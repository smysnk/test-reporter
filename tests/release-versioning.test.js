import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const setVersionFromBuildScript = path.join(repoRoot, 'scripts', 'release', 'set-version-from-build.sh');
const packageNames = [
  '@test-station/adapter-jest',
  '@test-station/adapter-node-test',
  '@test-station/adapter-playwright',
  '@test-station/adapter-shell',
  '@test-station/adapter-vitest',
  '@test-station/plugin-source-analysis',
  '@test-station/core',
  '@test-station/render-html',
  '@test-station/cli',
];

test('set-version-from-build rewrites publishable package versions and internal dependencies', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-release-version-'));
  fs.mkdirSync(path.join(tempRoot, 'packages'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'package.json'), `${JSON.stringify({
    name: 'test-station',
    private: true,
    workspaces: ['packages/*'],
  }, null, 2)}\n`);

  for (const packageName of packageNames) {
    const dirName = packageName.split('/').pop();
    const packageDir = path.join(tempRoot, 'packages', dirName);
    fs.mkdirSync(packageDir, { recursive: true });
    const manifest = {
      name: packageName,
      version: '0.1.0',
      type: 'module',
    };

    if (packageName === '@test-station/core') {
      manifest.dependencies = {
        '@test-station/adapter-jest': 'workspace:*',
        '@test-station/adapter-node-test': 'workspace:*',
        '@test-station/adapter-playwright': 'workspace:*',
        '@test-station/adapter-shell': 'workspace:*',
        '@test-station/adapter-vitest': 'workspace:*',
        '@test-station/plugin-source-analysis': 'workspace:*',
      };
    }

    if (packageName === '@test-station/cli') {
      manifest.dependencies = {
        '@test-station/core': 'workspace:*',
        '@test-station/render-html': 'workspace:*',
      };
    }

    fs.writeFileSync(path.join(packageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const result = spawnSync('bash', [setVersionFromBuildScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ROOT_DIR: tempRoot,
      BUILD_NUMBER: '412',
      VERSION_MAJOR: '0',
      VERSION_MINOR: '2',
      PATCH_MODE: 'build',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /target=0\.2\.412/);

  for (const packageName of packageNames) {
    const dirName = packageName.split('/').pop();
    const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'packages', dirName, 'package.json'), 'utf8'));
    assert.equal(manifest.version, '0.2.412');
  }

  const cliManifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'packages', 'cli', 'package.json'), 'utf8'));
  assert.deepEqual(cliManifest.dependencies, {
    '@test-station/core': '0.2.412',
    '@test-station/render-html': '0.2.412',
  });

  const coreManifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'packages', 'core', 'package.json'), 'utf8'));
  assert.deepEqual(coreManifest.dependencies, {
    '@test-station/adapter-jest': '0.2.412',
    '@test-station/adapter-node-test': '0.2.412',
    '@test-station/adapter-playwright': '0.2.412',
    '@test-station/adapter-shell': '0.2.412',
    '@test-station/adapter-vitest': '0.2.412',
    '@test-station/plugin-source-analysis': '0.2.412',
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
