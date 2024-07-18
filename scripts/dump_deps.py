#!/usr/env python3
import importlib
import sys
import json

# get the filename from the first argument
importFilename = sys.argv[1]
outputFilename = sys.argv[2]

# import python module named importFilename
print('trying to import', importFilename)
chromium_deps = importlib.import_module(importFilename)

with open(outputFilename, 'w') as f:
  json.dump(chromium_deps.deps, f, indent=2)
