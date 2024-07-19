# electron-dependencies
Programmatically determines as many dependency versions as possible from Electron

## Programatic Usage
```javascript
// Imports as a plain JSON object
const electronDependencies = require('electron-dependencies');
const version = '29.0.0';
const deps = electronDependencies[version];

const ffmpegVersion = deps.chromium.deps.ffmpeg.version
const ffmpegUrl = deps.chromium.deps.ffmpeg.url
```

## Build Requirements (runs during install)
This repo depends on python 3.x available on the system while downloading data
from the Chromium repository to determine dependencies.

## Generating version lists (only within this project, not as a library)
`yarn run listversions 20.0.0-beta.1`

If you wish to see the source repos and more debug info, add `--verbose` to the
call.

If you wish to output in yaml-like format, use `--yaml`
