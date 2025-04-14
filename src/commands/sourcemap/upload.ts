import { BaseCommand } from '../base-command';
import { SourcemapUploader } from '../../sourcemap/uploader';

export class SourcemapUploadCommand extends BaseCommand {
  setup(): void {
    this.program
      .name('sourcemap-upload')
      .description('Upload sourcemaps to the server')
      .option('-p, --path <path>', 'Path to the sourcemap files')
      .action(async (options) => {
        try {
          if (!this.config) {
            throw new Error('Configuration not loaded');
          }

          const path = options.path || this.config.sourcemap?.uploadPath;
          if (!path) {
            throw new Error('No sourcemap path specified in config or command line');
          }

          const uploader = new SourcemapUploader(this.config);
          await uploader.upload(path);

          console.log('Sourcemaps uploaded successfully');
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      });
  }
} 