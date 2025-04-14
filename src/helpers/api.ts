import axios, {AxiosInstance} from 'axios'
import {API_BASE_URL, DEFAULT_TIMEOUT} from '../constants'
import {ApiConfig, ErrorResponse} from '../types'

export class ApiClient {
  private client: AxiosInstance

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl || API_BASE_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      headers: {
        'X-API-Key': config.apiKey,
      },
    })
  }

  async uploadSourcemap(
    file: Buffer | NodeJS.ReadableStream,
    service: string,
    version: string
  ): Promise<void> {
    const form = new FormData()
    form.append('file', file)
    form.append('service', service)
    form.append('version', version)

    try {
      await this.client.post('/sourcemaps', form, {
        headers: form.getHeaders(),
      })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorResponse = error.response.data as ErrorResponse
        throw new Error(errorResponse.message || errorResponse.error)
      }
      throw error
    }
  }
} 