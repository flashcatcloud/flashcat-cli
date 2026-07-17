import path from 'path'

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

// A Flutter symbol file is named app.<platform>-<arch>.symbols, produced by
// `flutter build --obfuscate --split-debug-info=<dir>` (one per built architecture).
const SYMBOL_FILE_RE = /^app\.(android|ios)-(arm|arm64|x64)\.symbols$/

interface FlutterSymbolFile {
  path: string
  platform: string
  arch: string
}

export class UploadCommand extends Command {
  public static paths = [['flutter-symbols', 'upload']]

  public static usage = Command.Usage({
    category: 'RUM',
    description: 'Upload Flutter (Dart AOT) debug symbols to Flashcat for crash de-obfuscation.',
    details: `
      Point this at the --split-debug-info directory of an obfuscated release build.
      It uploads every app.<platform>-<arch>.symbols file found there; the server extracts
      each file's build-id and symbolicates matching obfuscated stacks at query time.

      Build with:
        flutter build apk --obfuscate --split-debug-info=<dir>
        flutter build ipa --obfuscate --split-debug-info=<dir>
    `,
    examples: [
      [
        'Upload Flutter symbols for a release',
        'flashcat-cli flutter-symbols upload ./debug-symbols --service my-app --release-version 1.2.3',
      ],
    ],
  })

  private basePath = Option.String({required: true})
  private service = Option.String('--service')
  private releaseVersion = Option.String('--release-version')
  private flavor = Option.String('--flavor', 'release')
  private maxConcurrency = Option.String('--max-concurrency', '20')
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

    const files = this.findSymbolFiles()
    if (files.length === 0) {
      this.context.stderr.write(
        `No app.<platform>-<arch>.symbols files found under ${path.resolve(this.basePath)}. ` +
          `Build with --obfuscate --split-debug-info=<dir> and point at that dir.\n`
      )

      return 1
    }

    if (this.dryRun) {
      for (const f of files) {
        this.context.stdout.write(
          `[DRYRUN] would upload ${f.path} (platform=${f.platform}, arch=${f.arch}, service=${this.service}, version=${this.releaseVersion})\n`
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
      const results = await doWithMaxConcurrency(Math.max(1, parseInt(this.maxConcurrency, 10) || 20), files, (f) =>
        this.uploadSymbolFile(requestBuilder, apiKeyValidator)(f)
      )

      if (results.some((r) => r !== UploadStatus.Success)) {
        return 1
      }

      if (!this.quiet) {
        this.context.stdout.write(`Uploaded ${files.length} Flutter symbol file(s).\n`)
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

  private findSymbolFiles(): FlutterSymbolFile[] {
    const matches = glob.sync(buildPath(this.basePath, '**/app.*.symbols'))

    return matches.reduce<FlutterSymbolFile[]>((acc, filePath) => {
      const m = SYMBOL_FILE_RE.exec(path.basename(filePath))
      if (m) {
        acc.push({path: filePath, platform: m[1], arch: m[2]})
      }

      return acc
    }, [])
  }

  private asMultipartPayload(file: FlutterSymbolFile): MultipartPayload {
    const eventMeta: Record<string, string> = {
      type: 'flutter_symbol_file',
      service: this.service!,
      version: this.releaseVersion!,
      flavor: this.flavor,
      platform: file.platform,
      arch: file.arch,
      cli_version: this.cliVersion,
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
        'flutter_symbol_file',
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
        ['DD-EVP-ORIGIN', 'flashcat-cli_flutter'],
        ['DD-EVP-ORIGIN-VERSION', this.cliVersion],
      ]),
      overrideUrl: '/sourcemap/upload',
    })
  }

  private uploadSymbolFile(
    requestBuilder: RequestBuilder,
    apiKeyValidator: ApiKeyValidator
  ): (file: FlutterSymbolFile) => Promise<UploadStatus> {
    return async (file: FlutterSymbolFile) =>
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
            this.context.stdout.write(`Uploading ${path.basename(file.path)} (${file.platform}/${file.arch})...\n`)
          }
        },
        retries: 5,
        useGzip: true,
      })
  }
}
