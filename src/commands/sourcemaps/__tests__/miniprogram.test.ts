import fs from 'fs'
import os from 'os'
import path from 'path'

import {Cli} from 'clipanion/lib/advanced'

import {UploadStatus, upload} from '../../../helpers/upload'
import {version} from '../../../helpers/version'
import {UploadMiniprogramCommand} from '../miniprogram'

jest.mock('../../../helpers/upload', () => {
  const actual = jest.requireActual('../../../helpers/upload')

  return {
    ...actual,
    upload: jest.fn(),
  }
})

describe('UploadMiniprogramCommand', () => {
  const mockedUpload = upload as jest.MockedFunction<typeof upload>

  beforeEach(() => {
    mockedUpload.mockReset()
    process.env = {FLASHCAT_API_KEY: 'PLACEHOLDER'}
  })

  test('uploads multipart event metadata and sourcemap archive', async () => {
    const zipPath = createZipFixture()
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI([
      'sourcemaps',
      'upload-miniprogram',
      '--service',
      'my-mp',
      '--release-version',
      '1.2.3',
      '--sourcemap-zip',
      zipPath,
      '--appid',
      'wxbad3e0a65782821c',
    ])

    expect(code).toBe(0)
    expect(uploadImplementation).toHaveBeenCalledTimes(1)
    const [payload, options] = uploadImplementation.mock.calls[0]
    const event = payload.content.get('event')
    const archive = payload.content.get('sourcemap_archive')

    if (event?.type !== 'string') {
      throw new Error('event should be a string multipart value')
    }
    expect(event.options).toEqual({contentType: 'application/json'})
    expect(JSON.parse(event.value)).toEqual({
      type: 'miniprogram_sourcemap',
      service: 'my-mp',
      version: '1.2.3',
      appid: 'wxbad3e0a65782821c',
      cli_version: version,
    })
    expect(archive).toEqual({
      type: 'file',
      path: path.resolve(zipPath),
      options: {filename: 'sourcemap.zip'},
    })
    expect(options).toMatchObject({
      retries: 5,
      useGzip: true,
    })
  })

  test('omits appid from event metadata when not provided', async () => {
    const zipPath = createZipFixture()
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI([
      'sourcemaps',
      'upload-miniprogram',
      '--service',
      'my-mp',
      '--release-version',
      '1.2.3',
      '--sourcemap-zip',
      zipPath,
    ])

    expect(code).toBe(0)
    const [payload] = uploadImplementation.mock.calls[0]
    const event = payload.content.get('event')

    expect(event?.type).toBe('string')
    if (event?.type !== 'string') {
      throw new Error('event should be a string multipart value')
    }
    expect(JSON.parse(event.value)).toEqual({
      type: 'miniprogram_sourcemap',
      service: 'my-mp',
      version: '1.2.3',
      cli_version: version,
    })
    expect(JSON.parse(event.value)).not.toHaveProperty('appid')
  })

  test("returns non-zero when zip path doesn't exist", async () => {
    const missingZipPath = path.join(os.tmpdir(), `missing-sourcemap-${Date.now()}.zip`)

    const {code, context} = await runCLI([
      'sourcemaps',
      'upload-miniprogram',
      '--service',
      'my-mp',
      '--release-version',
      '1.2.3',
      '--sourcemap-zip',
      missingZipPath,
    ])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain(`File not found: ${path.resolve(missingZipPath)}`)
    expect(mockedUpload).not.toHaveBeenCalled()
  })
})

const runCLI = async (args: string[]) => {
  const cli = new Cli()
  cli.register(UploadMiniprogramCommand)
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

const createZipFixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flashcat-miniprogram-test-'))
  const zipPath = path.join(directory, 'sourcemap.zip')
  fs.writeFileSync(zipPath, 'zip-content')

  return zipPath
}
