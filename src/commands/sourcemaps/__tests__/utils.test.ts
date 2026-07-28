import {extractRepeatedPath, getMinifiedFilePath, stripLocalFileProtocol} from '../utils'

describe('utils', () => {
  describe('getMinifiedFilePath', () => {
    test('should return correct minified path', () => {
      const file1 = 'sourcemaps/file1.min.js.map'
      const file2 = 'sourcemaps/file2.js.map.xxx'

      expect(getMinifiedFilePath(file1)).toBe('sourcemaps/file1.min.js')
      expect(() => getMinifiedFilePath(file2)).toThrow(
        'cannot get minified file path from a file which is not a sourcemap'
      )
    })
  })

  describe('stripLocalFileProtocol', () => {
    test('should strip the scheme of a local file URL, keeping the absolute path', () => {
      // Real Electron 41 renderer stack frame shape (bundle loaded via BrowserWindow.loadFile).
      expect(stripLocalFileProtocol('file:///Applications/My.app/Contents/Resources/app.asar/dist')).toBe(
        '/Applications/My.app/Contents/Resources/app.asar/dist'
      )
      expect(stripLocalFileProtocol('file:///dist')).toBe('/dist')
    })

    test('should strip a localhost authority', () => {
      expect(stripLocalFileProtocol('file://localhost/dist')).toBe('/dist')
      expect(stripLocalFileProtocol('FILE://LOCALHOST/dist')).toBe('/dist')
    })

    test('should keep the leading slash of a Windows file URL', () => {
      expect(
        stripLocalFileProtocol('file:///C:/Users/alice/AppData/Local/Programs/my-app/resources/app.asar/dist')
      ).toBe('/C:/Users/alice/AppData/Local/Programs/my-app/resources/app.asar/dist')
    })

    test('should leave every other prefix untouched', () => {
      expect(stripLocalFileProtocol('https://static.flashcat.com/js')).toBe('https://static.flashcat.com/js')
      expect(stripLocalFileProtocol('//static.flashcat.com/js')).toBe('//static.flashcat.com/js')
      expect(stripLocalFileProtocol('/static/js')).toBe('/static/js')
      expect(stripLocalFileProtocol('app:///dist')).toBe('app:///dist')
      // A non-empty, non-localhost authority is not a local file path.
      expect(stripLocalFileProtocol('file://fileserver/dist')).toBe('file://fileserver/dist')
    })
  })

  describe('arelastFoldersRepeated', () => {
    test('should return true', () => {
      const minifiedPathPrefix = 'https://subdomain.domain.dev/static/js'
      const relativePath = '/static/js/1.23.chunk.js'

      expect(extractRepeatedPath(minifiedPathPrefix, relativePath)).toBe('static/js')
    })

    test('should return true 2', () => {
      const minifiedPathPrefix = 'https://subdomain.domain.dev/static/js/'
      const relativePath = '/static/js/1.23.chunk.js'

      expect(extractRepeatedPath(minifiedPathPrefix, relativePath)).toBe('static/js')
    })

    test('should return false', () => {
      const minifiedPathPrefix = 'https://subdomain.domain.dev/static/js'
      const relativePath = '/1.23.chunk.js'

      expect(extractRepeatedPath(minifiedPathPrefix, relativePath)).toBe(undefined)
    })
  })
})
