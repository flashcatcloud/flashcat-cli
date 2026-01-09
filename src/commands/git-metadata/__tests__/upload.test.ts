import os from 'os'

import {Cli} from 'clipanion/lib/advanced'

import {UploadCommand} from '../upload'
import { CommandContext } from 'src/helpers/interfaces'

export const createMockContext = (appendStdoutWithStderr = true): CommandContext => {
  let out = ''
  let err = ''

  return {
    stdout: {
      toString: () => out,
      write: (chunk: string) => {
        out += chunk
      },
    },
    stderr: {
      toString: () => err,
      write: (chunk: string) => {
        err += chunk
        // This is solely for testing purposes: it's easier to check only `stdout` against snapshots.
        // This way, `context.stdout.toString()` looks like what a user would see in their terminal.
        if (appendStdoutWithStderr) {
          out += chunk
        }
      },
    },
  } as CommandContext
}


describe('execute', () => {
  const runCLI = async (apiKey: string) => {
    const cli = makeCli()
    const context = createMockContext()
    if (apiKey !== '') {
      process.env = {FLASHCAT_API_KEY: apiKey}
    } else {
      process.env = {}
    }
    const code = await cli.run(['git-metadata', 'upload', '--dry-run'], context)

    return {context, code}
  }

  test('runCLI', async () => {
    const {code, context} = await runCLI('PLACEHOLDER')
    const output = context.stdout.toString()
    expect(output).toContain('[DRYRUN] Handled')
    expect(code).toBe(0)
  }, 30000)

  test('runCLI without api key', async () => {
    const {code, context} = await runCLI('')
    const output = context.stdout.toString()
    // Use simple includes check to avoid ANSI color code issues
    expect(output.includes('FLASHCAT_API_KEY')).toBe(true)
    expect(code).toBe(1)
  })
})

const makeCli = () => {
  const cli = new Cli()
  cli.register(UploadCommand)

  return cli
}
