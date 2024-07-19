#!/usr/bin/env bash

if [ "$(git status --porcelain)" = "" ]; then
  echo "No new data, nothing to commit";
  exit;
fi

#Exit on failure
set -xe

git config user.email baparham@gmail.com
git config user.name Brad Parham
git add index.json

# Bump patch version with new changes
yarn version --patch --message "bump version to %s"

# Publish new version to NPM
echo //registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN} > .npmrc
npm publish --registry=https://registry.npmjs.org/
rm -rf .npmrc

git push origin main --follow-tags
