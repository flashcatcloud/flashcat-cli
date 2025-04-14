import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { validateConfig } from './config-validator';
import { Config } from '../types/config';

export class ConfigManager {
  private config: Config | null = null;
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async loadConfig(): Promise<Config> {
    if (this.config) {
      return this.config;
    }

    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Config file not found at ${this.configPath}`);
    }

    const configContent = fs.readFileSync(this.configPath, 'utf8');
    const config = yaml.load(configContent) as Config;

    if (!validateConfig(config)) {
      throw new Error('Invalid configuration format');
    }

    this.config = config;
    return config;
  }

  getConfig(): Config | null {
    return this.config;
  }

  async saveConfig(config: Config): Promise<void> {
    if (!validateConfig(config)) {
      throw new Error('Invalid configuration format');
    }

    const configContent = yaml.dump(config);
    fs.writeFileSync(this.configPath, configContent, 'utf8');
    this.config = config;
  }
} 