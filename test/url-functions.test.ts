import { getChromiumUrl } from '../src/url-functions';

describe('Url function tests', () => {
  it('should test getting the Chromium url', () => {
    const tag = '108.0.5329.0';
    const expectedUrl = `https://chromium.googlesource.com/chromium/src.git/+/refs/tags/${tag}`;
    expect(getChromiumUrl(tag)).toEqual(expectedUrl);
  });
});
