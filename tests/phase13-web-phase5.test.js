import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWebActorHeaders,
  createAuthOptions,
  resolveAutoSignInProviderId,
  resolveDemoAuthEnabled,
  resolveNextAuthUrl,
} from '../packages/web/lib/auth.js';
import { ensureNextAuthUrl } from '../packages/web/lib/nextAuthEnv.js';
import { formatCoveragePct, formatDuration } from '../packages/web/lib/format.js';
import {
  executeWebGraphql,
  loadWebHomePage,
  loadProjectExplorerPage,
  loadRunExplorerPage,
  loadRunReportHtml,
  resolveWebServerUrl,
} from '../packages/web/lib/serverGraphql.js';
import { buildRunTemplateHref, resolveRunTemplateMode } from '../packages/web/lib/runTemplateRouting.js';
import { buildSignInRedirectUrl, isProtectedWebPath } from '../packages/web/lib/routeProtection.js';
import { RUNNER_REPORT_HEIGHT_MESSAGE_TYPE } from '../packages/web/lib/runReportTemplate.js';
import { resolveNextAuthHandler } from '../packages/web/pages/api/auth/[...nextauth].js';

test('web auth options expose the sign-in page and session actor metadata', async () => {
  const authOptions = createAuthOptions({
    secret: 'test-secret',
    adminEmails: ['admin@example.com'],
    defaultProjectKeys: ['workspace'],
    demoAuthEnabled: true,
  });

  assert.equal(authOptions.pages.signIn, '/auth/signin');
  assert.equal(authOptions.providers.some((provider) => provider.type === 'credentials'), true);

  const token = await authOptions.callbacks.jwt({
    token: {},
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin Operator',
    },
  });

  assert.equal(token.userId, 'user-1');
  assert.equal(token.role, 'admin');
  assert.deepEqual(token.projectKeys, ['workspace']);

  const session = await authOptions.callbacks.session({
    session: { user: {} },
    token,
  });

  assert.equal(session.userId, 'user-1');
  assert.equal(session.role, 'admin');
  assert.deepEqual(session.projectKeys, ['workspace']);
  assert.equal(session.user.image, null);
});

test('web exposes Google as an OAuth provider when configured', () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

    const authOptions = createAuthOptions({
      demoAuthEnabled: false,
    });

    assert.equal(authOptions.providers.some((provider) => provider.id === 'google'), true);
  } finally {
    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }

    if (originalGoogleClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    }
  }
});

test('web demo auth defaults off unless explicitly enabled', () => {
  const originalDemoAuthEnabled = process.env.WEB_DEMO_AUTH_ENABLED;

  try {
    delete process.env.WEB_DEMO_AUTH_ENABLED;

    assert.equal(resolveDemoAuthEnabled(), false);

    const authOptions = createAuthOptions();
    assert.equal(authOptions.providers.some((provider) => provider.type === 'credentials'), false);
  } finally {
    if (originalDemoAuthEnabled === undefined) {
      delete process.env.WEB_DEMO_AUTH_ENABLED;
    } else {
      process.env.WEB_DEMO_AUTH_ENABLED = originalDemoAuthEnabled;
    }
  }
});

test('web demo auth can be enabled from WEB_DEMO_AUTH_ENABLED', () => {
  const originalDemoAuthEnabled = process.env.WEB_DEMO_AUTH_ENABLED;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    process.env.WEB_DEMO_AUTH_ENABLED = 'true';
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    assert.equal(resolveDemoAuthEnabled(), true);

    const authOptions = createAuthOptions();
    assert.equal(authOptions.providers.some((provider) => provider.type === 'credentials'), true);
  } finally {
    if (originalDemoAuthEnabled === undefined) {
      delete process.env.WEB_DEMO_AUTH_ENABLED;
    } else {
      process.env.WEB_DEMO_AUTH_ENABLED = originalDemoAuthEnabled;
    }

    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }

    if (originalGoogleClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    }
  }
});

test('web hides demo auth and auto-selects Google when Google OAuth is configured', () => {
  const originalDemoAuthEnabled = process.env.WEB_DEMO_AUTH_ENABLED;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    process.env.WEB_DEMO_AUTH_ENABLED = 'true';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

    const authOptions = createAuthOptions();
    assert.equal(authOptions.providers.some((provider) => provider.id === 'google'), true);
    assert.equal(authOptions.providers.some((provider) => provider.type === 'credentials'), false);
    assert.equal(resolveAutoSignInProviderId(authOptions.providers), 'google');
  } finally {
    if (originalDemoAuthEnabled === undefined) {
      delete process.env.WEB_DEMO_AUTH_ENABLED;
    } else {
      process.env.WEB_DEMO_AUTH_ENABLED = originalDemoAuthEnabled;
    }

    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }

    if (originalGoogleClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    }
  }
});

test('web defaults NEXTAUTH_URL to localhost using WEB_PORT when unset', () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;
  const originalWebPort = process.env.WEB_PORT;

  try {
    delete process.env.NEXTAUTH_URL;
    process.env.WEB_PORT = '3017';

    assert.equal(resolveNextAuthUrl(), 'http://localhost:3017');

    createAuthOptions({ demoAuthEnabled: false });
    assert.equal(process.env.NEXTAUTH_URL, 'http://localhost:3017');
  } finally {
    if (originalNextAuthUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalNextAuthUrl;
    }

    if (originalWebPort === undefined) {
      delete process.env.WEB_PORT;
    } else {
      process.env.WEB_PORT = originalWebPort;
    }
  }
});

test('web normalizes blank NEXTAUTH_URL before next-auth reads it', () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;
  const originalWebPort = process.env.WEB_PORT;

  try {
    process.env.NEXTAUTH_URL = '   ';
    process.env.WEB_PORT = '3018';

    assert.equal(ensureNextAuthUrl(), 'http://localhost:3018');
    assert.equal(process.env.NEXTAUTH_URL, 'http://localhost:3018');
  } finally {
    if (originalNextAuthUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalNextAuthUrl;
    }

    if (originalWebPort === undefined) {
      delete process.env.WEB_PORT;
    } else {
      process.env.WEB_PORT = originalWebPort;
    }
  }
});

test('web actor headers and route protection helpers produce the expected auth wiring', () => {
  const headers = buildWebActorHeaders({
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
    projectKeys: ['workspace', 'api'],
  });

  assert.deepEqual(headers, {
    'x-test-station-actor-id': 'user-1',
    'x-test-station-actor-email': 'user@example.com',
    'x-test-station-actor-name': 'Web User',
    'x-test-station-actor-role': 'member',
    'x-test-station-actor-project-keys': 'workspace,api',
  });

  assert.equal(isProtectedWebPath('/'), true);
  assert.equal(isProtectedWebPath('/projects/workspace'), true);
  assert.equal(isProtectedWebPath('/runs/run-1'), true);
  assert.equal(isProtectedWebPath('/auth/signin'), false);
  assert.equal(buildSignInRedirectUrl('/runs/run-1'), '/auth/signin?callbackUrl=%2Fruns%2Frun-1');
  assert.equal(
    buildSignInRedirectUrl('https://0.0.0.0:3001/?foo=bar#frag'),
    '/auth/signin?callbackUrl=%2F%3Ffoo%3Dbar%23frag',
  );
});

test('web defaults SERVER_URL to localhost using SERVER_PORT when unset', () => {
  const originalServerUrl = process.env.SERVER_URL;
  const originalServerPort = process.env.SERVER_PORT;

  try {
    delete process.env.SERVER_URL;
    process.env.SERVER_PORT = '4411';

    assert.equal(resolveWebServerUrl(), 'http://localhost:4411');
  } finally {
    if (originalServerUrl === undefined) {
      delete process.env.SERVER_URL;
    } else {
      process.env.SERVER_URL = originalServerUrl;
    }

    if (originalServerPort === undefined) {
      delete process.env.SERVER_PORT;
    } else {
      process.env.SERVER_PORT = originalServerPort;
    }
  }
});

test('web server URL ignores NEXT_PUBLIC_SERVER_URL and uses runtime SERVER_URL', () => {
  const originalServerUrl = process.env.SERVER_URL;
  const originalNextPublicServerUrl = process.env.NEXT_PUBLIC_SERVER_URL;

  try {
    process.env.SERVER_URL = 'http://test-station-server:4400';
    process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:4400';

    assert.equal(resolveWebServerUrl(), 'http://test-station-server:4400');
  } finally {
    if (originalServerUrl === undefined) {
      delete process.env.SERVER_URL;
    } else {
      process.env.SERVER_URL = originalServerUrl;
    }

    if (originalNextPublicServerUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SERVER_URL;
    } else {
      process.env.NEXT_PUBLIC_SERVER_URL = originalNextPublicServerUrl;
    }
  }
});

test('web auth API resolves a callable NextAuth handler', () => {
  assert.equal(typeof resolveNextAuthHandler(), 'function');
});

test('web GraphQL helpers forward actor headers and combine project activity data', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
    projectKeys: ['workspace'],
  };
  const requests = [];
  const fetchImpl = async (_url, options) => {
    const request = {
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    requests.push(request);
    const query = request.body.query || '';

    if (query.includes('WebHomePage')) {
      return new Response(JSON.stringify({
        data: {
          me: { id: 'user-1', name: 'Web User', email: 'user@example.com', role: 'member', projectKeys: ['workspace'] },
          projects: [{ id: 'project-1', key: 'workspace', slug: 'workspace', name: 'Workspace' }],
          runs: [{ id: 'run-1', externalKey: 'workspace:github-actions:1001', status: 'failed', coverageSnapshot: { linesPct: 80 } }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('WebProjectBySlug')) {
      return new Response(JSON.stringify({
        data: {
          project: {
            id: 'project-1',
            key: 'workspace',
            slug: 'workspace',
            name: 'Workspace',
            defaultBranch: 'main',
            repositoryUrl: 'https://example.test/workspace',
            metadata: {},
          },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('WebProjectActivity')) {
      return new Response(JSON.stringify({
        data: {
          runs: [{
            id: 'run-1',
            externalKey: 'workspace:github-actions:1001',
            status: 'failed',
            completedAt: '2026-03-09T15:00:00.000Z',
            durationMs: 3000,
            projectVersion: { versionKey: 'commit:abc123' },
            coverageSnapshot: { linesPct: 80 },
          }],
          coverageTrend: [
            {
              runId: 'run-1',
              completedAt: '2026-03-09T15:00:00.000Z',
              recordedAt: '2026-03-09T15:00:00.000Z',
              versionKey: 'commit:abc123',
              linesPct: 80,
            },
            {
              runId: 'run-0',
              completedAt: '2026-03-08T15:00:00.000Z',
              recordedAt: '2026-03-08T15:00:00.000Z',
              versionKey: 'commit:zzz999',
              linesPct: 74,
            },
          ],
          releaseNotes: [{
            id: 'note-1',
            title: 'Release',
            body: 'details',
            publishedAt: '2026-03-09T16:00:00.000Z',
            projectVersion: { versionKey: 'commit:abc123' },
          }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('WebRunScopeTrendCatalog')) {
      return new Response(JSON.stringify({
        data: {
          runPackages: [{ name: 'workspace', durationMs: 3000, suiteCount: 1, coverage: { linesPct: 80 } }],
          runModules: [{ module: 'runtime', owner: 'platform', coverage: { linesPct: 80 } }],
          runFiles: [{ path: '/repo/packages/core/src/index.js', packageName: 'workspace', moduleName: 'runtime', failedTestCount: 1, testCount: 2, coverage: { linesPct: 80 } }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('ScopedCoverageTrend')) {
      const variables = request.body.variables || {};
      const label = variables.packageName || variables.moduleName || variables.filePath;
      const scopeType = variables.filePath ? 'file' : variables.moduleName ? 'module' : 'package';
      return new Response(JSON.stringify({
        data: {
          coverageTrend: [
            {
              id: `${label}:current`,
              runId: 'run-1',
              externalKey: 'workspace:github-actions:1001',
              scopeType,
              scopeKey: label,
              label,
              recordedAt: '2026-03-09T15:00:00.000Z',
              completedAt: '2026-03-09T15:00:00.000Z',
              startedAt: '2026-03-09T14:59:00.000Z',
              branch: 'release',
              versionKey: 'commit:abc123',
              packageName: variables.packageName || 'workspace',
              moduleName: variables.moduleName || (variables.filePath ? 'runtime' : null),
              filePath: variables.filePath || null,
              linesPct: 80,
              branchesPct: 75,
              functionsPct: 66.67,
              statementsPct: 80,
            },
            {
              id: `${label}:previous`,
              runId: 'run-0',
              externalKey: 'workspace:github-actions:1000',
              scopeType,
              scopeKey: label,
              label,
              recordedAt: '2026-03-08T15:00:00.000Z',
              completedAt: '2026-03-08T15:00:00.000Z',
              startedAt: '2026-03-08T14:59:00.000Z',
              branch: 'release',
              versionKey: 'commit:zzz999',
              packageName: variables.packageName || 'workspace',
              moduleName: variables.moduleName || (variables.filePath ? 'runtime' : null),
              filePath: variables.filePath || null,
              linesPct: 74,
              branchesPct: 70,
              functionsPct: 75,
              statementsPct: 74,
            },
          ],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected web GraphQL request: ${query}`);
  };

  const home = await loadWebHomePage({ session, fetchImpl, requestId: 'req-home' });
  assert.equal(home.projects.length, 1);
  assert.equal(requests[0].headers['x-test-station-actor-project-keys'], 'workspace');
  assert.equal(requests[0].headers['x-request-id'], 'req-home');

  const project = await loadProjectExplorerPage({ session, slug: 'workspace', fetchImpl, requestId: 'req-project' });
  assert.equal(project.project.key, 'workspace');
  assert.equal(project.runs.length, 1);
  assert.equal(project.coverageTrend.length, 2);
  assert.equal(project.releaseNotes.length, 1);
  assert.equal(project.trendPanels.overlays.length, 3);
  assert.equal(project.trendPanels.packageTrends.length, 1);
  assert.equal(project.trendPanels.packageTrends[0].label, 'workspace');
  assert.equal(project.trendPanels.moduleTrends[0].label, 'runtime');
  assert.equal(project.trendPanels.fileTrends[0].label, '/repo/packages/core/src/index.js');
  assert.equal(requests[1].body.variables.slug, 'workspace');
  assert.equal(requests[2].body.variables.projectKey, 'workspace');
  assert.equal(requests[3].body.variables.runId, 'run-1');
  assert.equal(requests[4].body.variables.packageName, 'workspace');
  assert.equal(requests[5].body.variables.moduleName, 'runtime');
  assert.equal(requests[6].body.variables.filePath, '/repo/packages/core/src/index.js');
});

test('web run loader and raw GraphQL executor preserve response structure', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
    projectKeys: ['workspace'],
  };
  const responses = [
    {
      data: {
        run: {
          id: 'run-1',
          externalKey: 'workspace:github-actions:1001',
          project: { slug: 'workspace', name: 'Workspace' },
          artifacts: [],
          suites: [],
          coverageSnapshot: { linesPct: 80 },
        },
        runPackages: [{ name: 'workspace' }],
        runModules: [{ module: 'runtime' }],
        runFiles: [{ path: '/repo/packages/core/src/index.js' }],
        tests: [{ id: 'test-1', fullName: 'workspace fails', failureMessages: ['expected'] }],
        runCoverageComparison: {
          runId: 'run-1',
          previousRunId: 'run-0',
          currentExternalKey: 'workspace:github-actions:1001',
          previousExternalKey: 'workspace:github-actions:1000',
          currentVersionKey: 'commit:abc123',
          previousVersionKey: 'commit:zzz999',
          currentLinesPct: 80,
          previousLinesPct: 74,
          deltaLinesPct: 6,
          packageChanges: [{ label: 'workspace', deltaLinesPct: 6 }],
          moduleChanges: [{ label: 'runtime', deltaLinesPct: 6 }],
          fileChanges: [{ label: '/repo/packages/core/src/index.js', filePath: '/repo/packages/core/src/index.js', deltaLinesPct: 6 }],
        },
      },
    },
    {
      data: {
        projects: [],
      },
    },
  ];
  const fetchImpl = async (_url, _options) => new Response(JSON.stringify(responses.shift()), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  const run = await loadRunExplorerPage({ session, runId: 'run-1', fetchImpl });
  assert.equal(run.run.id, 'run-1');
  assert.equal(run.failedTests.length, 1);
  assert.equal(run.runModules[0].module, 'runtime');
  assert.equal(run.coverageComparison.deltaLinesPct, 6);
  assert.equal(run.coverageComparison.fileChanges[0].filePath, '/repo/packages/core/src/index.js');

  const direct = await executeWebGraphql({
    session,
    query: 'query { projects { id } }',
    fetchImpl,
  });
  assert.deepEqual(direct, {
    projects: [],
  });

  assert.equal(formatDuration(1250), '1.3 s');
  assert.equal(formatCoveragePct(80), '80%');
});

test('web can render the runner report template from stored raw report data', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
    projectKeys: ['workspace'],
  };

  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (!request.query.includes('WebRunReport')) {
      throw new Error(`Unexpected report request: ${request.query}`);
    }

    return new Response(JSON.stringify({
      data: {
        run: {
          id: 'run-1',
          externalKey: 'workspace:github-actions:1001',
          project: {
            name: 'Workspace',
          },
          rawReport: createRunnerReportFixture(),
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const html = await loadRunReportHtml({
    session,
    runId: 'run-1',
    fetchImpl,
  });

  assert.match(html, /Group by Module/);
  assert.match(html, /Group by Package/);
  assert.match(html, /Workspace Report - workspace:github-actions:1001/);
  assert.match(html, /<base target="_blank" \/>/);
  assert.match(html, new RegExp(RUNNER_REPORT_HEIGHT_MESSAGE_TYPE));
  assert.match(html, /href="https:\/\/artifacts\.example\.com\/workspace\/unit\.log"/);
});

test('web run template routing defaults to the runner report and keeps the operations view addressable', () => {
  assert.equal(resolveRunTemplateMode(undefined), 'runner');
  assert.equal(resolveRunTemplateMode('runner'), 'runner');
  assert.equal(resolveRunTemplateMode('web'), 'web');
  assert.equal(buildRunTemplateHref('run-1', 'runner'), '/runs/run-1');
  assert.equal(buildRunTemplateHref('run-1', 'web'), '/runs/run-1?template=web');
});

function createRunnerReportFixture() {
  return {
    schemaVersion: '1',
    generatedAt: '2026-03-09T15:00:00.000Z',
    meta: {
      projectName: 'Workspace',
    },
    summary: {
      totalPackages: 1,
      totalModules: 1,
      totalSuites: 1,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      skippedTests: 0,
      coverage: {
        lines: { covered: 8, total: 10, pct: 80 },
        branches: { covered: 3, total: 4, pct: 75 },
        functions: { covered: 2, total: 3, pct: 66.67 },
        statements: { covered: 8, total: 10, pct: 80 },
        files: [],
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
        location: 'packages/workspace',
        status: 'passed',
        durationMs: 3000,
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        coverage: {
          lines: { covered: 8, total: 10, pct: 80 },
          branches: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 2, total: 3, pct: 66.67 },
          statements: { covered: 8, total: 10, pct: 80 },
          files: [],
        },
        modules: ['runtime'],
        frameworks: ['node-test'],
        suites: [
          {
            id: 'workspace-node',
            label: 'Workspace Node Tests',
            runtime: 'node-test',
            command: 'node --test',
            status: 'passed',
            durationMs: 3000,
            summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
            warnings: [],
            rawArtifacts: [
              {
                label: 'Unit log',
                relativePath: 'workspace/unit.log',
                href: 'raw/workspace/unit.log',
                sourceUrl: 'https://artifacts.example.com/workspace/unit.log',
                kind: 'file',
                mediaType: 'text/plain',
              },
            ],
            tests: [
              {
                name: 'passes',
                fullName: 'workspace passes',
                status: 'passed',
                durationMs: 12,
                file: '/repo/packages/core/src/index.js',
                line: 10,
                column: 2,
                assertions: [],
                setup: [],
                mocks: [],
                failureMessages: [],
                rawDetails: {},
                module: 'runtime',
                theme: 'core',
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
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        durationMs: 3000,
        packageCount: 1,
        packages: ['workspace'],
        frameworks: ['node-test'],
        dominantPackages: ['workspace'],
        coverage: {
          lines: { covered: 8, total: 10, pct: 80 },
          branches: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 2, total: 3, pct: 66.67 },
          statements: { covered: 8, total: 10, pct: 80 },
          files: [],
        },
        themes: [],
      },
    ],
  };
}
