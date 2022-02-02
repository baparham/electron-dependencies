const fs = require('fs');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const releases = require('electron-releases');
const { join } = require('path');
const url = require('url');
const { spawnSync } = require('child_process');
var argv = require('minimist')(process.argv.slice(2));

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
  'fontconfig': {
    key: 'src/third_party/fontconfig/src',
    useShaVersion: false,
    fileWithVersionData: 'README',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  // 'ioswebkit': 'src/ios/third_party/webkit/src',
};

const chromiumComponents = {
  'libxml2': 'third_party/libxml/README.chromium',
  'sqlite': 'third_party/sqlite/README.chromium',
  'libxslt': 'third_party/libxslt/README.chromium',
  'libwebp': 'third_party/libwebp/README.chromium',
  'opus': 'third_party/opus/README.chromium',
};

const nodeComps = {
  'acorn': 'deps/acorn',
  'brotli': 'deps/brotli',
  'cares': 'deps/cares',
  'icu-small': 'deps/icu-small',
  'llhttp': 'deps/llhttp',
  'nghttp2': 'deps/nghttp2',
};

let chromiumDependencyMap;
let chromiumUrl;

let dependencies = {};

function getChromeVersion(release) {
  const chromeVersion = release.deps.chrome;
  if (!chromeVersion) {
    throw 'Chrome version not detected';
  }
  return chromeVersion;
}

function getRelease(tag) {
  const release = releases.find(release => release.tag_name === `v${tag}`);

  if (release === undefined) {
    console.error('Could not find electron release matching', argv._[0]);
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
  // console.log('Downloading', fileUrl);
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

async function addComponentVersions(readmeFile, suffix, component, indent=2) {
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

function getVersionString(name, depTree, indent=0) {
  let returnString = '';
  if (typeof depTree === 'string') {
    returnString += `${' '.repeat(indent)}${name}: ${depTree}\n`;
  } else if (depTree.version) {
    returnString += `${' '.repeat(indent)}${name}: ${depTree.version}${depTree.cpeVersion ? ' or ' + depTree.cpeVersion : ''}\n`;
  }
  const subDependencies = depTree.deps;
  if (subDependencies) {
    for (const depName of Object.keys(subDependencies)) {
      returnString += getVersionString(depName, subDependencies[depName], indent + 2)
    }
  }
  return returnString;
}

function getDepSummary(deps) {
  let retString = 'Dependency Summary\n';
  retString += getVersionString('electron', deps) + '\n';
  return retString;
}

async function main() {
  checkArgs();

  let tag = getTagFromArg();

  const release = getRelease(tag);

  const chromiumVersion = getChromeVersion(release);
  chromiumUrl = `https://chromium.googlesource.com/chromium/src.git/+/refs/tags/${chromiumVersion}/`;
  dependencies = {
    version: release.deps.version,
    deps: {
      chromium: {
        version: chromiumVersion,
        url: chromiumUrl,
        deps: {},
      },
      node: {
        version: release.deps.node,
        url: `https://github.com/nodejs/node/tree/v${release.deps['node']}/deps`,
        deps: {
          'v8': release.deps.v8,
          'uv': release.deps.uv,
          'zlib': release.deps.zlib,
          'openssl': release.deps.openssl,
        },
      },
    },
  };

  // console.log('Chromium URL', chromiumUrl);
  const chromiumGitHubBaseUrl = `https://raw.githubusercontent.com/chromium/chromium/${chromiumVersion}/`;
  const chromiumDepsFile = `${chromiumGitHubBaseUrl}DEPS`;

  // download deps file and save to disk
  const localDepsFilename = join(__dirname, 'chromium_deps.py');
  fs.writeFileSync(localDepsFilename, initialPyContent);
  await downloadFile(chromiumDepsFile, localDepsFilename, { flags: 'a' });

  // use python script to dump to json
  const proc = spawnSync('python3 dump_deps.py', {shell: true});
  if (proc.error) {
    console.log(proc.output.toString());
    process.exit(3);
  }

  // import json file here
  chromiumDependencyMap = JSON.parse(fs.readFileSync(join(__dirname, 'chromium_deps.json')));

  // get more data for specific deps
  // console.log(release.deps);
  // console.log('Node.js deps page:', `https://github.com/nodejs/node/tree/v${release.deps['node']}/deps`);

  // console.log('\nThird party component repos:');
  // iterate and show links to any defined component
  for (const comp of Object.keys(componentRepos)) {
    // console.log(comp);
    const repo = getComponentRepoUrl(comp);
    const compData = getComponentData(comp);
    // console.log(' ', repo);
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

    if (comp === 'pdfium') {
      const pdfiumComps = {
        'libtiff': 'third_party/libtiff/README.pdfium',
        'libopenjpeg20': 'third_party/libopenjpeg20/README.pdfium',
      };
      for (const pdfiumComp of Object.keys(pdfiumComps)) {
        const readmeFile = repo + '/' + pdfiumComps[pdfiumComp];
        dependencies.deps.chromium.deps[comp].deps[pdfiumComp] = {
          url: readmeFile,
          version: '',
          cpeVersion: '',
        };

        // console.log(' ', pdfiumComp);
        await addComponentVersions(readmeFile, 'pdfium', dependencies.deps.chromium.deps[comp].deps[pdfiumComp], 4);
      }
    }
  }

  // console.log('\nChromium specific components:');
  // iterate over chromium components
  for (const comp of Object.keys(chromiumComponents)) {
    const value = getChromiumComponent(comp);
    dependencies.deps.chromium.deps[comp] = {
      url: value,
      version: '',
      cpeVersion: '',
    };
    // console.log(comp);
    // console.log('  reading file:', value);
    await addComponentVersions(value, 'chromium', dependencies.deps.chromium.deps[comp]);
  }

  // console.log(JSON.stringify(dependencies, null, 2));
  console.log(getDepSummary(dependencies));
}

main();
