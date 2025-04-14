#!/usr/bin/env node

import { Command } from 'commander';
import { uploadCommand } from './commands/upload';

const program = new Command();

program
  .name('flashcat-ci')
  .description('CLI tool for Flashcat CI/CD operations')
  .version('1.0.0');

// Add sourcemap upload command
program
  .command('sourcemap:upload')
  .description('Upload sourcemap files')
  .requiredOption('-f, --file <file>', 'Sourcemap file path')
  .requiredOption('-u, --url <url>', 'Upload URL')
  .option('-t, --token <token>', 'Authentication token')
  .action(uploadCommand);

program.parse(process.argv); 