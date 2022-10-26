import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { downloadFile, getChromiumDepsFilename } from '../src/download';
import { expectAllStrings } from './test-utils';

describe('Download tests', () => {
  it('should be able to get a chromium deps file url', () => {
    const tag = '108.0.5329.0';
    expect(getChromiumDepsFilename(tag)).toEqual(
      `https://raw.githubusercontent.com/chromium/chromium/${tag}/DEPS`
    );
  });

  it('should download DEPS file for chromium version', () => {
    const tag = '108.0.5329.0';
    const localFile = join(__dirname, 'logs', 'local_chromium_deps');
    downloadFile(getChromiumDepsFilename(tag), localFile);
    const fileContent = readFileSync(localFile).toString();
    const expectedStrings = [
      'vars =',
      'pdfium_revision',
      'ffmpeg_revision',
      'src/third_party/ffmpeg',
    ];
    expectAllStrings(expectedStrings, fileContent);
  });
});
