import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('fleet bundle files exist for unified web and server deployment', () => {
  const expectedFiles = [
    'fleet.yaml',
    'fleet/README.md',
    'fleet/gitrepo.yml',
    'fleet/test-station/Chart.yaml',
    'fleet/test-station/values.yaml',
    '.env.fleet.example',
    '.env.fleet.config.example',
    'scripts/apply-fleet-gitrepo-ssh-secret.sh',
    'scripts/apply-fleet-env-secret.sh',
    'scripts/apply-fleet-env-configmap.sh',
    'scripts/deploy-fleet.sh',
    'scripts/monitor-deployment-output.sh',
    'scripts/recycle-and-monitor.sh',
    'scripts/lib/fleet-defaults.sh',
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
  const fleetReadme = fs.readFileSync(path.join(repoRoot, 'fleet/README.md'), 'utf8');
  const envFleetExample = fs.readFileSync(path.join(repoRoot, '.env.fleet.example'), 'utf8');
  const gitIgnore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  const workflowYaml = fs.readFileSync(path.join(repoRoot, '.github/workflows/image-build.yml'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'docker/Dockerfile'), 'utf8');

  assert.match(fleetYaml, /publicDomain:\s*test-station\.smysnk\.com/);
  assert.match(fleetYaml, /existingSecret:\s*test-station-runtime-secret/);
  assert.match(fleetYaml, /className:\s*traefik/);
  assert.match(fleetYaml, /cert-manager\.io\/cluster-issuer:\s*letsencrypt-prod/);
  assert.match(fleetYaml, /tls:\s*\n\s*enabled:\s*true/);
  assert.match(fleetYaml, /enabled:\s*true/);
  assert.match(gitRepoYaml, /paths:\s*\n\s*-\s*\./);
  assert.doesNotMatch(gitRepoYaml, /helm:\s*\n\s*values:/);
  assert.match(valuesYaml, /publicDomain:\s*""/);
  assert.match(valuesYaml, /ingressPaths:\s*\n\s*-\s*path:\s*\/api\/ingest/);
  assert.match(valuesYaml, /INGEST_SHARED_KEY:\s*change-me/);
  assert.match(valuesYaml, /secretName:\s*""/);
  assert.match(valuesYaml, /repository:\s*ghcr\.io\/smysnk\/test-station/);
  assert.match(webIngressYaml, /test-station\.publicDomain/);
  assert.match(webIngressYaml, /test-station\.defaultTlsSecretName/);
  assert.match(webIngressYaml, /test-station\.serverName/);
  assert.match(webIngressYaml, /kindIs "map"/);
  assert.match(webConfigMapYaml, /NEXTAUTH_URL/);
  assert.match(serverConfigMapYaml, /WEB_URL/);
  assert.match(fleetReadme, /TLS secret/);
  assert.match(fleetReadme, /certificate \|\| true/);
  assert.match(fleetReadme, /apply-fleet-gitrepo-ssh-secret\.sh/);
  assert.match(fleetReadme, /apply-fleet-env-secret\.sh/);
  assert.match(fleetReadme, /deploy-fleet\.sh/);
  assert.match(envFleetExample, /DATABASE_URL=/);
  assert.match(envFleetExample, /NEXTAUTH_SECRET=/);
  assert.match(gitIgnore, /^\.env\.fleet$/m);
  assert.match(gitIgnore, /^\.env\.fleet\.config$/m);
  assert.match(workflowYaml, /vars\.CONTAINER_REGISTRY/);
  assert.match(workflowYaml, /vars\.CONTAINER_IMAGE_REPOSITORY/);
  assert.match(workflowYaml, /secrets\.CONTAINER_REGISTRY_PASSWORD/);
  assert.match(workflowYaml, /push:\s*true/);
  assert.match(dockerfile, /COPY scripts \.\/scripts/);
});
