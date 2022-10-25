import { getChromiumDepsFilename } from '../src/download';

describe('Download tests', () => {
  it('should be able to get a chromium deps file url', () => {
    const tag = '108.0.5329.0';
    expect(getChromiumDepsFilename(tag)).toEqual(
      `https://raw.githubusercontent.com/chromium/chromium/${tag}/DEPS`
    );
  });
});
