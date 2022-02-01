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

const componentRepos = {
  'freetype': 'src/third_party/freetype/src',
  'ffmpeg': 'src/third_party/ffmpeg',
  'pdfium': 'src/third_party/pdfium',
  'libsrtp': 'src/third_party/libsrtp',
  'openh264': 'src/third_party/openh264/src',
  'angle': 'src/third_party/angle',
  'boringssl': 'src/third_party/boringssl/src',
  'fontconfig': 'src/third_party/fontconfig/src',
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

let json;
let chromeUrl;

function getChromeVersion(release) {
  const chromeVersion = release.deps.chrome;
  if (chromeVersion) {
    console.log('Found Chrome version: ' + chromeVersion);
  } else {
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
  console.log('Downloading', fileUrl);
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

function getComponentRawRepo(comp) {
  return json[componentRepos[comp]];
}

function getComponentRepo(comp) {
  const rawRepo = getComponentRawRepo(comp);
  if (rawRepo.url) {
    return rawRepo.url.replace('@', '/+/');
  }
  return rawRepo.replace('@', '/+/');
}

function getChromiumComponent(comp) {
  return chromeUrl + chromiumComponents[comp];
}

function decodeBase64(input) {
  return Buffer.from(input, 'base64').toString('utf-8');
}

async function printComponentVersions(readmeFile, suffix, indent=2) {
  if (readmeFile.endsWith(`README.${suffix}`)) {
    let { cpeVersion, version } = await getVersionsFromChromiumFile(readmeFile);

    if (cpeVersion !== undefined) {
      console.log(' '.repeat(indent) + 'found cpe version:', cpeVersion);
    }
    if (version !== undefined) {
      console.log(' '.repeat(indent) + 'found version:', version);
    }
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

async function main() {
  checkArgs();

  let tag = getTagFromArg();

  const release = getRelease(tag);

  const chromeVersion = getChromeVersion(release);

  chromeUrl = `https://chromium.googlesource.com/chromium/src.git/+/refs/tags/${chromeVersion}/`;
  console.log('Chromium URL', chromeUrl);
  const chromeGitHub = `https://raw.githubusercontent.com/chromium/chromium/${chromeVersion}/`;
  const chromeDepsFile = `${chromeGitHub}DEPS`;

  // download deps file and save to disk
  const localDepsFilename = join(__dirname, 'chromium_deps.py');
  fs.writeFileSync(localDepsFilename, initialPyContent);
  await downloadFile(chromeDepsFile, localDepsFilename, { flags: 'a' });

  // use python script to dump to json
  const proc = spawnSync('python3 dump_deps.py', {shell: true});
  if (proc.error) {
    console.log(proc.output.toString());
    process.exit(3);
  }

  // import json file here
  json = JSON.parse(fs.readFileSync(join(__dirname, 'chromium_deps.json')));

  // get more data for specific deps
  console.log(release.deps);
  console.log('Node.js deps page:', `https://github.com/nodejs/node/tree/v${release.deps['node']}/deps`);

  console.log('\nThird party component repos:');
  // iterate and show links to any defined component
  for (const comp of Object.keys(componentRepos)) {
    console.log(comp);
    const repo = getComponentRepo(comp);
    console.log(' ', repo);
    if (comp === 'pdfium') {
      const pdfiumComps = {
        'libtiff': 'third_party/libtiff/README.pdfium',
        'libopenjpeg20': 'third_party/libopenjpeg20/README.pdfium',
      };
      for (const pdfiumComp of Object.keys(pdfiumComps)) {
        console.log(' ', pdfiumComp);
        const readmeFile = repo + '/' + pdfiumComps[pdfiumComp];
        await printComponentVersions(readmeFile, 'pdfium', 4);
      }
    }
  }

  console.log('\nChromium specific components:');
  // iterate over chromium components
  for (const comp of Object.keys(chromiumComponents)) {
    console.log(comp);
    const value = getChromiumComponent(comp);
    console.log('  reading file:', value);
    await printComponentVersions(value, 'chromium');
  }
}

main();
