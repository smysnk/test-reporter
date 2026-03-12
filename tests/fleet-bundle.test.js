import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('fleet bundle files exist for unified web and server deployment', () => {
  const expectedFiles = [
    'fleet.yaml',
    'fleet/gitrepo.yml',
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
  const fleetYaml = fs.readFileSync(path.join(repoRoot, 'fleet.yaml'), 'utf8');
  const gitRepoYaml = fs.readFileSync(path.join(repoRoot, 'fleet/gitrepo.yml'), 'utf8');
  const valuesYaml = fs.readFileSync(path.join(repoRoot, 'fleet/test-station/values.yaml'), 'utf8');
  const webIngressYaml = fs.readFileSync(path.join(repoRoot, 'fleet/test-station/templates/web-ingress.yaml'), 'utf8');
  const webConfigMapYaml = fs.readFileSync(path.join(repoRoot, 'fleet/test-station/templates/web-configmap.yaml'), 'utf8');
  const serverConfigMapYaml = fs.readFileSync(path.join(repoRoot, 'fleet/test-station/templates/server-configmap.yaml'), 'utf8');
  const workflowYaml = fs.readFileSync(path.join(repoRoot, '.github/workflows/image-build.yml'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'docker/Dockerfile'), 'utf8');

  assert.doesNotMatch(fleetYaml, /publicDomain:\s*test-station\.smysnk\.com/);
  assert.match(gitRepoYaml, /paths:\s*\n\s*-\s*\./);
  assert.match(gitRepoYaml, /helm:\s*\n\s*values:/);
  assert.match(gitRepoYaml, /publicDomain:\s*test-station\.smysnk\.com/);
  assert.match(gitRepoYaml, /enabled:\s*true/);
  assert.match(valuesYaml, /publicDomain:\s*""/);
  assert.match(valuesYaml, /repository:\s*ghcr\.io\/smysnk\/test-station/);
  assert.match(webIngressYaml, /test-station\.publicDomain/);
  assert.match(webConfigMapYaml, /NEXTAUTH_URL/);
  assert.match(serverConfigMapYaml, /WEB_URL/);
  assert.match(workflowYaml, /vars\.CONTAINER_REGISTRY/);
  assert.match(workflowYaml, /vars\.CONTAINER_IMAGE_REPOSITORY/);
  assert.match(workflowYaml, /secrets\.CONTAINER_REGISTRY_PASSWORD/);
  assert.match(workflowYaml, /push:\s*true/);
  assert.match(dockerfile, /COPY scripts \.\/scripts/);
});
