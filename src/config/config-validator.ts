import { Config } from '../types/config';

export function validateConfig(config: any): config is Config {
  if (!config || typeof config !== 'object') {
    return false;
  }

  if (!config.version || typeof config.version !== 'string') {
    return false;
  }

  if (config.api) {
    if (typeof config.api !== 'object') {
      return false;
    }
    if (typeof config.api.baseUrl !== 'string') {
      return false;
    }
    if (config.api.apiKey && typeof config.api.apiKey !== 'string') {
      return false;
    }
  }

  if (config.sourcemap) {
    if (typeof config.sourcemap !== 'object') {
      return false;
    }
    if (typeof config.sourcemap.uploadPath !== 'string') {
      return false;
    }
    if (!Array.isArray(config.sourcemap.include)) {
      return false;
    }
    if (config.sourcemap.exclude && !Array.isArray(config.sourcemap.exclude)) {
      return false;
    }
  }

  return true;
} 