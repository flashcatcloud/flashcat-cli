import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';

export interface UploadOptions {
  file: string;
  url: string;
  token?: string;
}

export async function uploadSourcemap(options: UploadOptions): Promise<void> {
  const { file, url, token } = options;

  // Check if file exists
  if (!fs.existsSync(file)) {
    throw new Error(`File ${file} does not exist`);
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', fs.createReadStream(file));

  // Set headers
  const headers: Record<string, string> = {
    ...formData.getHeaders(),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Upload file
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }
} 