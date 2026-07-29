import fs from 'fs'
import os from 'os'
import path from 'path'

import {Cli} from 'clipanion/lib/advanced'

import {UploadStatus, upload} from '../../../helpers/upload'
import {version} from '../../../helpers/version'
import {UploadCommand} from '../upload'

jest.mock('../../../helpers/upload', () => {
  const actual = jest.requireActual('../../../helpers/upload')

  return {
    ...actual,
    upload: jest.fn(),
  }
})

describe('flutter-symbols upload', () => {
  const mockedUpload = upload as jest.MockedFunction<typeof upload>

  beforeEach(() => {
    mockedUpload.mockReset()
    process.env = {FLASHCAT_API_KEY: 'PLACEHOLDER'}
  })

  test('uploads each app.<platform>-<arch>.symbols with parsed metadata', async () => {
    const dir = createSymbolsFixture(['app.android-arm64.symbols', 'app.ios-arm64.symbols'])
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI([
      'flutter-symbols',
      'upload',
      dir,
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
    ])

    expect(code).toBe(0)
    expect(uploadImplementation).toHaveBeenCalledTimes(2)

    const events = uploadImplementation.mock.calls.map(([payload]) => {
      const event = payload.content.get('event')
      if (event?.type !== 'string') {
        throw new Error('event should be a string multipart value')
      }
      expect(event.options).toEqual({contentType: 'application/json'})

      const file = payload.content.get('flutter_symbol_file')
      expect(file?.type).toBe('file')

      return JSON.parse(event.value)
    })

    const byArch = Object.fromEntries(events.map((e) => [`${e.platform}-${e.arch}`, e]))
    expect(byArch['android-arm64']).toEqual({
      type: 'flutter_symbol_file',
      service: 'my-app',
      version: '1.2.3',
      flavor: 'release',
      platform: 'android',
      arch: 'arm64',
      cli_version: version,
    })
    expect(byArch['ios-arm64'].platform).toBe('ios')

    const [, options] = uploadImplementation.mock.calls[0]
    expect(options).toMatchObject({retries: 5, useGzip: true})
  })

  test('dry-run reports files without uploading', async () => {
    const dir = createSymbolsFixture(['app.android-arm.symbols'])
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code, context} = await runCLI([
      'flutter-symbols',
      'upload',
      dir,
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
      '--dry-run',
    ])

    expect(code).toBe(0)
    expect(uploadImplementation).not.toHaveBeenCalled()
    expect(context.stdout.toString()).toContain('[DRYRUN]')
    expect(context.stdout.toString()).toContain('platform=android')
  })

  test('ignores non-symbol files and errors when none found', async () => {
    const dir = createSymbolsFixture(['not-a-symbol.txt', 'app.web-x64.symbols'])

    const {code, context} = await runCLI([
      'flutter-symbols',
      'upload',
      dir,
      '--service',
      'my-app',
      '--release-version',
      '1.2.3',
    ])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain('No app.<platform>-<arch>.symbols files found')
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  test('requires --service and --release-version', async () => {
    const dir = createSymbolsFixture(['app.android-arm64.symbols'])

    const {code} = await runCLI(['flutter-symbols', 'upload', dir])
    expect(code).toBe(1)
  })
})

const runCLI = async (args: string[]) => {
  const cli = new Cli()
  cli.register(UploadCommand)
  const context = createMockContext() as any
  const code = await cli.run(args, context)

  return {code, context}
}

const createSymbolsFixture = (names: string[]) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashcat-flutter-test-'))
  for (const name of names) {
    fs.writeFileSync(path.join(dir, name), 'symbol-content')
  }

  return dir
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
