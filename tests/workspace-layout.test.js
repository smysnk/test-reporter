import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const expectedPackages = [
  'core',
  'cli',
  'render-html',
  'adapter-node-test',
  'adapter-vitest',
  'adapter-playwright',
  'adapter-shell',
  'adapter-jest',
  'plugin-source-analysis',
];

test('workspace contains expected reporter packages', () => {
  for (const pkg of expectedPackages) {
    const packageJsonPath = path.join(repoRoot, 'packages', pkg, 'package.json');
    assert.equal(fs.existsSync(packageJsonPath), true, `missing ${packageJsonPath}`);
  }
});
