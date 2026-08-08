import fs from 'fs'
import path from 'path'
import readline from 'readline'

import chalk from 'chalk'
import {Command, Option} from 'clipanion'
import {glob} from 'glob'

import {ApiKeyValidator, newApiKeyValidator} from '../../helpers/apikey'
import {getBaseSourcemapIntakeUrl} from '../../helpers/base-intake-url'
import {doWithMaxConcurrency} from '../../helpers/concurrency'
import {InvalidConfigurationError} from '../../helpers/errors'
import {RequestBuilder} from '../../helpers/interfaces'
import {MultipartPayload, MultipartValue, UploadStatus, upload} from '../../helpers/upload'
import {buildPath, getRequestBuilder} from '../../helpers/utils'
import {version} from '../../helpers/version'

// A Breakpad symbol file opens with:
//   MODULE <os> <arch> <debug_id> <name>
// The name may contain spaces (on macOS the most common module is "Electron Framework"),
// so it is the whole remainder of the line.
const MODULE_LINE_RE = /^MODULE (\S+) (\S+) ([0-9a-fA-F]{32,}) (.+)$/

// Reading a few hundred bytes is enough to reach the end of the first line of any
// well-formed symbol file. A file that needs more than this is not one.
const MAX_HEADER_BYTES = 4096

export interface ElectronSymbolFile {
  path: string
  os: string
  arch: string
  moduleName: string
}

/**
 * Reads the MODULE header of a Breakpad symbol file.
 *
 * This is only used to skip files that are not symbol files and to label progress output.
 * The debug id is deliberately NOT sent to the server: the server reads it from the file
 * it actually stores, so there is no way for a mismatch between what we claim and what
 * gets indexed.
 */
export const readModuleHeader = async (filePath: string): Promise<ElectronSymbolFile | undefined> => {
  let stream: fs.ReadStream | undefined
  try {
    stream = fs.createReadStream(filePath, {encoding: 'utf8', end: MAX_HEADER_BYTES, start: 0})
    const lines = readline.createInterface({crlfDelay: Infinity, input: stream})
    for await (const line of lines) {
      lines.close()
      const match = MODULE_LINE_RE.exec(line.trim())
      if (!match) {
        return undefined
      }

      return {arch: match[2], moduleName: match[4], os: match[1], path: filePath}
    }

    return undefined
  } catch {
    return undefined
  } finally {
    stream?.destroy()
  }
}

export class UploadCommand extends Command {
  public static paths = [['electron-symbols', 'upload']]

  public static usage = Command.Usage({
    category: 'RUM',
    description: 'Upload Electron Breakpad symbols to Flashcat for native crash symbolication.',
    details: `
      Point this at a directory of Breakpad symbol files (.sym). Every file found is
      uploaded; the server reads each file's own module id and uses it to symbolicate
      matching native crash stacks at query time.

      Most frames in an Electron crash land in Electron's own binaries rather than in your
      code, so start with the symbols Electron publishes for the exact version, platform
      and architecture you ship:

        electron-v<version>-<platform>-<arch>-symbols.zip

      For your own native modules or .node addons, generate a .sym with dump_syms and put
      it in the same directory.

      Symbols are matched on the module id alone. --service and --release-version only
      label the upload so it can be found in the console later; they do not affect whether
      a symbol file matches a crash.
    `,
    examples: [
      [
        'Upload Electron symbols for a release',
        'flashcat-cli electron-symbols upload ./breakpad_symbols --service my-app --release-version 1.2.3',
      ],
    ],
  })

  private basePath = Option.String({required: true})
  private service = Option.String('--service')
  private releaseVersion = Option.String('--release-version')
  // The intake serializes native symbol uploads per service, so requests beyond the first
  // are rejected rather than queued. Default to one at a time; raising this trades a
  // successful upload for a faster failure.
  private maxConcurrency = Option.String('--max-concurrency', '1')
  private dryRun = Option.Boolean('--dry-run', false)
  private quiet = Option.Boolean('--quiet', false)

  private cliVersion = version

  private config = {
    apiKey: process.env.FLASHCAT_API_KEY,
    flashcatSite: process.env.FLASHCAT_SITE || 'flashcat.cloud',
  }

  public async execute() {
    if (!this.service) {
      this.context.stderr.write('Missing --service\n')

      return 1
    }
    if (!this.releaseVersion) {
      this.context.stderr.write('Missing --release-version\n')

      return 1
    }

    const candidates = glob.sync(buildPath(this.basePath, '**/*.sym'))
    if (candidates.length === 0) {
      this.context.stderr.write(
        `No .sym files found under ${path.resolve(this.basePath)}. ` +
          `Unpack Electron's electron-v<version>-<platform>-<arch>-symbols.zip and point at that directory.\n`
      )

      return 1
    }

    const files: ElectronSymbolFile[] = []
    let skipped = 0
    for (const candidate of candidates) {
      const parsed = await readModuleHeader(candidate)
      if (parsed) {
        files.push(parsed)
      } else {
        skipped++
        if (!this.quiet) {
          this.context.stdout.write(`Skipping ${path.basename(candidate)}: not a Breakpad symbol file.\n`)
        }
      }
    }

    if (files.length === 0) {
      this.context.stderr.write(
        `None of the ${candidates.length} .sym file(s) under ${path.resolve(this.basePath)} start with a ` +
          `MODULE header, so none of them are Breakpad symbol files.\n`
      )

      return 1
    }

    if (this.dryRun) {
      for (const f of files) {
        this.context.stdout.write(
          `[DRYRUN] would upload ${f.path} (module=${f.moduleName}, os=${f.os}, arch=${f.arch}, ` +
            `service=${this.service}, version=${this.releaseVersion})\n`
        )
      }

      return 0
    }

    const apiKeyValidator = newApiKeyValidator({
      apiKey: this.config.apiKey,
      flashcatSite: this.config.flashcatSite,
    })
    const requestBuilder = this.getRequestBuilder()

    try {
      const results = await doWithMaxConcurrency(Math.max(1, parseInt(this.maxConcurrency, 10) || 1), files, (f) =>
        this.uploadSymbolFile(requestBuilder, apiKeyValidator)(f)
      )

      if (results.some((r) => r !== UploadStatus.Success)) {
        return 1
      }

      if (!this.quiet) {
        const skippedNote = skipped > 0 ? ` (${skipped} skipped)` : ''
        this.context.stdout.write(`Uploaded ${files.length} Electron symbol file(s)${skippedNote}.\n`)
      }

      return 0
    } catch (error) {
      if (error instanceof InvalidConfigurationError) {
        this.context.stderr.write(`${error.message}\n`)

        return 1
      }

      throw error
    }
  }

  private asMultipartPayload(file: ElectronSymbolFile): MultipartPayload {
    const eventMeta: Record<string, string> = {
      cli_version: this.cliVersion,
      service: this.service!,
      type: 'electron_symbol_file',
      version: this.releaseVersion!,
    }

    const content = new Map<string, MultipartValue>([
      [
        'event',
        {
          type: 'string',
          options: {contentType: 'application/json'},
          value: JSON.stringify(eventMeta),
        },
      ],
      [
        'symbol_file',
        {
          type: 'file',
          path: file.path,
          options: {filename: path.basename(file.path)},
        },
      ],
    ])

    return {content}
  }

  private getRequestBuilder(): RequestBuilder {
    if (!this.config.apiKey) {
      throw new InvalidConfigurationError(`Missing ${chalk.bold('FLASHCAT_API_KEY')} in your environment.`)
    }

    return getRequestBuilder({
      apiKey: this.config.apiKey,
      baseUrl: getBaseSourcemapIntakeUrl(this.config.flashcatSite),
      headers: new Map([
        ['DD-EVP-ORIGIN', 'flashcat-cli_electron'],
        ['DD-EVP-ORIGIN-VERSION', this.cliVersion],
      ]),
      overrideUrl: '/sourcemap/upload',
    })
  }

  private uploadSymbolFile(
    requestBuilder: RequestBuilder,
    apiKeyValidator: ApiKeyValidator
  ): (file: ElectronSymbolFile) => Promise<UploadStatus> {
    return async (file: ElectronSymbolFile) =>
      upload(requestBuilder)(this.asMultipartPayload(file), {
        apiKeyValidator,
        onError: (e) => {
          this.context.stderr.write(`Upload failed for ${path.basename(file.path)}: ${e.message}\n`)
        },
        onRetry: (e, attempts) => {
          if (!this.quiet) {
            this.context.stdout.write(`Retry ${attempts} for ${path.basename(file.path)}: ${e.message}\n`)
          }
        },
        onUpload: () => {
          if (!this.quiet) {
            this.context.stdout.write(`Uploading ${file.moduleName} (${file.os}/${file.arch})...\n`)
          }
        },
        retries: 5,
        useGzip: true,
      })
  }
}
