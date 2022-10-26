import { getComponentConfig } from '../src/component-data';

describe('Component Data tests', () => {
  it('should test getting component config', () => {
    // Just test a few components so this doesn't get overdefined
    expect(getComponentConfig('ffmpeg').key).toEqual('src/third_party/ffmpeg');
    expect(getComponentConfig('wayland').useShaVersion).toEqual(false);
    expect(getComponentConfig('pdfium').useShaVersion).toEqual(true);
  });
});
