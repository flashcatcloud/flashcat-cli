// fixme later 修改一下校验api的url
export const flashcatSite = process.env.FLASHCAT_SITE || process.env.DD_SITE || 'flashcat.cloud'

export const apiHost = 'api.' + flashcatSite

export const getBaseIntakeUrl = () => {
  if (process.env.FLASHCAT_SOURCEMAP_INTAKE_URL) {
    return process.env.FLASHCAT_SOURCEMAP_INTAKE_URL
  }

  return 'https://jira.' + flashcatSite
}
