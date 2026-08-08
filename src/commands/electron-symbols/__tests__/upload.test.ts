import fs from 'fs'
import os from 'os'
import path from 'path'

import {Cli} from 'clipanion/lib/advanced'

import {UploadStatus, upload} from '../../../helpers/upload'
import {version} from '../../../helpers/version'
import {UploadCommand, readModuleHeader} from '../upload'

jest.mock('../../../helpers/upload', () => {
  const actual = jest.requireActual('../../../helpers/upload')

  return {
    ...actual,
    upload: jest.fn(),
  }
})

// A minimal but well-formed Breakpad symbol file. The module name is the remainder of the
// MODULE line, so the macOS case deliberately carries a space.
const symFile = (osName: string, arch: string, debugId: string, name: string) =>
  [`MODULE ${osName} ${arch} ${debugId} ${name}`, 'FILE 0 /src/a.cc', 'FUNC 1000 100 0 some_function', '1000 10 42 0', ''].join(
    '\n'
  )

const MAC_SYM = symFile('mac', 'arm64', '1A2B3C4D5E6F70819AC0DE00000000000', 'Electron Framework')
const WIN_SYM = symFile('windows', 'x86_64', 'E3A1B2C4D5E6F708192A3B4C5D6E7F801', 'electron.exe.pdb')

describe('electron-symbols upload', () => {
  const mockedUpload = upload as jest.MockedFunction<typeof upload>

  beforeEach(() => {
    mockedUpload.mockReset()
    process.env = {FLASHCAT_API_KEY: 'PLACEHOLDER'}
  })

  test('uploads each .sym under the symbol_file field with the event metadata', async () => {
    const dir = createFixture({'ElectronFramework.sym': MAC_SYM, 'electron.exe.sym': WIN_SYM})
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI(['electron-symbols', 'upload', dir, '--service', 'my-app', '--release-version', '1.2.3'])

    expect(code).toBe(0)
    expect(uploadImplementation).toHaveBeenCalledTimes(2)

    const events = uploadImplementation.mock.calls.map(([payload]) => {
      const event = payload.content.get('event')
      if (event?.type !== 'string') {
        throw new Error('event should be a string multipart value')
      }
      expect(event.options).toEqual({contentType: 'application/json'})

      const file = payload.content.get('symbol_file')
      expect(file?.type).toBe('file')

      return JSON.parse(event.value)
    })

    // Every upload carries the same metadata: the platform, architecture and module id all
    // come from the file itself on the server side, so they are deliberately absent here.
    for (const event of events) {
      expect(event).toEqual({
        cli_version: version,
        service: 'my-app',
        type: 'electron_symbol_file',
        version: '1.2.3',
      })
    }

    const [, options] = uploadImplementation.mock.calls[0]
    expect(options).toMatchObject({retries: 5, useGzip: true})
  })

  test('finds symbol files in nested directories', async () => {
    const dir = createFixture({'breakpad_symbols/Electron Framework/ABC/ElectronFramework.sym': MAC_SYM})
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code} = await runCLI(['electron-symbols', 'upload', dir, '--service', 'my-app', '--release-version', '1.0.0'])

    expect(code).toBe(0)
    expect(uploadImplementation).toHaveBeenCalledTimes(1)
  })

  test('dry-run reports the parsed module without uploading', async () => {
    const dir = createFixture({'ElectronFramework.sym': MAC_SYM})
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code, context} = await runCLI([
      'electron-symbols',
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
    expect(context.stdout.toString()).toContain('module=Electron Framework')
    expect(context.stdout.toString()).toContain('os=mac')
  })

  // A .sym extension is not proof of a Breakpad file. Skipping locally turns a directory of
  // stray files into a clear message instead of a run of server-side rejections.
  test('skips files that are not Breakpad symbol files but uploads the rest', async () => {
    const dir = createFixture({
      'ElectronFramework.sym': MAC_SYM,
      'notes.sym': 'this is not a symbol file\n',
    })
    const uploadImplementation = jest.fn().mockResolvedValue(UploadStatus.Success)
    mockedUpload.mockReturnValue(uploadImplementation)

    const {code, context} = await runCLI(['electron-symbols', 'upload', dir, '--service', 'my-app', '--release-version', '1.0.0'])

    expect(code).toBe(0)
    expect(uploadImplementation).toHaveBeenCalledTimes(1)
    expect(context.stdout.toString()).toContain('Skipping notes.sym')
    expect(context.stdout.toString()).toContain('1 skipped')
  })

  test('errors when the directory holds no .sym files', async () => {
    const dir = createFixture({'readme.txt': 'nothing here'})

    const {code, context} = await runCLI(['electron-symbols', 'upload', dir, '--service', 'my-app', '--release-version', '1.0.0'])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain('No .sym files found')
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  test('errors when every .sym turns out not to be a symbol file', async () => {
    const dir = createFixture({'notes.sym': 'this is not a symbol file\n'})

    const {code, context} = await runCLI(['electron-symbols', 'upload', dir, '--service', 'my-app', '--release-version', '1.0.0'])

    expect(code).toBe(1)
    expect(context.stderr.toString()).toContain('MODULE header')
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  test('requires --service and --release-version', async () => {
    const dir = createFixture({'ElectronFramework.sym': MAC_SYM})

    expect((await runCLI(['electron-symbols', 'upload', dir])).code).toBe(1)
    expect((await runCLI(['electron-symbols', 'upload', dir, '--service', 'my-app'])).code).toBe(1)
    expect((await runCLI(['electron-symbols', 'upload', dir, '--release-version', '1.0.0'])).code).toBe(1)
  })
})

describe('readModuleHeader', () => {
  test('parses a module name containing spaces', async () => {
    const dir = createFixture({'a.sym': MAC_SYM})
    const parsed = await readModuleHeader(path.join(dir, 'a.sym'))

    expect(parsed).toEqual({
      arch: 'arm64',
      moduleName: 'Electron Framework',
      os: 'mac',
      path: path.join(dir, 'a.sym'),
    })
  })

  test('parses a windows module', async () => {
    const dir = createFixture({'b.sym': WIN_SYM})
    const parsed = await readModuleHeader(path.join(dir, 'b.sym'))

    expect(parsed?.os).toBe('windows')
    expect(parsed?.moduleName).toBe('electron.exe.pdb')
  })

  test('tolerates CRLF line endings', async () => {
    const dir = createFixture({'c.sym': MAC_SYM.split('\n').join('\r\n')})
    const parsed = await readModuleHeader(path.join(dir, 'c.sym'))

    expect(parsed?.moduleName).toBe('Electron Framework')
  })

  test('returns undefined for a file that is not a symbol file', async () => {
    const dir = createFixture({'d.sym': 'MODULE\n', 'e.sym': '', 'f.sym': '\x7fELF\x02\x01binary'})

    expect(await readModuleHeader(path.join(dir, 'd.sym'))).toBeUndefined()
    expect(await readModuleHeader(path.join(dir, 'e.sym'))).toBeUndefined()
    expect(await readModuleHeader(path.join(dir, 'f.sym'))).toBeUndefined()
  })

  test('returns undefined for a missing file rather than throwing', async () => {
    expect(await readModuleHeader(path.join(os.tmpdir(), 'definitely-absent.sym'))).toBeUndefined()
  })
})

const runCLI = async (args: string[]) => {
  const cli = new Cli()
  cli.register(UploadCommand)
  const context = createMockContext() as any
  const code = await cli.run(args, context)

  return {code, context}
}

const createFixture = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashcat-electron-test-'))
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name)
    fs.mkdirSync(path.dirname(target), {recursive: true})
    fs.writeFileSync(target, content)
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
