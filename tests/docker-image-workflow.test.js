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
    '.github/workflows/publish.yml',
  ];

  for (const relativePath of expectedFiles) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `missing ${relativePath}`);
  }
});

test('image build workflow is reusable and uses the unified Dockerfile', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/image-build.yml'), 'utf8');

  assert.match(workflow, /workflow_call:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /image_tag:/);
  assert.match(workflow, /push_image:/);
  assert.match(workflow, /file:\s*docker\/Dockerfile/);
  assert.match(workflow, /Build and publish unified web\/server image/);
  assert.match(workflow, /CONTAINER_REGISTRY/);
  assert.match(workflow, /CONTAINER_IMAGE_REPOSITORY/);
  assert.match(workflow, /CONTAINER_REGISTRY_USERNAME/);
  assert.match(workflow, /secrets\.CONTAINER_REGISTRY_PASSWORD/);
  assert.match(workflow, /images:\s*\$\{\{ env\.CONTAINER_REGISTRY \}\}\/\$\{\{ env\.CONTAINER_IMAGE_REPOSITORY \}\}/);
  assert.match(workflow, /type=raw,value=\$\{\{ inputs\.image_tag \}\}/);
});

test('ci workflow only runs test validation for main and pull requests', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

  assert.match(workflow, /branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /yarn install --immutable/);
  assert.match(workflow, /yarn test:node/);
  assert.match(workflow, /yarn test:coverage/);
  assert.match(workflow, /tee "\$log_path"/);
  assert.match(workflow, /Captured log:/);
  assert.doesNotMatch(workflow, /publish-ingest-report\.mjs/);
  assert.doesNotMatch(workflow, /docker build --file docker\/Dockerfile --tag test-station-ci \./);
});

test('staging release workflow gates npm publish, image build, and fleet deployment behind validation', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'publish.yml'), 'utf8');

  assert.match(workflow, /branches:\s*\n\s*-\s*staging/);
  assert.match(workflow, /needs:\s*validate/);
  assert.match(workflow, /needs:\s*npm-publish/);
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/image-build\.yml/);
  assert.match(workflow, /image_tag:\s*staging/);
  assert.match(workflow, /NPM_PUBLISH:\s*\$\{\{ \(\(github\.event_name == 'push' && github\.ref_name == 'staging'\) \|\| inputs\.publish_npm\) && '1' \|\| '0' \}\}/);
  assert.match(workflow, /TEST_STATION_INGEST_SHARED_KEY/);
  assert.match(workflow, /S3_BUCKET/);
  assert.match(workflow, /tee "\$log_path"/);
  assert.match(workflow, /Captured log:/);
  assert.match(workflow, /azure\/setup-kubectl@v4/);
  assert.match(workflow, /FLEET_KUBECONFIG/);
  assert.match(workflow, /deploy-fleet\.sh --kubeconfig "\$KUBECONFIG_PATH" --restart/);
});
