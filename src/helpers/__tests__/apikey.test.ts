import {AxiosError} from 'axios'

import {InvalidConfigurationError} from '../errors'
import {newApiKeyValidator} from '../apikey'

describe('ApiKeyValidator', () => {
  test('does not report invalid parameter responses as invalid API keys', async () => {
    const validator = newApiKeyValidator({apiKey: 'api-key', flashcatSite: 'flashcat.cloud'})
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            code: 'InvalidParameter',
            message: 'Invalid Minified URL: contains dangerous path characters',
          },
        },
      },
    } as AxiosError

    await expect(validator.verifyApiKey(error)).resolves.toBeUndefined()
  })

  test('reports unauthorized responses as invalid API keys', async () => {
    const validator = newApiKeyValidator({apiKey: 'api-key', flashcatSite: 'flashcat.cloud'})
    const error = {
      response: {
        status: 401,
      },
    } as AxiosError

    await expect(validator.verifyApiKey(error)).rejects.toBeInstanceOf(InvalidConfigurationError)
  })
})
