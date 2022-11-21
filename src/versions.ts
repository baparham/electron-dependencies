import electronReleases from 'electron-releases/lite.json';
import { getComponentConfig } from './component-data';
import { decodeBase64, downloadToString } from './download';
import { shaPattern } from './regex-patterns';
import { getComponentUrl } from './url-functions';

export function getVTagName(version: string): string {
  let tag = version;
  if (tag.startsWith('v')) {
    return tag;
  }
  return `v${tag}`;
}

export function getSanitizedVersion(version: string): string {
  let sanitizedVersion = version;
  if (sanitizedVersion.startsWith('v')) {
    sanitizedVersion = sanitizedVersion.slice(1);
  }
  return sanitizedVersion;
}

export function getChromiumVersionFromElectronVersion(version: string): string {
  const release = electronReleases.find(r => r.tag_name === getVTagName(version));
  if (release === undefined) {
    throw new Error(`Could not find Electron release ${version}`);
  }
  return release.deps.chrome;
}

export async function getComponentVersion(component: string, chromiumTag: string): Promise<string> {
  const componentConfig = getComponentConfig(component);
  const compUrl = await getComponentUrl(component, chromiumTag)
  if (componentConfig.useShaVersion) {
    const regex = new RegExp(shaPattern);
    const shaMatches = regex.exec(compUrl);
    if (shaMatches && shaMatches.length) {
      return shaMatches[0];
    }
  } else {
    const fileVersionUrl = compUrl + '/' + componentConfig.fileWithVersionData;
    // TODO add file with version download here and version parsing
    const base64String = await downloadToString(componentConfig.fileWithVersionData + '?format=TEXT');
    const fileContent = decodeBase64(base64String);
    const regEx = new RegExp(componentConfig.versionRegEx, 'i');
    const versionMatches = regEx.exec(fileContent);
    if (versionMatches && versionMatches.length) {
      return versionMatches[componentConfig.useRegExMatchNumber];
    }
  }
  return '';
}
