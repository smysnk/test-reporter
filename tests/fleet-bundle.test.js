import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('fleet bundle files exist for unified web and server deployment', () => {
  const expectedFiles = [
    'fleet.yaml',
    'fleet/test-station/Chart.yaml',
    'fleet/test-station/values.yaml',
    'fleet/test-station/templates/server-deployment.yaml',
    'fleet/test-station/templates/server-service.yaml',
    'fleet/test-station/templates/web-deployment.yaml',
    'fleet/test-station/templates/web-service.yaml',
    'fleet/test-station/templates/web-ingress.yaml',
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `missing ${relativePath}`);
  }
});

test('fleet values and workflow use the unified image contract without stray reference names', () => {
  const valuesYaml = fs.readFileSync(path.join(repoRoot, 'fleet/test-station/values.yaml'), 'utf8');
  const workflowYaml = fs.readFileSync(path.join(repoRoot, '.github/workflows/image-build.yml'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'docker/Dockerfile'), 'utf8');

  assert.match(valuesYaml, /repository:\s*ghcr\.io\/smysnk\/test-station/);
  assert.match(workflowYaml, /vars\.CONTAINER_REGISTRY/);
  assert.match(workflowYaml, /vars\.CONTAINER_IMAGE_REPOSITORY/);
  assert.match(workflowYaml, /secrets\.CONTAINER_REGISTRY_PASSWORD/);
  assert.match(workflowYaml, /push:\s*true/);
  assert.match(dockerfile, /COPY scripts \.\/scripts/);
});
