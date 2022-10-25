import electronReleases from 'electron-releases/lite.json';
import { getChromiumVersionFromElectronVersion, getSanitizedVersion, getVTagName } from '../src/versions';

describe('Version tests', () => {
  it('should get chromium version from electron release', () => {
    let tag = 'v21.0.0';
    const chrome = '106.0.5249.51';
    const release = electronReleases.find(r => r.tag_name === tag);
    expect(release.deps.chrome).toEqual(chrome);
    expect(getChromiumVersionFromElectronVersion(tag)).toEqual(chrome);
    tag = '21.0.0';
    expect(getChromiumVersionFromElectronVersion(tag)).toEqual(chrome);
  });

  it('should get chromium version from incorrect electron release', () => {
    const tag = 'v21.999.999';
    expect(() => getChromiumVersionFromElectronVersion(tag)).toThrowError();
  });

  it('should test getSanitizedVersion', () => {
    expect(getSanitizedVersion('v1.2.3')).toEqual('1.2.3');
    expect(getSanitizedVersion('1.2.3')).toEqual('1.2.3');
  });

  it('should test getVTagName', () => {
    expect(getVTagName('v1.2.3')).toEqual('v1.2.3');
    expect(getVTagName('1.2.3')).toEqual('v1.2.3');
  });
});
