import { createWriteStream, mkdirSync, WriteStream } from 'node:fs';
import { get, RequestOptions } from 'node:https';
import { dirname } from 'node:path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { chromiumGitHubRawBaseUrl } from './consts';

export function getChromiumDepsFilename(tag: string): string {
  const chromiumGitHubBaseUrl = `${chromiumGitHubRawBaseUrl}${tag}/`;
  return `${chromiumGitHubBaseUrl}DEPS`;
}

function downloadToStream(fileUrl: string, localWriteStream: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = new URL(fileUrl);
    if (process.env.https_proxy) {
      const proxyAgent = new HttpsProxyAgent(process.env.https_proxy);
      options.agent = proxyAgent;
    }
    localWriteStream.on('error', reject);

    const request = get(options, (response) => {
      response.pipe(localWriteStream);
    });
    localWriteStream.on('finish', resolve);
    request.on('error', reject);
    request.end();
  });
}

export function downloadFile(
  remoteFile: string, localFile: string, fileOptions?: any
): Promise<void> {
  mkdirSync(dirname(localFile), { recursive: true });
  const localWriteStream = createWriteStream(localFile, fileOptions);
  return downloadToStream(remoteFile, localWriteStream);
}
