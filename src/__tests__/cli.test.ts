import {Builtins, CommandClass} from 'clipanion'

// Test all commands, including beta ones.
process.env.DD_BETA_COMMANDS_ENABLED = '1'

import {cli, BETA_COMMANDS} from '../cli'

const builtins: CommandClass[] = [Builtins.HelpCommand, Builtins.VersionCommand]


describe('cli', () => {
  const commands = Array.from(cli['registrations'].keys())
  const userDefinedCommands = commands.filter((command) => !builtins.includes(command))
  const commandPaths: {command: CommandClass; commandPath: string[]}[] = []
  for (const command of userDefinedCommands) {
    for (const commandPath of command.paths ?? []) {
      commandPaths.push({command, commandPath})
    }
  }

  const cases: [string, string, string[], CommandClass][] = commandPaths.map(({command, commandPath}) => {
    const [rootPath, subPath] = commandPath
    const commandName = BETA_COMMANDS.includes(rootPath) ? `${rootPath} (beta)` : rootPath // e.g. synthetics
    const subcommandName = subPath || '<root>' // e.g. run-tests

    return [commandName, subcommandName, commandPath, command]
  })

  describe('all commands have the right metadata', () => {
    test.each(cases)('%s %s', (commandName, _subcommandName, _commandPath, command) => {
      expect(command).toHaveProperty('paths')
      expect(command).toHaveProperty('usage')

      if (commandName !== 'version') {
        // Please categorize the commands by product. You can refer to the CODEOWNERS file.
        // eslint-disable-next-line jest/no-conditional-expect
        expect(command.usage).toHaveProperty('category')
      }

      // You should at least document the command with a description, otherwise it will show as "undocumented" in `--help`.
      expect(command.usage).toHaveProperty('description')

      // Please end your description with a period.
      expect(command.usage?.description).toMatch(/\.$/)

      // Please uppercase the first letter of the category and description.
      expect(command.usage?.category?.charAt(0)).toStrictEqual(command.usage?.category?.charAt(0).toUpperCase())
      expect(command.usage?.description?.charAt(0)).toStrictEqual(command.usage?.description?.charAt(0).toUpperCase())
    })
  })
})
