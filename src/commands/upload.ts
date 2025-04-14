import { Command } from 'commander';
import { uploadSourcemap } from '../helpers/upload';

export async function uploadCommand(options: {
  file: string;
  url: string;
  token?: string;
}) {
  try {
    await uploadSourcemap(options);
    console.log('Sourcemap uploaded successfully');
  } catch (error) {
    console.error('Error uploading sourcemap:', error);
    process.exit(1);
  }
} 