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

test('ci workflow runs test validation for pull requests and main pushes', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /yarn install --immutable/);
  assert.match(workflow, /yarn test:node/);
  assert.match(workflow, /yarn test:coverage/);
  assert.match(workflow, /tee "\$log_path"/);
  assert.match(workflow, /Captured log:/);
  assert.doesNotMatch(workflow, /publish-ingest-report\.mjs/);
  assert.doesNotMatch(workflow, /docker build --file docker\/Dockerfile --tag test-station-ci \./);
});

test('publish release workflow uses npm trusted publishing and gates releases behind validation', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'publish.yml'), 'utf8');

  assert.match(workflow, /name:\s*Main Release Pipeline/);
  assert.match(workflow, /branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /needs:\s*validate/);
  assert.doesNotMatch(workflow, /docker-image:\s*\n\s*needs:\s*npm-publish/);
  assert.match(workflow, /docker-image:\s*\n\s*needs:\s*validate/);
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/image-build\.yml/);
  assert.match(workflow, /image_tag:\s*main/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /npm install --global npm@11\.16\.0/);
  assert.doesNotMatch(workflow, /secrets\.NPM_TOKEN/);
  assert.doesNotMatch(workflow, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
  assert.match(workflow, /NPM_PUBLISH:\s*\$\{\{ \(\(github\.event_name == 'push' && github\.ref_name == 'main'\) \|\| inputs\.publish_npm\) && '1' \|\| '0' \}\}/);
  assert.match(workflow, /TEST_STATION_INGEST_SHARED_KEY/);
  assert.match(workflow, /S3_BUCKET/);
  assert.match(workflow, /tee "\$log_path"/);
  assert.match(workflow, /Captured log:/);
  assert.match(workflow, /azure\/setup-kubectl@v4/);
  assert.match(workflow, /FLEET_KUBECONFIG/);
  assert.match(workflow, /deploy-fleet\.sh --kubeconfig "\$KUBECONFIG_PATH" --restart/);
});

test('every publishable npm package identifies the trusted GitHub repository', () => {
  const packageDirectories = [
    'adapter-jest',
    'adapter-node-test',
    'adapter-playwright',
    'adapter-shell',
    'adapter-vitest',
    'cli',
    'core',
    'plugin-source-analysis',
    'render-html',
  ];

  for (const directory of packageDirectories) {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages', directory, 'package.json'), 'utf8'));
    const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
    assert.equal(repository, 'git+https://github.com/smysnk/test-station.git', manifest.name);
    assert.equal(manifest.repository.directory, `packages/${directory}`, manifest.name);
  }
});
