#!/usr/bin/env bash

# ensure we ignore anything in .yarn since that may get updated simply by
# running yarn install earlier
if [ "$(git status --porcelain | grep -v ". .yarn/")" = "" ]; then
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
echo //registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN} > .npmrc
npm publish --registry=https://registry.npmjs.org/
rm -rf .npmrc

# Push commit and tag to remote
git push origin main --follow-tags
