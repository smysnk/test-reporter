import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('docker assets for the unified web/server image exist', () => {
  const expectedFiles = [
    '.dockerignore',
    'docker/Dockerfile',
    'docker/docker-entrypoint.sh',
    'docker/docker-compose.yml',
    '.github/workflows/image-build.yml',
  ];

  for (const relativePath of expectedFiles) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `missing ${relativePath}`);
  }
});

test('image build workflow targets main and uses the unified Dockerfile', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/image-build.yml'), 'utf8');

  assert.match(workflow, /branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /file:\s*docker\/Dockerfile/);
  assert.match(workflow, /Build and publish unified web\/server image/);
  assert.match(workflow, /CONTAINER_REGISTRY/);
  assert.match(workflow, /CONTAINER_IMAGE_REPOSITORY/);
  assert.match(workflow, /CONTAINER_REGISTRY_USERNAME/);
  assert.match(workflow, /secrets\.CONTAINER_REGISTRY_PASSWORD/);
  assert.match(workflow, /images:\s*\$\{\{ env\.CONTAINER_REGISTRY \}\}\/\$\{\{ env\.CONTAINER_IMAGE_REPOSITORY \}\}/);
});
