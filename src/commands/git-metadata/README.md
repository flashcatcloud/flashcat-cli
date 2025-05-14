# git-metadata command

Upload the git commit details to FLASHCAT.

## Usage

### Setup

You need to have `FLASHCAT_API_KEY` in your environment.

```bash
# Environment setup
export FLASHCAT_API_KEY="<API KEY>"
```

It is possible to configure the tool to use FLASHCAT EU by defining the `FLASHCAT_SITE` environment variable to `FLASHCAThq.eu`. By default the requests are sent to FLASHCAT US.

It is also possible to override the full URL for the intake endpoint by defining the `FLASHCAT_SOURCEMAP_INTAKE_URL` environment variable.

### Commands

#### `upload`

This command will upload the current commit details to FLASHCAT in order to create links to your repositories inside FLASHCAT's UI.

This command should be run inside a local git repository and the git program must be available:

```bash
FLASHCAT-ci git-metadata upload
```

* `--repository-url` (default: empty): overrides the repository remote with a custom URL. For example: https://github.com/my-company/my-project

#### Limitations

The `git-metadata` command only reports commits in the current HEAD's history with a commit date within the last 30 days. The command outputs a maximum of 1,000 commits.

The repository URL is inferred from the remote named `origin` (or the first remote if none are named `origin`). The value can be overridden by using the `--repository-url` flag.
For example: The remote `git@github.com:FLASHCAT/example.git` will create links that point to `https://github.com/FLASHCAT/example`.

The only repository URLs supported are the ones whose host contains: `github`, `gitlab`, `bitbucket`, or `dev.azure`. This allows FLASHCAT to create proper URLs such as:

| Provider        | URL                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub / GitLab | https://\<repository-url\>/blob/\<commit-hash\>/\<tracked-file-path\>#L\<line\>                                                                     |
| Bitbucket       | https://\<repository-url\>/src/\<commit-hash\>/\<tracked-file-path\>#lines-\<line\>                                                                 |
| Azure DevOps    | https://\<repository-url\>?version=GC\<commit-hash\>&path=\<tracked-file-path\>&line=\<line\>&lineEnd=\<line + 1>&lineStartColumn=1&lineEndColumn=1 |

### End-to-end testing process

To verify this command works as expected, you can trigger a test run and verify it returns 0:

```bash
export FLASHCAT_API_KEY='<API key>'

yarn launch git-metadata upload
```

Successful output should look like this:
```bash
Reporting commit fceed94376fc50dea8ba6d6310002dcf1efcc06e from repository git@github.com:FLASHCAT/FLASHCAT-ci.git.
180 tracked file paths will be reported.
✅ Uploaded in 0.736 seconds.
✨  Done in 4.27s
```


## Further reading

Additional helpful documentation, links, and articles:

- [Learn about Source Code Integration][1]

[1]: https://docs.FLASHCAThq.com/integrations/guide/source-code-integration/
