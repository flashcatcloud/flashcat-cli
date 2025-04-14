import { Command } from 'commander';
import { SourcemapUploadCommand } from './commands/sourcemap/upload';

const program = new Command();

program
  .name('flashcat-ci')
  .description('Flashcat CI command line tool')
  .version('1.0.0');

// 注册命令
const sourcemapUpload = new SourcemapUploadCommand();
program.addCommand(sourcemapUpload.execute());

export { program };

if (require.main === module) {
  program.parse(process.argv);
} 