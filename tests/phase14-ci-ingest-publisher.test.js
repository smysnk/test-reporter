import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  attachArtifactLocations,
  collectOutputArtifacts,
  createIngestPayload,
} from '../scripts/ingest-report-utils.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..');

test('createIngestPayload includes GitHub metadata and S3-backed artifact pointers', () => {
  const fixture = createIngestFixture();
  const payload = createIngestPayload({
    reportPath: fixture.reportPath,
    projectKey: 'test-station',
    buildStartedAt: '2026-03-12T12:00:00.000Z',
    buildCompletedAt: '2026-03-12T12:04:00.000Z',
    jobStatus: 'passed',
    storage: {
      bucket: 'artifact-bucket',
      prefix: 'ci/test-station/100/1',
      baseUrl: 'https://artifacts.example.com/test-station',
    },
    env: fixture.env,
  });

  assert.equal(payload.projectKey, 'test-station');
  assert.equal(payload.source.provider, 'github-actions');
  assert.equal(payload.source.runId, '100');
  assert.equal(payload.source.repository, 'smysnk/test-station');
  assert.equal(payload.source.repositoryUrl, 'https://github.com/smysnk/test-station');
  assert.equal(payload.source.branch, 'main');
  assert.equal(payload.source.commitSha, 'abc123');
  assert.equal(payload.source.buildNumber, 88);
  assert.equal(payload.source.ci.status, 'passed');
  assert.equal(payload.source.ci.buildDurationMs, 240000);
  assert.equal(payload.source.ci.artifactCount, 5);
  assert.equal(payload.artifacts.some((artifact) => artifact.relativePath === 'report.json'), true);
  assert.equal(payload.artifacts.some((artifact) => artifact.relativePath === 'modules.json'), true);
  assert.equal(payload.artifacts.some((artifact) => artifact.relativePath === 'ownership.json'), true);
  assert.equal(payload.artifacts.some((artifact) => artifact.relativePath === 'index.html'), true);
  assert.equal(payload.artifacts.some((artifact) => artifact.relativePath === 'raw/workspace/unit.log'), true);

  const reportArtifact = payload.artifacts.find((artifact) => artifact.relativePath === 'report.json');
  assert.equal(reportArtifact.storageKey, 's3://artifact-bucket/ci/test-station/100/1/report.json');
  assert.equal(reportArtifact.sourceUrl, 'https://artifacts.example.com/test-station/ci/test-station/100/1/report.json');

  const rawArtifact = payload.report.packages[0].suites[0].rawArtifacts[0];
  assert.equal(rawArtifact.storageKey, 's3://artifact-bucket/ci/test-station/100/1/raw/workspace/unit.log');
  assert.equal(rawArtifact.sourceUrl, 'https://artifacts.example.com/test-station/ci/test-station/100/1/raw/workspace/unit.log');
});

test('publish-ingest-report CLI posts bearer-authenticated payloads', async () => {
  const fixture = createIngestFixture();
  let capturedRequest = null;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    capturedRequest = {
      authorization: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', runId: 'run-123' }));
  });

  server.listen(0);
  await once(server, 'listening');
  const address = server.address();

  const env = {
    ...process.env,
    ...fixture.env,
    TEST_STATION_INGEST_ENDPOINT: `http://127.0.0.1:${address.port}/api/ingest`,
    TEST_STATION_INGEST_PROJECT_KEY: 'test-station',
    TEST_STATION_INGEST_SHARED_KEY: 'phase14-secret',
    TEST_STATION_BUILD_STARTED_AT: '2026-03-12T12:00:00.000Z',
    TEST_STATION_BUILD_COMPLETED_AT: '2026-03-12T12:03:00.000Z',
    TEST_STATION_CI_STATUS: 'failed',
    TEST_STATION_ARTIFACT_S3_BUCKET: 'artifact-bucket',
    TEST_STATION_ARTIFACT_STORAGE_PREFIX: 'ci/test-station/100/1',
    TEST_STATION_ARTIFACT_BASE_URL: 'https://artifacts.example.com/test-station',
  };

  const { stdout } = await execFileAsync('node', [
    './scripts/publish-ingest-report.mjs',
    '--input',
    fixture.reportPath,
  ], {
    cwd: repoRoot,
    env,
  });

  server.close();

  assert.match(stdout, /Published test-station:github-actions:100/);
  assert.equal(capturedRequest.authorization, 'Bearer phase14-secret');
  assert.equal(capturedRequest.body.projectKey, 'test-station');
  assert.equal(capturedRequest.body.source.ci.status, 'failed');
  assert.equal(capturedRequest.body.artifacts.some((artifact) => artifact.relativePath === 'raw/workspace/unit.log'), true);
});

test('collectOutputArtifacts and attachArtifactLocations cover the complete report directory', () => {
  const fixture = createIngestFixture();
  const artifacts = collectOutputArtifacts(path.dirname(fixture.reportPath), {
    bucket: 'artifact-bucket',
    prefix: 'ci/test-station/100/1',
    baseUrl: 'https://artifacts.example.com/test-station',
  });
  const enrichedReport = attachArtifactLocations(fixture.report, {
    bucket: 'artifact-bucket',
    prefix: 'ci/test-station/100/1',
    baseUrl: 'https://artifacts.example.com/test-station',
  });

  assert.deepEqual(
    artifacts.map((artifact) => artifact.relativePath),
    ['index.html', 'modules.json', 'ownership.json', 'raw/workspace/unit.log', 'report.json'],
  );
  assert.equal(enrichedReport.packages[0].suites[0].rawArtifacts[0].sourceUrl, 'https://artifacts.example.com/test-station/ci/test-station/100/1/raw/workspace/unit.log');
});

function createIngestFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-ingest-'));
  const outputDir = path.join(rootDir, 'self-test-report');
  const rawDir = path.join(outputDir, 'raw', 'workspace');
  fs.mkdirSync(rawDir, { recursive: true });

  const report = {
    schemaVersion: '1',
    generatedAt: '2026-03-12T12:02:00.000Z',
    durationMs: 180000,
    summary: {
      totalPackages: 1,
      totalSuites: 1,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      skippedTests: 0,
      failedSuites: 0,
    },
    packages: [
      {
        name: 'workspace',
        location: 'packages/workspace',
        status: 'passed',
        durationMs: 180000,
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        suites: [
          {
            id: 'unit',
            label: 'Unit',
            runtime: 'node-test',
            command: 'node --test',
            cwd: '/repo',
            status: 'passed',
            durationMs: 180000,
            summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
            warnings: [],
            rawArtifacts: [
              {
                relativePath: 'workspace/unit.log',
                href: 'raw/workspace/unit.log',
                label: 'Unit log',
                kind: 'file',
                mediaType: 'text/plain',
              },
            ],
            output: { stdout: '', stderr: '' },
            tests: [],
          },
        ],
      },
    ],
    modules: [],
    meta: {
      projectName: 'test-station',
      outputDir,
    },
  };

  const reportPath = path.join(outputDir, 'report.json');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'modules.json'), '{}\n');
  fs.writeFileSync(path.join(outputDir, 'ownership.json'), '{}\n');
  fs.writeFileSync(path.join(outputDir, 'index.html'), '<html></html>\n');
  fs.writeFileSync(path.join(rawDir, 'unit.log'), 'fixture log\n');

  const eventPath = path.join(rootDir, 'event.json');
  fs.writeFileSync(eventPath, `${JSON.stringify({
    repository: {
      full_name: 'smysnk/test-station',
      html_url: 'https://github.com/smysnk/test-station',
      default_branch: 'main',
    },
  }, null, 2)}\n`);

  return {
    env: {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'smysnk/test-station',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REF_NAME: 'main',
      GITHUB_REF_TYPE: 'branch',
      GITHUB_SHA: 'abc123',
      GITHUB_ACTOR: 'ci-bot',
      GITHUB_RUN_ID: '100',
      GITHUB_RUN_NUMBER: '88',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_WORKFLOW: 'CI',
      GITHUB_WORKFLOW_REF: 'smysnk/test-station/.github/workflows/ci.yml@refs/heads/main',
      GITHUB_WORKFLOW_SHA: 'abc123',
      GITHUB_JOB: 'test',
      GITHUB_REPOSITORY_OWNER: 'smysnk',
    },
    report,
    reportPath,
  };
}
