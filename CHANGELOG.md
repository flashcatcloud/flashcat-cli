# Changelog

> **Legend**
>
> 💥 - Breaking change.
>
> ✨ - New feature.
>
> 🐛 - Bug fix.
>
> ⚡️ - Performance improvement.
>
> 📝 - Documentation.
>
> ⚗ - Experimental.

---

## v0.3.0

- ✨ New `electron-symbols upload` command: uploads the Breakpad symbol files (`.sym`) for an Electron application, so native crash stacks are resolved to function names and line numbers in the RUM console instead of showing bare module names and addresses

## v0.2.0

- ✨ New `flutter-symbols upload` command: uploads the `app.<platform>-<arch>.symbols` debug companions produced by `flutter build --obfuscate --split-debug-info=<dir>`, so obfuscated Dart AOT crash stacks are de-obfuscated in the RUM console

## v0.1.3

- 🐛 Normalize Windows path separators when building JavaScript sourcemap `minified_url` values
- 🐛 Accept Windows-style absolute `--minified-path-prefix` values such as `\dist`
- 🐛 Avoid reporting backend payload validation errors as invalid `FLASHCAT_API_KEY` errors

## v0.1.2

- 🐛 Prepare CLI release package

## v0.1.1

- ✨ Add WeChat miniprogram sourcemap zip upload command

## v0.1.0

- ✨ Add sourcemaps upload command
- ✨ Add dsyms upload command
- ✨ Add git-metadata upload command
- [breaking change] update upload endpoint

## v0.0.2

- ✨ Initial CLI structure
- ✨ Add version command

## v0.0.1

- 🎉 Initial release
