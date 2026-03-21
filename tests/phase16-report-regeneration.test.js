import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReplayPayload,
  buildRunArtifactReplayPayloads,
  hasReplayableRawReport,
  parseRegenerateStoredReportsArgs,
} from '../scripts/regenerate-stored-reports.mjs';

test('report regeneration args support project, run, limit, and dry-run filters', () => {
  const parsed = parseRegenerateStoredReportsArgs([
    '--project-key', 'workspace',
    '--run-id', 'run-1',
    '--limit', '5',
    '--dry-run',
  ]);

  assert.deepEqual(parsed, {
    projectKey: 'workspace',
    runId: 'run-1',
    limit: 5,
    dryRun: true,
  });
});

test('report regeneration detects replayable raw reports', () => {
  assert.equal(hasReplayableRawReport({ rawReport: { summary: { totalTests: 2 } } }), true);
  assert.equal(hasReplayableRawReport({ rawReport: {} }), false);
  assert.equal(hasReplayableRawReport({ rawReport: null }), false);
});

test('report regeneration only replays run-level artifact metadata', () => {
  const artifacts = buildRunArtifactReplayPayloads([
    {
      label: 'run-log',
      relativePath: 'raw/run.log',
      href: 'https://example.test/raw/run.log',
      kind: 'log',
      mediaType: 'text/plain',
      storageKey: 's3://bucket/raw/run.log',
      sourceUrl: 'https://cdn.example.test/raw/run.log',
      suiteRunId: null,
      testExecutionId: null,
    },
    {
      label: 'suite-log',
      relativePath: 'raw/suite.log',
      kind: 'log',
      suiteRunId: 'suite-1',
      testExecutionId: null,
    },
  ]);

  assert.deepEqual(artifacts, [{
    label: 'run-log',
    relativePath: 'raw/run.log',
    href: 'https://example.test/raw/run.log',
    kind: 'log',
    mediaType: 'text/plain',
    storageKey: 's3://bucket/raw/run.log',
    sourceUrl: 'https://cdn.example.test/raw/run.log',
  }]);
});

test('report regeneration builds a replay payload from stored run metadata', () => {
  const payload = buildReplayPayload({
    project: {
      key: 'workspace',
      name: 'Workspace',
      repositoryUrl: 'https://github.com/example/test-station',
      defaultBranch: 'main',
    },
    run: {
      id: 'run-1',
      sourceProvider: 'github-actions',
      sourceRunId: '1001',
      sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
      branch: 'main',
      commitSha: 'abc123',
      startedAt: new Date('2026-03-09T14:58:00.000Z'),
      completedAt: new Date('2026-03-09T15:00:00.000Z'),
      projectVersion: {
        buildNumber: 88,
      },
      rawReport: {
        schemaVersion: '1',
        summary: {
          totalTests: 2,
        },
      },
      metadata: {
        source: {
          provider: 'github-actions',
          runId: '1001',
          runUrl: 'https://github.com/example/test-station/actions/runs/1001',
          actor: 'octocat',
          repository: 'example/test-station',
          repositoryUrl: 'https://github.com/example/test-station',
          defaultBranch: 'main',
          projectName: 'Workspace',
          branch: 'main',
          tag: null,
          commitSha: 'abc123',
          startedAt: '2026-03-09T14:58:00.000Z',
          completedAt: '2026-03-09T15:00:00.000Z',
          buildNumber: 88,
        },
      },
    },
    artifacts: [{
      label: 'run-log',
      relativePath: 'raw/run.log',
      href: 'https://example.test/raw/run.log',
      kind: 'log',
      suiteRunId: null,
      testExecutionId: null,
    }],
  });

  assert.equal(payload.projectKey, 'workspace');
  assert.equal(payload.report.summary.totalTests, 2);
  assert.equal(payload.source.provider, 'github-actions');
  assert.equal(payload.source.runId, '1001');
  assert.equal(payload.source.actor, 'octocat');
  assert.equal(payload.source.buildNumber, 88);
  assert.equal(payload.source.repositoryUrl, 'https://github.com/example/test-station');
  assert.equal(payload.source.defaultBranch, 'main');
  assert.equal(payload.artifacts.length, 1);
  assert.equal(payload.artifacts[0].label, 'run-log');
});

test('report regeneration falls back to stored raw report GitHub environment for build number', () => {
  const payload = buildReplayPayload({
    project: {
      key: 'retro-display',
      name: 'Retro Display',
      repositoryUrl: 'https://github.com/example/retro-display',
      defaultBranch: 'main',
    },
    run: {
      id: 'run-2',
      sourceProvider: 'github-actions',
      sourceRunId: '23333047005',
      sourceUrl: 'https://github.com/example/retro-display/actions/runs/23333047005',
      branch: 'main',
      commitSha: 'def456',
      startedAt: new Date('2026-03-20T07:22:24.000Z'),
      completedAt: new Date('2026-03-20T07:23:30.000Z'),
      projectVersion: {
        buildNumber: null,
      },
      rawReport: {
        schemaVersion: '1',
        generatedAt: '2026-03-20T07:23:30.670Z',
        summary: {
          totalTests: 155,
        },
        meta: {
          ci: {
            environment: {
              GITHUB_ACTOR: 'octocat',
              GITHUB_REPOSITORY: 'example/retro-display',
              GITHUB_RUN_NUMBER: '45',
              GITHUB_SERVER_URL: 'https://github.com',
            },
          },
        },
      },
      metadata: {
        source: {
          provider: 'github-actions',
          runId: '23333047005',
          runUrl: 'https://github.com/example/retro-display/actions/runs/23333047005',
          branch: 'main',
          commitSha: 'def456',
          startedAt: '2026-03-20T07:22:24.000Z',
          completedAt: '2026-03-20T07:23:30.000Z',
          metadata: {},
        },
      },
    },
  });

  assert.equal(payload.source.buildNumber, 45);
  assert.equal(payload.source.actor, 'octocat');
  assert.equal(payload.source.repository, 'example/retro-display');
  assert.equal(payload.source.repositoryUrl, 'https://github.com/example/retro-display');
  assert.equal(payload.source.ci.environment.GITHUB_RUN_NUMBER, '45');
});
