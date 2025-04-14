export const getBaseSourcemapIntakeUrl = (flashcatSite?: string) => {
  if (process.env.FLASHCAT_SOURCEMAP_INTAKE_URL) {
    return process.env.FLASHCAT_SOURCEMAP_INTAKE_URL
  } else if (flashcatSite) {
    return 'https://jira.' + flashcatSite
  }

  return 'https://jira.flashcat.cloud' // fixme later @fiona 确认一下这里的默认url
}
