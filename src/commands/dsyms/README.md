# dsyms upload

Upload iOS/macOS dSYM files to Flashcat to symbolicate crash reports.

## Overview

The `dsyms upload` command uploads debug symbol files (dSYM) to Flashcat, enabling symbolication of crash reports from iOS and macOS applications. The command automatically handles fat binaries by splitting them into separate architecture-specific dSYM files before uploading.

## Prerequisites

- **Operating System**: macOS or Linux (requires system tools: `dwarfdump`, `lipo`, `zip`, `unzip`)
- **API Key**: Valid `FLASHCAT_API_KEY` environment variable

## Usage

```bash
flashcat-cli dsyms upload <path> [options]
```

### Arguments

- `<path>` (required): Path to dSYM files or directory
  - Can be a directory containing `.dSYM` bundles
  - Can be a `.zip` archive containing dSYM files (common with Bitcode-enabled apps)

### Options

- `--dry-run`: Simulate upload without actually sending files
- `--max-concurrency <number>`: Maximum number of concurrent uploads (default: 20)

### Environment Variables

- `FLASHCAT_API_KEY` (required): Your Flashcat API key
- `FLASHCAT_SITE` (optional): Flashcat site domain (default: `flashcat.cloud`)
- `FLASHCAT_SOURCEMAP_INTAKE_URL` (optional): Override the default intake URL (shared with sourcemap uploads)

## Examples

### Upload dSYMs from Xcode's DerivedData

```bash
export FLASHCAT_API_KEY=your_api_key
flashcat-cli dsyms upload ~/Library/Developer/Xcode/DerivedData
```

### Upload dSYMs from a zip archive

```bash
flashcat-cli dsyms upload /path/to/MyApp.dSYMs.zip
```

### Dry run to preview what would be uploaded

```bash
flashcat-cli dsyms upload ./build --dry-run
```

### Upload with custom concurrency

```bash
flashcat-cli dsyms upload ./dSYMs --max-concurrency 10
```

## How It Works

1. **Discovery**: Recursively searches for all `.dSYM` bundles in the specified path
2. **Analysis**: Runs `dwarfdump --uuid` to extract architecture and UUID information
3. **Slimming**: Splits fat binaries (multi-architecture dSYMs) into separate single-architecture dSYMs using `lipo -thin`
4. **Compression**: Compresses each dSYM bundle into a `.zip` archive
5. **Upload**: Uploads compressed archives to Flashcat with UUID metadata
6. **Cleanup**: Removes temporary files

## Understanding Fat Binaries

iOS/macOS apps often contain "fat binaries" - executables with multiple architectures (e.g., arm64, x86_64). The command automatically splits these to:

- Reduce upload size
- Avoid exceeding API payload limits
- Optimize processing on the server

For example, a dSYM with architectures `arm64` and `x86_64` will be split into:

- `<uuid1>.dSYM` (arm64 only)
- `<uuid2>.dSYM` (x86_64 only)

## Output Format

The command provides detailed progress information:

```
Starting upload with concurrency 20.
Will look for dSYMs in /path/to/dSYMs
Once dSYMs upload is successful files will be processed and ready to use within the next 5 minutes.
Will use temporary intermediate directory: /tmp/123456/flashcat-cli/dsyms/intermediate
Will use temporary upload directory: /tmp/123456/flashcat-cli/dsyms/upload
Uploading C8469F85.zip (MyApp, arch: arm64, UUID: C8469F85-B060-3085-B69D-E46C645560EA)
Uploading 06EE3D68.zip (MyApp, arch: x86_64, UUID: 06EE3D68-D605-3E92-B92D-2F48C02A505E)

Command summary:
✅ Uploaded 2 dSYMs in 3.45 seconds.
```

## Error Handling

The command includes robust error handling:

- **Invalid dSYMs**: Skipped with a warning
- **Architecture extraction failures**: Logged but don't stop the overall process
- **Upload failures**: Automatically retried up to 5 times with exponential backoff
- **Invalid API key**: Clear error message with configuration guidance

## Common Issues

### Command not found: dwarfdump

**Problem**: System tools are not available (usually on non-macOS systems)

**Solution**: This command requires macOS system tools. If you're building on Linux in CI, consider:

- Using macOS runners for symbol upload
- Uploading dSYMs as a separate step on macOS
- Pre-processing dSYMs on macOS before transferring to CI

### No dSYMs detected

**Problem**: The specified path doesn't contain `.dSYM` bundles

**Solution**:

- Verify the path is correct
- Ensure debug symbols are generated in your Xcode build settings
- Check that the dSYM bundles have the `.dSYM` extension

### API key errors

**Problem**: `FLASHCAT_API_KEY` is missing or invalid

**Solution**:

- Ensure the environment variable is set: `export FLASHCAT_API_KEY=your_key`
- Verify the API key is valid in your Flashcat account settings
- Check that the key has the necessary permissions

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Upload dSYMs to Flashcat
  env:
    FLASHCAT_API_KEY: ${{ secrets.FLASHCAT_API_KEY }}
  run: |
    npx @flashcatcloud/flashcat-cli dsyms upload ./build/dSYMs
```

### GitLab CI

```yaml
upload-dsyms:
  stage: deploy
  script:
    - npm install -g @flashcatcloud/flashcat-cli
    - flashcat-cli dsyms upload ./build/dSYMs
  variables:
    FLASHCAT_API_KEY: $FLASHCAT_API_KEY
```

### Xcode Build Phase

Add a "Run Script" build phase after archiving:

```bash
if [ "$CONFIGURATION" = "Release" ]; then
  export FLASHCAT_API_KEY="your_api_key"
  npx @flashcatcloud/flashcat-cli dsyms upload "$DWARF_DSYM_FOLDER_PATH"
fi
```

## Troubleshooting

Enable verbose output by checking the command output. All operations are logged with clear status messages.

For additional help:

- Check that your build produces dSYM files (Xcode: Build Settings → Debug Information Format → DWARF with dSYM File)
- Verify network connectivity to Flashcat services
- Try with `--dry-run` first to validate the setup

## Related Commands

- [`flashcat-cli sourcemaps upload`](../sourcemaps/README.md): Upload JavaScript sourcemaps for web applications
- [`flashcat-cli version`](../version/cli.ts): Show CLI version

## Technical Details

### Payload Format

Each dSYM is uploaded as a multipart form with:

- `symbols_archive`: The compressed `.zip` file
- `event`: JSON metadata containing:
  ```json
  {
    "type": "ios_symbols",
    "uuids": "UUID1,UUID2,..."
  }
  ```

### Temporary Files

The command creates temporary directories for processing:

- `intermediate/`: Contains architecture-split dSYM bundles
- `upload/`: Contains final compressed `.zip` files

These are automatically cleaned up after upload completes (or fails).

### Concurrency

Multiple dSYMs are uploaded in parallel with configurable concurrency (default: 20). This significantly speeds up uploads for projects with many symbols.
