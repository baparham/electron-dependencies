import electronReleases from 'electron-releases/lite.json';

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
