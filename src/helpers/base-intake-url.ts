export const getBaseSourcemapIntakeUrl = (flashcatSite?: string) => {
  if (process.env.FLASHCAT_SOURCEMAP_INTAKE_URL) {
    return process.env.FLASHCAT_SOURCEMAP_INTAKE_URL
  } else if (flashcatSite) {
    return "https://browser." + flashcatSite;
  }

  return "https://browser.flashcat.cloud";
};
