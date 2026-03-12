import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../packages/server/index.js';

test('GraphQL rejects protected queries without an actor', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    models: createGraphqlModels(),
  });

  await listen(server);
  const response = await graphqlRequest(server, {
    query: '{ projects { key } }',
  });

  assert.equal(response.status, 401);
  assert.equal(response.payload.data, null);
  assert.equal(response.payload.errors[0].extensions.code, 'UNAUTHORIZED');

  await closeServer(server);
});

test('GraphQL exposes project, run, file, test, artifact, trend, and release-note reads for authorized actors', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    models: createGraphqlModels(),
  });

  await listen(server);
  const response = await graphqlRequest(server, {
    query: `
      query Phase4ReadLayer {
        me {
          id
          role
          projectKeys
        }
        projects {
          key
          name
        }
        project(key: "workspace") {
          key
          slug
        }
        runs(projectKey: "workspace") {
          id
          externalKey
          status
          project {
            key
          }
          projectVersion {
            versionKey
          }
          coverageSnapshot {
            linesPct
          }
        }
        run(id: "run-1") {
          id
          externalKey
          status
          rawReport
          coverageSnapshot {
            linesPct
          }
          suites {
            suiteIdentifier
            label
            status
            tests {
              fullName
              status
              moduleName
            }
          }
          artifacts {
            label
            href
            kind
          }
        }
        runPackages(runId: "run-1") {
          name
          status
          suiteCount
        }
        runModules(runId: "run-1") {
          module
          owner
          packageCount
        }
        runFiles(runId: "run-1") {
          path
          status
          testCount
          failedTestCount
          coverage
          tests {
            fullName
            status
          }
        }
        tests(runId: "run-1", status: "failed") {
          fullName
          status
          suiteIdentifier
          packageName
        }
        coverageTrend(projectKey: "workspace") {
          runId
          externalKey
          scopeType
          label
          linesPct
          versionKey
        }
        runCoverageComparison(runId: "run-1") {
          runId
          previousRunId
          currentExternalKey
          previousExternalKey
          currentVersionKey
          previousVersionKey
          currentLinesPct
          previousLinesPct
          deltaLinesPct
          packageChanges {
            label
            deltaLinesPct
          }
          moduleChanges {
            label
            deltaLinesPct
          }
          fileChanges {
            label
            filePath
            deltaLinesPct
          }
        }
        artifacts(runId: "run-1") {
          label
          href
          kind
        }
        releaseNotes(projectKey: "workspace") {
          title
          sourceUrl
          projectVersion {
            versionKey
          }
        }
      }
    `,
  }, {
    'x-test-station-actor-id': 'user-1',
    'x-test-station-actor-email': 'user-1@example.com',
    'x-test-station-actor-role': 'member',
    'x-test-station-actor-project-keys': 'workspace',
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.errors, undefined);
  assert.deepEqual(response.payload.data.me, {
    id: 'user-1',
    role: 'member',
    projectKeys: ['workspace'],
  });
  assert.deepEqual(response.payload.data.projects, [
    {
      key: 'workspace',
      name: 'Workspace',
    },
  ]);
  assert.deepEqual(response.payload.data.project, {
    key: 'workspace',
    slug: 'workspace',
  });
  assert.equal(response.payload.data.runs.length, 2);
  assert.equal(response.payload.data.runs[0].externalKey, 'workspace:github-actions:1001');
  assert.equal(response.payload.data.runs[0].coverageSnapshot.linesPct, 80);
  assert.equal(response.payload.data.runs[1].externalKey, 'workspace:github-actions:1000');
  assert.equal(response.payload.data.runs[1].coverageSnapshot.linesPct, 74);
  assert.equal(response.payload.data.run.suites.length, 1);
  assert.equal(response.payload.data.run.suites[0].tests.length, 2);
  assert.equal(response.payload.data.run.artifacts[0].href, 'raw/workspace/repo-node.log');
  assert.equal(response.payload.data.run.rawReport.summary.totalTests, 2);
  assert.deepEqual(response.payload.data.runPackages, [
    {
      name: 'workspace',
      status: 'failed',
      suiteCount: 1,
    },
  ]);
  assert.deepEqual(response.payload.data.runModules, [
    {
      module: 'runtime',
      owner: 'platform',
      packageCount: 1,
    },
  ]);
  assert.equal(response.payload.data.runFiles.length, 1);
  assert.equal(response.payload.data.runFiles[0].path, '/repo/packages/core/src/index.js');
  assert.equal(response.payload.data.runFiles[0].failedTestCount, 1);
  assert.equal(response.payload.data.tests.length, 1);
  assert.equal(response.payload.data.tests[0].fullName, 'workspace fails');
  assert.equal(response.payload.data.coverageTrend.length, 2);
  assert.equal(response.payload.data.coverageTrend[0].scopeType, 'project');
  assert.equal(response.payload.data.coverageTrend[0].versionKey, 'commit:abc123');
  assert.equal(response.payload.data.runCoverageComparison.previousRunId, 'run-0');
  assert.equal(response.payload.data.runCoverageComparison.previousVersionKey, 'commit:zzz999');
  assert.equal(response.payload.data.runCoverageComparison.deltaLinesPct, 6);
  assert.equal(response.payload.data.runCoverageComparison.packageChanges[0].label, 'workspace');
  assert.equal(response.payload.data.runCoverageComparison.packageChanges[0].deltaLinesPct, 6);
  assert.equal(response.payload.data.runCoverageComparison.moduleChanges[0].label, 'runtime');
  assert.equal(response.payload.data.runCoverageComparison.fileChanges[0].filePath, '/repo/packages/core/src/index.js');
  assert.equal(response.payload.data.runCoverageComparison.fileChanges[0].deltaLinesPct, 6);
  assert.equal(response.payload.data.artifacts.length, 1);
  assert.equal(response.payload.data.releaseNotes[0].title, '0.1.0 release');

  await closeServer(server);
});

test('GraphQL ingest mutation accepts shared-key service auth', async () => {
  const ingestionCalls = [];
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    ingestSharedKeys: ['phase4-secret'],
    models: createGraphqlModels(),
    ingestionService: {
      async ingest(payload) {
        ingestionCalls.push(payload);
        return {
          projectId: 'project-1',
          projectVersionId: 'version-1',
          runId: 'run-2',
          externalKey: 'workspace:github-actions:1002',
          created: true,
          counts: {
            packages: 1,
            modules: 1,
            files: 1,
            suites: 1,
            tests: 2,
            coverageFiles: 1,
            artifacts: 1,
            errors: 1,
          },
        };
      },
    },
  });

  await listen(server);
  const response = await graphqlRequest(server, {
    query: `
      mutation IngestRun($projectKey: String!, $report: JSON!, $source: JSON, $artifacts: JSON) {
        ingestRun(projectKey: $projectKey, report: $report, source: $source, artifacts: $artifacts) {
          runId
          externalKey
          created
          counts {
            tests
          }
        }
      }
    `,
    variables: {
      projectKey: 'workspace',
      report: createRunReport(),
      source: {
        provider: 'github-actions',
        runId: '1002',
      },
      artifacts: [
        {
          label: 'run report',
          href: 'https://example.test/report/1002',
          kind: 'link',
        },
      ],
    },
  }, {
    authorization: 'Bearer phase4-secret',
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.errors, undefined);
  assert.equal(response.payload.data.ingestRun.externalKey, 'workspace:github-actions:1002');
  assert.equal(response.payload.data.ingestRun.counts.tests, 2);
  assert.equal(ingestionCalls.length, 1);
  assert.equal(ingestionCalls[0].projectKey, 'workspace');
  assert.equal(ingestionCalls[0].source.runId, '1002');

  await closeServer(server);
});

function createGraphqlModels() {
  const report = createRunReport();

  return {
    Project: createFindAllModel([
      {
        id: 'project-1',
        key: 'workspace',
        slug: 'workspace',
        name: 'Workspace',
        repositoryUrl: 'https://github.com/example/test-station',
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-2',
        key: 'hidden',
        slug: 'hidden',
        name: 'Hidden',
        repositoryUrl: null,
        defaultBranch: 'main',
        metadata: {},
      },
    ]),
    ProjectVersion: createFindAllModel([
      {
        id: 'version-0',
        projectId: 'project-1',
        versionKey: 'commit:zzz999',
        versionKind: 'commit',
        branch: 'release',
        tag: null,
        commitSha: 'zzz999',
        semanticVersion: null,
        buildNumber: 1000,
        releaseName: null,
        releasedAt: null,
        metadata: {},
      },
      {
        id: 'version-1',
        projectId: 'project-1',
        versionKey: 'commit:abc123',
        versionKind: 'commit',
        branch: 'release',
        tag: null,
        commitSha: 'abc123',
        semanticVersion: null,
        buildNumber: 1001,
        releaseName: null,
        releasedAt: null,
        metadata: {},
      },
    ]),
    ProjectPackage: createFindAllModel([
      {
        id: 'package-1',
        projectId: 'project-1',
        name: 'workspace',
        slug: 'workspace',
        path: 'packages',
        metadata: {},
      },
    ]),
    ProjectModule: createFindAllModel([
      {
        id: 'module-1',
        projectId: 'project-1',
        projectPackageId: 'package-1',
        name: 'runtime',
        slug: 'runtime',
        owner: 'platform',
        metadata: {},
      },
    ]),
    ProjectFile: createFindAllModel([
      {
        id: 'file-1',
        projectId: 'project-1',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        path: '/repo/packages/core/src/index.js',
        language: 'js',
        metadata: {},
      },
    ]),
    Run: createFindAllModel([
      {
        id: 'run-0',
        projectId: 'project-1',
        projectVersionId: 'version-0',
        externalKey: 'workspace:github-actions:1000',
        sourceProvider: 'github-actions',
        sourceRunId: '1000',
        sourceUrl: 'https://github.com/example/test-station/actions/runs/1000',
        triggeredBy: 'ci-bot',
        branch: 'release',
        commitSha: 'zzz999',
        startedAt: '2026-03-08T14:59:00.000Z',
        completedAt: '2026-03-08T15:00:00.000Z',
        durationMs: 2800,
        status: 'passed',
        reportSchemaVersion: '1',
        rawReport: report,
        summary: report.summary,
        metadata: {},
      },
      {
        id: 'run-1',
        projectId: 'project-1',
        projectVersionId: 'version-1',
        externalKey: 'workspace:github-actions:1001',
        sourceProvider: 'github-actions',
        sourceRunId: '1001',
        sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
        triggeredBy: 'ci-bot',
        branch: 'release',
        commitSha: 'abc123',
        startedAt: '2026-03-09T14:59:00.000Z',
        completedAt: '2026-03-09T15:00:00.000Z',
        durationMs: 3000,
        status: 'failed',
        reportSchemaVersion: '1',
        rawReport: report,
        summary: report.summary,
        metadata: {},
      },
    ]),
    SuiteRun: createFindAllModel([
      {
        id: 'suite-1',
        runId: 'run-1',
        projectPackageId: 'package-1',
        packageName: 'workspace',
        suiteIdentifier: 'repo-node',
        label: 'Repository Tests',
        runtime: 'node-test',
        command: 'node --test ../tests/*.test.js',
        cwd: '/repo/packages',
        status: 'failed',
        durationMs: 3000,
        summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
        warnings: ['fixture warning'],
        rawArtifacts: report.packages[0].suites[0].rawArtifacts,
        output: {
          stdout: 'suite output',
          stderr: '',
        },
        metadata: {},
      },
    ]),
    TestExecution: createFindAllModel([
      {
        id: 'test-1',
        suiteRunId: 'suite-1',
        projectModuleId: 'module-1',
        projectFileId: 'file-1',
        name: 'passes',
        fullName: 'workspace passes',
        status: 'passed',
        durationMs: 10,
        filePath: '/repo/packages/core/src/index.js',
        line: 10,
        column: 2,
        classificationSource: 'fixture',
        moduleName: 'runtime',
        themeName: 'core',
        assertions: ['assert.equal(1, 1)'],
        setup: ['load fixture'],
        mocks: ['mock fs'],
        failureMessages: [],
        rawDetails: { fixture: true },
        sourceSnippet: 'assert.equal(1, 1)',
        metadata: {},
      },
      {
        id: 'test-2',
        suiteRunId: 'suite-1',
        projectModuleId: 'module-1',
        projectFileId: 'file-1',
        name: 'fails',
        fullName: 'workspace fails',
        status: 'failed',
        durationMs: 12,
        filePath: '/repo/packages/core/src/index.js',
        line: 24,
        column: 4,
        classificationSource: 'fixture',
        moduleName: 'runtime',
        themeName: 'core',
        assertions: ['assert.equal(1, 2)'],
        setup: ['load fixture'],
        mocks: [],
        failureMessages: ['expected 2 but received 1'],
        rawDetails: { fixture: false },
        sourceSnippet: 'assert.equal(1, 2)',
        metadata: {},
      },
    ]),
    CoverageSnapshot: createFindAllModel([
      {
        id: 'coverage-0',
        runId: 'run-0',
        linesCovered: 37,
        linesTotal: 50,
        linesPct: 74,
        branchesCovered: 14,
        branchesTotal: 20,
        branchesPct: 70,
        functionsCovered: 9,
        functionsTotal: 12,
        functionsPct: 75,
        statementsCovered: 37,
        statementsTotal: 50,
        statementsPct: 74,
        metadata: {},
      },
      {
        id: 'coverage-1',
        runId: 'run-1',
        linesCovered: 8,
        linesTotal: 10,
        linesPct: 80,
        branchesCovered: 3,
        branchesTotal: 4,
        branchesPct: 75,
        functionsCovered: 2,
        functionsTotal: 3,
        functionsPct: 66.67,
        statementsCovered: 8,
        statementsTotal: 10,
        statementsPct: 80,
        metadata: {},
      },
    ]),
    CoverageFile: createFindAllModel([
      {
        id: 'coverage-file-0',
        coverageSnapshotId: 'coverage-0',
        projectFileId: 'file-1',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        path: '/repo/packages/core/src/index.js',
        linesCovered: 37,
        linesTotal: 50,
        linesPct: 74,
        branchesCovered: 14,
        branchesTotal: 20,
        branchesPct: 70,
        functionsCovered: 9,
        functionsTotal: 12,
        functionsPct: 75,
        statementsCovered: 37,
        statementsTotal: 50,
        statementsPct: 74,
        shared: false,
        attributionSource: 'manifest',
        attributionReason: 'fixture',
        attributionWeight: 1,
        metadata: {},
      },
      {
        id: 'coverage-file-1',
        coverageSnapshotId: 'coverage-1',
        projectFileId: 'file-1',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        path: '/repo/packages/core/src/index.js',
        linesCovered: 8,
        linesTotal: 10,
        linesPct: 80,
        branchesCovered: 3,
        branchesTotal: 4,
        branchesPct: 75,
        functionsCovered: 2,
        functionsTotal: 3,
        functionsPct: 66.67,
        statementsCovered: 8,
        statementsTotal: 10,
        statementsPct: 80,
        shared: false,
        attributionSource: 'manifest',
        attributionReason: 'fixture',
        attributionWeight: 1,
        metadata: {},
      },
    ]),
    CoverageTrendPoint: createFindAllModel([
      {
        id: 'trend-project-0',
        projectId: 'project-1',
        projectVersionId: 'version-0',
        runId: 'run-0',
        projectPackageId: null,
        projectModuleId: null,
        projectFileId: null,
        scopeType: 'project',
        scopeHash: 'trend-project-0',
        scopeKey: 'project:workspace',
        label: 'Workspace',
        packageName: null,
        moduleName: null,
        filePath: null,
        recordedAt: '2026-03-08T15:00:00.000Z',
        linesPct: 74,
        branchesPct: 70,
        functionsPct: 75,
        statementsPct: 74,
        metadata: {},
      },
      {
        id: 'trend-package-0',
        projectId: 'project-1',
        projectVersionId: 'version-0',
        runId: 'run-0',
        projectPackageId: 'package-1',
        projectModuleId: null,
        projectFileId: null,
        scopeType: 'package',
        scopeHash: 'trend-package-0',
        scopeKey: 'package:workspace',
        label: 'workspace',
        packageName: 'workspace',
        moduleName: null,
        filePath: null,
        recordedAt: '2026-03-08T15:00:00.000Z',
        linesPct: 74,
        branchesPct: 70,
        functionsPct: 75,
        statementsPct: 74,
        metadata: {},
      },
      {
        id: 'trend-module-0',
        projectId: 'project-1',
        projectVersionId: 'version-0',
        runId: 'run-0',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        projectFileId: null,
        scopeType: 'module',
        scopeHash: 'trend-module-0',
        scopeKey: 'module:workspace:runtime',
        label: 'runtime',
        packageName: 'workspace',
        moduleName: 'runtime',
        filePath: null,
        recordedAt: '2026-03-08T15:00:00.000Z',
        linesPct: 74,
        branchesPct: 70,
        functionsPct: 75,
        statementsPct: 74,
        metadata: {},
      },
      {
        id: 'trend-file-0',
        projectId: 'project-1',
        projectVersionId: 'version-0',
        runId: 'run-0',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        projectFileId: 'file-1',
        scopeType: 'file',
        scopeHash: 'trend-file-0',
        scopeKey: 'file:/repo/packages/core/src/index.js',
        label: '/repo/packages/core/src/index.js',
        packageName: 'workspace',
        moduleName: 'runtime',
        filePath: '/repo/packages/core/src/index.js',
        recordedAt: '2026-03-08T15:00:00.000Z',
        linesPct: 74,
        branchesPct: 70,
        functionsPct: 75,
        statementsPct: 74,
        metadata: {},
      },
      {
        id: 'trend-project-1',
        projectId: 'project-1',
        projectVersionId: 'version-1',
        runId: 'run-1',
        projectPackageId: null,
        projectModuleId: null,
        projectFileId: null,
        scopeType: 'project',
        scopeHash: 'trend-project-1',
        scopeKey: 'project:workspace',
        label: 'Workspace',
        packageName: null,
        moduleName: null,
        filePath: null,
        recordedAt: '2026-03-09T15:00:00.000Z',
        linesPct: 80,
        branchesPct: 75,
        functionsPct: 66.67,
        statementsPct: 80,
        metadata: {},
      },
      {
        id: 'trend-package-1',
        projectId: 'project-1',
        projectVersionId: 'version-1',
        runId: 'run-1',
        projectPackageId: 'package-1',
        projectModuleId: null,
        projectFileId: null,
        scopeType: 'package',
        scopeHash: 'trend-package-1',
        scopeKey: 'package:workspace',
        label: 'workspace',
        packageName: 'workspace',
        moduleName: null,
        filePath: null,
        recordedAt: '2026-03-09T15:00:00.000Z',
        linesPct: 80,
        branchesPct: 75,
        functionsPct: 66.67,
        statementsPct: 80,
        metadata: {},
      },
      {
        id: 'trend-module-1',
        projectId: 'project-1',
        projectVersionId: 'version-1',
        runId: 'run-1',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        projectFileId: null,
        scopeType: 'module',
        scopeHash: 'trend-module-1',
        scopeKey: 'module:workspace:runtime',
        label: 'runtime',
        packageName: 'workspace',
        moduleName: 'runtime',
        filePath: null,
        recordedAt: '2026-03-09T15:00:00.000Z',
        linesPct: 80,
        branchesPct: 75,
        functionsPct: 66.67,
        statementsPct: 80,
        metadata: {},
      },
      {
        id: 'trend-file-1',
        projectId: 'project-1',
        projectVersionId: 'version-1',
        runId: 'run-1',
        projectPackageId: 'package-1',
        projectModuleId: 'module-1',
        projectFileId: 'file-1',
        scopeType: 'file',
        scopeHash: 'trend-file-1',
        scopeKey: 'file:/repo/packages/core/src/index.js',
        label: '/repo/packages/core/src/index.js',
        packageName: 'workspace',
        moduleName: 'runtime',
        filePath: '/repo/packages/core/src/index.js',
        recordedAt: '2026-03-09T15:00:00.000Z',
        linesPct: 80,
        branchesPct: 75,
        functionsPct: 66.67,
        statementsPct: 80,
        metadata: {},
      },
    ]),
    Artifact: createFindAllModel([
      {
        id: 'artifact-1',
        runId: 'run-1',
        suiteRunId: 'suite-1',
        testExecutionId: null,
        label: 'Repo log',
        relativePath: 'workspace/repo-node.log',
        href: 'raw/workspace/repo-node.log',
        kind: 'file',
        mediaType: 'text/plain',
        storageKey: null,
        sourceUrl: null,
        metadata: {},
      },
    ]),
    ReleaseNote: createFindAllModel([
      {
        id: 'note-1',
        projectId: 'project-1',
        projectVersionId: 'version-1',
        title: '0.1.0 release',
        body: 'Initial web and API release.',
        sourceUrl: 'https://example.test/releases/0.1.0',
        publishedAt: '2026-03-09T16:00:00.000Z',
        metadata: {},
      },
    ]),
  };
}

function createRunReport() {
  return {
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
        owner: 'platform',
        summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
        durationMs: 22,
        packageCount: 1,
        packages: ['workspace'],
        frameworks: ['node-test'],
        dominantPackages: ['workspace'],
        coverage: {
          lines: { covered: 8, total: 10, pct: 80 },
        },
        themes: [],
      },
    ],
    meta: {
      projectName: 'Workspace',
    },
  };
}

function createFindAllModel(rows) {
  return {
    async findAll() {
      return rows.map((row) => structuredClone(row));
    },
  };
}

async function listen(server) {
  await new Promise((resolve) => {
    server.httpServer.listen(0, resolve);
  });
}

async function graphqlRequest(server, payload, headers = {}) {
  const address = server.httpServer.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  return {
    status: response.status,
    payload: await response.json(),
  };
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
