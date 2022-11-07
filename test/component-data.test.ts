import { getComponentConfig } from '../src/component-data';
import { getComponentVersion } from '../src/versions';

describe('Component Data tests', () => {
  it('should test getting component config', () => {
    // Just test a few components so this doesn't get overdefined
    expect(getComponentConfig('ffmpeg').key).toEqual('src/third_party/ffmpeg');
    expect(getComponentConfig('wayland').useShaVersion).toEqual(false);
    expect(getComponentConfig('pdfium').useShaVersion).toEqual(true);
  });

  it('should test getting hydrated component data', async () => {
    const chromiumTag = '108.0.5329.0';
    const compWithShaVersioning = 'pdfium';
    let expectedCompVersion = '06749a7a52305b11d6f6b578f3c3a2ea73d8129c';
    expect(await getComponentVersion(compWithShaVersioning, chromiumTag))
      .toEqual(expectedCompVersion);
  });
});
