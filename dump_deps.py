#!/usr/env python3
import chromium_deps
import json

filename = 'chromium_deps.json'

with open(filename, 'w') as f:
  json.dump(chromium_deps.deps, f, indent=2)
