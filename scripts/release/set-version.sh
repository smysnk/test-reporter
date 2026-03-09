#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${THIS_DIR}/paths.sh"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <semver>" >&2
  echo "Example: $0 0.1.412" >&2
  exit 1
fi

NEW_VERSION="$1"
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: $NEW_VERSION (expected format: X.Y.Z)" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Missing node in PATH" >&2
  exit 1
fi

PACKAGE_DIRS_JSON="$(printf '%s\n' "${PUBLISH_PACKAGE_DIRS[@]}" | node -e "const fs = require('node:fs'); const lines = fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean); process.stdout.write(JSON.stringify(lines));")"

node - <<'JS' "$ROOT_DIR" "$NEW_VERSION" "$PACKAGE_DIRS_JSON"
const fs = require('node:fs');
const path = require('node:path');

const [rootDir, newVersion, packageDirsJson] = process.argv.slice(2);
const packageDirs = JSON.parse(packageDirsJson);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const manifests = packageDirs.map((packageDir) => {
  const manifestPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing package.json: ${manifestPath}`);
  }
  return {
    packageDir,
    manifestPath,
    data: readJson(manifestPath),
  };
});

const packageNames = new Set(manifests.map((entry) => entry.data.name));

for (const manifest of manifests) {
  manifest.data.version = newVersion;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const section = manifest.data[field];
    if (!section || typeof section !== 'object') {
      continue;
    }
    for (const dependencyName of Object.keys(section)) {
      if (packageNames.has(dependencyName)) {
        section[dependencyName] = newVersion;
      }
    }
  }
  writeJson(manifest.manifestPath, manifest.data);
}

process.stdout.write(`Updated ${manifests.length} publishable package manifests to ${newVersion}\n`);
JS
