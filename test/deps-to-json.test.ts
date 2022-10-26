import { getChromiumDependencyMap } from '../src/deps-to-json';

describe('Deps to Json tests', () => {
  it('should test converting DEPS file to json', async () => {
    // Gets a real deps version from the web, so this needs to be valid
    const tag = '108.0.5329.0';
    const dependencyMap = await getChromiumDependencyMap(tag);
    expect(dependencyMap['src/third_party/ffmpeg']).toBeDefined();
  });
});
