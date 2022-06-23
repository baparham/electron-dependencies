# electron-dependencies
Programmatically determines as many dependency versions as possible from Electron

## Requirements
This repo depends on python 3.x available on the system while downloading data
from the Chromium repository to determine dependencies.

## Generating version lists
`yarn run listversions 20.0.0-beta.1`

If you wish to see the source repos and more debug info, add `--verbose` to the
call.

If you wish to output in yaml-like format, use `--yaml`
