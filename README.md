# github-copy-release-assets
Copies release assets from one Github release to another

## Usage

```
  Usage
    $ copy-release-assets owner repo from to

  Options
    -v, --verbose  Verbose output

  Examples
    $ copy-release-assets --verbose sass node-sass v3.11.2 v3.11.3
```

## Authentication

A GitHub OAuth token is expected to be present in the `GITHUB_AUTH_TOKEN` environment variable.

## Support

Tested on Node 7 on OS X and Heroku linux.

