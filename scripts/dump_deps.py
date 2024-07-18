#!/usr/env python3
import importlib
import importlib.util
import sys
import json

# get the filename from the first argument
importFilename = sys.argv[1]
outputFilename = sys.argv[2]

spec = importlib.util.spec_from_file_location(
  name="chrome_deps_imported_module",
  location=importFilename
)
chromium_deps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chromium_deps)

with open(outputFilename, 'w') as f:
  json.dump(chromium_deps.deps, f, indent=2)
