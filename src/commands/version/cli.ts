import {Command} from 'clipanion'

import {version} from '../../helpers/version'

class VersionCommand extends Command {
  public static paths = [['version']]

  public static usage = Command.Usage({
    // This description is longer than usual because this is valuable information, and it's unlikely
    // that the user is going to run `flashcat-cli version --help`. This description will show in `flashcat-cli --help` instead.
    description:
      'Get the current version of flashcat-cli. This command outputs a prefixed version, e.g. `v1.0.0`. If you want the raw version, use `flashcat-cli --version`.',
  })

  public async execute() {
    this.context.stdout.write(`v${version}\n`)

    return 0
  }
}

module.exports = [VersionCommand]
