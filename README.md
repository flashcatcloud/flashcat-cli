# Flashcat CI

A command-line tool for supporting Flashcat-related operations.
See the  [documentation](https://docs.flashcat.cloud/zh/flashduty/introduction) documentation for more details.

## Installation

```bash
npm install -g @flashcatcloud/flashcat-cli
```


## Usage

### Sourcemap Upload

```bash
flashcat-cli sourcemaps upload ./build --service <service> --minified-path-prefix <minified-path>
```

Option descriptions:
- `--service` (required): Service name
- `--minified-path-prefix` (required): The common prefix for all JS source files, depending on their deployed URL. It can be a complete URL or an absolute path.

## License
[Apache License, v2.0](./LICENSE)

## Credits
This project is inspired by  [datadog-ci](https://github.com/DATADOG/datadog-ci) and initialized from Datadog, Inc.
The original work is copyright Datadog, Inc., 2020.
Modifications copyright Flashcat, Inc., 2025.