const fs = require('fs');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { join } = require('path');
const url = require('url');
const { spawnSync } = require('child_process');
const nodeReleases = require('process-versions');

var argv = require('minimist')(process.argv.slice(2));
const verbose = !!argv.verbose || false;
const toYaml = !!argv.yaml || false;

const initialPyContent = `# This section of the file has been added by electron-dependencies
# Helper function to process strings
def Str(value):
  return str(value)

# Helper function to access variables
def Var(value):
  return vars[value]

`;

// More strict semver style matching
// source https://github.com/npm/node-semver/issues/32
const semverPattern =
  /([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?/;
// Matches non semver things like 69, 1728389, 1.my-release, 3, 2022, etc
const lenientVersionPattern = /([\d]+(?:\.[a-zA-Z0-9-]+)?(?:\.[a-zA-Z0-9-]+\.?)?)/;
const shaPattern = /([A-Fa-f0-9]{40})/;

const componentRepos = {
  'freetype': {
    key: 'src/third_party/freetype/src',
    useShaVersion: false,
    fileWithVersionData: 'README',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'ffmpeg': {
    key: 'src/third_party/ffmpeg',
    useShaVersion: false,
    fileWithVersionData: 'RELEASE',
    versionRegEx: lenientVersionPattern,
    useRegExMatchNumber: 0,
  },
  'pdfium': {
    key: 'src/third_party/pdfium',
    useShaVersion: true,
  },
  'libsrtp': {
    key: 'src/third_party/libsrtp',
    useShaVersion: false,
    fileWithVersionData: 'LIBSRTP_VERSION',
    versionRegEx: shaPattern,
    useRegExMatchNumber: 0
  },
  'openh264': {
    key: 'src/third_party/openh264/src',
    useShaVersion: false,
    fileWithVersionData: 'RELEASES',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'angle': {
    key: 'src/third_party/angle',
    useShaVersion: true,
  },
  'boringssl': {
    key: 'src/third_party/boringssl/src',
    useShaVersion: true,
  },
  'libvpx': {
    key: 'src/third_party/libvpx/source/libvpx',
    useShaVersion: false,
    fileWithVersionData: 'CHANGELOG',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'sqlite': {
    key: 'src/third_party/sqlite/src',
    useShaVersion: false,
    fileWithVersionData: 'VERSION',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'wayland': {
    key: 'src/third_party/wayland/src',
    useShaVersion: false,
    fileWithVersionData: 'meson.build',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'libjpeg-turbo': {
    key: 'src/third_party/libjpeg_turbo',
    useShaVersion: false,
    fileWithVersionData: 'README.chromium',
    versionRegEx: lenientVersionPattern,
    useRegExMatchNumber: 0,
  },
};

const chromiumComponents = {
  'libxml2': 'third_party/libxml/README.chromium',
  'libxslt': 'third_party/libxslt/README.chromium',
  'libwebp': 'third_party/libwebp/README.chromium',
  'opus': 'third_party/opus/README.chromium',
  'fontconfig': 'third_party/fontconfig/README.chromium',
  'glew': 'third_party/glfw/README.chromium',
  'jsoncpp': 'third_party/jsoncpp/README.chromium',
  'leveldb': 'third_party/leveldatabase/README.chromium',
  'libaom': 'third_party/libaom/README.chromium',
  'libcxx': 'third_party/libc++/README.chromium',
  'libcxxabi': 'third_party/libc++abi/README.chromium',
  'libusb': 'third_party/libusb/README.chromium',
  'ots': 'third_party/ots/README.chromium',
  're2': 'third_party/re2/README.chromium',
};

let chromiumDependencyMap;
let chromiumUrl;

function debugLog(...msgs) {
  if (verbose) {
    console.log(...msgs);
  }
}

function getChromeVersion(release) {
  const chromeVersion = release.chrome;
  if (!chromeVersion) {
    throw 'Chrome version not detected';
  }
  return chromeVersion;
}

function getSanitizedVersion(version) {
  let sanitizedVersion = version;
  if (sanitizedVersion.startsWith('v')) {
    sanitizedVersion = sanitizedVersion.slice(1);
  }
  return sanitizedVersion;
}

function getRelease(tag) {
  debugLog('Finding electron release with tag', `v${tag}`);
  const electronHeaders = require('../tmp/index.json');

  const release = electronHeaders.find(r => r.version === getSanitizedVersion(tag))
  // const release = electronHeaders.find(release => release.tag_name === `v${tag}`);

  if (release === undefined) {
    console.error('Could not find electron release matching', tag);
    console.error('please download a new version of https://electronjs.org/headers/index.json to', join(__dirname, '..', 'tmp', './index.json'));
    process.exit(2);
  }
  return release;
}

function checkArgs() {
  if (argv._.length != 1) {
    console.error('Usage: yarn listversions <version>');
    process.exit(1);
  }
}

function getTagFromArg() {
  let tag = argv._[0];
  if (tag.startsWith('v')) {
    tag = tag.slice(1);
  }
  return tag;
}

function downloadFile(fileUrl, localFilename, fileOptions) {
  debugLog('Downloading', fileUrl);
  const localWriteStream = fs.createWriteStream(localFilename, fileOptions);
  return downloadToStream(fileUrl, localWriteStream);
}

function downloadToStream(fileUrl, localWriteStream) {
  return new Promise((resolve, reject) => {
    const options = url.parse(fileUrl);
    if (process.env.https_proxy) {
      const proxyAgent = HttpsProxyAgent(process.env.https_proxy);
      options.agent = proxyAgent;
    }
    localWriteStream.on('error', reject);

    const request = https.get(options, (response) => {
      // if response is 301 or 302, follow the redirect
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolve(downloadToStream(response.headers.location, localWriteStream));
        return;
      }
      response.pipe(localWriteStream);
    });
    localWriteStream.on('finish', resolve);
    request.on('error', reject);
    request.end();
  });
}

// TODO refactor this to use common code with downloadToStream
function downloadToString(fileUrl) {
  const bufferArray = [];
  return new Promise((resolve, reject) => {
    const options = url.parse(fileUrl);
    if (process.env.https_proxy) {
      const proxyAgent = HttpsProxyAgent(process.env.https_proxy);
      options.agent = proxyAgent;
    }

    const request = https.get(options, (response) => {
      response.on('data', (chunk) => {
        bufferArray.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve(Buffer.concat(bufferArray).toString('utf-8')));
    });
    request.on('error', reject);
    request.end();
  });
}

function getRawComponentData(comp) {
  return componentRepos[comp];
}

function getComponentRawUrlSuffix(comp) {
  const componentData = getRawComponentData(comp);
  if (typeof componentData === 'object') {
    return chromiumDependencyMap[componentData.key];
  } else if (typeof componentData === 'string') {
    return chromiumDependencyMap[componentData];
  } else {
    throw new Error('Malformed component data for ' + comp + ' in\n' + JSON.stringify(componentRepos, null, 2));
  }
}

function getComponentRepoUrl(comp) {
  const rawRepo = getComponentRawUrlSuffix(comp);
  if (rawRepo.url) {
    return rawRepo.url.replace('@', '/+/');
  }
  return rawRepo.replace('@', '/+/');
}

function getComponentData(comp) {
  const compData = getRawComponentData(comp);
  const returnData = {
    url: '',
    useShaVersion: true,
    fileWithVersionData: undefined,
    versionRegEx: undefined,
    useRegExMatchNumber: undefined,
  };
  returnData.url = getComponentRepoUrl(comp);
  if (typeof compData === 'object') {
    returnData.useShaVersion = compData.useShaVersion;
    returnData.fileWithVersionData = returnData.url + '/' + compData.fileWithVersionData;
    returnData.versionRegEx = compData.versionRegEx;
    returnData.useRegExMatchNumber = compData.useRegExMatchNumber;
  }
  return returnData;
}

function getChromiumComponent(comp) {
  return chromiumUrl + chromiumComponents[comp];
}

function decodeBase64(input) {
  return Buffer.from(input, 'base64').toString('utf-8');
}

async function addComponentVersions(readmeFile, suffix, component, indent = 2) {
  if (readmeFile.endsWith(`README.${suffix}`)) {
    let { cpeVersion, version } = await getVersionsFromChromiumFile(readmeFile);
    component.version = version;
    component.cpeVersion = cpeVersion;
  }
}

async function getVersionsFromChromiumFile(value) {
  const base64String = await downloadToString(value + '?format=TEXT');
  const fileContent = decodeBase64(base64String);

  const regEx = new RegExp(/version: (.*)/, 'i');
  const cpeVersionRegEx = new RegExp(/cpeprefix:.*:(.*)/, 'i');
  const matches = regEx.exec(fileContent);
  const cpeMatches = cpeVersionRegEx.exec(fileContent);
  let version;
  let cpeVersion;
  if (cpeMatches && cpeMatches.length > 1) {
    cpeVersion = cpeMatches[1];
  }
  if (matches && matches.length > 1) {
    version = matches[1];
  }
  return { cpeVersion, version };
}

function wrapWithChar(stringToWrap, wrapChar) {
  return `${wrapChar}${stringToWrap}${wrapChar}`;
}

function useBestVersion(versions) {
  for (const version of versions) {
    if (new RegExp('^' + semverPattern.source + '$').exec(version)) {
      return version;
    }
  }
  return versions[0];
}

function getSingleVersionItemString(depTree, returnString, indent, name, quoteChar, useYamlNotation) {
  const nameString = `${name}`;
  let versionString = `${wrapWithChar(depTree, quoteChar)}`;

  if (typeof depTree !== 'string') {
    versionString = `${useBestVersion([depTree.version, depTree.cpeVersion])}`;
    versionString = wrapWithChar(versionString, quoteChar);
  }
  let versionText = ` ${versionString}`;
  if (useYamlNotation) {
    versionText = `\n${' '.repeat(indent + 2)}- version: ${versionString}`;
  }
  returnString += `${' '.repeat(indent)}${nameString}:${versionText}\n`;

  return returnString;
}

function getVersionString(name, depTree, quoteChar = '', indent = 0, autoIndent = true, useYamlNotation = false) {
  let returnString = getSingleVersionItemString(depTree, '', indent, name, quoteChar, useYamlNotation);
  const subDependencies = depTree.deps;
  if (subDependencies) {
    for (const depName of Object.keys(subDependencies)) {
      const useIndent = autoIndent ? indent + 2 : indent;
      returnString += getVersionString(depName, subDependencies[depName], quoteChar, useIndent, autoIndent, useYamlNotation);
    }
  }
  return returnString;
}

function getDepSummary(deps) {
  let retString = 'Dependency Summary\n';
  retString += getVersionString('electron', deps) + '\n';
  return retString;
}

function getYamlSummary(deps) {
  let retString = 'versions:\n';
  retString += getVersionString('electron', deps, '"', 2, false, true);
  return retString;
}

function printSummary(dependencies) {
  if (toYaml) {
    console.log(getYamlSummary(dependencies));
  } else {
    console.log(getDepSummary(dependencies));
  }
}

function getPdfiumComponents(chromiumVersion) {
  let libOpenJpeg = {
    'libopenjpeg': 'third_party/libopenjpeg/README.pdfium',
  };
  // pdfium uses libopenjpeg20 in versions included prior to chromium 105
  if (chromiumVersion && Number(chromiumVersion.split('.')[0]) < 105) {
    libOpenJpeg = {
      'libopenjpeg20': 'third_party/libopenjpeg20/README.pdfium',
    };
  }
  const pdfiumComps = {
    'libtiff': 'third_party/libtiff/README.pdfium',
    'libpng16': 'third_party/libpng16/README.pdfium',
    ...libOpenJpeg,
  };
  return pdfiumComps;
}


async function downloadAndProcessDeps(release, force = false) {
  const chromiumVersion = getChromeVersion(release);
  chromiumUrl = `https://chromium.googlesource.com/chromium/src.git/+/refs/tags/${chromiumVersion}/`;
  const dependencies = {
    version: release.version,
    deps: {
      chromium: {
        version: chromiumVersion,
        url: chromiumUrl,
        deps: {},
      },
      node: {
        version: release.node,
        url: `https://github.com/nodejs/node/tree/v${release['node']}/deps`,
        deps: {
          'openssl': release.openssl,
          ...nodeReleases[release.node],
          // Electron specific overrides deviating from upstream Node.js versions
          'v8': release.v8,
          'uv': release.uv,
          'zlib': release.zlib,
        },
      },
    },
  };

  debugLog('Chromium URL', chromiumUrl);
  const chromiumGitHubBaseUrl = `https://raw.githubusercontent.com/chromium/chromium/${chromiumVersion}/`;
  const chromiumDepsFile = `${chromiumGitHubBaseUrl}DEPS`;

  const chromeJsonFilename = `chromium_deps_${chromiumVersion.replaceAll('.', '_')}.json`;
  const tempFolderName = 'tmp';
  const jsonDepFilename = join(__dirname, '..', tempFolderName, chromeJsonFilename);

  const chromePyFilename = `chromium_deps_${chromiumVersion.replaceAll('.', '_')}.py`;
  // download deps file and save to disk
  const localDepsFilename = join(__dirname, '..', tempFolderName, chromePyFilename);

  if (!fs.existsSync(jsonDepFilename) || force) {
    if (!fs.existsSync(localDepsFilename) || force) {
      fs.writeFileSync(localDepsFilename, initialPyContent);
      await downloadFile(chromiumDepsFile, localDepsFilename, { flags: 'a' });
      // Append a new line to the file to flush the previous writes
      await fs.promises.appendFile(localDepsFilename, '\n');
    }

    const cmd = `python ${__dirname}/dump_deps.py "${localDepsFilename}" "${jsonDepFilename}"`;
    // use python script to dump to json
    const proc = spawnSync(cmd, { shell: true });
    if (proc.error || proc.status !== 0) {
      console.error(proc.output.toString());
      process.exit(3);
    }
  }

  // import json file here
  chromiumDependencyMap = JSON.parse(fs.readFileSync(jsonDepFilename));

  // get more data for specific deps
  debugLog('Node.js deps page:', `https://github.com/nodejs/node/tree/v${release['node']}/deps`);

  debugLog('\nThird party component repos:');
  // iterate and show links to any defined component
  for (const comp of Object.keys(componentRepos)) {
    debugLog(comp);
    const repo = getComponentRepoUrl(comp);
    const compData = getComponentData(comp);
    debugLog(' ', repo);
    dependencies.deps.chromium.deps[comp] = {
      url: repo,
      version: '',
      deps: {},
    };

    if (compData.useShaVersion) {
      const regex = new RegExp(shaPattern);
      const shaMatches = regex.exec(repo);
      if (shaMatches && shaMatches.length) {
        dependencies.deps.chromium.deps[comp].version = shaMatches[0];
      }
    } else if (compData.fileWithVersionData !== undefined) {
      if (compData.fileWithVersionData === 'README.chromium') {
        const readmeFile = repo + '/' + compData.fileWithVersionData;
        await addComponentVersions(readmeFile, 'chromium', dependencies.deps.chromium.deps[comp]);
      } else {
        // We can try and get the version from a readme or similar file
        dependencies.deps.chromium.deps[comp].versionFile = compData.fileWithVersionData;
        const base64String = await downloadToString(compData.fileWithVersionData + '?format=TEXT');
        const fileContent = decodeBase64(base64String);
        const regEx = new RegExp(compData.versionRegEx, 'i');
        const versionMatches = regEx.exec(fileContent);
        if (versionMatches && versionMatches.length) {
          dependencies.deps.chromium.deps[comp].version = versionMatches[compData.useRegExMatchNumber];
        }
      }

    }

    if (comp === 'pdfium') {
      const pdfiumComps = getPdfiumComponents(dependencies.deps.chromium.version);
      for (const pdfiumComp of Object.keys(pdfiumComps)) {
        const readmeFile = repo + '/' + pdfiumComps[pdfiumComp];
        dependencies.deps.chromium.deps[comp].deps[pdfiumComp] = {
          url: readmeFile,
          version: '',
          cpeVersion: '',
        };

        debugLog(' ', pdfiumComp);
        await addComponentVersions(readmeFile, 'pdfium', dependencies.deps.chromium.deps[comp].deps[pdfiumComp], 4);
      }
    }
  }

  debugLog('\nChromium specific components:');
  // iterate over chromium components
  for (const comp of Object.keys(chromiumComponents)) {
    const value = getChromiumComponent(comp);
    dependencies.deps.chromium.deps[comp] = {
      url: value,
      version: '',
      cpeVersion: '',
    };
    debugLog(comp);
    debugLog('  reading file:', value);
    await addComponentVersions(value, 'chromium', dependencies.deps.chromium.deps[comp]);
  }

  return dependencies;
}

async function main() {
  checkArgs();

  let tag = getTagFromArg();

  const release = getRelease(tag);

  const dependencies = await downloadAndProcessDeps(release);

  debugLog(JSON.stringify(dependencies, null, 2));

  printSummary(dependencies);
}

// only run main if this is not being imported
if (require.main === module) {
  main();
}

async function getElectronDependencies(tag) {
  const release = getRelease(tag);
  return downloadAndProcessDeps(release);
}

module.exports = { downloadFile, getElectronDependencies }
