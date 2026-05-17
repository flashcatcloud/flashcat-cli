import fs from 'fs'
import path from 'path'

import chalk from 'chalk'
import {Command, Option} from 'clipanion'

import {ApiKeyValidator, newApiKeyValidator} from '../../helpers/apikey'
import {getBaseSourcemapIntakeUrl} from '../../helpers/base-intake-url'
import {InvalidConfigurationError} from '../../helpers/errors'
import {RequestBuilder} from '../../helpers/interfaces'
import {MultipartPayload, MultipartValue, UploadStatus, upload} from '../../helpers/upload'
import {getRequestBuilder} from '../../helpers/utils'
import {version} from '../../helpers/version'

export class UploadMiniprogramCommand extends Command {
  public static paths = [['sourcemaps', 'upload-miniprogram']]

  public static usage = Command.Usage({
    category: 'RUM',
    description: 'Upload a WeChat miniprogram sourcemap zip (from miniprogram-ci getDevSourceMap) to Flashcat.',
    details: `
      Provide the sourcemap.zip produced by 'miniprogram-ci getDevSourceMap'.
      The whole zip is sent as one multipart request; the server unzips and indexes each .js.map entry.
    `,
    examples: [
      [
        'Upload a miniprogram sourcemap',
        'flashcat-cli sourcemaps upload-miniprogram --service my-mp --release-version 1.2.3 --sourcemap-zip ./sourcemap.zip',
      ],
    ],
  })

  private service = Option.String('--service')
  private releaseVersion = Option.String('--release-version')
  private sourcemapZip = Option.String('--sourcemap-zip')
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
    if (!this.sourcemapZip) {
      this.context.stderr.write('Missing --sourcemap-zip\n')

      return 1
    }

    const zipPath = path.resolve(this.sourcemapZip)
    if (!fs.existsSync(zipPath)) {
      this.context.stderr.write(`File not found: ${zipPath}\n`)

      return 1
    }

    const apiKeyValidator = newApiKeyValidator({
      apiKey: this.config.apiKey,
      flashcatSite: this.config.flashcatSite,
    })
    const requestBuilder = this.getRequestBuilder()
    const payload = this.asMultipartPayload(zipPath)

    if (this.dryRun) {
      this.context.stdout.write(
        `[DRYRUN] would upload ${zipPath} (service=${this.service}, version=${this.releaseVersion})\n`
      )

      return 0
    }

    try {
      const result = await this.uploadMiniprogramArchive(requestBuilder, apiKeyValidator)(payload, zipPath)

      if (result === UploadStatus.Success) {
        if (!this.quiet) {
          this.context.stdout.write('Upload succeeded.\n')
        }

        return 0
      }

      return 1
    } catch (error) {
      if (error instanceof InvalidConfigurationError) {
        this.context.stderr.write(`${error.message}\n`)

        return 1
      }

      throw error
    }
  }

  private asMultipartPayload(zipPath: string): MultipartPayload {
    const eventMeta: Record<string, string> = {
      type: 'miniprogram_sourcemap',
      service: this.service!,
      version: this.releaseVersion!,
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
        'sourcemap_archive',
        {
          type: 'file',
          path: zipPath,
          options: {filename: 'sourcemap.zip'},
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
        ['DD-EVP-ORIGIN', 'flashcat-cli_miniprogram'],
        ['DD-EVP-ORIGIN-VERSION', this.cliVersion],
      ]),
      overrideUrl: '/sourcemap/upload',
    })
  }

  private uploadMiniprogramArchive(
    requestBuilder: RequestBuilder,
    apiKeyValidator: ApiKeyValidator
  ): (payload: MultipartPayload, zipPath: string) => Promise<UploadStatus> {
    return async (payload: MultipartPayload, zipPath: string) =>
      upload(requestBuilder)(payload, {
        apiKeyValidator,
        onError: (e) => {
          this.context.stderr.write(`Upload failed: ${e.message}\n`)
        },
        onRetry: (e, attempts) => {
          if (!this.quiet) {
            this.context.stdout.write(`Retry ${attempts}: ${e.message}\n`)
          }
        },
        onUpload: () => {
          if (!this.quiet) {
            this.context.stdout.write(`Uploading ${path.basename(zipPath)}...\n`)
          }
        },
        retries: 5,
        useGzip: true,
      })
  }
}
