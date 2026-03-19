import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphqlQueryService } from '../packages/server/graphql/query-service.js';
import { createServer } from '../packages/server/index.js';
import { resolveActorFromRequest } from '../packages/server/graphql/context.js';

test('GraphQL exposes guest-safe public reads and hides private resources', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    models: createGraphqlModels(),
  });

  await listen(server);
  const response = await graphqlRequest(server, {
    query: `
      query GuestPublicRead {
        viewer {
          id
        }
        projects {
          key
          name
        }
        publicProject: project(key: "public-site") {
          key
          slug
        }
        privateProject: project(key: "workspace") {
          key
        }
        runs(projectKey: "public-site") {
          id
          externalKey
          status
          project {
            key
          }
          coverageSnapshot {
            linesPct
          }
        }
        publicRun: run(id: "run-public-1") {
          id
          externalKey
          project {
            key
          }
          coverageSnapshot {
            linesPct
          }
          suites {
            suiteIdentifier
            tests {
              fullName
              status
            }
          }
          artifacts {
            label
            href
            kind
          }
        }
        privateRun: run(id: "run-1") {
          id
        }
        runPackages(runId: "run-public-1") {
          name
          status
          suiteCount
        }
        runModules(runId: "run-public-1") {
          module
          owner
          packageCount
        }
        runFiles(runId: "run-public-1") {
          path
          status
          testCount
          failedTestCount
        }
        tests(runId: "run-public-1") {
          fullName
          status
          packageName
        }
        runPerformanceStats(runId: "run-public-1") {
          runId
          statGroup
          statName
          numericValue
          unit
          seriesId
          branch
          buildNumber
          commitSha
        }
        privateRunPerformanceStats: runPerformanceStats(runId: "run-1") {
          statGroup
        }
        performanceTrend(
          projectKey: "public-site"
          statGroup: "benchmark.browser.gameplay.nibbles.intro"
          statName: "time_to_waiting_for_input_ms"
        ) {
          runId
          statGroup
          statName
          numericValue
          unit
          seriesId
          branch
          buildNumber
          commitSha
        }
        privatePerformanceTrend: performanceTrend(
          projectKey: "workspace"
          statGroup: "benchmark.node.engine.nibbles.intro"
          statName: "elapsed_ms"
        ) {
          runId
        }
        benchmarkCatalog(projectKey: "public-site") {
          projectKey
          statGroup
          statNames
          units
          seriesIds
          runnerKeys
          pointCount
          latestCompletedAt
        }
        privateBenchmarkCatalog: benchmarkCatalog(projectKey: "workspace") {
          statGroup
        }
        coverageTrend(projectKey: "public-site") {
          runId
          externalKey
          scopeType
          label
          linesPct
          versionKey
        }
        runCoverageComparison(runId: "run-public-1") {
          runId
          previousRunId
          currentExternalKey
          currentVersionKey
          previousVersionKey
          deltaLinesPct
        }
        artifacts(runId: "run-public-1") {
          label
          href
          kind
        }
        privateArtifacts: artifacts(runId: "run-1") {
          label
        }
        releaseNotes(projectKey: "public-site") {
          title
          projectVersion {
            versionKey
          }
        }
      }
    `,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.errors, undefined);
  assert.equal(response.payload.data.viewer, null);
  assert.deepEqual(response.payload.data.projects, [
    {
      key: 'public-site',
      name: 'Public Site',
    },
  ]);
  assert.deepEqual(response.payload.data.publicProject, {
    key: 'public-site',
    slug: 'public-site',
  });
  assert.equal(response.payload.data.privateProject, null);
  assert.equal(response.payload.data.runs.length, 1);
  assert.equal(response.payload.data.runs[0].externalKey, 'public-site:github-actions:2001');
  assert.equal(response.payload.data.runs[0].coverageSnapshot.linesPct, 91);
  assert.equal(response.payload.data.publicRun.externalKey, 'public-site:github-actions:2001');
  assert.equal(response.payload.data.publicRun.suites[0].tests[0].fullName, 'public site passes');
  assert.equal(response.payload.data.publicRun.artifacts[0].href, 'raw/public-site/public-site.log');
  assert.equal(response.payload.data.privateRun, null);
  assert.deepEqual(response.payload.data.runPackages, [
    {
      name: 'public-site',
      status: 'passed',
      suiteCount: 1,
    },
  ]);
  assert.deepEqual(response.payload.data.runModules, [
    {
      module: 'marketing',
      owner: 'growth',
      packageCount: 1,
    },
  ]);
  assert.deepEqual(response.payload.data.runFiles, [
    {
      path: '/repo/apps/public-site/src/home.js',
      status: 'passed',
      testCount: 1,
      failedTestCount: 0,
    },
  ]);
  assert.deepEqual(response.payload.data.tests, [
    {
      fullName: 'public site passes',
      status: 'passed',
      packageName: 'public-site',
    },
  ]);
  assert.deepEqual(response.payload.data.runPerformanceStats, [
    {
      runId: 'run-public-1',
      statGroup: 'benchmark.browser.gameplay.nibbles.intro',
      statName: 'time_to_first_terminal_byte_ms',
      numericValue: 3200,
      unit: 'ms',
      seriesId: 'chromium-headless',
      branch: 'main',
      buildNumber: 2001,
      commitSha: 'public111',
    },
    {
      runId: 'run-public-1',
      statGroup: 'benchmark.browser.gameplay.nibbles.intro',
      statName: 'time_to_waiting_for_input_ms',
      numericValue: 11900,
      unit: 'ms',
      seriesId: 'chromium-headless',
      branch: 'main',
      buildNumber: 2001,
      commitSha: 'public111',
    },
  ]);
  assert.deepEqual(response.payload.data.privateRunPerformanceStats, []);
  assert.deepEqual(response.payload.data.performanceTrend, [
    {
      runId: 'run-public-1',
      statGroup: 'benchmark.browser.gameplay.nibbles.intro',
      statName: 'time_to_waiting_for_input_ms',
      numericValue: 11900,
      unit: 'ms',
      seriesId: 'chromium-headless',
      branch: 'main',
      buildNumber: 2001,
      commitSha: 'public111',
    },
  ]);
  assert.deepEqual(response.payload.data.privatePerformanceTrend, []);
  assert.deepEqual(response.payload.data.benchmarkCatalog, [
    {
      projectKey: 'public-site',
      statGroup: 'benchmark.browser.gameplay.nibbles.intro',
      statNames: ['time_to_first_terminal_byte_ms', 'time_to_waiting_for_input_ms'],
      units: ['ms'],
      seriesIds: ['chromium-headless'],
      runnerKeys: ['gha-ubuntu-latest-node20-chromium-headless'],
      pointCount: 2,
      latestCompletedAt: '2026-03-10T15:00:00.000Z',
    },
  ]);
  assert.deepEqual(response.payload.data.privateBenchmarkCatalog, []);
  assert.deepEqual(response.payload.data.coverageTrend, [
    {
      runId: 'run-public-1',
      externalKey: 'public-site:github-actions:2001',
      scopeType: 'project',
      label: 'Public Site',
      linesPct: 91,
      versionKey: 'commit:public111',
    },
  ]);
  assert.deepEqual(response.payload.data.runCoverageComparison, {
    runId: 'run-public-1',
    previousRunId: null,
    currentExternalKey: 'public-site:github-actions:2001',
    currentVersionKey: 'commit:public111',
    previousVersionKey: null,
    deltaLinesPct: null,
  });
  assert.deepEqual(response.payload.data.artifacts, [
    {
      label: 'Public site log',
      href: 'raw/public-site/public-site.log',
      kind: 'file',
    },
  ]);
  assert.deepEqual(response.payload.data.privateArtifacts, []);
  assert.deepEqual(response.payload.data.releaseNotes, [
    {
      title: 'Public site launch',
      projectVersion: {
        versionKey: 'commit:public111',
      },
    },
  ]);

  await closeServer(server);
});

test('GraphQL returns trace headers and request profiling metadata', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    models: createGraphqlModels(),
  });

  await listen(server);
  const response = await graphqlRequest(server, {
    query: `
      query TraceProbe {
        viewer {
          id
        }
      }
    `,
  }, {
    'x-request-id': 'browser-request-123',
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers['x-request-id'], 'browser-request-123');
  assert.equal(response.headers['x-test-station-trace-id'], 'browser-request-123');
  assert.match(response.headers['server-timing'] || '', /graphql;dur=/);
  assert.equal(response.payload.extensions.testStationTrace.requestId, 'browser-request-123');
  assert.equal(response.payload.extensions.testStationTrace.traceId, 'browser-request-123');
  assert.equal(response.payload.extensions.testStationTrace.parentRequestId, null);
  assert.equal(response.payload.extensions.testStationTrace.operationName, 'TraceProbe');
  assert.equal(typeof response.payload.extensions.testStationTrace.durationMs, 'number');

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
        viewer {
          id
          userId
          email
          name
          role
          isAdmin
          isGuest
          roleKeys
          groupKeys
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
        runPerformanceStats(
          runId: "run-1"
          statGroupPrefix: "benchmark.node.engine"
          seriesIds: ["interpreter-redux"]
        ) {
          runId
          suiteRunId
          testExecutionId
          statGroup
          statName
          numericValue
          unit
          seriesId
          runnerKey
          branch
          buildNumber
          versionKey
        }
        performanceTrend(
          projectKey: "workspace"
          statGroup: "benchmark.node.engine.nibbles.intro"
          statName: "elapsed_ms"
          seriesIds: ["interpreter", "interpreter-redux"]
          runnerKey: "gha-ubuntu-latest-node20"
          limit: 4
        ) {
          runId
          statGroup
          statName
          numericValue
          unit
          seriesId
          branch
          buildNumber
          commitSha
          versionKey
          completedAt
        }
        benchmarkCatalog(projectKey: "workspace") {
          projectKey
          statGroup
          statNames
          units
          seriesIds
          runnerKeys
          pointCount
          latestCompletedAt
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
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.errors, undefined);
  assert.deepEqual(response.payload.data.viewer, {
    id: 'user-1',
    userId: 'user-1',
    email: 'user-1@example.com',
    name: 'User One',
    role: 'member',
    isAdmin: false,
    isGuest: false,
    roleKeys: ['release-manager'],
    groupKeys: ['qa'],
  });
  assert.deepEqual(response.payload.data.projects, [
    {
      key: 'group-only',
      name: 'Group Only',
    },
    {
      key: 'public-site',
      name: 'Public Site',
    },
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
  assert.deepEqual(response.payload.data.runPerformanceStats, [
    {
      runId: 'run-1',
      suiteRunId: null,
      testExecutionId: null,
      statGroup: 'benchmark.node.engine.nibbles.intro',
      statName: 'elapsed_ms',
      numericValue: 57.54,
      unit: 'ms',
      seriesId: 'interpreter-redux',
      runnerKey: 'gha-ubuntu-latest-node20',
      branch: 'release',
      buildNumber: 1001,
      versionKey: 'commit:abc123',
    },
    {
      runId: 'run-1',
      suiteRunId: null,
      testExecutionId: 'test-2',
      statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
      statName: 'heap_delta_bytes',
      numericValue: 2048,
      unit: 'bytes',
      seriesId: 'interpreter-redux',
      runnerKey: 'gha-ubuntu-latest-node20',
      branch: 'release',
      buildNumber: 1001,
      versionKey: 'commit:abc123',
    },
    {
      runId: 'run-1',
      suiteRunId: 'suite-1',
      testExecutionId: null,
      statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
      statName: 'steps_per_second',
      numericValue: 404.55,
      unit: 'ops_per_sec',
      seriesId: 'interpreter-redux',
      runnerKey: 'gha-ubuntu-latest-node20',
      branch: 'release',
      buildNumber: 1001,
      versionKey: 'commit:abc123',
    },
  ]);
  assert.deepEqual(response.payload.data.performanceTrend, [
    {
      runId: 'run-1',
      statGroup: 'benchmark.node.engine.nibbles.intro',
      statName: 'elapsed_ms',
      numericValue: 62.4,
      unit: 'ms',
      seriesId: 'interpreter',
      branch: 'release',
      buildNumber: 1001,
      commitSha: 'abc123',
      versionKey: 'commit:abc123',
      completedAt: '2026-03-09T15:00:00.000Z',
    },
    {
      runId: 'run-1',
      statGroup: 'benchmark.node.engine.nibbles.intro',
      statName: 'elapsed_ms',
      numericValue: 57.54,
      unit: 'ms',
      seriesId: 'interpreter-redux',
      branch: 'release',
      buildNumber: 1001,
      commitSha: 'abc123',
      versionKey: 'commit:abc123',
      completedAt: '2026-03-09T15:00:00.000Z',
    },
    {
      runId: 'run-0',
      statGroup: 'benchmark.node.engine.nibbles.intro',
      statName: 'elapsed_ms',
      numericValue: 74.2,
      unit: 'ms',
      seriesId: 'interpreter',
      branch: 'release',
      buildNumber: 1000,
      commitSha: 'zzz999',
      versionKey: 'commit:zzz999',
      completedAt: '2026-03-08T15:00:00.000Z',
    },
  ]);
  assert.deepEqual(response.payload.data.benchmarkCatalog, [
    {
      projectKey: 'workspace',
      statGroup: 'benchmark.node.engine.nibbles.intro',
      statNames: ['elapsed_ms'],
      units: ['ms'],
      seriesIds: ['interpreter', 'interpreter-redux'],
      runnerKeys: ['gha-ubuntu-latest-node20'],
      pointCount: 3,
      latestCompletedAt: '2026-03-09T15:00:00.000Z',
    },
    {
      projectKey: 'workspace',
      statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
      statNames: ['heap_delta_bytes', 'steps_per_second'],
      units: ['bytes', 'ops_per_sec'],
      seriesIds: ['interpreter-redux'],
      runnerKeys: ['gha-ubuntu-latest-node20'],
      pointCount: 2,
      latestCompletedAt: '2026-03-09T15:00:00.000Z',
    },
  ]);
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

test('GraphQL rejects admin queries for non-admin actors', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    models: createAdminGraphqlModels(),
  });

  await listen(server);
  const response = await graphqlRequest(server, {
    query: `
      query AdminUsers {
        adminUsers {
          id
        }
      }
    `,
  }, {
    'x-test-station-actor-id': 'user-1',
    'x-test-station-actor-email': 'user-1@example.com',
    'x-test-station-actor-role': 'member',
  });

  assert.equal(response.status, 403);
  assert.equal(response.payload.data, null);
  assert.equal(response.payload.errors[0].extensions.code, 'FORBIDDEN');

  await closeServer(server);
});

test('GraphQL admin queries and mutations manage roles, groups, users, and project access', async () => {
  const server = await createServer({
    port: 0,
    corsOrigin: 'http://localhost:3001',
    models: createAdminGraphqlModels(),
  });

  await listen(server);

  const initial = await graphqlRequest(server, {
    query: `
      query AdminBootstrap {
        adminUsers {
          id
          email
          isAdmin
          roleKeys
          groupKeys
        }
        adminRoles {
          id
          key
          userCount
          projectCount
        }
        adminGroups {
          id
          key
          userCount
          projectCount
        }
        workspaceAccess: adminProjectAccess(key: "workspace") {
          isPublic
          roleKeys
          groupKeys
        }
      }
    `,
  }, buildAdminHeaders());

  assert.equal(initial.status, 200);
  assert.equal(initial.payload.errors, undefined);
  assert.deepEqual(initial.payload.data.adminUsers, [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      isAdmin: true,
      roleKeys: [],
      groupKeys: [],
    },
    {
      id: 'user-1',
      email: 'user-1@example.com',
      isAdmin: false,
      roleKeys: ['release-manager'],
      groupKeys: ['qa'],
    },
  ]);
  assert.deepEqual(initial.payload.data.adminRoles, [
    {
      id: 'role-1',
      key: 'release-manager',
      userCount: 1,
      projectCount: 1,
    },
  ]);
  assert.deepEqual(initial.payload.data.adminGroups, [
    {
      id: 'group-1',
      key: 'qa',
      userCount: 1,
      projectCount: 1,
    },
  ]);
  assert.deepEqual(initial.payload.data.workspaceAccess, {
    isPublic: false,
    roleKeys: ['release-manager'],
    groupKeys: [],
  });

  const createResponse = await graphqlRequest(server, {
    query: `
      mutation CreateAdminEntities {
        role: adminCreateRole(input: {
          key: "ops"
          name: "Operations"
          description: "Operations access"
        }) {
          id
          key
          name
          description
          userCount
          projectCount
        }
        group: adminCreateGroup(input: {
          key: "partners"
          name: "Partners"
          description: "External partners"
        }) {
          id
          key
          name
          description
          userCount
          projectCount
        }
      }
    `,
  }, buildAdminHeaders());

  assert.equal(createResponse.status, 200);
  assert.equal(createResponse.payload.errors, undefined);
  assert.equal(createResponse.payload.data.role.key, 'ops');
  assert.equal(createResponse.payload.data.group.key, 'partners');
  const createdRoleId = createResponse.payload.data.role.id;
  const createdGroupId = createResponse.payload.data.group.id;

  const updateResponse = await graphqlRequest(server, {
    query: `
      mutation UpdateAdminEntities($roleId: ID!, $groupId: ID!) {
        updatedRole: adminUpdateRole(id: $roleId, input: {
          name: "Operations Prime"
          description: "Primary operations access"
        }) {
          id
          key
          name
          description
        }
        updatedGroup: adminUpdateGroup(id: $groupId, input: {
          name: "Partners Prime"
          description: "Primary partner access"
        }) {
          id
          key
          name
          description
        }
        promotedUser: adminSetUserAdmin(userId: "user-1", isAdmin: true) {
          id
          isAdmin
          roleKeys
          groupKeys
        }
        userWithRole: adminAddUserRole(userId: "user-1", roleId: $roleId) {
          id
          isAdmin
          roleKeys
          groupKeys
        }
        userWithGroup: adminAddUserGroup(userId: "user-1", groupId: $groupId) {
          id
          isAdmin
          roleKeys
          groupKeys
        }
        publicWorkspace: adminSetProjectPublic(projectId: "project-1", isPublic: true) {
          project {
            key
          }
          isPublic
          roleKeys
          groupKeys
        }
        hiddenRoleAccess: adminAddProjectRoleAccess(projectId: "project-2", roleId: $roleId) {
          project {
            key
          }
          isPublic
          roleKeys
          groupKeys
        }
        hiddenGroupAccess: adminAddProjectGroupAccess(projectId: "project-2", groupId: $groupId) {
          project {
            key
          }
          isPublic
          roleKeys
          groupKeys
        }
      }
    `,
    variables: {
      roleId: createdRoleId,
      groupId: createdGroupId,
    },
  }, buildAdminHeaders());

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.payload.errors, undefined);
  assert.deepEqual(updateResponse.payload.data.updatedRole, {
    id: createdRoleId,
    key: 'ops',
    name: 'Operations Prime',
    description: 'Primary operations access',
  });
  assert.deepEqual(updateResponse.payload.data.updatedGroup, {
    id: createdGroupId,
    key: 'partners',
    name: 'Partners Prime',
    description: 'Primary partner access',
  });
  assert.equal(updateResponse.payload.data.promotedUser.isAdmin, true);
  assert.deepEqual(updateResponse.payload.data.userWithRole.roleKeys, ['ops', 'release-manager']);
  assert.deepEqual(updateResponse.payload.data.userWithGroup.groupKeys, ['partners', 'qa']);
  assert.deepEqual(updateResponse.payload.data.publicWorkspace, {
    project: {
      key: 'workspace',
    },
    isPublic: true,
    roleKeys: ['release-manager'],
    groupKeys: [],
  });
  assert.deepEqual(updateResponse.payload.data.hiddenRoleAccess, {
    project: {
      key: 'hidden',
    },
    isPublic: false,
    roleKeys: ['ops'],
    groupKeys: [],
  });
  assert.deepEqual(updateResponse.payload.data.hiddenGroupAccess, {
    project: {
      key: 'hidden',
    },
    isPublic: false,
    roleKeys: ['ops'],
    groupKeys: ['partners'],
  });

  const adminState = await graphqlRequest(server, {
    query: `
      query AdminState {
        user: adminUser(email: "user-1@example.com") {
          id
          normalizedEmail
          isAdmin
          roleKeys
          groupKeys
        }
        hiddenAccess: adminProjectAccess(projectId: "project-2") {
          project {
            key
          }
          isPublic
          roleKeys
          groupKeys
          roles {
            id
            key
            userCount
            projectCount
          }
          groups {
            id
            key
            userCount
            projectCount
          }
        }
        roles: adminRoles {
          id
          key
          userCount
          projectCount
        }
        groups: adminGroups {
          id
          key
          userCount
          projectCount
        }
      }
    `,
  }, buildAdminHeaders());

  assert.equal(adminState.status, 200);
  assert.equal(adminState.payload.errors, undefined);
  assert.deepEqual(adminState.payload.data.user, {
    id: 'user-1',
    normalizedEmail: 'user-1@example.com',
    isAdmin: true,
    roleKeys: ['ops', 'release-manager'],
    groupKeys: ['partners', 'qa'],
  });
  assert.deepEqual(adminState.payload.data.hiddenAccess, {
    project: {
      key: 'hidden',
    },
    isPublic: false,
    roleKeys: ['ops'],
    groupKeys: ['partners'],
    roles: [
      {
        id: createdRoleId,
        key: 'ops',
        userCount: 1,
        projectCount: 1,
      },
    ],
    groups: [
      {
        id: createdGroupId,
        key: 'partners',
        userCount: 1,
        projectCount: 1,
      },
    ],
  });

  const cleanupResponse = await graphqlRequest(server, {
    query: `
      mutation CleanupAdminEntities($roleId: ID!, $groupId: ID!) {
        userWithoutRole: adminRemoveUserRole(userId: "user-1", roleId: $roleId) {
          id
          roleKeys
          groupKeys
        }
        userWithoutGroup: adminRemoveUserGroup(userId: "user-1", groupId: $groupId) {
          id
          roleKeys
          groupKeys
        }
        hiddenWithoutRole: adminRemoveProjectRoleAccess(projectId: "project-2", roleId: $roleId) {
          project {
            key
          }
          roleKeys
          groupKeys
        }
        hiddenWithoutGroup: adminRemoveProjectGroupAccess(projectId: "project-2", groupId: $groupId) {
          project {
            key
          }
          roleKeys
          groupKeys
        }
        deletedRole: adminDeleteRole(id: $roleId) {
          id
          key
        }
        deletedGroup: adminDeleteGroup(id: $groupId) {
          id
          key
        }
      }
    `,
    variables: {
      roleId: createdRoleId,
      groupId: createdGroupId,
    },
  }, buildAdminHeaders());

  assert.equal(cleanupResponse.status, 200);
  assert.equal(cleanupResponse.payload.errors, undefined);
  assert.deepEqual(cleanupResponse.payload.data.userWithoutRole, {
    id: 'user-1',
    roleKeys: ['release-manager'],
    groupKeys: ['partners', 'qa'],
  });
  assert.deepEqual(cleanupResponse.payload.data.userWithoutGroup, {
    id: 'user-1',
    roleKeys: ['release-manager'],
    groupKeys: ['qa'],
  });
  assert.deepEqual(cleanupResponse.payload.data.hiddenWithoutRole, {
    project: {
      key: 'hidden',
    },
    roleKeys: [],
    groupKeys: ['partners'],
  });
  assert.deepEqual(cleanupResponse.payload.data.hiddenWithoutGroup, {
    project: {
      key: 'hidden',
    },
    roleKeys: [],
    groupKeys: [],
  });
  assert.deepEqual(cleanupResponse.payload.data.deletedRole, {
    id: createdRoleId,
    key: 'ops',
  });
  assert.deepEqual(cleanupResponse.payload.data.deletedGroup, {
    id: createdGroupId,
    key: 'partners',
  });

  await closeServer(server);
});

test('query service filters visible projects from public, role, and group grants', async () => {
  const queryService = createGraphqlQueryService({
    models: createGraphqlModels(),
  });

  const guestProjects = await queryService.listProjects({
    actor: {
      id: 'guest',
      userId: null,
      email: null,
      name: 'Guest',
      role: 'guest',
      isAdmin: false,
      isGuest: true,
      roleKeys: [],
      groupKeys: [],
    },
  });
  assert.deepEqual(guestProjects.map((project) => project.key), ['public-site']);

  const memberProjects = await queryService.listProjects({
    actor: {
      id: 'user-1',
      userId: 'user-1',
      email: 'user-1@example.com',
      name: 'User One',
      role: 'member',
      isAdmin: false,
      isGuest: false,
      roleKeys: ['release-manager'],
      groupKeys: ['qa'],
    },
  });
  assert.deepEqual(memberProjects.map((project) => project.key), ['group-only', 'public-site', 'workspace']);

  const adminProjects = await queryService.listProjects({
    actor: {
      id: 'admin-1',
      userId: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      isAdmin: true,
      isGuest: false,
      roleKeys: [],
      groupKeys: [],
    },
  });
  assert.deepEqual(adminProjects.map((project) => project.key), ['group-only', 'hidden', 'public-site', 'workspace']);
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

test('resolveActorFromRequest returns a guest actor when no identity headers are present', async () => {
  const actor = await resolveActorFromRequest({
    headers: {},
  }, {
    models: createGraphqlModels(),
  });

  assert.deepEqual(actor, {
    id: 'guest',
    userId: null,
    email: null,
    name: 'Guest',
    role: 'guest',
    isAdmin: false,
    isGuest: true,
    roleKeys: [],
    groupKeys: [],
  });
});

test('resolveActorFromRequest upserts persisted users, applies bootstrap admin emails, and ignores legacy project key headers', async () => {
  const models = {
    User: createMutableModel([], 'user'),
    Role: createFindAllModel([]),
    Group: createFindAllModel([]),
    UserRole: createFindAllModel([]),
    UserGroup: createFindAllModel([]),
  };

  const actor = await resolveActorFromRequest({
    headers: {
      'x-test-station-actor-id': 'session-user',
      'x-test-station-actor-email': 'Bootstrap.Admin@example.com',
      'x-test-station-actor-name': 'Bootstrap Admin',
      'x-test-station-actor-project-keys': 'workspace',
    },
  }, {
    models,
    adminEmails: ['bootstrap.admin@example.com'],
  });

  assert.equal(actor.id, 'user-1');
  assert.equal(actor.userId, 'user-1');
  assert.equal(actor.email, 'Bootstrap.Admin@example.com');
  assert.equal(actor.name, 'Bootstrap Admin');
  assert.equal(actor.role, 'admin');
  assert.equal(actor.isAdmin, true);
  assert.equal(actor.isGuest, false);
  assert.deepEqual(actor.roleKeys, []);
  assert.deepEqual(actor.groupKeys, []);
  assert.deepEqual(models.User.rows, [{
    id: 'user-1',
    email: 'Bootstrap.Admin@example.com',
    normalizedEmail: 'bootstrap.admin@example.com',
    name: 'Bootstrap Admin',
    avatarUrl: null,
    isAdmin: true,
    metadata: {},
  }]);
});

test('listRuns queries the lightweight feed fields with DB-side limit and related lookups', async () => {
  let runFindAllOptions = null;
  let versionFindAllOptions = null;
  let snapshotFindAllOptions = null;

  const queryService = createGraphqlQueryService({
    accessService: {
      async filterProjects({ projects }) {
        return projects;
      },
    },
    models: {
      Project: createFindAllModel([
        {
          id: 'project-1',
          key: 'workspace',
          slug: 'workspace',
          name: 'Workspace',
          isPublic: true,
        },
      ]),
      Run: {
        async findAll(options = {}) {
          runFindAllOptions = options;
          return [
            {
              id: 'run-2',
              projectId: 'project-1',
              projectVersionId: 'version-2',
              externalKey: 'workspace:github-actions:1002',
              status: 'passed',
              completedAt: '2026-03-15T12:00:00.000Z',
              durationMs: 1000,
              summary: { totalTests: 3, passedTests: 3, failedTests: 0 },
            },
            {
              id: 'run-1',
              projectId: 'project-1',
              projectVersionId: 'version-1',
              externalKey: 'workspace:github-actions:1001',
              status: 'failed',
              completedAt: '2026-03-14T12:00:00.000Z',
              durationMs: 1200,
              summary: { totalTests: 2, passedTests: 1, failedTests: 1 },
            },
          ];
        },
      },
      ProjectVersion: {
        async findAll(options = {}) {
          versionFindAllOptions = options;
          return [
            { id: 'version-1', versionKey: 'commit:abc123', buildNumber: 88 },
            { id: 'version-2', versionKey: 'commit:def456', buildNumber: 89 },
          ];
        },
      },
      CoverageSnapshot: {
        async findAll(options = {}) {
          snapshotFindAllOptions = options;
          return [
            { id: 'coverage-1', runId: 'run-1', linesPct: 80 },
            { id: 'coverage-2', runId: 'run-2', linesPct: 90 },
          ];
        },
      },
      Group: createFindAllModel([]),
      ProjectFile: createFindAllModel([]),
      ProjectGroupAccess: createFindAllModel([]),
      ProjectModule: createFindAllModel([]),
      ProjectPackage: createFindAllModel([]),
      ProjectRoleAccess: createFindAllModel([]),
      ReleaseNote: createFindAllModel([]),
      Role: createFindAllModel([]),
      SuiteRun: createFindAllModel([]),
      TestExecution: createFindAllModel([]),
      Artifact: createFindAllModel([]),
    },
  });

  const runs = await queryService.listRuns({
    actor: {
      id: 'guest',
      userId: null,
      email: null,
      name: 'Guest',
      role: 'guest',
      isAdmin: false,
      isGuest: true,
      roleKeys: [],
      groupKeys: [],
    },
    limit: 5,
  });

  assert.equal(runs.length, 2);
  assert.equal(runs[0].externalKey, 'workspace:github-actions:1002');
  assert.deepEqual(runFindAllOptions.where, {
    projectId: ['project-1'],
  });
  assert.equal(runFindAllOptions.limit, 5);
  assert.deepEqual(runFindAllOptions.order, [
    ['completedAt', 'DESC'],
    ['startedAt', 'DESC'],
    ['createdAt', 'DESC'],
  ]);
  assert.deepEqual(runFindAllOptions.attributes, [
    'id',
    'projectId',
    'projectVersionId',
    'externalKey',
    'sourceProvider',
    'sourceRunId',
    'sourceUrl',
    'triggeredBy',
    'branch',
    'commitSha',
    'startedAt',
    'completedAt',
    'durationMs',
    'status',
    'reportSchemaVersion',
    'summary',
  ]);
  assert.deepEqual(versionFindAllOptions.where, {
    id: ['version-2', 'version-1'],
  });
  assert.deepEqual(snapshotFindAllOptions.where, {
    runId: ['run-2', 'run-1'],
  });
  assert.deepEqual(runs[0].summary, { totalTests: 3, passedTests: 3, failedTests: 0 });
});

test('listPerformanceTrend applies visibility, metadata filters, and post-filter limits', async () => {
  const queryService = createGraphqlQueryService({
    models: createGraphqlModels(),
  });

  const memberActor = {
    id: 'user-1',
    userId: 'user-1',
    email: 'user-1@example.com',
    name: 'User One',
    role: 'member',
    isAdmin: false,
    isGuest: false,
    roleKeys: ['release-manager'],
    groupKeys: ['qa'],
  };
  const guestActor = {
    id: 'guest',
    userId: null,
    email: null,
    name: 'Guest',
    role: 'guest',
    isAdmin: false,
    isGuest: true,
    roleKeys: [],
    groupKeys: [],
  };

  const memberPoints = await queryService.listPerformanceTrend({
    actor: memberActor,
    projectKey: 'workspace',
    statGroup: 'benchmark.node.engine.nibbles.intro',
    statName: 'elapsed_ms',
    seriesIds: ['interpreter'],
    runnerKey: 'gha-ubuntu-latest-node20',
    limit: 1,
  });

  assert.deepEqual(memberPoints.map((point) => ({
    runId: point.runId,
    statName: point.statName,
    numericValue: point.numericValue,
    seriesId: point.seriesId,
    buildNumber: point.buildNumber,
    projectKey: point.projectKey,
  })), [
    {
      runId: 'run-1',
      statName: 'elapsed_ms',
      numericValue: 62.4,
      seriesId: 'interpreter',
      buildNumber: 1001,
      projectKey: 'workspace',
    },
  ]);

  const guestPoints = await queryService.listPerformanceTrend({
    actor: guestActor,
    projectKey: 'workspace',
    statGroup: 'benchmark.node.engine.nibbles.intro',
    statName: 'elapsed_ms',
    limit: 5,
  });

  assert.deepEqual(guestPoints, []);
});

function createGraphqlModels() {
  const report = createRunReport();
  const publicReport = createPublicRunReport();

  return {
    User: createFindAllModel([
      {
        id: 'user-1',
        email: 'user-1@example.com',
        normalizedEmail: 'user-1@example.com',
        name: 'User One',
        avatarUrl: null,
        isAdmin: false,
        metadata: {},
      },
    ]),
    Role: createFindAllModel([
      {
        id: 'role-1',
        key: 'release-manager',
        name: 'Release Manager',
        description: null,
        metadata: {},
      },
    ]),
    Group: createFindAllModel([
      {
        id: 'group-1',
        key: 'qa',
        name: 'QA',
        description: null,
        metadata: {},
      },
    ]),
    UserRole: createFindAllModel([
      {
        id: 'user-role-1',
        userId: 'user-1',
        roleId: 'role-1',
        metadata: {},
      },
    ]),
    UserGroup: createFindAllModel([
      {
        id: 'user-group-1',
        userId: 'user-1',
        groupId: 'group-1',
        metadata: {},
      },
    ]),
    Project: createFindAllModel([
      {
        id: 'project-1',
        key: 'workspace',
        slug: 'workspace',
        name: 'Workspace',
        isPublic: false,
        repositoryUrl: 'https://github.com/example/test-station',
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-2',
        key: 'hidden',
        slug: 'hidden',
        name: 'Hidden',
        isPublic: false,
        repositoryUrl: null,
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-3',
        key: 'public-site',
        slug: 'public-site',
        name: 'Public Site',
        isPublic: true,
        repositoryUrl: 'https://github.com/example/public-site',
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-4',
        key: 'group-only',
        slug: 'group-only',
        name: 'Group Only',
        isPublic: false,
        repositoryUrl: null,
        defaultBranch: 'main',
        metadata: {},
      },
    ]),
    ProjectRoleAccess: createFindAllModel([
      {
        id: 'project-role-access-1',
        projectId: 'project-1',
        roleId: 'role-1',
        metadata: {},
      },
    ]),
    ProjectGroupAccess: createFindAllModel([
      {
        id: 'project-group-access-1',
        projectId: 'project-4',
        groupId: 'group-1',
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
      {
        id: 'version-public-1',
        projectId: 'project-3',
        versionKey: 'commit:public111',
        versionKind: 'commit',
        branch: 'main',
        tag: null,
        commitSha: 'public111',
        semanticVersion: null,
        buildNumber: 2001,
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
      {
        id: 'package-public-1',
        projectId: 'project-3',
        name: 'public-site',
        slug: 'public-site',
        path: 'apps/public-site',
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
      {
        id: 'module-public-1',
        projectId: 'project-3',
        projectPackageId: 'package-public-1',
        name: 'marketing',
        slug: 'marketing',
        owner: 'growth',
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
      {
        id: 'file-public-1',
        projectId: 'project-3',
        projectPackageId: 'package-public-1',
        projectModuleId: 'module-public-1',
        path: '/repo/apps/public-site/src/home.js',
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
      {
        id: 'run-public-1',
        projectId: 'project-3',
        projectVersionId: 'version-public-1',
        externalKey: 'public-site:github-actions:2001',
        sourceProvider: 'github-actions',
        sourceRunId: '2001',
        sourceUrl: 'https://github.com/example/public-site/actions/runs/2001',
        triggeredBy: 'ci-bot',
        branch: 'main',
        commitSha: 'public111',
        startedAt: '2026-03-10T14:59:00.000Z',
        completedAt: '2026-03-10T15:00:00.000Z',
        durationMs: 1800,
        status: 'passed',
        reportSchemaVersion: '1',
        rawReport: publicReport,
        summary: publicReport.summary,
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
      {
        id: 'suite-public-1',
        runId: 'run-public-1',
        projectPackageId: 'package-public-1',
        packageName: 'public-site',
        suiteIdentifier: 'public-site-node',
        label: 'Public Site Tests',
        runtime: 'node-test',
        command: 'node --test ./tests/*.test.js',
        cwd: '/repo/apps/public-site',
        status: 'passed',
        durationMs: 1800,
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        warnings: [],
        rawArtifacts: publicReport.packages[0].suites[0].rawArtifacts,
        output: {
          stdout: 'public suite output',
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
      {
        id: 'test-public-1',
        suiteRunId: 'suite-public-1',
        projectModuleId: 'module-public-1',
        projectFileId: 'file-public-1',
        name: 'passes',
        fullName: 'public site passes',
        status: 'passed',
        durationMs: 8,
        filePath: '/repo/apps/public-site/src/home.js',
        line: 14,
        column: 2,
        classificationSource: 'fixture',
        moduleName: 'marketing',
        themeName: 'landing',
        assertions: ['assert.equal(true, true)'],
        setup: ['load landing fixture'],
        mocks: [],
        failureMessages: [],
        rawDetails: { fixture: true },
        sourceSnippet: 'assert.equal(true, true)',
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
      {
        id: 'coverage-public-1',
        runId: 'run-public-1',
        linesCovered: 10,
        linesTotal: 11,
        linesPct: 91,
        branchesCovered: 9,
        branchesTotal: 10,
        branchesPct: 90,
        functionsCovered: 3,
        functionsTotal: 3,
        functionsPct: 100,
        statementsCovered: 10,
        statementsTotal: 11,
        statementsPct: 91,
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
      {
        id: 'coverage-file-public-1',
        coverageSnapshotId: 'coverage-public-1',
        projectFileId: 'file-public-1',
        projectPackageId: 'package-public-1',
        projectModuleId: 'module-public-1',
        path: '/repo/apps/public-site/src/home.js',
        linesCovered: 10,
        linesTotal: 11,
        linesPct: 91,
        branchesCovered: 9,
        branchesTotal: 10,
        branchesPct: 90,
        functionsCovered: 3,
        functionsTotal: 3,
        functionsPct: 100,
        statementsCovered: 10,
        statementsTotal: 11,
        statementsPct: 91,
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
      {
        id: 'trend-project-public-1',
        projectId: 'project-3',
        projectVersionId: 'version-public-1',
        runId: 'run-public-1',
        projectPackageId: null,
        projectModuleId: null,
        projectFileId: null,
        scopeType: 'project',
        scopeHash: 'trend-project-public-1',
        scopeKey: 'project:public-site',
        label: 'Public Site',
        packageName: null,
        moduleName: null,
        filePath: null,
        recordedAt: '2026-03-10T15:00:00.000Z',
        linesPct: 91,
        branchesPct: 90,
        functionsPct: 100,
        statementsPct: 91,
        metadata: {},
      },
    ]),
    PerformanceStat: createFindAllModel([
      {
        id: 'perf-run-0-interpreter-intro',
        runId: 'run-0',
        suiteRunId: null,
        testExecutionId: null,
        statGroup: 'benchmark.node.engine.nibbles.intro',
        statName: 'elapsed_ms',
        unit: 'ms',
        numericValue: 74.2,
        textValue: null,
        metadata: {
          seriesId: 'interpreter',
          engineId: 'interpreter',
          runnerKey: 'gha-ubuntu-latest-node20',
          scenarioId: 'nibbles-intro-screen',
          surface: 'node-engine',
          statistic: 'median',
        },
      },
      {
        id: 'perf-run-1-interpreter-intro',
        runId: 'run-1',
        suiteRunId: null,
        testExecutionId: null,
        statGroup: 'benchmark.node.engine.nibbles.intro',
        statName: 'elapsed_ms',
        unit: 'ms',
        numericValue: 62.4,
        textValue: null,
        metadata: {
          seriesId: 'interpreter',
          engineId: 'interpreter',
          runnerKey: 'gha-ubuntu-latest-node20',
          scenarioId: 'nibbles-intro-screen',
          surface: 'node-engine',
          statistic: 'median',
        },
      },
      {
        id: 'perf-run-1-redux-intro',
        runId: 'run-1',
        suiteRunId: null,
        testExecutionId: null,
        statGroup: 'benchmark.node.engine.nibbles.intro',
        statName: 'elapsed_ms',
        unit: 'ms',
        numericValue: 57.54,
        textValue: null,
        metadata: {
          seriesId: 'interpreter-redux',
          engineId: 'interpreter-redux',
          runnerKey: 'gha-ubuntu-latest-node20',
          scenarioId: 'nibbles-intro-screen',
          surface: 'node-engine',
          statistic: 'median',
        },
      },
      {
        id: 'perf-suite-1-redux-tight-sps',
        runId: 'run-1',
        suiteRunId: 'suite-1',
        testExecutionId: null,
        statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
        statName: 'steps_per_second',
        unit: 'ops_per_sec',
        numericValue: 404.55,
        textValue: null,
        metadata: {
          seriesId: 'interpreter-redux',
          engineId: 'interpreter-redux',
          runnerKey: 'gha-ubuntu-latest-node20',
          scenarioId: 'tight-arithmetic-loop',
          surface: 'node-engine',
          statistic: 'median',
        },
      },
      {
        id: 'perf-test-2-redux-tight-heap',
        runId: 'run-1',
        suiteRunId: null,
        testExecutionId: 'test-2',
        statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
        statName: 'heap_delta_bytes',
        unit: 'bytes',
        numericValue: 2048,
        textValue: null,
        metadata: {
          seriesId: 'interpreter-redux',
          engineId: 'interpreter-redux',
          runnerKey: 'gha-ubuntu-latest-node20',
          scenarioId: 'tight-arithmetic-loop',
          surface: 'node-engine',
          statistic: 'median',
        },
      },
      {
        id: 'perf-run-public-intro-terminal',
        runId: 'run-public-1',
        suiteRunId: null,
        testExecutionId: null,
        statGroup: 'benchmark.browser.gameplay.nibbles.intro',
        statName: 'time_to_first_terminal_byte_ms',
        unit: 'ms',
        numericValue: 3200,
        textValue: null,
        metadata: {
          seriesId: 'chromium-headless',
          runnerKey: 'gha-ubuntu-latest-node20-chromium-headless',
          scenarioId: 'nibbles-browser-intro',
          surface: 'browser-gameplay',
          statistic: 'single',
          browserName: 'chromium',
          headless: true,
          viewport: '1280x900',
        },
      },
      {
        id: 'perf-run-public-intro-wait',
        runId: 'run-public-1',
        suiteRunId: null,
        testExecutionId: null,
        statGroup: 'benchmark.browser.gameplay.nibbles.intro',
        statName: 'time_to_waiting_for_input_ms',
        unit: 'ms',
        numericValue: 11900,
        textValue: null,
        metadata: {
          seriesId: 'chromium-headless',
          runnerKey: 'gha-ubuntu-latest-node20-chromium-headless',
          scenarioId: 'nibbles-browser-intro',
          surface: 'browser-gameplay',
          statistic: 'single',
          browserName: 'chromium',
          headless: true,
          viewport: '1280x900',
        },
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
      {
        id: 'artifact-public-1',
        runId: 'run-public-1',
        suiteRunId: 'suite-public-1',
        testExecutionId: null,
        label: 'Public site log',
        relativePath: 'public-site/public-site.log',
        href: 'raw/public-site/public-site.log',
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
      {
        id: 'note-public-1',
        projectId: 'project-3',
        projectVersionId: 'version-public-1',
        title: 'Public site launch',
        body: 'Initial public launch.',
        sourceUrl: 'https://example.test/releases/public-site-launch',
        publishedAt: '2026-03-10T16:00:00.000Z',
        metadata: {},
      },
    ]),
  };
}

function createAdminGraphqlModels() {
  const base = createGraphqlModels();

  return {
    ...base,
    User: createMutableModel([
      {
        id: 'admin-1',
        email: 'admin@example.com',
        normalizedEmail: 'admin@example.com',
        name: 'Admin User',
        avatarUrl: null,
        isAdmin: true,
        metadata: {
          providerAccessToken: 'should-not-leak',
        },
      },
      {
        id: 'user-1',
        email: 'user-1@example.com',
        normalizedEmail: 'user-1@example.com',
        name: 'User One',
        avatarUrl: null,
        isAdmin: false,
        metadata: {
          providerAccessToken: 'should-not-leak',
        },
      },
    ], 'user'),
    Role: createMutableModel([
      {
        id: 'role-1',
        key: 'release-manager',
        name: 'Release Manager',
        description: null,
        metadata: {},
      },
    ], 'role'),
    Group: createMutableModel([
      {
        id: 'group-1',
        key: 'qa',
        name: 'QA',
        description: null,
        metadata: {},
      },
    ], 'group'),
    UserRole: createMutableModel([
      {
        id: 'user-role-1',
        userId: 'user-1',
        roleId: 'role-1',
        metadata: {},
      },
    ], 'user-role'),
    UserGroup: createMutableModel([
      {
        id: 'user-group-1',
        userId: 'user-1',
        groupId: 'group-1',
        metadata: {},
      },
    ], 'user-group'),
    Project: createMutableModel([
      {
        id: 'project-1',
        key: 'workspace',
        slug: 'workspace',
        name: 'Workspace',
        isPublic: false,
        repositoryUrl: 'https://github.com/example/test-station',
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-2',
        key: 'hidden',
        slug: 'hidden',
        name: 'Hidden',
        isPublic: false,
        repositoryUrl: null,
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-3',
        key: 'public-site',
        slug: 'public-site',
        name: 'Public Site',
        isPublic: true,
        repositoryUrl: 'https://github.com/example/public-site',
        defaultBranch: 'main',
        metadata: {},
      },
      {
        id: 'project-4',
        key: 'group-only',
        slug: 'group-only',
        name: 'Group Only',
        isPublic: false,
        repositoryUrl: null,
        defaultBranch: 'main',
        metadata: {},
      },
    ], 'project'),
    ProjectRoleAccess: createMutableModel([
      {
        id: 'project-role-access-1',
        projectId: 'project-1',
        roleId: 'role-1',
        metadata: {},
      },
    ], 'project-role-access'),
    ProjectGroupAccess: createMutableModel([
      {
        id: 'project-group-access-1',
        projectId: 'project-4',
        groupId: 'group-1',
        metadata: {},
      },
    ], 'project-group-access'),
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

function createPublicRunReport() {
  return {
    schemaVersion: '1',
    generatedAt: '2026-03-10T15:00:00.000Z',
    durationMs: 1800,
    summary: {
      totalPackages: 1,
      totalModules: 1,
      totalSuites: 1,
      failedSuites: 0,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      skippedTests: 0,
      coverage: {
        lines: { covered: 10, total: 11, pct: 91 },
        branches: { covered: 9, total: 10, pct: 90 },
        functions: { covered: 3, total: 3, pct: 100 },
        statements: { covered: 10, total: 11, pct: 91 },
        files: [
          {
            path: '/repo/apps/public-site/src/home.js',
            lines: { covered: 10, total: 11, pct: 91 },
            branches: { covered: 9, total: 10, pct: 90 },
            functions: { covered: 3, total: 3, pct: 100 },
            statements: { covered: 10, total: 11, pct: 91 },
            module: 'marketing',
            theme: 'landing',
            packageName: 'public-site',
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
        modules: ['marketing'],
        packages: ['public-site'],
        frameworks: ['node-test'],
      },
    },
    packages: [
      {
        name: 'public-site',
        location: 'apps/public-site',
        status: 'passed',
        durationMs: 1800,
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        coverage: {
          lines: { covered: 10, total: 11, pct: 91 },
          branches: { covered: 9, total: 10, pct: 90 },
          functions: { covered: 3, total: 3, pct: 100 },
          statements: { covered: 10, total: 11, pct: 91 },
        },
        modules: ['marketing'],
        frameworks: ['node-test'],
        suites: [
          {
            id: 'public-site-node',
            label: 'Public Site Tests',
            runtime: 'node-test',
            command: 'node --test ./tests/*.test.js',
            cwd: '/repo/apps/public-site',
            status: 'passed',
            durationMs: 1800,
            summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
            warnings: [],
            output: {
              stdout: 'public suite output',
              stderr: '',
            },
            rawArtifacts: [
              {
                relativePath: 'public-site/public-site.log',
                href: 'raw/public-site/public-site.log',
                label: 'Public site log',
                kind: 'file',
                mediaType: 'text/plain',
              },
            ],
            tests: [
              {
                name: 'passes',
                fullName: 'public site passes',
                status: 'passed',
                durationMs: 8,
                file: '/repo/apps/public-site/src/home.js',
                line: 14,
                column: 2,
                assertions: ['assert.equal(true, true)'],
                setup: ['load landing fixture'],
                mocks: [],
                failureMessages: [],
                rawDetails: { fixture: true },
                sourceSnippet: 'assert.equal(true, true)',
                module: 'marketing',
                theme: 'landing',
                classificationSource: 'fixture',
              },
            ],
          },
        ],
      },
    ],
    modules: [
      {
        module: 'marketing',
        owner: 'growth',
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        durationMs: 8,
        packageCount: 1,
        packages: ['public-site'],
        frameworks: ['node-test'],
        dominantPackages: ['public-site'],
        coverage: {
          lines: { covered: 10, total: 11, pct: 91 },
        },
        themes: [],
      },
    ],
    meta: {
      projectName: 'Public Site',
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

function createMutableModel(rows = [], idPrefix = 'row') {
  const state = rows.map((row) => structuredClone(row));

  return {
    rows: state,
    async findAll() {
      return state.map((row) => createMutableRecord(row, state));
    },
    async findOne({ where } = {}) {
      const row = state.find((entry) => matchesWhere(entry, where || {}));
      return row ? createMutableRecord(row, state) : null;
    },
    async create(values) {
      const row = {
        ...structuredClone(values),
        id: values.id || `${idPrefix}-${state.length + 1}`,
      };
      state.push(row);
      return createMutableRecord(row, state);
    },
  };
}

function createMutableRecord(row, state) {
  return {
    ...row,
    toJSON() {
      return structuredClone(row);
    },
    async update(values) {
      Object.assign(row, structuredClone(values));
      Object.assign(this, row);
      return this;
    },
    async destroy() {
      const index = state.findIndex((entry) => entry.id === row.id);
      if (index >= 0) {
        state.splice(index, 1);
      }
    },
  };
}

function buildAdminHeaders() {
  return {
    'x-test-station-actor-id': 'admin-1',
    'x-test-station-actor-email': 'admin@example.com',
    'x-test-station-actor-role': 'admin',
  };
}

function matchesWhere(row, where) {
  return Object.entries(where || {}).every(([key, value]) => row?.[key] === value);
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
    headers: Object.fromEntries(response.headers.entries()),
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
