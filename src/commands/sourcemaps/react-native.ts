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

const REACT_NATIVE_PLATFORMS = ['ios', 'android']

// The bundle name each platform loads at runtime unless the app overrides it.
// Symbolication matches stack frames against the uploaded file name, so an
// upload renamed in CI (a unified --bundle-output is common) never matches.
const DEFAULT_RUNTIME_BUNDLE_NAMES: Record<string, string> = {
  android: 'index.android.bundle',
  ios: 'main.jsbundle',
}

export class UploadReactNativeCommand extends Command {
  public static paths = [['sourcemaps', 'upload-react-native']]

  public static usage = Command.Usage({
    category: 'RUM',
    description: 'Upload a React Native JavaScript bundle and its sourcemap to Flashcat.',
    details: `
      Provide the JS bundle and the sourcemap produced by the React Native bundler (Metro).
      Both files are sent in one multipart request; the server indexes them by service + version + platform.
    `,
    examples: [
      [
        'Upload an iOS React Native sourcemap',
        'flashcat-cli sourcemaps upload-react-native --platform ios --service my-app --release-version 1.2.3 --bundle ./main.jsbundle --sourcemap ./main.jsbundle.map',
      ],
      [
        'Upload an Android React Native sourcemap',
        'flashcat-cli sourcemaps upload-react-native --platform android --service my-app --release-version 1.2.3 --bundle ./index.android.bundle --sourcemap ./index.android.bundle.map',
      ],
    ],
  })

  private platform = Option.String('--platform')
  private service = Option.String('--service')
  private releaseVersion = Option.String('--release-version')
  private buildVersion = Option.String('--build-version')
  private bundle = Option.String('--bundle')
  private sourcemap = Option.String('--sourcemap')
  private dryRun = Option.Boolean('--dry-run', false)
  private quiet = Option.Boolean('--quiet', false)

  private cliVersion = version

  private config = {
    apiKey: process.env.FLASHCAT_API_KEY,
    flashcatSite: process.env.FLASHCAT_SITE || 'flashcat.cloud',
  }

  public async execute() {
    if (!this.platform) {
      this.context.stderr.write('Missing --platform\n')

      return 1
    }
    if (!REACT_NATIVE_PLATFORMS.includes(this.platform)) {
      this.context.stderr.write(`Invalid --platform: ${this.platform} (expected one of ${REACT_NATIVE_PLATFORMS.join(', ')})\n`)

      return 1
    }
    if (!this.service) {
      this.context.stderr.write('Missing --service\n')

      return 1
    }
    if (!this.releaseVersion) {
      this.context.stderr.write('Missing --release-version\n')

      return 1
    }
    if (!this.bundle) {
      this.context.stderr.write('Missing --bundle\n')

      return 1
    }
    if (!this.sourcemap) {
      this.context.stderr.write('Missing --sourcemap\n')

      return 1
    }

    const bundlePath = path.resolve(this.bundle)
    if (!fs.existsSync(bundlePath)) {
      this.context.stderr.write(`File not found: ${bundlePath}\n`)

      return 1
    }
    const sourcemapPath = path.resolve(this.sourcemap)
    if (!fs.existsSync(sourcemapPath)) {
      this.context.stderr.write(`File not found: ${sourcemapPath}\n`)

      return 1
    }

    // Warn, never block: apps that override the runtime bundle name are a
    // legitimate case, but a name that only differs on the upload side means
    // the sourcemap will never be hit.
    const bundleName = path.basename(bundlePath)
    const runtimeName = DEFAULT_RUNTIME_BUNDLE_NAMES[this.platform]
    if (bundleName !== runtimeName) {
      this.context.stderr.write(
        chalk.yellow(
          `Warning: bundle file name '${bundleName}' is not the default ${this.platform} runtime bundle name '${runtimeName}'.\n` +
            `Symbolication matches stack frames by file name, so the uploaded name must equal the name the app loads at runtime.\n` +
            `If your app loads '${runtimeName}', rename the file before uploading; if it really loads '${bundleName}', ignore this warning.\n`
        )
      )
    }

    const apiKeyValidator = newApiKeyValidator({
      apiKey: this.config.apiKey,
      flashcatSite: this.config.flashcatSite,
    })
    const requestBuilder = this.getRequestBuilder()
    const payload = this.asMultipartPayload(bundlePath, sourcemapPath)

    if (this.dryRun) {
      this.context.stdout.write(
        `[DRYRUN] would upload ${bundlePath} and ${sourcemapPath} (service=${this.service}, version=${this.releaseVersion}, platform=${this.platform})\n`
      )

      return 0
    }

    try {
      const result = await this.uploadReactNativeBundle(requestBuilder, apiKeyValidator)(payload, bundlePath, sourcemapPath)

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

  private asMultipartPayload(bundlePath: string, sourcemapPath: string): MultipartPayload {
    const eventMeta: Record<string, string> = {
      type: 'react_native_sourcemap',
      service: this.service!,
      version: this.releaseVersion!,
      platform: this.platform!,
      cli_version: this.cliVersion,
    }
    if (this.buildVersion) {
      eventMeta.build_version = this.buildVersion
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
        'bundle',
        {
          type: 'file',
          path: bundlePath,
          options: {filename: path.basename(bundlePath)},
        },
      ],
      [
        'source_map',
        {
          type: 'file',
          path: sourcemapPath,
          options: {filename: path.basename(sourcemapPath)},
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
        ['DD-EVP-ORIGIN', 'flashcat-cli_react-native'],
        ['DD-EVP-ORIGIN-VERSION', this.cliVersion],
      ]),
      overrideUrl: '/sourcemap/upload',
    })
  }

  private uploadReactNativeBundle(
    requestBuilder: RequestBuilder,
    apiKeyValidator: ApiKeyValidator
  ): (payload: MultipartPayload, bundlePath: string, sourcemapPath: string) => Promise<UploadStatus> {
    return async (payload: MultipartPayload, bundlePath: string, sourcemapPath: string) =>
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
            this.context.stdout.write(`Uploading ${path.basename(bundlePath)} and ${path.basename(sourcemapPath)}...\n`)
          }
        },
        retries: 5,
        useGzip: true,
      })
  }
}
