"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
const path_1 = require("path");
const child_process_1 = require("child_process");
const releases = require('electron-releases');
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
const semverPattern = /([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?/;
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
    'libvpx': {
        key: 'src/third_party/libvpx/source/libvpx',
        useShaVersion: false,
        fileWithVersionData: 'CHANGELOG',
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
let chromiumUrl = '';
;
let dependencies;
function debugLog(...msgs) {
    if (verbose) {
        console.log(...msgs);
    }
}
function getChromeVersion(release) {
    const chromeVersion = release.deps.chrome;
    if (!chromeVersion) {
        throw 'Chrome version not detected';
    }
    return chromeVersion;
}
function getRelease(tag) {
    debugLog('Finding electron release with tag', `v${tag}`);
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
    debugLog('Downloading', fileUrl);
    const localWriteStream = fs.createWriteStream(localFilename, fileOptions);
    return downloadToStream(fileUrl, localWriteStream);
}
function downloadToStream(fileUrl, localWriteStream) {
    return new Promise((resolve, reject) => {
        const options = new URL(fileUrl);
        if (process.env.https_proxy) {
            const proxyAgent = (0, https_proxy_agent_1.default)(process.env.https_proxy);
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
        const options = new URL(fileUrl);
        if (process.env.https_proxy) {
            const proxyAgent = (0, https_proxy_agent_1.default)(process.env.https_proxy);
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
    }
    else if (typeof componentData === 'string') {
        return chromiumDependencyMap[componentData];
    }
    else {
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
    const compUrl = getComponentRepoUrl(comp);
    if (compData !== undefined) {
        if (!compData.useShaVersion) {
            compData.fileWithVersionData = compUrl + '/' + compData.fileWithVersionData;
        }
        return Object.assign({ url: compUrl }, compData);
    }
    else {
        return {
            url: compUrl,
            useShaVersion: true,
        };
    }
}
function getChromiumComponent(comp) {
    return chromiumUrl + chromiumComponents[comp];
}
function decodeBase64(input) {
    return Buffer.from(input, 'base64').toString('utf-8');
}
function addComponentVersions(readmeFile, suffix, component, indent = 2) {
    return __awaiter(this, void 0, void 0, function* () {
        if (readmeFile.endsWith(`README.${suffix}`)) {
            let { cpeVersion, version } = yield getVersionsFromChromiumFile(readmeFile);
            if (version !== undefined) {
                component.version = version;
            }
            if (cpeVersion !== undefined) {
                component.cpeVersion = cpeVersion;
            }
        }
    });
}
function getVersionsFromChromiumFile(value) {
    return __awaiter(this, void 0, void 0, function* () {
        const base64String = yield downloadToString(value + '?format=TEXT');
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
    });
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
function printSummary() {
    if (toYaml) {
        console.log(getYamlSummary(dependencies));
    }
    else {
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
    const pdfiumComps = Object.assign({ 'libtiff': 'third_party/libtiff/README.pdfium', 'libpng16': 'third_party/libpng16/README.pdfium' }, libOpenJpeg);
    return pdfiumComps;
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
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
        debugLog('Chromium URL', chromiumUrl);
        const chromiumGitHubBaseUrl = `https://raw.githubusercontent.com/chromium/chromium/${chromiumVersion}/`;
        const chromiumDepsFile = `${chromiumGitHubBaseUrl}DEPS`;
        // download deps file and save to disk
        const localDepsFilename = (0, path_1.join)(__dirname, 'chromium_deps.py');
        fs.writeFileSync(localDepsFilename, initialPyContent);
        yield downloadFile(chromiumDepsFile, localDepsFilename, { flags: 'a' });
        // use python script to dump to json
        const proc = (0, child_process_1.spawnSync)('python3 dump_deps.py', { shell: true });
        if (proc.error) {
            console.error(proc.output.toString());
            process.exit(3);
        }
        // import json file here
        chromiumDependencyMap = JSON.parse(fs.readFileSync((0, path_1.join)(__dirname, 'chromium_deps.json')).toString());
        // get more data for specific deps
        debugLog('Node.js deps page:', `https://github.com/nodejs/node/tree/v${release.deps['node']}/deps`);
        debugLog('\nThird party component repos:');
        // iterate and show links to any defined component
        for (const comp of Object.keys(componentRepos)) {
            debugLog(comp);
            const repo = getComponentRepoUrl(comp);
            const compData = getComponentData(comp);
            debugLog(' ', repo);
            let currentComponent = {
                url: repo,
                version: '',
                deps: {},
            };
            if (compData.useShaVersion) {
                const regex = new RegExp(shaPattern);
                const shaMatches = regex.exec(repo);
                if (shaMatches && shaMatches.length) {
                    currentComponent.version = shaMatches[0];
                }
            }
            else if (compData.fileWithVersionData !== undefined) {
                // We can try and get the version from a readme or similar file
                currentComponent.versionFile = compData.fileWithVersionData;
                const base64String = yield downloadToString(compData.fileWithVersionData + '?format=TEXT');
                const fileContent = decodeBase64(base64String);
                const regEx = new RegExp(compData.versionRegEx, 'i');
                const versionMatches = regEx.exec(fileContent);
                if (versionMatches && versionMatches.length) {
                    currentComponent.version = versionMatches[compData.useRegExMatchNumber];
                }
            }
            if (comp === 'pdfium') {
                const pdfiumComps = getPdfiumComponents(dependencies.deps.chromium.version);
                for (const pdfiumComp of Object.keys(pdfiumComps)) {
                    const readmeFile = repo + '/' + pdfiumComps[pdfiumComp];
                    currentComponent.deps[pdfiumComp] = {
                        url: readmeFile,
                        version: '',
                        cpeVersion: '',
                    };
                    debugLog(' ', pdfiumComp);
                    yield addComponentVersions(readmeFile, 'pdfium', currentComponent.deps[pdfiumComp], 4);
                }
            }
            dependencies.deps.chromium.deps[comp] = currentComponent;
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
            yield addComponentVersions(value, 'chromium', dependencies.deps.chromium.deps[comp]);
        }
        debugLog(JSON.stringify(dependencies, null, 2));
        printSummary();
    });
}
main();
