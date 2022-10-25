import { chromiumGitHubRawBaseUrl } from './consts';

export function getChromiumDepsFilename(tag: string) {
  const chromiumGitHubBaseUrl = `${chromiumGitHubRawBaseUrl}${tag}/`;
  return `${chromiumGitHubBaseUrl}DEPS`;
}
