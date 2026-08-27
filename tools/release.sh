#!/usr/bin/env bash

# ensure we ignore anything in .yarn since that may get updated simply by
# running yarn install earlier
UNCOMMITTED=$(git status --porcelain | grep -v ". .yarn/")

# index.json may have been backfilled/updated in a commit that landed on main
# since the last release, without leaving any uncommitted changes in this run.
# Compare it against the last release tag to catch that case too.
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [ -n "$LAST_TAG" ]; then
  INDEX_CHANGED_SINCE_RELEASE=$(git diff --name-only "$LAST_TAG" -- index.json)
else
  # No previous release tag, so treat index.json as changed.
  INDEX_CHANGED_SINCE_RELEASE="index.json"
fi

if [ -z "$UNCOMMITTED" ] && [ -z "$INDEX_CHANGED_SINCE_RELEASE" ]; then
  echo "No new data, nothing to commit";
  exit;
fi

#Exit on failure
set -xe

git config user.email baparham@gmail.com
git config user.name Brad Parham
git add index.json

# Bump patch version with new changes
yarn version patch

git add package.json
# if we do end up having updated anything (e.g. process-versions) include .yarn
git add .yarn yarn.lock

VERSION=$(node -p -e "require('./package.json').version")

# Commit and tag the repo
git commit -m "bump version to v${VERSION}"
git tag v${VERSION}

# Publish new version to NPM
npm publish --registry=https://registry.npmjs.org/

# Push commit and tag to remote
git push origin main --follow-tags
