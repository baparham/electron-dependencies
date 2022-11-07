import { getComponentConfig } from './component-data';
import { chromiumBaseUrl, chromiumTagsSuffix } from './consts';
import { getChromiumDependencyMap } from './deps-to-json';
import { getSanitizedVersion } from './versions';

export function getChromiumUrl(tag: string): string {
  return chromiumBaseUrl + chromiumTagsSuffix + tag;
}

export function getNodeJsDepsUrl(versionOrTag: string): string {
  return `https://github.com/nodejs/node/tree/v${getSanitizedVersion(versionOrTag)}/deps`;
}

function sanitizeDepsUrl(rawUrl: string | { url: string }): string {
  let urlString: string;
  if (typeof rawUrl === 'string') {
    urlString = rawUrl;
  } else {
    urlString = rawUrl.url;
  }
  return urlString.replace('@', '/+/');
}

export async function getComponentUrl(component: string, chromiumVersion: string): Promise<string> {
  const compConfig = getComponentConfig(component);
  const chromiumDepsData = await getChromiumDependencyMap(chromiumVersion);
  const componentRawUrl = chromiumDepsData[compConfig.key];
  return sanitizeDepsUrl(componentRawUrl);
}
