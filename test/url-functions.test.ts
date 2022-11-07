import { getChromiumUrl, getComponentUrl, getNodeJsDepsUrl } from '../src/url-functions';

describe('Url function tests', () => {
  it('should test getting the Chromium url', () => {
    const tag = '108.0.5329.0';
    const expectedUrl = `https://chromium.googlesource.com/chromium/src.git/+/refs/tags/${tag}`;
    expect(getChromiumUrl(tag)).toEqual(expectedUrl);
  });

  it('should test getting the Node.js deps url', () => {
    const version = '18.12.1';
    const expectedUrl = `https://github.com/nodejs/node/tree/v${version}/deps`;
    expect(getNodeJsDepsUrl(version)).toEqual(expectedUrl);
    const tag = 'v18.12.1';
    expect(getNodeJsDepsUrl(tag)).toEqual(expectedUrl);
  });

  it('should test getting component repo url', async () => {
    const chromiumTag = '108.0.5329.0';
    let component = 'ffmpeg';
    let expectedUrl =
      'https://chromium.googlesource.com/chromium/third_party/ffmpeg.git/+/b9f01c3c54576330b2cf8918c54d5ee5be8faefe';
    expect(await getComponentUrl(component, chromiumTag)).toEqual(expectedUrl);
    component = 'freetype';
    expectedUrl =
      'https://chromium.googlesource.com/chromium/src/third_party/freetype2.git/+/df2601395f96d5d513f15795a725abfe76214d95';
    expect(await getComponentUrl(component, chromiumTag)).toEqual(expectedUrl);
  });
});
