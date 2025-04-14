export const getBaseSourcemapIntakeUrl = (flashcatSite?: string) => {
  if (process.env.DATADOG_SOURCEMAP_INTAKE_URL) {
    return process.env.DATADOG_SOURCEMAP_INTAKE_URL
  } else if (flashcatSite) {
    return 'https://sourcemap-intake.' + flashcatSite
  }

  return 'https://sourcemap-intake.flashcat.cloud'
}
