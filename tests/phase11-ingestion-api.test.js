import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../packages/server/index.js';
import {
  createIngestionService,
  createSequelizeIngestionPersistence,
  normalizeIngestPayload,
} from '../packages/server/ingest/index.js';

test('normalizeIngestPayload validates the report contract and derives run identity', () => {
  const normalized = normalizeIngestPayload(createSamplePayload(), {
    now: '2026-03-09T15:00:00.000Z',
  });

  assert.equal(normalized.project.key, 'workspace');
  assert.equal(normalized.project.slug, 'workspace');
  assert.equal(normalized.projectVersion.versionKey, 'commit:abc123');
  assert.equal(normalized.run.externalKey, 'workspace:github-actions:1001');
  assert.equal(normalized.run.status, 'failed');
  assert.equal(normalized.packages.length, 1);
  assert.equal(normalized.modules.length, 1);
  assert.equal(normalized.files.length, 1);
  assert.equal(normalized.suites.length, 1);
  assert.equal(normalized.tests.length, 2);
  assert.equal(normalized.coverageFiles.length, 1);
  assert.equal(normalized.errors.length, 2);
  assert.equal(normalized.artifacts.length, 2);
});

test('ingestion persistence upserts duplicate runs and replaces prior facts', async () => {
  const persistenceContext = createFakePersistenceContext();
  const persistence = createSequelizeIngestionPersistence(persistenceContext);
  const service = createIngestionService({ persistence });

  const first = await service.ingest(createSamplePayload(), {
    now: '2026-03-09T15:00:00.000Z',
  });

  const models = persistenceContext.models;
  assert.equal(first.created, true);
  assert.equal(first.counts.tests, 2);
  assert.equal(models.CoverageTrendPoint.rows.length, 4);

  const updatedPayload = createSamplePayload({
    report: {
      durationMs: 2400,
      summary: {
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        skippedTests: 0,
        failedSuites: 0,
        coverage: {
          lines: { covered: 9, total: 10, pct: 90 },
          branches: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 2, total: 3, pct: 66.67 },
          statements: { covered: 9, total: 10, pct: 90 },
          files: [
            {
              path: '/repo/packages/core/src/index.js',
              lines: { covered: 9, total: 10, pct: 90 },
              branches: { covered: 3, total: 4, pct: 75 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 9, total: 10, pct: 90 },
              module: 'runtime',
              theme: 'core',
              packageName: 'workspace',
              shared: false,
              attributionSource: 'manifest',
              attributionReason: 'fixture',
              attributionWeight: 1,
            },
          ],
        },
      },
      packages: [
        {
          name: 'workspace',
          location: 'packages',
          status: 'passed',
          durationMs: 2400,
          summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
          coverage: {
            lines: { covered: 9, total: 10, pct: 90 },
            branches: { covered: 3, total: 4, pct: 75 },
            functions: { covered: 2, total: 3, pct: 66.67 },
            statements: { covered: 9, total: 10, pct: 90 },
          },
          modules: ['runtime'],
          frameworks: ['node-test'],
          suites: [
            {
              id: 'repo-node',
              label: 'Repository Tests',
              runtime: 'node-test',
              command: 'node --test ../tests/*.test.js',
              cwd: '/repo/packages',
              status: 'passed',
              durationMs: 2400,
              summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
              warnings: [],
              rawArtifacts: [],
              output: {
                stdout: 'suite output',
                stderr: '',
              },
              tests: [
                {
                  name: 'passes',
                  fullName: 'workspace passes',
                  status: 'passed',
                  durationMs: 10,
                  file: '/repo/packages/core/src/index.js',
                  line: 10,
                  column: 2,
                  assertions: ['assert.equal(1, 1)'],
                  module: 'runtime',
                  theme: 'core',
                  classificationSource: 'fixture',
                  rawDetails: { fixture: true },
                },
              ],
            },
          ],
        },
      ],
    },
    artifacts: [],
  });

  const second = await service.ingest(updatedPayload, {
    now: '2026-03-09T15:05:00.000Z',
  });

  assert.equal(second.created, false);
  assert.equal(models.Run.rows.length, 1);
  assert.equal(models.SuiteRun.rows.length, 1);
  assert.equal(models.TestExecution.rows.length, 1);
  assert.equal(models.CoverageTrendPoint.rows.length, 4);
  assert.deepEqual(models.CoverageTrendPoint.rows.map((row) => row.scopeType).sort(), ['file', 'module', 'package', 'project']);
  assert.equal(models.ErrorOccurrence.rows.length, 0);
  assert.equal(models.Artifact.rows.length, 0);
  assert.equal(models.PerformanceStat.rows.length, 3);
  assert.equal(models.Run.rows[0].status, 'passed');
  assert.equal(models.Run.rows[0].summary.totalTests, 1);
  assert.equal(models.CoverageTrendPoint.rows.find((row) => row.scopeType === 'project')?.linesPct, 90);
  assert.equal(models.CoverageTrendPoint.rows.find((row) => row.scopeType === 'file')?.linesPct, 90);
});

test('server ingest route enforces auth and returns actionable validation errors', async () => {
  const ingestionService = createIngestionService({
    persistence: {
      async persistRun(normalized) {
        return {
          runId: 'run-1',
          externalKey: normalized.run.externalKey,
          created: true,
          counts: normalized.counts,
        };
      },
    },
  });
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    ingestSharedKeys: ['top-secret'],
    ingestionService,
  });

  await new Promise((resolve) => {
    server.httpServer.listen(0, resolve);
  });

  const address = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const unauthorized = await fetch(`${baseUrl}/api/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(createSamplePayload()),
  });
  assert.equal(unauthorized.status, 401);
  const unauthorizedPayload = await unauthorized.json();
  assert.equal(unauthorizedPayload.error.code, 'INGEST_UNAUTHORIZED');

  const invalid = await fetch(`${baseUrl}/api/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer top-secret',
    },
    body: JSON.stringify({
      report: {},
    }),
  });
  assert.equal(invalid.status, 400);
  const invalidPayload = await invalid.json();
  assert.equal(invalidPayload.error.code, 'INGEST_VALIDATION_ERROR');
  assert.match(invalidPayload.error.message, /projectKey/);

  const success = await fetch(`${baseUrl}/api/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'top-secret',
    },
    body: JSON.stringify(createSamplePayload()),
  });
  assert.equal(success.status, 200);
  const successPayload = await success.json();
  assert.equal(successPayload.status, 'ok');
  assert.equal(successPayload.externalKey, 'workspace:github-actions:1001');
  assert.equal(successPayload.counts.tests, 2);

  await closeServer(server);
});

test('server ingest route returns JSON when the payload exceeds the ingest body limit', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    ingestSharedKeys: ['top-secret'],
    ingestJsonLimit: '1b',
    ingestionService: createIngestionService({
      persistence: {
        async persistRun() {
          throw new Error('should not persist oversized payloads');
        },
      },
    }),
  });

  await new Promise((resolve) => {
    server.httpServer.listen(0, resolve);
  });

  const address = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const oversized = await fetch(`${baseUrl}/api/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer top-secret',
    },
    body: JSON.stringify(createSamplePayload()),
  });

  assert.equal(oversized.status, 413);
  const oversizedPayload = await oversized.json();
  assert.equal(oversizedPayload.error.code, 'INGEST_PAYLOAD_TOO_LARGE');
  assert.match(oversizedPayload.error.message, /1b/);

  await closeServer(server);
});

function createSamplePayload(overrides = {}) {
  const payload = {
    projectKey: 'workspace',
    source: {
      provider: 'github-actions',
      runId: '1001',
      runUrl: 'https://github.com/example/test-station/actions/runs/1001',
      repositoryUrl: 'https://github.com/example/test-station',
      repository: 'test-station',
      defaultBranch: 'main',
      branch: 'release',
      commitSha: 'abc123',
      actor: 'ci-bot',
      startedAt: '2026-03-09T14:59:00.000Z',
      completedAt: '2026-03-09T15:00:00.000Z',
    },
    artifacts: [
      {
        label: 'Run summary',
        href: 'https://example.test/reports/1001/report.json',
        kind: 'link',
        mediaType: 'application/json',
      },
    ],
    report: {
      schemaVersion: '1',
      generatedAt: '2026-03-09T15:00:00.000Z',
      durationMs: 3000,
      summary: {
        totalPackages: 1,
        totalModules: 1,
        totalSuites: 1,
        failedSuites: 1,
        totalTests: 2,
        passedTests: 1,
        failedTests: 1,
        skippedTests: 0,
        coverage: {
          lines: { covered: 8, total: 10, pct: 80 },
          branches: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 2, total: 3, pct: 66.67 },
          statements: { covered: 8, total: 10, pct: 80 },
          files: [
            {
              path: '/repo/packages/core/src/index.js',
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 3, total: 4, pct: 75 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 8, total: 10, pct: 80 },
              module: 'runtime',
              theme: 'core',
              packageName: 'workspace',
              shared: false,
              attributionSource: 'manifest',
              attributionReason: 'fixture',
              attributionWeight: 1,
            },
          ],
        },
        coverageAttribution: {
          totalFiles: 1,
          attributedFiles: 1,
          sharedFiles: 0,
          unattributedFiles: 0,
        },
        filterOptions: {
          modules: ['runtime'],
          packages: ['workspace'],
          frameworks: ['node-test'],
        },
      },
      packages: [
        {
          name: 'workspace',
          location: 'packages',
          status: 'failed',
          durationMs: 3000,
          summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
          coverage: {
            lines: { covered: 8, total: 10, pct: 80 },
            branches: { covered: 3, total: 4, pct: 75 },
            functions: { covered: 2, total: 3, pct: 66.67 },
            statements: { covered: 8, total: 10, pct: 80 },
          },
          modules: ['runtime'],
          frameworks: ['node-test'],
          suites: [
            {
              id: 'repo-node',
              label: 'Repository Tests',
              runtime: 'node-test',
              command: 'node --test ../tests/*.test.js',
              cwd: '/repo/packages',
              status: 'failed',
              durationMs: 3000,
              summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
              warnings: ['fixture warning'],
              output: {
                stdout: 'suite output',
                stderr: '',
              },
              rawArtifacts: [
                {
                  relativePath: 'workspace/repo-node.log',
                  href: 'raw/workspace/repo-node.log',
                  label: 'Repo log',
                  kind: 'file',
                  mediaType: 'text/plain',
                },
              ],
              tests: [
                {
                  name: 'passes',
                  fullName: 'workspace passes',
                  status: 'passed',
                  durationMs: 10,
                  file: '/repo/packages/core/src/index.js',
                  line: 10,
                  column: 2,
                  assertions: ['assert.equal(1, 1)'],
                  setup: ['load fixture'],
                  mocks: ['mock fs'],
                  failureMessages: [],
                  rawDetails: { fixture: true },
                  sourceSnippet: 'assert.equal(1, 1)',
                  module: 'runtime',
                  theme: 'core',
                  classificationSource: 'fixture',
                },
                {
                  name: 'fails',
                  fullName: 'workspace fails',
                  status: 'failed',
                  durationMs: 12,
                  file: '/repo/packages/core/src/index.js',
                  line: 24,
                  column: 4,
                  assertions: ['assert.equal(1, 2)'],
                  setup: ['load fixture'],
                  mocks: [],
                  failureMessages: ['expected 2 but received 1'],
                  rawDetails: { fixture: false },
                  sourceSnippet: 'assert.equal(1, 2)',
                  module: 'runtime',
                  theme: 'core',
                  classificationSource: 'fixture',
                },
              ],
            },
          ],
        },
      ],
      modules: [
        {
          module: 'runtime',
          packages: ['workspace'],
          frameworks: ['node-test'],
          owner: 'platform',
        },
      ],
      meta: {
        projectName: 'test-station self-test',
      },
    },
  };

  return deepMerge(payload, overrides);
}

function createFakePersistenceContext() {
  const models = {
    Project: createFakeModel('project'),
    ProjectVersion: createFakeModel('project-version'),
    ProjectPackage: createFakeModel('project-package'),
    ProjectModule: createFakeModel('project-module'),
    ProjectFile: createFakeModel('project-file'),
    Run: createFakeModel('run'),
    SuiteRun: createFakeModel('suite-run'),
    TestExecution: createFakeModel('test-execution'),
    CoverageSnapshot: createFakeModel('coverage-snapshot'),
    CoverageFile: createFakeModel('coverage-file'),
    CoverageTrendPoint: createFakeModel('coverage-trend-point'),
    ErrorOccurrence: createFakeModel('error-occurrence'),
    PerformanceStat: createFakeModel('performance-stat'),
    Artifact: createFakeModel('artifact'),
  };

  return {
    sequelize: {
      async transaction(callback) {
        return callback({ id: 'fake-transaction' });
      },
    },
    models,
  };
}

function createFakeModel(prefix) {
  const rows = [];
  let counter = 0;

  return {
    rows,
    async findOne(options = {}) {
      const match = rows.find((row) => matchesWhere(row, options.where || {}));
      return wrapRecord(match);
    },
    async findAll(options = {}) {
      return rows.filter((row) => matchesWhere(row, options.where || {})).map((row) => wrapRecord(row));
    },
    async create(values) {
      const row = { id: `${prefix}-${++counter}`, ...values };
      rows.push(row);
      return wrapRecord(row);
    },
    async destroy(options = {}) {
      const matches = rows.filter((row) => matchesWhere(row, options.where || {}));
      for (const row of matches) {
        rows.splice(rows.indexOf(row), 1);
      }
      return matches.length;
    },
  };
}

function wrapRecord(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    async update(values) {
      Object.assign(row, values);
      Object.assign(this, row);
      return this;
    },
  };
}

function matchesWhere(row, where) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function deepMerge(target, source) {
  if (Array.isArray(source)) {
    return source.map((entry) => deepMerge(undefined, entry));
  }
  if (source && typeof source === 'object') {
    const base = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        base[key] = value.map((entry) => deepMerge(undefined, entry));
      } else if (value && typeof value === 'object') {
        base[key] = deepMerge(base[key], value);
      } else {
        base[key] = value;
      }
    }
    return base;
  }
  return source === undefined ? target : source;
}

async function closeServer(server) {
  await server.graphqlServer.stop();
  if (!server.httpServer.listening) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
