import { Command } from 'commander';
import { ConfigManager } from '../config/config-manager';
import { Config } from '../types/config';

export abstract class BaseCommand {
  protected configManager!: ConfigManager;
  protected config: Config | null = null;
  protected program: Command;

  constructor() {
    this.program = new Command();
    this.setupBaseOptions();
  }

  private setupBaseOptions() {
    this.program
      .option('-c, --config <path>', 'Path to the configuration file')
      .hook('preAction', async (thisCommand) => {
        try {
          const configPath = thisCommand.opts().config || './flashcat-ci.yaml';
          this.configManager = new ConfigManager(configPath);
          this.config = await this.configManager.loadConfig();
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      });
  }

  abstract setup(): void;

  execute() {
    this.setup();
    return this.program;
  }
} 