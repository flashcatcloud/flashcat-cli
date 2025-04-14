# Flashcat CI

A command-line tool for Flashcat CI/CD operations.

## Installation

```bash
npm install -g flashcat-cli
```

## Usage

### Sourcemap Upload

```bash
flashcat-cli sourcemap:upload -f <sourcemap-file> -u <upload-url> [-t <token>]
```

Options:
- `-f, --file`: Path to the sourcemap file (required)
- `-u, --url`: Upload URL (required)
- `-t, --token`: Authentication token (optional)

Example:
```bash
flashcat-cli sourcemap:upload -f ./dist/main.js.map -u https://api.example.com/upload -t your-token
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run in development mode:
   ```bash
   npm run dev
   ```


## License

[Apache License, v2.0](LICENSE)

## Credits

This project is forked from [flashcat-cli](https://github.com/FLASHCAT/flashcat-cli) by Flashcat, Inc.
Original work Copyright 2020 Flashcat, Inc.
Modified work Copyright 2025 Flashcat, Inc.