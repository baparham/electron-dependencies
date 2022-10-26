import { chromiumBaseUrl, chromiumTagsSuffix } from './consts';

export function getChromiumUrl(tag: string): string {
  return chromiumBaseUrl + chromiumTagsSuffix + tag;
}
