import {FLASHCAT_SITES} from '../constants'

/**
 * Get the base intake URL for a service. If the `DD_SITE` or `FLASHCAT_SITE` environment
 * variables are not defined, use the default site (US1).
 */
export const getBaseIntakeUrl = (intake: string) => {
  if (process.env.FLASHCAT_SITES || process.env.FC_SITE) {
    return `https://${intake}.${process.env.FLASHCAT_SITES || process.env.FC_SITE}`
  }

  return `https://${intake}.${FLASHCAT_SITES}`
}
