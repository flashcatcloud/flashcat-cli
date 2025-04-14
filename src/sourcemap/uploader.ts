import { Config } from '../types/config';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export class SourcemapUploader {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async upload(uploadPath: string): Promise<void> {
    if (!this.config.api?.baseUrl) {
      throw new Error('API base URL not configured');
    }

    const files = await this.findSourcemapFiles(uploadPath);
    if (files.length === 0) {
      throw new Error('No sourcemap files found');
    }

    for (const file of files) {
      await this.uploadFile(file);
    }
  }

  private async findSourcemapFiles(uploadPath: string): Promise<string[]> {
    const patterns = this.config.sourcemap?.include || ['**/*.js.map'];
    const exclude = this.config.sourcemap?.exclude || [];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: uploadPath,
        ignore: exclude,
        absolute: true,
      });
      files.push(...matches);
    }

    return files;
  }

  private async uploadFile(filePath: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('path', path.relative(process.cwd(), filePath));

    const headers = {
      ...formData.getHeaders(),
    };

    if (this.config.api?.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.api.apiKey}`;
    }

    const baseUrl = this.config.api?.baseUrl;
    if (!baseUrl) {
      throw new Error('API base URL not configured');
    }

    await axios.post(`${baseUrl}/sourcemaps`, formData, {
      headers,
      maxBodyLength: Infinity,
    });
  }
} 