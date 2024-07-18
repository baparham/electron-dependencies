const { mkdirSync, writeFileSync } = require('fs');
const { dirname, join } = require('path');
const semver = require('semver');
const existingElectronDependencies = require('../index.json');
const { downloadFile, getElectronDependencies } = require('./index.js');

async function update() {
  const electronHeaders = require('../tmp/index.json');

  // Identify all versions in index.json newer than 29.0.0
  const allSupportedVersions = electronHeaders.filter(h => {
    if (h.version && !h.version.includes('nightly')) {
      return semver.gte(h.version, '29.0.0')
    }
    return false;
  });

  // Find versions that are not yet in existingElectronDepen
  const newVersions = allSupportedVersions.filter(h => {
    return !existingElectronDependencies[h.version];
  });

  const promises = [];

  for (const version of newVersions) {
    console.log('downloading', version.version);
    try {
      const deps = await getElectronDependencies(version.version);
      existingElectronDependencies[version.version] = deps;
    } catch (e) {
      console.error('Error downloading', version.version);
      console.error(e);
      continue;
    }

  }
  // newVersions.forEach(async (v) => {
  //   const deps = await getElectronDependencies(v.version));
  // });

  // Promise.allSettled(promises).then((results) => {
  //   results.forEach((result) => {
  //     if (result.status === 'fulfilled') {
  //       const { value } = result;
  //       existingElectronDependencies[value.version] = value;
  //     }
  //   });

  // sort existingElectronDependencies by key
  const sorted = Object.keys(existingElectronDependencies).sort(semver.compare).reduce((acc, key) => {
    acc[key] = existingElectronDependencies[key];
    return acc;
  }, {});

  writeFileSync(join(__dirname, '../index.json'), JSON.stringify(sorted, null, 2));
  // });
}

// Download index.json from electron
const electronHeadersFile = join(__dirname, '..', 'tmp', 'index.json');
mkdirSync(dirname(electronHeadersFile), { recursive: true });

downloadFile('https://electronjs.org/headers/index.json', electronHeadersFile)
  .then(async (result) => {
    await update();
  });
