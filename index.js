const authToken = process.env.GITHUB_AUTH_TOKEN;

const fs        = require('fs');
const path      = require('path');
const meow      = require('meow');
const GitHub    = require('github');
const request   = require('request');
const rimraf    = require('rimraf');
const Promise   = require('bluebird');

const download = (asset, folder) => {
  const dest = folder + path.sep + asset.name;

  return new Promise((resolve, reject) => {
    console.log(`Downloading ${asset.name} to ${folder}`);

    request(asset.browser_download_url, {
      rejectUnauthorized: false,
      timeout: 60000,
    }, (err, response) => {
      if (err) {
        reject(err);
      } else if (response.statusCode !== 200) {
        reject(`Request Failed. Status Code: ${response.statusCode}`);
      } else {
        resolve(dest);
      }
    })
    .on('response', (response) => {
      if (response.statusCode === 200) {
        response.pipe(fs.createWriteStream(dest));
      }
    })
    .on('error', reject);
  })
  .catch(console.error);
};

const makeTempDir = () => {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(__dirname + path.sep + '.tmp', (err, folder) => {
      if (err) {
        reject(err);
      } else {
        resolve(folder);
      }
    });
  })
  .disposer((folder, promise) => {
    cleanupTempDir(folder);
  })
};

const cleanupTempDir = (folder) => {
  return new Promise((resolve, reject) => {
    rimraf(folder, { disableGlob: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(folder);
      }
    });
  })
  .catch(console.error);
}

const doWork = (owner, repo, from, to, filter, verbose) => {
  if (!(owner && repo && from && to)) {
    console.log(owner, repo, from, to, filter, verbose);
    console.error('Not enough arguments');
    return;
  }

  const api = new GitHub({
    Promise: Promise,
  });

  api.authenticate({
    type: 'oauth',
    token: authToken,
  });

  let assets = [];
  const pager = (res) => {
    assets = assets.concat(res);
    if (api.hasNextPage(res)) {
      return api.getNextPage(res).then(pager);
    }
    return assets;
  };

  const filterFunc = (asset) => {
    if (!filter) return true;
    return asset.name.includes(filter);
  };

  Promise.using(makeTempDir(), (folder) => {
    return api.repos.getReleaseByTag({ owner: owner, repo: repo, tag: from })
      .then(release => {
        return api.repos.getAssets({ owner: owner, repo: repo, id: release.id });
      })
      .then(pager)
      .filter(filterFunc)
      .map((asset) => download(asset, folder))
      .each((file) => {
        return api.repos.getReleaseByTag({ owner: owner, repo: repo, tag: to })
          .then(release => {
            console.log(`Uploading ${file} to ${release.tag_name}`);

            return api.repos.uploadAsset({
              owner: owner,
              repo: repo,
              id: release.id,
              filePath: file,
              name: path.basename(file),
            });
          });
      })
      .catch(console.error);
  });
};

const cli = meow(`
  Usage
    $ copy-release-assets owner repo from to

  Options
    -v, --verbose  Verbose output
    -f, --filter   Filters assets to copy by a case-sensitive substring match

  Examples
    $ copy-release-assets sass node-sass v3.11.2 v3.11.3
`, {
  alias: {
    f: 'filter',
    v: 'verbose',
  },
  default: {
    verbose: false,
    filter: null,
  }
});

if (cli.flags.help) {
  console.log(cli.help);
  return;
}

doWork(...cli.input, cli.flags.filter, cli.flags.verbose);