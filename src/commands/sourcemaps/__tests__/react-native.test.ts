import fs from 'fs'
import os from 'os'
import path from 'path'

import {Cli} from 'clipanion/lib/advanced'

import {UploadStatus, upload} from '../../../helpers/upload'
import {version} from '../../../helpers/version'
import {UploadReactNativeCommand} from '../react-native'

jest.mock('../../../helpers/upload', () => {
  const actual = jest.requireActual('../../../helpers/upload')

  return {
    ...actual,
    upload: jest.fn(),
  }
})

describe('UploadReactNativeCommand', () => {
  const mockedUpload = upload as jest.MockedFunction<typeof upload>

  beforeEach(() => {
    mockedUpload.mockReset()
    process.env = {FLASHCAT_API_KEY: 'PLACEHOLDER'}
  })

  test('uploads multipart event metadata with bundle and sourcemap files', async () => {
    const {bundlePath, sourcemapPath} = createBundleFixtures()
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI([
      'sourcemaps',
      'upload-react-native',
      '--platform',
      'ios',
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--bundle',
      bundlePath,
      '--sourcemap',
      sourcemapPath,
    ])

    expect(code).toBe(0)
    expect(uploadImplementation).toHaveBeenCalledTimes(1)
    const [payload, options] = uploadImplementation.mock.calls[0]
    const event = payload.content.get('event')
    const bundle = payload.content.get('bundle')
    const sourceMap = payload.content.get('source_map')

    if (event?.type !== 'string') {
      throw new Error('event should be a string multipart value')
    }
    expect(event.options).toEqual({contentType: 'application/json'})
    expect(JSON.parse(event.value)).toEqual({
      type: 'react_native_sourcemap',
      service: 'my-app',
      version: '1.2.3',
      platform: 'ios',
      cli_version: version,
    })
    expect(bundle).toEqual({
      type: 'file',
      path: path.resolve(bundlePath),
      options: {filename: path.basename(bundlePath)},
    })
    expect(sourceMap).toEqual({
      type: 'file',
      path: path.resolve(sourcemapPath),
      options: {filename: path.basename(sourcemapPath)},
    })
    expect(options).toMatchObject({
      retries: 5,
      useGzip: true,
    })
  })

  test('supports the android platform', async () => {
    const {bundlePath, sourcemapPath} = createBundleFixtures()
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI([
      'sourcemaps',
      'upload-react-native',
      '--platform',
      'android',
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--bundle',
      bundlePath,
      '--sourcemap',
      sourcemapPath,
    ])

    expect(code).toBe(0)
    const [payload] = uploadImplementation.mock.calls[0]
    const event = payload.content.get('event')

    if (event?.type !== 'string') {
      throw new Error('event should be a string multipart value')
    }
    expect(JSON.parse(event.value)).toMatchObject({platform: 'android'})
  })

  test('rejects an invalid platform', async () => {
    const {bundlePath, sourcemapPath} = createBundleFixtures()

    const {code, context} = await runCLI([
      'sourcemaps',
      'upload-react-native',
      '--platform',
      'web',
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--bundle',
      bundlePath,
      '--sourcemap',
      sourcemapPath,
    ])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain('Invalid --platform: web')
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  test('returns non-zero when bundle path does not exist', async () => {
    const {sourcemapPath} = createBundleFixtures()
    const missingBundlePath = path.join(os.tmpdir(), `missing-bundle-${Date.now()}.jsbundle`)

    const {code, context} = await runCLI([
      'sourcemaps',
      'upload-react-native',
      '--platform',
      'ios',
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--bundle',
      missingBundlePath,
      '--sourcemap',
      sourcemapPath,
    ])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain(`File not found: ${path.resolve(missingBundlePath)}`)
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  test('returns non-zero when sourcemap path does not exist', async () => {
    const {bundlePath} = createBundleFixtures()
    const missingSourcemapPath = path.join(os.tmpdir(), `missing-sourcemap-${Date.now()}.map`)

    const {code, context} = await runCLI([
      'sourcemaps',
      'upload-react-native',
      '--platform',
      'ios',
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--bundle',
      bundlePath,
      '--sourcemap',
      missingSourcemapPath,
    ])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain(`File not found: ${path.resolve(missingSourcemapPath)}`)
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  test('dry run does not upload', async () => {
    const {bundlePath, sourcemapPath} = createBundleFixtures()

    const {code, context} = await runCLI([
      'sourcemaps',
      'upload-react-native',
      '--platform',
      'ios',
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--bundle',
      bundlePath,
      '--sourcemap',
      sourcemapPath,
      '--dry-run',
    ])

    expect(code).toBe(0)
    expect(context.stdout.toString()).toContain('[DRYRUN]')
    expect(context.stdout.toString()).toContain('platform=ios')
    expect(mockedUpload).not.toHaveBeenCalled()
  })
})

const runCLI = async (args: string[]) => {
  const cli = new Cli()
  cli.register(UploadReactNativeCommand)
  const context = createMockContext() as any
  const code = await cli.run(args, context)

  return {code, context}
}

const createMockContext = () => {
  let stdout = ''
  let stderr = ''

  return {
    stderr: {
      toString: () => stderr,
      write: (input: string) => {
        stderr += input
      },
    },
    stdout: {
      toString: () => stdout,
      write: (input: string) => {
        stdout += input
      },
    },
  }
}

const createBundleFixtures = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flashcat-react-native-test-'))
  const bundlePath = path.join(directory, 'index.bundle')
  const sourcemapPath = path.join(directory, 'index.bundle.map')
  fs.writeFileSync(bundlePath, 'bundle-content')
  fs.writeFileSync(sourcemapPath, 'sourcemap-content')

  return {bundlePath, sourcemapPath}
}
