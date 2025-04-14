export interface Config {
  version: string;
  api?: {
    baseUrl: string;
    apiKey?: string;
  };
  sourcemap?: {
    uploadPath: string;
    include: string[];
    exclude?: string[];
  };
  [key: string]: any;
} 