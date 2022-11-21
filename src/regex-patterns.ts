// More strict semver style matching
// source https://github.com/npm/node-semver/issues/32
export const semverPattern =
  /([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?/;
// Matches non semver things like 69, 1728389, 1.my-release, 3, 2022, etc
export const lenientVersionPattern = /([\d]+(?:\.[a-zA-Z0-9-]+)?(?:\.[a-zA-Z0-9-]+\.?)?)/;
export const shaPattern = /([A-Fa-f0-9]{40})/;
