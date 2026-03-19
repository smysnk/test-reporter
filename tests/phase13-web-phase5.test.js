import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildWebActorHeaders,
  createAuthOptions,
  resolveAutoSignInProviderId,
  resolveDemoAuthEnabled,
  resolveNextAuthUrl,
} from '../packages/web/lib/auth.js';
import { buildSignedOutRedirectUrl } from '../packages/web/lib/authRoutes.js';
import { ensureNextAuthUrl } from '../packages/web/lib/nextAuthEnv.js';
import {
  formatBenchmarkMetricLabel,
  formatBenchmarkNamespace,
  formatBenchmarkValue,
  formatBuildNumber,
  formatCommitSha,
  formatCoveragePct,
  formatDuration,
  formatRepositoryName,
  formatRunBuildLabel,
} from '../packages/web/lib/format.js';
import {
  beginClientRouteProfile,
  buildServerTimingHeader,
  completeClientRouteProfile,
  createPageLoadProfiler,
  recordClientPageMark,
  recordClientRouteStage,
  setClientServerPageProfile,
} from '../packages/web/lib/pageProfiling.js';
import { buildAdminPageResult, buildOverviewPageResult, buildProjectPageResult, buildRunPageResult } from '../packages/web/lib/pageProps.js';
import { WEB_HOME_QUERY, PROJECT_ACTIVITY_QUERY, PERFORMANCE_TREND_QUERY, RUN_DETAIL_QUERY, RUN_HEADER_QUERY } from '../packages/web/lib/queries.js';
import { resolvePublicRuntimeConfig } from '../packages/web/lib/runtimeConfig.js';
import {
  ADMIN_PAGE_UNAUTHORIZED,
  executeWebGraphql,
  loadAdminOverviewPage,
  loadAdminProjectAccessPage,
  loadWebHomePage,
  loadProjectExplorerPage,
  loadRunExplorerPage,
  loadRunReportHtml,
  resolveWebServerUrl,
} from '../packages/web/lib/serverGraphql.js';
import { buildRunTemplateHref, resolveRunTemplateMode } from '../packages/web/lib/runTemplateRouting.js';
import { buildSignInRedirectUrl, isProtectedWebPath } from '../packages/web/lib/routeProtection.js';
import { RUNNER_REPORT_HEIGHT_MESSAGE_TYPE } from '../packages/web/lib/runReportTemplate.js';
import { decorateEmbeddedRunnerReportHtml } from '../packages/web/lib/runReportTemplate.js';
import { resolveNextAuthHandler } from '../packages/web/pages/api/auth/[...nextauth].js';
import webHealthzHandler from '../packages/web/pages/api/healthz.js';
import { createGraphqlProxyHandler } from '../packages/web/pages/api/graphql-proxy.js';
import { createRunReportHandler } from '../packages/web/pages/api/runs/[id]/report.js';
import { BenchmarkExplorer, RunBenchmarkSummary } from '../packages/web/components/BenchmarkBits.js';
import { RunBuildChip, RunSourceLink } from '../packages/web/components/WebBits.js';
import { buildHomeExplorerModel } from '../packages/web/lib/homeExplorer.js';

test('web auth options expose the sign-in page and session actor metadata', async () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const authOptions = createAuthOptions({
      secret: 'test-secret',
      adminEmails: ['admin@example.com'],
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

    const session = await authOptions.callbacks.session({
      session: { user: {} },
      token,
    });

    assert.equal(session.userId, 'user-1');
    assert.equal(session.role, 'admin');
    assert.equal(session.user.image, null);
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
    assert.equal(resolveAutoSignInProviderId(authOptions.providers, { signedOut: true }), null);
    assert.equal(resolveAutoSignInProviderId(authOptions.providers, { error: 'OAuthSignin' }), null);
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

test('web sign-out redirects to a signed-out sign-in page without auto re-authenticating', () => {
  assert.equal(buildSignedOutRedirectUrl(), '/auth/signin?signedOut=1');
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
  });

  assert.deepEqual(headers, {
    'x-test-station-actor-id': 'user-1',
    'x-test-station-actor-email': 'user@example.com',
    'x-test-station-actor-name': 'Web User',
    'x-test-station-actor-role': 'member',
  });

  assert.equal(isProtectedWebPath('/'), false);
  assert.equal(isProtectedWebPath('/projects/workspace'), false);
  assert.equal(isProtectedWebPath('/runs/run-1'), false);
  assert.equal(isProtectedWebPath('/admin'), true);
  assert.equal(isProtectedWebPath('/admin/access'), true);
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

test('web public runtime config exposes graphql path and analytics measurement id', () => {
  const originalGraphqlPath = process.env.WEB_GRAPHQL_PATH;
  const originalGaMeasurementId = process.env.GA_MEASUREMENT_ID;

  try {
    process.env.WEB_GRAPHQL_PATH = '/runtime-graphql';
    process.env.GA_MEASUREMENT_ID = 'G-TESTSTATION123';

    assert.deepEqual(resolvePublicRuntimeConfig(), {
      graphqlPath: '/runtime-graphql',
      GA_MEASUREMENT_ID: 'G-TESTSTATION123',
    });
  } finally {
    if (originalGraphqlPath === undefined) {
      delete process.env.WEB_GRAPHQL_PATH;
    } else {
      process.env.WEB_GRAPHQL_PATH = originalGraphqlPath;
    }

    if (originalGaMeasurementId === undefined) {
      delete process.env.GA_MEASUREMENT_ID;
    } else {
      process.env.GA_MEASUREMENT_ID = originalGaMeasurementId;
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

test('web health endpoint returns a fast readiness payload', () => {
  const headers = new Map();
  const response = {
    statusCode: null,
    payload: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  webHealthzHandler({}, response);

  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, {
    status: 'ok',
    service: 'test-station-web',
  });
});

test('web GraphQL helpers forward actor headers and combine project activity data', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
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
          viewer: { id: 'user-1', name: 'Web User', email: 'user@example.com', role: 'member' },
          projects: [{ id: 'project-1', key: 'workspace', slug: 'workspace', name: 'Workspace' }],
          runFeed: [{
            id: 'run-1',
            externalKey: 'workspace:github-actions:1001',
            status: 'failed',
            projectId: 'project-1',
            projectKey: 'workspace',
            projectSlug: 'workspace',
            projectName: 'Workspace',
            projectRepositoryUrl: 'https://example.test/workspace',
            versionKey: 'commit:abc123',
            buildNumber: 88,
            linesPct: 80,
            totalTests: 2,
            passedTests: 1,
            failedTests: 1,
            sourceRunId: '1001',
            sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
          }],
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
            sourceRunId: '1001',
            sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
            completedAt: '2026-03-09T15:00:00.000Z',
            durationMs: 3000,
            projectVersion: { versionKey: 'commit:abc123', buildNumber: 88 },
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
          benchmarkCatalog: [{
            projectKey: 'workspace',
            statGroup: 'benchmark.node.engine.nibbles.intro',
            statNames: ['elapsed_ms'],
            units: ['ms'],
            seriesIds: ['interpreter', 'interpreter-redux'],
            runnerKeys: ['gha-ubuntu-latest-node20'],
            latestCompletedAt: '2026-03-09T15:00:00.000Z',
            pointCount: 3,
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

    if (query.includes('WebPerformanceTrend')) {
      return new Response(JSON.stringify({
        data: {
          performanceTrend: [
            {
              id: 'perf-run-1-redux',
              runId: 'run-1',
              suiteRunId: null,
              testExecutionId: null,
              projectId: 'project-1',
              projectKey: 'workspace',
              externalKey: 'workspace:github-actions:1001',
              versionKey: 'commit:abc123',
              completedAt: '2026-03-09T15:00:00.000Z',
              branch: 'release',
              commitSha: 'abc123',
              buildNumber: 88,
              statGroup: 'benchmark.node.engine.nibbles.intro',
              statName: 'elapsed_ms',
              numericValue: 57.54,
              textValue: null,
              unit: 'ms',
              seriesId: 'interpreter-redux',
              runnerKey: 'gha-ubuntu-latest-node20',
              metadata: {},
            },
            {
              id: 'perf-run-1',
              runId: 'run-1',
              suiteRunId: null,
              testExecutionId: null,
              projectId: 'project-1',
              projectKey: 'workspace',
              externalKey: 'workspace:github-actions:1001',
              versionKey: 'commit:abc123',
              completedAt: '2026-03-09T15:00:00.000Z',
              branch: 'release',
              commitSha: 'abc123',
              buildNumber: 88,
              statGroup: 'benchmark.node.engine.nibbles.intro',
              statName: 'elapsed_ms',
              numericValue: 62.4,
              textValue: null,
              unit: 'ms',
              seriesId: 'interpreter',
              runnerKey: 'gha-ubuntu-latest-node20',
              metadata: {},
            },
            {
              id: 'perf-run-0',
              runId: 'run-0',
              suiteRunId: null,
              testExecutionId: null,
              projectId: 'project-1',
              projectKey: 'workspace',
              externalKey: 'workspace:github-actions:1000',
              versionKey: 'commit:zzz999',
              completedAt: '2026-03-08T15:00:00.000Z',
              branch: 'release',
              commitSha: 'zzz999',
              buildNumber: 87,
              statGroup: 'benchmark.node.engine.nibbles.intro',
              statName: 'elapsed_ms',
              numericValue: 74.2,
              textValue: null,
              unit: 'ms',
              seriesId: 'interpreter',
              runnerKey: 'gha-ubuntu-latest-node20',
              metadata: {},
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
  assert.equal(home.viewer.id, 'user-1');
  assert.equal(home.projects.length, 1);
  assert.deepEqual(home.runs[0].summary, { totalTests: 2, passedTests: 1, failedTests: 1 });
  assert.equal(requests[0].headers['x-request-id'], 'req-home');

  const project = await loadProjectExplorerPage({ session, slug: 'workspace', fetchImpl, requestId: 'req-project' });
  assert.equal(project.project.key, 'workspace');
  assert.equal(project.runs.length, 1);
  assert.equal(project.coverageTrend.length, 2);
  assert.equal(project.releaseNotes.length, 1);
  assert.equal(project.benchmarkCatalog.length, 1);
  assert.equal(project.benchmarkPanels.length, 1);
  assert.equal(project.benchmarkPanels[0].statGroup, 'benchmark.node.engine.nibbles.intro');
  assert.equal(project.benchmarkPanels[0].metrics[0].points.length, 3);
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
  assert.equal(requests[7].body.variables.projectKey, 'workspace');
  assert.equal(requests[7].body.variables.statGroup, 'benchmark.node.engine.nibbles.intro');
  assert.equal(requests[7].body.variables.statName, 'elapsed_ms');
});

test('web project loader falls back to the base trend view when scoped trend panels fail', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
  };

  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    const query = request.query;

    if (query.includes('WebProjectBySlug')) {
      return new Response(JSON.stringify({
        data: {
          project: {
            id: 'project-1',
            key: 'workspace',
            slug: 'workspace',
            name: 'Workspace',
            defaultBranch: 'main',
            repositoryUrl: 'https://github.com/example/test-station.git',
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
            status: 'passed',
            completedAt: '2026-03-09T15:00:00.000Z',
            durationMs: 3000,
            projectVersion: { versionKey: 'commit:abc123', buildNumber: 88 },
            coverageSnapshot: { linesPct: 80 },
          }],
          coverageTrend: [{
            runId: 'run-1',
            completedAt: '2026-03-09T15:00:00.000Z',
            recordedAt: '2026-03-09T15:00:00.000Z',
            versionKey: 'commit:abc123',
            linesPct: 80,
          }],
          releaseNotes: [{
            id: 'note-1',
            title: 'Release',
            body: 'details',
            publishedAt: '2026-03-09T16:00:00.000Z',
          }],
          benchmarkCatalog: [{
            projectKey: 'workspace',
            statGroup: 'benchmark.node.engine.nibbles.intro',
            statNames: ['elapsed_ms'],
            units: ['ms'],
            seriesIds: ['interpreter'],
            runnerKeys: ['gha-ubuntu-latest-node20'],
            latestCompletedAt: '2026-03-09T15:00:00.000Z',
            pointCount: 1,
          }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('WebRunScopeTrendCatalog')) {
      throw new Error('catalog timeout');
    }

    throw new Error(`Unexpected web GraphQL request: ${query}`);
  };

  const project = await loadProjectExplorerPage({
    session,
    slug: 'workspace',
    fetchImpl,
    requestId: 'req-project-fallback',
  });

  assert.equal(project.project.key, 'workspace');
  assert.equal(project.coverageTrend.length, 1);
  assert.equal(project.releaseNotes.length, 1);
  assert.equal(project.trendPanels.overall.length, 1);
  assert.equal(project.trendPanels.overlays.length, 2);
  assert.deepEqual(project.benchmarkPanels, []);
  assert.deepEqual(project.trendPanels.packageTrends, []);
  assert.deepEqual(project.trendPanels.moduleTrends, []);
  assert.deepEqual(project.trendPanels.fileTrends, []);
});

test('web GraphQL helpers and proxy allow anonymous public reads without actor headers', async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push({
      headers: options.headers,
      body: JSON.parse(options.body),
    });

    return new Response(JSON.stringify({
      data: {
        viewer: null,
        projects: [{ id: 'project-public', key: 'public-site', slug: 'public-site', name: 'Public Site' }],
        runFeed: [],
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const home = await loadWebHomePage({ session: null, fetchImpl, requestId: 'req-guest' });
  assert.equal(home.viewer, null);
  assert.equal(home.projects[0].key, 'public-site');
  assert.equal(requests[0].headers['x-test-station-actor-id'], undefined);
  assert.equal(requests[0].headers['x-request-id'], 'req-guest');
  assert.equal(requests[0].headers['x-test-station-trace-id'], 'req-guest');

  const responseState = createResponseRecorder();
  const handler = createGraphqlProxyHandler({
    getSession: async () => null,
    fetchImpl: async (_url, options) => {
      requests.push({
        headers: options.headers,
        body: JSON.parse(options.body),
      });

      return new Response(JSON.stringify({
        data: {
          projects: [{ key: 'public-site' }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await handler({
    method: 'POST',
    headers: {
      'x-request-id': 'proxy-guest',
    },
    body: {
      query: '{ projects { key } }',
    },
  }, responseState.res);

  assert.equal(responseState.statusCode, 200);
  assert.deepEqual(JSON.parse(responseState.bodyText), {
    data: {
      projects: [{ key: 'public-site' }],
    },
  });
  assert.equal(responseState.headers['x-request-id'], 'proxy-guest');
  assert.equal(responseState.headers['x-test-station-trace-id'], 'proxy-guest');
  assert.equal(requests[1].headers['x-test-station-actor-id'], undefined);
  assert.match(requests[1].headers['x-request-id'], /^webproxy-/);
  assert.equal(requests[1].headers['x-test-station-trace-id'], 'proxy-guest');
  assert.equal(requests[1].headers['x-test-station-parent-request-id'], 'proxy-guest');
});

test('web SSR page result builders allow guest public pages and return notFound for private resources', async () => {
  const store = createStoreStub();
  const session = null;
  const pageProfile = {
    pageType: 'overview',
    route: '/',
    totalMs: 12.4,
    steps: [{ name: 'home-feed-query', durationMs: 8.7 }],
  };
  const overview = buildOverviewPageResult({
    store,
    session,
    data: {
      viewer: null,
      projects: [{ id: 'project-public', key: 'public-site', slug: 'public-site', name: 'Public Site' }],
      runs: [],
    },
    pageProfile,
  });
  assert.equal(overview.props.session, null);
  assert.equal(overview.props.data.projects[0].key, 'public-site');
  assert.equal(overview.props.pageProfile, pageProfile);

  const projectPage = buildProjectPageResult({
    store,
    session,
    slug: 'public-site',
    data: {
      project: { id: 'project-public', key: 'public-site', slug: 'public-site', name: 'Public Site' },
      runs: [],
      coverageTrend: [],
      releaseNotes: [],
      trendPanels: {},
    },
    pageProfile,
  });
  assert.equal(projectPage.props.session, null);
  assert.equal(projectPage.props.data.project.slug, 'public-site');
  assert.equal(projectPage.props.pageProfile, pageProfile);

  const projectNotFound = buildProjectPageResult({
    store,
    session,
    slug: 'workspace',
    data: null,
  });
  assert.deepEqual(projectNotFound, { notFound: true });

  const runPage = buildRunPageResult({
    store,
    session,
    runId: 'run-public-1',
    templateMode: 'runner',
    data: {
      run: {
        id: 'run-public-1',
        externalKey: 'public-site:github-actions:2001',
        project: { slug: 'public-site' },
      },
      runPackages: [],
      runModules: [],
      runFiles: [],
      failedTests: [],
      coverageComparison: null,
    },
    pageProfile,
  });
  assert.equal(runPage.props.session, null);
  assert.equal(runPage.props.data.run.id, 'run-public-1');
  assert.equal(runPage.props.pageProfile, pageProfile);

  const runNotFound = buildRunPageResult({
    store,
    session,
    runId: 'run-1',
    templateMode: 'runner',
    data: null,
  });
  assert.deepEqual(runNotFound, { notFound: true });
});

test('web page profiling helpers capture server timings and client route milestones', async () => {
  const pageProfiler = createPageLoadProfiler({
    pageType: 'project',
    route: '/projects/public-site',
  });

  await pageProfiler.measureStep('project-base-query', async () => {});
  await pageProfiler.measureStep('project-activity-query', async () => {});
  const pageProfile = pageProfiler.finalize({
    projectSlug: 'public-site',
    runCount: 3,
  });

  assert.equal(pageProfile.pageType, 'project');
  assert.equal(pageProfile.route, '/projects/public-site');
  assert.equal(pageProfile.projectSlug, 'public-site');
  assert.equal(pageProfile.runCount, 3);
  assert.equal(pageProfile.steps.length, 2);

  const serverTimingHeader = buildServerTimingHeader(pageProfile);
  assert.match(serverTimingHeader, /project;dur=/);
  assert.match(serverTimingHeader, /project-base-query;dur=/);

  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      location: {
        pathname: '/projects/public-site',
        search: '',
        hash: '',
      },
      __TEST_STATION_PERF__: {
        lcp: null,
        cls: 0,
        longTaskCount: 0,
        longTaskDurationMs: 0,
      },
    };

    setClientServerPageProfile(pageProfile);
    beginClientRouteProfile('/runs/run-1', { sourceRoute: '/projects/public-site' });
    recordClientRouteStage('routeChangeStart', { url: '/runs/run-1' });
    recordClientPageMark('project-page-ready', { projectSlug: 'public-site' });
    const completedRoute = completeClientRouteProfile('/runs/run-1');

    assert.equal(globalThis.window.__TEST_STATION_PERF__.serverPageProfile.pageType, 'project');
    assert.equal(globalThis.window.__TEST_STATION_PERF__.pageMarks[0].name, 'project-page-ready');
    assert.equal(completedRoute.to, '/runs/run-1');
    assert.equal(completedRoute.status, 'completed');
    assert.equal(completedRoute.marks[0].name, 'routeChangeStart');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('web admin loaders short-circuit for authenticated non-admin viewers', async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);

    return new Response(JSON.stringify({
      data: {
        viewer: {
          id: 'viewer-1',
          userId: 'user-1',
          email: 'member@example.com',
          name: 'Member User',
          role: 'member',
          isAdmin: false,
          isGuest: false,
          roleKeys: [],
          groupKeys: [],
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const data = await loadAdminOverviewPage({
    session: {
      userId: 'user-1',
      user: {
        email: 'member@example.com',
      },
      role: 'member',
    },
    fetchImpl,
    requestId: 'admin-member',
  });

  assert.equal(data, ADMIN_PAGE_UNAUTHORIZED);
  assert.equal(requests.length, 1);
  assert.match(requests[0].query, /WebViewerAccess/);
});

test('web admin loaders normalize overview and project access data for admin pages', async () => {
  const requests = [];
  const session = {
    userId: 'admin-1',
    user: {
      email: 'admin@example.com',
      name: 'Admin User',
    },
    role: 'admin',
  };
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const query = body.query || '';

    if (query.includes('WebViewerAccess')) {
      return new Response(JSON.stringify({
        data: {
          viewer: {
            id: 'viewer-1',
            userId: 'admin-1',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
            isAdmin: true,
            isGuest: false,
            roleKeys: ['platform'],
            groupKeys: ['staff'],
          },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('AdminOverviewPage')) {
      return new Response(JSON.stringify({
        data: {
          viewer: {
            id: 'viewer-1',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
            isAdmin: true,
          },
          adminUsers: [{
            id: 'user-1',
            email: 'member@example.com',
            name: 'Member User',
            isAdmin: false,
            roleKeys: ['platform'],
            groupKeys: [],
          }],
          adminRoles: [{
            id: 'role-1',
            key: 'platform',
            name: 'Platform',
            description: 'Platform team',
            userCount: 1,
            projectCount: 1,
          }],
          adminGroups: [{
            id: 'group-1',
            key: 'staff',
            name: 'Staff',
            description: 'Internal team',
            userCount: 1,
            projectCount: 1,
          }],
          adminProjects: [{
            project: {
              id: 'project-1',
              key: 'workspace',
              slug: 'workspace',
              name: 'Workspace',
              repositoryUrl: 'https://example.test/workspace',
              defaultBranch: 'main',
            },
            isPublic: false,
            roleKeys: ['platform'],
            groupKeys: ['staff'],
          }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (query.includes('AdminProjectAccessPage')) {
      return new Response(JSON.stringify({
        data: {
          viewer: {
            id: 'viewer-1',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
            isAdmin: true,
          },
          adminProjectAccess: {
            project: {
              id: 'project-1',
              key: 'workspace',
              slug: 'workspace',
              name: 'Workspace',
              repositoryUrl: 'https://example.test/workspace',
              defaultBranch: 'main',
            },
            isPublic: false,
            roleKeys: ['platform'],
            groupKeys: ['staff'],
            roles: [{
              id: 'role-1',
              key: 'platform',
              name: 'Platform',
              description: 'Platform team',
              userCount: 1,
              projectCount: 1,
            }],
            groups: [{
              id: 'group-1',
              key: 'staff',
              name: 'Staff',
              description: 'Internal team',
              userCount: 1,
              projectCount: 1,
            }],
          },
          adminRoles: [{
            id: 'role-1',
            key: 'platform',
            name: 'Platform',
            description: 'Platform team',
            userCount: 1,
            projectCount: 1,
          }],
          adminGroups: [{
            id: 'group-1',
            key: 'staff',
            name: 'Staff',
            description: 'Internal team',
            userCount: 1,
            projectCount: 1,
          }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected admin GraphQL request: ${query}`);
  };

  const overview = await loadAdminOverviewPage({ session, fetchImpl, requestId: 'admin-overview' });
  assert.equal(overview.viewer.isAdmin, true);
  assert.equal(overview.users.length, 1);
  assert.equal(overview.projects[0].project.slug, 'workspace');

  const projectAccess = await loadAdminProjectAccessPage({
    session,
    slug: 'workspace',
    fetchImpl,
    requestId: 'admin-project',
  });
  assert.equal(projectAccess.projectAccess.project.slug, 'workspace');
  assert.equal(projectAccess.projectAccess.roles.length, 1);
  assert.equal(projectAccess.roles.length, 1);
  assert.equal(projectAccess.groups.length, 1);
  assert.match(requests[0].query, /WebViewerAccess/);
  assert.match(requests[1].query, /AdminOverviewPage/);
  assert.match(requests[2].query, /WebViewerAccess/);
  assert.match(requests[3].query, /AdminProjectAccessPage/);
  assert.deepEqual(requests[3].variables, { slug: 'workspace' });
});

test('web admin page result builder dispatches admin state and selected project context', () => {
  const originalGraphqlPath = process.env.WEB_GRAPHQL_PATH;
  const originalGaMeasurementId = process.env.GA_MEASUREMENT_ID;
  const actions = [];
  const store = {
    dispatch(action) {
      actions.push(action);
    },
  };

  try {
    process.env.WEB_GRAPHQL_PATH = '/runtime-graphql';
    process.env.GA_MEASUREMENT_ID = 'G-TESTSTATION123';

    const result = buildAdminPageResult({
      store,
      session: { userId: 'admin-1' },
      selectedProjectSlug: 'workspace',
      data: {
        viewer: {
          isAdmin: true,
        },
        projects: [],
      },
      dispatchers: {
        setViewMode: (value) => ({ type: 'view', payload: value }),
        setRuntimeConfig: (value) => ({ type: 'runtime', payload: value }),
        setSelectedProjectSlug: (value) => ({ type: 'project', payload: value }),
        setSelectedRunId: (value) => ({ type: 'run', payload: value }),
      },
    });

    assert.equal(result.props.session.userId, 'admin-1');
    assert.equal(result.props.data.viewer.isAdmin, true);
    assert.deepEqual(actions, [
      { type: 'view', payload: 'admin' },
      { type: 'runtime', payload: { graphqlPath: '/runtime-graphql', GA_MEASUREMENT_ID: 'G-TESTSTATION123' } },
      { type: 'project', payload: 'workspace' },
      { type: 'run', payload: null },
    ]);

    assert.deepEqual(buildAdminPageResult({
      store,
      session: null,
      data: null,
    }), { notFound: true });
  } finally {
    if (originalGraphqlPath === undefined) {
      delete process.env.WEB_GRAPHQL_PATH;
    } else {
      process.env.WEB_GRAPHQL_PATH = originalGraphqlPath;
    }

    if (originalGaMeasurementId === undefined) {
      delete process.env.GA_MEASUREMENT_ID;
    } else {
      process.env.GA_MEASUREMENT_ID = originalGaMeasurementId;
    }
  }
});

test('web runner report handler allows anonymous public report rendering', async () => {
  const responseState = createResponseRecorder();
  const handler = createRunReportHandler({
    getSession: async () => null,
    loadReportHtml: async ({ session, runId, requestId }) => {
      assert.equal(session, null);
      assert.equal(runId, 'run-public-1');
      assert.equal(requestId, 'runner-guest');
      return '<!DOCTYPE html><html><body><main>public report</main></body></html>';
    },
  });

  await handler({
    method: 'GET',
    query: {
      id: 'run-public-1',
    },
    headers: {
      'x-request-id': 'runner-guest',
    },
  }, responseState.res);

  assert.equal(responseState.statusCode, 200);
  assert.equal(responseState.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(responseState.headers['x-request-id'], 'runner-guest');
  assert.equal(responseState.headers['x-test-station-trace-id'], 'runner-guest');
  assert.match(responseState.bodyText, /public report/);
});

test('web run loader and raw GraphQL executor preserve response structure', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
  };
  const responses = [
    {
      data: {
        run: {
          id: 'run-1',
          externalKey: 'workspace:github-actions:1001',
          sourceRunId: '1001',
          sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
          project: { slug: 'workspace', name: 'Workspace' },
          projectVersion: { versionKey: 'commit:abc123', buildNumber: 88 },
          coverageSnapshot: { linesPct: 80 },
        },
      },
    },
    {
      data: {
        run: {
          id: 'run-1',
          externalKey: 'workspace:github-actions:1001',
          sourceRunId: '1001',
          sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
          project: { slug: 'workspace', name: 'Workspace' },
          projectVersion: { versionKey: 'commit:abc123', buildNumber: 88 },
          artifacts: [],
          suites: [],
          coverageSnapshot: { linesPct: 80 },
        },
        runPackages: [{ name: 'workspace' }],
        runModules: [{ module: 'runtime' }],
        runFiles: [{ path: '/repo/packages/core/src/index.js' }],
        tests: [{ id: 'test-1', fullName: 'workspace fails', failureMessages: ['expected'] }],
        runPerformanceStats: [{
          id: 'perf-run-1-redux',
          runId: 'run-1',
          suiteRunId: null,
          testExecutionId: null,
          projectId: 'project-1',
          projectKey: 'workspace',
          externalKey: 'workspace:github-actions:1001',
          versionKey: 'commit:abc123',
          completedAt: '2026-03-09T15:00:00.000Z',
          branch: 'release',
          commitSha: 'abc123',
          buildNumber: 88,
          statGroup: 'benchmark.node.engine.nibbles.intro',
          statName: 'elapsed_ms',
          numericValue: 57.54,
          textValue: null,
          unit: 'ms',
          seriesId: 'interpreter-redux',
          runnerKey: 'gha-ubuntu-latest-node20',
          metadata: {},
        }],
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
  const graphqlQueries = [];
  const fetchImpl = async (_url, options) => {
    graphqlQueries.push(JSON.parse(options.body).query);
    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const runnerView = await loadRunExplorerPage({
    session,
    runId: 'run-1',
    templateMode: 'runner',
    fetchImpl,
  });
  assert.equal(runnerView.run.id, 'run-1');
  assert.deepEqual(runnerView.failedTests, []);
  assert.deepEqual(runnerView.runModules, []);
  assert.equal(runnerView.coverageComparison, null);

  const operationsView = await loadRunExplorerPage({
    session,
    runId: 'run-1',
    templateMode: 'web',
    fetchImpl,
  });
  assert.equal(operationsView.run.id, 'run-1');
  assert.equal(operationsView.failedTests.length, 1);
  assert.equal(operationsView.runModules[0].module, 'runtime');
  assert.equal(operationsView.runPerformanceStats.length, 1);
  assert.equal(operationsView.runPerformanceStats[0].statGroup, 'benchmark.node.engine.nibbles.intro');
  assert.equal(operationsView.coverageComparison.deltaLinesPct, 6);
  assert.equal(operationsView.coverageComparison.fileChanges[0].filePath, '/repo/packages/core/src/index.js');

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
  assert.equal(formatBuildNumber(88), 'build #88');
  assert.equal(formatCommitSha('abcdef1234567890'), 'abcdef1');
  assert.equal(formatRepositoryName('https://github.com/smysnk/test-station.git'), 'smysnk/test-station');
  assert.equal(formatRunBuildLabel({ projectVersion: { buildNumber: 88 } }), 'build #88');
  assert.equal(formatRunBuildLabel({ sourceRunId: '1001' }), 'run 1001');
  assert.equal(formatBenchmarkValue(57.54, 'ms'), '57.5 ms');
  assert.equal(formatBenchmarkValue(2048, 'bytes'), '2 KiB');
  assert.equal(formatBenchmarkMetricLabel('steps_per_second'), 'Steps Per Second');
  assert.equal(formatBenchmarkNamespace('benchmark.node.engine.nibbles.intro'), 'Node / Engine / Nibbles / Intro');
  assert.equal(graphqlQueries.some((query) => query.includes('query WebRunHeader')), true);
  assert.equal(graphqlQueries.some((query) => query.includes('query WebRunHeader') && query.includes('runPackages(runId: $runId)')), false);
  assert.equal(graphqlQueries.some((query) => query.includes('query WebRunDetail') && query.includes('runPackages(runId: $runId)')), true);
  assert.equal(graphqlQueries.some((query) => query.includes('query WebRunDetail') && query.includes('runPerformanceStats(runId: $runId)')), true);
});

test('web run build chip and GraphQL queries include build metadata and source links', () => {
  const html = renderToStaticMarkup(React.createElement(RunBuildChip, {
    run: {
      sourceRunId: '1001',
      sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
      projectVersion: {
        buildNumber: 88,
      },
    },
  }));

  assert.match(html, /build #88/);
  assert.match(html, /https:\/\/github\.com\/example\/test-station\/actions\/runs\/1001/);
  assert.match(WEB_HOME_QUERY, /viewer/);
  assert.match(WEB_HOME_QUERY, /runFeed\(limit:\s*24\)/);
  assert.match(WEB_HOME_QUERY, /sourceRunId/);
  assert.match(WEB_HOME_QUERY, /sourceUrl/);
  assert.match(WEB_HOME_QUERY, /buildNumber/);
  assert.match(PROJECT_ACTIVITY_QUERY, /sourceRunId/);
  assert.match(PROJECT_ACTIVITY_QUERY, /sourceUrl/);
  assert.match(PROJECT_ACTIVITY_QUERY, /buildNumber/);
  assert.match(PROJECT_ACTIVITY_QUERY, /benchmarkCatalog\(projectKey: \$projectKey\)/);
  assert.match(PERFORMANCE_TREND_QUERY, /performanceTrend\(projectKey: \$projectKey, statGroup: \$statGroup, statName: \$statName, limit: \$limit\)/);
  assert.match(RUN_HEADER_QUERY, /sourceRunId/);
  assert.match(RUN_HEADER_QUERY, /sourceUrl/);
  assert.match(RUN_HEADER_QUERY, /buildNumber/);
  assert.match(RUN_DETAIL_QUERY, /sourceRunId/);
  assert.match(RUN_DETAIL_QUERY, /sourceUrl/);
  assert.match(RUN_DETAIL_QUERY, /buildNumber/);
  assert.match(RUN_DETAIL_QUERY, /runPerformanceStats\(runId: \$runId\)/);
});

test('run source link renders a direct action back to the GitHub Actions run', () => {
  const html = renderToStaticMarkup(React.createElement(RunSourceLink, {
    run: {
      sourceUrl: 'https://github.com/example/test-station/actions/runs/1001',
    },
  }));

  assert.match(html, /Open GitHub Actions run/);
  assert.match(html, /https:\/\/github\.com\/example\/test-station\/actions\/runs\/1001/);
  assert.match(html, /web-button/);
});

test('benchmark explorer renders namespace controls, series toggles, and chart content', () => {
  const html = renderToStaticMarkup(React.createElement(BenchmarkExplorer, {
    benchmarkPanels: [{
      projectKey: 'workspace',
      statGroup: 'benchmark.node.engine.nibbles.intro',
      statNames: ['elapsed_ms'],
      units: ['ms'],
      seriesIds: ['interpreter', 'interpreter-redux'],
      runnerKeys: ['gha-ubuntu-latest-node20'],
      latestCompletedAt: '2026-03-09T15:00:00.000Z',
      pointCount: 3,
      metrics: [{
        statName: 'elapsed_ms',
        unit: 'ms',
        points: [
          {
            id: 'perf-run-0',
            runId: 'run-0',
            completedAt: '2026-03-08T15:00:00.000Z',
            branch: 'release',
            commitSha: 'zzz999',
            numericValue: 74.2,
            unit: 'ms',
            seriesId: 'interpreter',
            runnerKey: 'gha-ubuntu-latest-node20',
          },
          {
            id: 'perf-run-1',
            runId: 'run-1',
            completedAt: '2026-03-09T15:00:00.000Z',
            branch: 'release',
            commitSha: 'abc123',
            numericValue: 62.4,
            unit: 'ms',
            seriesId: 'interpreter',
            runnerKey: 'gha-ubuntu-latest-node20',
          },
          {
            id: 'perf-run-1-redux',
            runId: 'run-1',
            completedAt: '2026-03-09T15:00:00.000Z',
            branch: 'release',
            commitSha: 'abc123',
            numericValue: 57.54,
            unit: 'ms',
            seriesId: 'interpreter-redux',
            runnerKey: 'gha-ubuntu-latest-node20',
          },
        ],
      }],
    }],
  }));

  assert.match(html, /Namespace/);
  assert.match(html, /Metric/);
  assert.match(html, /interpreter-redux/);
  assert.match(html, /Node \/ Engine \/ Nibbles \/ Intro/);
  assert.match(html, /Elapsed Ms/);
  assert.match(html, /svg/);
});

test('run benchmark summary groups benchmark rows by namespace', () => {
  const html = renderToStaticMarkup(React.createElement(RunBenchmarkSummary, {
    stats: [
      {
        id: 'perf-run-1-redux',
        statGroup: 'benchmark.node.engine.nibbles.intro',
        statName: 'elapsed_ms',
        numericValue: 57.54,
        unit: 'ms',
        seriesId: 'interpreter-redux',
        runnerKey: 'gha-ubuntu-latest-node20',
        completedAt: '2026-03-09T15:00:00.000Z',
        branch: 'release',
        commitSha: 'abc123',
        suiteRunId: null,
        testExecutionId: null,
      },
      {
        id: 'perf-suite-1',
        statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
        statName: 'steps_per_second',
        numericValue: 404.55,
        unit: 'ops_per_sec',
        seriesId: 'interpreter-redux',
        runnerKey: 'gha-ubuntu-latest-node20',
        completedAt: '2026-03-09T15:00:00.000Z',
        branch: 'release',
        commitSha: 'abc123',
        suiteRunId: 'suite-1',
        testExecutionId: null,
      },
    ],
  }));

  assert.match(html, /Node \/ Engine \/ Nibbles \/ Intro/);
  assert.match(html, /Shared \/ Tight Arithmetic Loop/);
  assert.match(html, /57.5 ms/);
  assert.match(html, /404.6 ops\/s/);
  assert.match(html, /suite scope/);
});

test('web home explorer model sorts sidebar projects by activity and filters the selected project feed', () => {
  const projects = [
    {
      id: 'project-a',
      key: 'alpha',
      slug: 'alpha',
      name: 'Alpha',
      repositoryUrl: 'https://github.com/example/alpha.git',
    },
    {
      id: 'project-b',
      key: 'beta',
      slug: 'beta',
      name: 'Beta',
      repositoryUrl: 'https://github.com/example/beta.git',
    },
    {
      id: 'project-c',
      key: 'charlie',
      slug: 'charlie',
      name: 'Charlie',
      repositoryUrl: 'https://github.com/example/charlie.git',
    },
  ];
  const runs = [
    {
      id: 'run-beta-1',
      project: { slug: 'beta' },
      completedAt: '2026-03-15T10:00:00.000Z',
      coverageSnapshot: { linesPct: 91.2 },
    },
    {
      id: 'run-alpha-1',
      project: { slug: 'alpha' },
      completedAt: '2026-03-14T10:00:00.000Z',
      coverageSnapshot: { linesPct: 88.4 },
    },
  ];

  const selected = buildHomeExplorerModel({
    projects,
    runs,
    selectedProjectSlug: 'beta',
  });

  assert.equal(selected.selectedProject.slug, 'beta');
  assert.deepEqual(selected.visibleRuns.map((run) => run.id), ['run-beta-1']);
  assert.deepEqual(selected.projects.map((project) => project.slug), ['beta', 'alpha', 'charlie']);
  assert.equal(selected.projects[0].recentRunCount, 1);
  assert.equal(selected.projects[2].latestRun, null);
  assert.equal(selected.latestCoverage, 91.2);

  const allRuns = buildHomeExplorerModel({
    projects,
    runs,
    selectedProjectSlug: 'missing-project',
  });

  assert.equal(allRuns.selectedProject, null);
  assert.deepEqual(allRuns.visibleRuns.map((run) => run.id), ['run-beta-1', 'run-alpha-1']);
});

test('web can render the runner report template from stored raw report data', async () => {
  const session = {
    userId: 'user-1',
    user: {
      email: 'user@example.com',
      name: 'Web User',
    },
    role: 'member',
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

test('web runner report embed script measures the report content instead of the full iframe viewport', () => {
  const html = decorateEmbeddedRunnerReportHtml('<!DOCTYPE html><html><head></head><body><main>report</main></body></html>');

  assert.match(html, /document\.querySelector\('main'\)/);
  assert.match(html, /content\?\.scrollHeight/);
  assert.doesNotMatch(html, /body\?\.scrollHeight/);
});

test('web focused run view avoids nested scroll containers around the report', () => {
  const appStylesSource = fs.readFileSync(new URL('../packages/web/pages/_app.js', import.meta.url), 'utf8');
  const runPageSource = fs.readFileSync(new URL('../packages/web/pages/runs/[id].js', import.meta.url), 'utf8');

  assert.match(appStylesSource, /\.web-table-wrap\s*\{[\s\S]*overflow:\s*visible;/);
  assert.doesNotMatch(appStylesSource, /\.web-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;/);
  assert.match(runPageSource, /scrolling:\s*'no'/);
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

function createStoreStub() {
  return {
    dispatch() {},
  };
}

function createResponseRecorder() {
  const state = {
    statusCode: 200,
    headers: {},
    bodyText: '',
  };

  return {
    ...state,
    res: {
      setHeader(name, value) {
        state.headers[String(name).toLowerCase()] = value;
      },
      status(code) {
        state.statusCode = code;
        return this;
      },
      json(payload) {
        state.bodyText = JSON.stringify(payload);
        return this;
      },
      send(payload) {
        state.bodyText = typeof payload === 'string' ? payload : String(payload);
        return this;
      },
      end(payload = '') {
        state.bodyText = typeof payload === 'string' ? payload : String(payload);
        return this;
      },
    },
    get statusCode() {
      return state.statusCode;
    },
    get headers() {
      return state.headers;
    },
    get bodyText() {
      return state.bodyText;
    },
  };
}
