import { AxiosError, default as axios } from "axios";
import chalk from "chalk";

import { InvalidConfigurationError } from "./errors";

/** ApiKeyValidator is an helper interface to interpret Flashcat error responses and possibly check the
 * validity of the api key.
 */
export interface ApiKeyValidator {
  verifyApiKey(error: AxiosError): Promise<void>;
}

export interface ApiKeyValidatorParams {
  apiKey: string | undefined;
  flashcatSite: string;
}

export const newApiKeyValidator = (
  params: ApiKeyValidatorParams
): ApiKeyValidator =>
  new ApiKeyValidatorImplem(params.apiKey, params.flashcatSite);

/** ApiKeyValidator is an helper class to interpret Flashcat error responses and possibly check the
 * validity of the api key.
 */
class ApiKeyValidatorImplem {
  public apiKey: string | undefined;
  public flashcatSite: string;

  constructor(apiKey: string | undefined, flashcatSite: string) {
    this.apiKey = apiKey;
    this.flashcatSite = flashcatSite;
  }

  /** Check if an API key is valid, based on the Axios error and defaulting to verify the API key
   * through Flashcat's API for ambiguous cases.
   * An exception is raised when the API key is invalid.
   * Callers should catch the exception to display it nicely.
   */
  public async verifyApiKey(error: AxiosError): Promise<void> {
    if (error.response === undefined) {
      return;
    }
    if (error.response.status === 403 || error.response.status === 400) {
      throw new InvalidConfigurationError(
        `${chalk.red.bold(
          "FLASHCAT_API_KEY"
        )} does not contain a valid API key for Flashcat site ${
          this.flashcatSite
        }`
      );
    }
  }
}
