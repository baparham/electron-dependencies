import { semverPattern, lenientVersionPattern, shaPattern } from './regex-patterns';

interface ShaVersionedComponentConfig {
  key: string,
  useShaVersion: true,
}

interface VersionedComponentConfig {
  key: string,
  useShaVersion: false,
  fileWithVersionData: string,
  versionRegEx: RegExp,
  useRegExMatchNumber: number,
}

type ComponentConfigMap = { [id: string]: ShaVersionedComponentConfig | VersionedComponentConfig };

const componentConfiguration: ComponentConfigMap = {
  'freetype': {
    key: 'src/third_party/freetype/src',
    useShaVersion: false,
    fileWithVersionData: 'README',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'ffmpeg': {
    key: 'src/third_party/ffmpeg',
    useShaVersion: false,
    fileWithVersionData: 'RELEASE',
    versionRegEx: lenientVersionPattern,
    useRegExMatchNumber: 0,
  },
  'pdfium': {
    key: 'src/third_party/pdfium',
    useShaVersion: true,
  },
  'libsrtp': {
    key: 'src/third_party/libsrtp',
    useShaVersion: false,
    fileWithVersionData: 'LIBSRTP_VERSION',
    versionRegEx: shaPattern,
    useRegExMatchNumber: 0
  },
  'openh264': {
    key: 'src/third_party/openh264/src',
    useShaVersion: false,
    fileWithVersionData: 'RELEASES',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'angle': {
    key: 'src/third_party/angle',
    useShaVersion: true,
  },
  'boringssl': {
    key: 'src/third_party/boringssl/src',
    useShaVersion: true,
  },
  'fontconfig': {
    key: 'src/third_party/fontconfig/src',
    useShaVersion: false,
    fileWithVersionData: 'README',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'libvpx': {
    key: 'src/third_party/libvpx/source/libvpx',
    useShaVersion: false,
    fileWithVersionData: 'CHANGELOG',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
  'wayland': {
    key: 'src/third_party/wayland/src',
    useShaVersion: false,
    fileWithVersionData: 'meson.build',
    versionRegEx: semverPattern,
    useRegExMatchNumber: 0,
  },
};

type ChromiumComponent = 'libxml2' | 'sqlite' | 'libxslt' | 'libwebp' | 'opus';

const chromiumComponents: { [id in ChromiumComponent]: string } = {
  'libxml2': 'third_party/libxml/README.chromium',
  'sqlite': 'third_party/sqlite/README.chromium',
  'libxslt': 'third_party/libxslt/README.chromium',
  'libwebp': 'third_party/libwebp/README.chromium',
  'opus': 'third_party/opus/README.chromium',
};

export function getComponentConfig(component: string): ShaVersionedComponentConfig | VersionedComponentConfig {
  return componentConfiguration[component];
}
