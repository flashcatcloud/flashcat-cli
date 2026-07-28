import path from 'path'

export const getMinifiedFilePath = (sourcemapPath: string) => {
  if (path.extname(sourcemapPath) !== '.map') {
    throw Error('cannot get minified file path from a file which is not a sourcemap')
  }

  return sourcemapPath.replace(new RegExp('\\.map$'), '')
}

// Matches a `file://` scheme followed by an empty or `localhost` authority, i.e. the two
// forms a local file URL can take: `file:///abs/path` and `file://localhost/abs/path`.
// The lookahead keeps the leading `/` of the path itself.
const LOCAL_FILE_URL_PREFIX = /^file:\/\/(localhost)?(?=\/)/i

// stripLocalFileProtocol turns a `file://` prefix into the plain absolute path it denotes.
//
// Electron renderer bundles are loaded over `file://`, so their stack frame URLs look like
// `file:///Applications/My.app/Contents/Resources/app.asar/dist/renderer.js`. The intake
// keys sourcemaps by the URL *path* only, so `file:///a/b` and `/a/b` resolve to the same
// key — normalizing here lets users paste the prefix straight out of a stack trace while
// keeping the value a plain absolute path everywhere downstream.
//
// Non-local `file://` URLs (a real authority, e.g. `file://host/a`) and every other scheme
// are returned untouched.
export const stripLocalFileProtocol = (minifiedPathPrefix: string): string =>
  minifiedPathPrefix.replace(LOCAL_FILE_URL_PREFIX, '')

// ExtractRepeatedPath checks if the last part of paths of the first arg are repeated at the start of the second arg.
export const extractRepeatedPath = (path1: string, path2: string): string | undefined => {
  const splitOnSlashes = new RegExp(/[\/]+|[\\]+/)
  const trimSlashes = new RegExp(/^[\/]+|^[\\]+|[\/]+$|[\\]+$/)
  const path1split = path1.trim().replace(trimSlashes, '').split(splitOnSlashes)
  const path2split = path2.trim().replace(trimSlashes, '').split(splitOnSlashes)
  const normalizedpath2 = path2split.join('/')
  for (let i = path1split.length; i > 0; i--) {
    const path1subset = path1split.slice(-i).join('/')
    if (normalizedpath2.startsWith(path1subset)) {
      return path1subset
    }
  }

  return undefined
}
