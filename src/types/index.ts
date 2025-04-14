export interface SourcemapUploadResponse {
  id: string
  service: string
  version: string
  filename: string
  size: number
  uploadedAt: string
}

export interface ErrorResponse {
  error: string
  message: string
  statusCode: number
}

export interface ApiConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
} 