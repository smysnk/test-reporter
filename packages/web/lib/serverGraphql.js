import { buildWebActorHeaders } from './auth.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildTraceHeaders,
  createStandaloneWebTrace,
  createWebChildTrace,
  extractTraceResponseMeta,
} from './requestTrace.js';
import {
  ADMIN_GROUPS_QUERY,
  ADMIN_OVERVIEW_QUERY,
  ADMIN_PROJECT_ACCESS_QUERY,
  ADMIN_PROJECTS_QUERY,
  ADMIN_ROLES_QUERY,
  ADMIN_USERS_QUERY,
  BADGE_SUMMARY_QUERY,
  PERFORMANCE_TREND_QUERY,
  PERFORMANCE_TRENDS_QUERY,
  WEB_HOME_QUERY,
  WEB_RUN_FEED_PAGE_QUERY,
  PROJECT_ACTIVITY_QUERY,
  PROJECT_BY_SLUG_QUERY,
  RUN_PROJECT_HISTORY_QUERY,
  RUN_HEADER_QUERY,
  RUN_SCOPE_TREND_CATALOG_QUERY,
  RUN_DETAIL_QUERY,
  RUN_REPORT_QUERY,
  SCOPED_COVERAGE_TREND_QUERY,
  SUITE_TESTS_QUERY,
  VIEWER_ACCESS_QUERY,
} from './queries.js';
import {
  decorateEmbeddedRunnerReportHtml,
  prepareEmbeddedRunnerReport,
} from './runReportTemplate.js';

export const ADMIN_PAGE_UNAUTHORIZED = Symbol('test-station.admin-page-unauthorized');
const INITIAL_HOME_RUN_LIMIT = 20;
const renderedReportCache = new Map();
const renderedReportCacheDirectory = path.join(os.tmpdir(), 'test-station-rendered-reports');

async function measureProfileStep(profiler, name, fn, details = null) {
  if (!profiler || typeof profiler.measureStep !== 'function') {
    return fn();
  }

  return profiler.measureStep(name, fn, details);
}

function resolveDownstreamTrace({ requestTrace = null, requestId = null, requestIdPrefix = 'webgql' } = {}) {
  if (requestTrace) {
    return createWebChildTrace(requestTrace, requestIdPrefix);
  }

  if (requestId) {
    return createStandaloneWebTrace(requestId, requestIdPrefix);
  }

  return createStandaloneWebTrace(null, requestIdPrefix);
}

async function executeWebGraphqlRequest({
  session,
  query,
  variables = {},
  fetchImpl = fetch,
  requestId = null,
  requestTrace = null,
}) {
  const downstreamTrace = resolveDownstreamTrace({
    requestTrace,
    requestId,
    requestIdPrefix: 'webgql',
  });
  const response = await fetchImpl(resolveWebGraphqlUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildTraceHeaders(downstreamTrace),
      ...buildWebActorHeaders(session),
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const payload = await response.json();
  const meta = {
    requestTrace: downstreamTrace,
    responseTrace: extractTraceResponseMeta(response.headers),
    responseProfile: payload?.extensions?.testStationTrace || null,
  };

  if (!response.ok || Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = Array.isArray(payload.errors) && payload.errors.length > 0
      ? payload.errors[0].message
      : `GraphQL request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    error.trace = meta;
    throw error;
  }

  return {
    data: payload.data || {},
    meta,
  };
}

function normalizeEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveDefaultServerUrl() {
  const configuredPort = Number.parseInt(normalizeEnvValue(process.env.SERVER_PORT), 10);
  const serverPort = Number.isInteger(configuredPort) && configuredPort >= 1 && configuredPort <= 65535
    ? configuredPort
    : 4400;
  return `http://localhost:${serverPort}`;
}

export function resolveWebServerUrl() {
  const configuredServerUrl = normalizeEnvValue(process.env.SERVER_URL);
  return configuredServerUrl || resolveDefaultServerUrl();
}

export function resolveWebGraphqlUrl() {
  return `${resolveWebServerUrl().replace(/\/$/, '')}/graphql`;
}

export async function executeWebGraphql({ session, query, variables = {}, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const result = await executeWebGraphqlRequest({
    session,
    query,
    variables,
    fetchImpl,
    requestId,
    requestTrace,
  });
  return result.data;
}

export async function loadWebHomePage({ session, fetchImpl = fetch, requestId = null, requestTrace = null, profiler = null }) {
  const result = await measureProfileStep(profiler, 'home-feed-query', () => executeWebGraphqlRequest({
    session,
    query: WEB_HOME_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  }), (response) => ({
    query: 'WEB_HOME_QUERY',
    ...response?.meta,
  }));
  const data = result.data;

  return {
    viewer: data.viewer || data.me || null,
    projects: Array.isArray(data.projects) ? data.projects : [],
    runs: Array.isArray(data.runFeed)
      ? data.runFeed.slice(0, INITIAL_HOME_RUN_LIMIT).map(normalizeRunFeedEntry)
      : [],
    hasMoreRuns: Array.isArray(data.runFeed) && data.runFeed.length > INITIAL_HOME_RUN_LIMIT,
  };
}

export async function loadWebRunFeedPage({ session, after = null, projectKey = null, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const result = await executeWebGraphqlRequest({
    session,
    query: WEB_RUN_FEED_PAGE_QUERY,
    variables: { after, projectKey },
    fetchImpl,
    requestId,
    requestTrace,
  });
  const entries = Array.isArray(result.data.runFeed) ? result.data.runFeed : [];
  return {
    runs: entries.slice(0, 30).map(normalizeRunFeedEntry),
    hasMoreRuns: entries.length > 30,
  };
}

function normalizeRunFeedEntry(entry) {
  return {
        id: entry.id,
        externalKey: entry.externalKey,
        status: entry.status,
        branch: entry.branch,
        commitSha: entry.commitSha,
        sourceRunId: entry.sourceRunId,
        sourceUrl: entry.sourceUrl,
        completedAt: entry.completedAt,
        durationMs: entry.durationMs,
        cursor: entry.cursor || null,
        projectId: entry.projectId,
        project: {
          key: entry.projectKey,
          slug: entry.projectSlug,
          name: entry.projectName,
          repositoryUrl: entry.projectRepositoryUrl,
        },
        projectVersion: entry.versionKey || Number.isFinite(entry.buildNumber)
          ? {
            versionKey: entry.versionKey,
            buildNumber: entry.buildNumber,
          }
          : null,
        summary: Number.isFinite(entry.totalTests) || Number.isFinite(entry.passedTests) || Number.isFinite(entry.failedTests)
          ? {
            totalTests: entry.totalTests,
            passedTests: entry.passedTests,
            failedTests: entry.failedTests,
          }
          : null,
        coverageSnapshot: Number.isFinite(entry.linesPct)
          ? { linesPct: entry.linesPct }
          : null,
  };
}

export async function loadProjectBadgeSummary({
  session = null,
  projectKey = 'test-station',
  fetchImpl = fetch,
  requestId = null,
  requestTrace = null,
}) {
  const data = await executeWebGraphql({
    session,
    query: BADGE_SUMMARY_QUERY,
    variables: {
      projectKey,
    },
    fetchImpl,
    requestId,
    requestTrace,
  });

  return {
    totalTests: Number.isFinite(data.badgeSummary?.totalTests) ? data.badgeSummary.totalTests : 0,
    passedTests: Number.isFinite(data.badgeSummary?.passedTests) ? data.badgeSummary.passedTests : 0,
    failedTests: Number.isFinite(data.badgeSummary?.failedTests) ? data.badgeSummary.failedTests : 0,
    skippedTests: Number.isFinite(data.badgeSummary?.skippedTests) ? data.badgeSummary.skippedTests : 0,
    coverage: {
      lines: {
        pct: Number.isFinite(data.badgeSummary?.linesPct)
          ? data.badgeSummary.linesPct
          : null,
      },
    },
  };
}

export async function loadProjectExplorerPage({ session, slug, fetchImpl = fetch, requestId = null, requestTrace = null, profiler = null }) {
  const baseResult = await measureProfileStep(profiler, 'project-base-query', () => executeWebGraphqlRequest({
    session,
    query: PROJECT_BY_SLUG_QUERY,
    variables: { slug },
    fetchImpl,
    requestId,
    requestTrace,
  }), (response) => ({
    query: 'PROJECT_BY_SLUG_QUERY',
    slug,
    ...response?.meta,
  }));
  const base = baseResult.data;

  if (!base.project) {
    return null;
  }

  return {
    project: base.project,
    runs: [],
    coverageTrend: [],
    releaseNotes: [],
    benchmarkCatalog: [],
    benchmarkSummary: null,
    benchmarkPanels: [],
    trendPanels: {},
  };
}

export async function loadProjectActivity({ session, projectKey, includeBenchmarks = false, fetchImpl = fetch, requestId = null, requestTrace = null, profiler = null }) {
  const activityResult = await measureProfileStep(profiler, 'project-activity-query', () => executeWebGraphqlRequest({
    session,
    query: PROJECT_ACTIVITY_QUERY,
    variables: { projectKey },
    fetchImpl,
    requestId,
    requestTrace,
  }), (response) => ({
    query: 'PROJECT_ACTIVITY_QUERY',
    projectKey,
    ...response?.meta,
  }));
  const activity = activityResult.data;
  const overallTrend = Array.isArray(activity.coverageTrend) ? activity.coverageTrend : [];
  const releaseNotes = Array.isArray(activity.releaseNotes) ? activity.releaseNotes : [];
  const benchmarkCatalog = Array.isArray(activity.benchmarkCatalog) ? activity.benchmarkCatalog : [];
  const benchmarkSummary = activity.benchmarkSummary && typeof activity.benchmarkSummary === 'object'
    ? activity.benchmarkSummary
    : null;
  let trendPanels = {
    overall: overallTrend,
    overlays: buildTrendOverlays(overallTrend, releaseNotes),
    packageTrends: [],
    moduleTrends: [],
    fileTrends: [],
  };
  let benchmarkPanels = [];

  if (includeBenchmarks) {
    try {
      trendPanels = await measureProfileStep(profiler, 'project-trend-panels', () => loadProjectTrendPanels({
        session,
        projectKey,
        latestRunId: Array.isArray(activity.runs) && activity.runs[0] ? activity.runs[0].id : null,
        overallTrend,
        releaseNotes,
        fetchImpl,
        requestId,
        requestTrace,
        profiler,
      }), {
        latestRunId: Array.isArray(activity.runs) && activity.runs[0] ? activity.runs[0].id : null,
      });
    } catch {
      // Keep the bounded overall trend when optional scoped analysis fails.
    }

    try {
      benchmarkPanels = await measureProfileStep(profiler, 'project-benchmark-panels', () => loadProjectBenchmarkPanels({
        session,
        projectKey,
        benchmarkCatalog,
        fetchImpl,
        requestId,
        requestTrace,
      }), {
        namespaceCount: benchmarkCatalog.length,
      });
    } catch {
      // Namespace panels retain independent loading and retry states.
    }
  }

  return {
    runs: Array.isArray(activity.runs) ? activity.runs : [],
    coverageTrend: overallTrend,
    releaseNotes,
    benchmarkCatalog,
    benchmarkSummary,
    benchmarkPanels,
    trendPanels,
  };
}

export async function loadProjectBenchmarkNamespace({ session, projectKey, statGroup, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const activityResult = await executeWebGraphqlRequest({ session, query: PROJECT_ACTIVITY_QUERY, variables: { projectKey }, fetchImpl, requestId, requestTrace });
  const catalog = normalizeBenchmarkCatalogEntries(activityResult.data.benchmarkCatalog || []);
  const selected = catalog.find((entry) => entry.statGroup === statGroup);
  if (!selected) {
    const error = new Error('Benchmark namespace not found');
    error.statusCode = 404;
    error.publicMessage = 'Benchmark namespace not found.';
    throw error;
  }
  return {
    benchmarkPanels: await loadProjectBenchmarkPanels({ session, projectKey, benchmarkCatalog: [selected], fetchImpl, requestId, requestTrace }),
  };
}

export async function loadRunExplorerPage({
  session,
  runId,
  templateMode = 'runner',
  fetchImpl = fetch,
  requestId = null,
  requestTrace = null,
  profiler = null,
}) {
  const result = await measureProfileStep(profiler, 'run-header-query', () => executeWebGraphqlRequest({
    session,
    query: RUN_HEADER_QUERY,
    variables: { runId },
    fetchImpl,
    requestId,
    requestTrace,
  }), (response) => ({
    query: 'RUN_HEADER_QUERY',
    runId,
    templateMode,
    ...response?.meta,
  }));
  const data = result.data;

  if (!data.run) {
    return null;
  }

  return {
    run: data.run,
    coverageTrend: [],
    coverageTrendOverlays: [],
    benchmarkPanels: [],
    runPackages: [],
    runModules: [],
    runFiles: [],
    failedTests: [],
    runPerformanceStats: [],
    coverageComparison: null,
  };
}

export async function loadRunInsights({ session, runId, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const headerResult = await executeWebGraphqlRequest({
    session,
    query: RUN_HEADER_QUERY,
    variables: { runId },
    fetchImpl,
    requestId,
    requestTrace,
  });
  const projectKey = headerResult.data.run?.project?.key || null;
  if (!projectKey) {
    const error = new Error('Run not found');
    error.statusCode = 404;
    error.publicMessage = 'Run not found.';
    throw error;
  }
  const historyResult = await executeWebGraphqlRequest({
    session,
    query: RUN_PROJECT_HISTORY_QUERY,
    variables: { projectKey },
    fetchImpl,
    requestId,
    requestTrace,
  });
  const historyData = historyResult.data;
  const coverageTrend = Array.isArray(historyData.coverageTrend) ? historyData.coverageTrend : [];
  return {
    coverageTrend,
    coverageTrendOverlays: buildTrendOverlays(
      coverageTrend,
      Array.isArray(historyData.releaseNotes) ? historyData.releaseNotes : [],
    ),
    benchmarkPanels: await loadProjectBenchmarkPanels({
      session,
      projectKey,
      benchmarkCatalog: Array.isArray(historyData.benchmarkCatalog) ? historyData.benchmarkCatalog.slice(0, 1) : [],
      fetchImpl,
      requestId,
      requestTrace,
    }),
    runId,
  };
}

export async function loadRunOperationsData({ session, runId, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const result = await executeWebGraphqlRequest({
    session,
    query: RUN_DETAIL_QUERY,
    variables: { runId },
    fetchImpl,
    requestId,
    requestTrace,
  });
  const data = result.data;
  return {
    run: data.run || null,
    runPackages: Array.isArray(data.runPackages) ? data.runPackages : [],
    runModules: Array.isArray(data.runModules) ? data.runModules : [],
    runFiles: Array.isArray(data.runFiles) ? data.runFiles : [],
    failedTests: Array.isArray(data.tests) ? data.tests : [],
    runPerformanceStats: Array.isArray(data.runPerformanceStats) ? data.runPerformanceStats : [],
    coverageComparison: data.runCoverageComparison || null,
  };
}

export async function loadSuiteTests({ session, runId, suiteRunId, limit = 100, after = null, status = null, search = null, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const result = await executeWebGraphqlRequest({
    session,
    query: SUITE_TESTS_QUERY,
    variables: { runId, suiteRunId, limit: limit + 1, after, status, search },
    fetchImpl,
    requestId,
    requestTrace,
  });
  const tests = Array.isArray(result.data.testsForSuite) ? result.data.testsForSuite : [];
  const page = tests.slice(0, limit);
  return {
    tests: page,
    hasMore: tests.length > limit,
    nextCursor: page.at(-1)?.id || null,
  };
}

async function loadRunReportHtmlResult({ session, runId, fetchImpl = fetch, requestId = null, requestTrace = null, profiler = null }) {
  const result = await measureProfileStep(profiler, 'run-report-query', () => executeWebGraphqlRequest({
    session,
    query: RUN_REPORT_QUERY,
    variables: { runId },
    fetchImpl,
    requestId,
    requestTrace,
  }), (response) => ({
    query: 'RUN_REPORT_QUERY',
    runId,
    ...response?.meta,
  }));
  const data = result.data;

  const run = data.run || null;
  if (!run || !run.rawReport) {
    return null;
  }

  const storedHtmlArtifact = (Array.isArray(run.artifacts) ? run.artifacts : []).find((artifact) => (
    typeof artifact?.sourceUrl === 'string'
    && /^https?:\/\//i.test(artifact.sourceUrl)
    && (artifact.relativePath === 'index.html' || artifact.relativePath?.endsWith('/index.html'))
  ));
  if (storedHtmlArtifact) {
    return {
      redirectUrl: storedHtmlArtifact.sourceUrl,
      etag: storedHtmlArtifact.metadata?.contentHash || null,
      meta: result.meta,
      cacheStatus: 'stored-artifact',
    };
  }

  const reportHash = crypto.createHash('sha256').update(JSON.stringify(run.rawReport)).digest('hex');
  const diskCachePath = path.join(renderedReportCacheDirectory, `${reportHash}.html`);
  if (renderedReportCache.has(reportHash)) {
    return {
      html: renderedReportCache.get(reportHash),
      etag: reportHash,
      meta: result.meta,
      cacheStatus: 'render-cache-hit',
    };
  }
  try {
    const cachedHtml = fs.readFileSync(diskCachePath, 'utf8');
    renderedReportCache.set(reportHash, cachedHtml);
    return {
      html: cachedHtml,
      etag: reportHash,
      meta: result.meta,
      cacheStatus: 'render-cache-hit',
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const html = await measureProfileStep(profiler, 'run-report-render', async () => {
    const { renderHtmlReport } = await import('@test-station/render-html');
    const embeddedReport = prepareEmbeddedRunnerReport(run.rawReport);
    return renderHtmlReport(embeddedReport, {
      title: `${run.project?.name || 'Test Station'} Report - ${run.externalKey}`,
    });
  }, {
    runId,
  });

  const decoratedHtml = decorateEmbeddedRunnerReportHtml(html);
  fs.mkdirSync(renderedReportCacheDirectory, { recursive: true });
  fs.writeFileSync(diskCachePath, decoratedHtml, { mode: 0o600 });
  renderedReportCache.set(reportHash, decoratedHtml);
  if (renderedReportCache.size > 50) renderedReportCache.delete(renderedReportCache.keys().next().value);
  return {
    html: decoratedHtml,
    etag: reportHash,
    meta: result.meta,
    cacheStatus: 'render-cache-miss',
  };
}

export async function loadRunReportHtml({ session, runId, fetchImpl = fetch, requestId = null, requestTrace = null, profiler = null }) {
  const result = await loadRunReportHtmlResult({
    session,
    runId,
    fetchImpl,
    requestId,
    requestTrace,
    profiler,
  });

  return result?.html || null;
}

export async function loadAdminOverviewPage({ session, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const viewer = await loadAdminViewer({ session, fetchImpl, requestId, requestTrace });
  if (!viewer) {
    return ADMIN_PAGE_UNAUTHORIZED;
  }

  const data = await executeWebGraphql({
    session,
    query: ADMIN_OVERVIEW_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  });

  return {
    viewer,
    users: Array.isArray(data.adminUsers) ? data.adminUsers : [],
    projects: Array.isArray(data.adminProjects) ? data.adminProjects : [],
  };
}

export async function loadAdminProjectsPage({ session, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const viewer = await loadAdminViewer({ session, fetchImpl, requestId, requestTrace });
  if (!viewer) {
    return ADMIN_PAGE_UNAUTHORIZED;
  }

  const data = await executeWebGraphql({
    session,
    query: ADMIN_PROJECTS_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  });

  return {
    viewer,
    projects: Array.isArray(data.adminProjects) ? data.adminProjects : [],
  };
}

export async function loadAdminProjectAccessPage({ session, slug, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const viewer = await loadAdminViewer({ session, fetchImpl, requestId, requestTrace });
  if (!viewer) {
    return ADMIN_PAGE_UNAUTHORIZED;
  }

  const data = await executeWebGraphql({
    session,
    query: ADMIN_PROJECT_ACCESS_QUERY,
    variables: { slug },
    fetchImpl,
    requestId,
    requestTrace,
  });

  if (!data.adminProjectAccess) {
    return null;
  }

  return {
    viewer,
    projectAccess: data.adminProjectAccess,
  };
}

export async function loadAdminRolesPage({ session, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const viewer = await loadAdminViewer({ session, fetchImpl, requestId, requestTrace });
  if (!viewer) {
    return ADMIN_PAGE_UNAUTHORIZED;
  }

  const data = await executeWebGraphql({
    session,
    query: ADMIN_ROLES_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  });

  return {
    viewer,
    roles: Array.isArray(data.adminRoles) ? data.adminRoles : [],
  };
}

export async function loadAdminGroupsPage({ session, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const viewer = await loadAdminViewer({ session, fetchImpl, requestId, requestTrace });
  if (!viewer) {
    return ADMIN_PAGE_UNAUTHORIZED;
  }

  const data = await executeWebGraphql({
    session,
    query: ADMIN_GROUPS_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  });

  return {
    viewer,
    groups: Array.isArray(data.adminGroups) ? data.adminGroups : [],
  };
}

export async function loadAdminUsersPage({ session, fetchImpl = fetch, requestId = null, requestTrace = null }) {
  const viewer = await loadAdminViewer({ session, fetchImpl, requestId, requestTrace });
  if (!viewer) {
    return ADMIN_PAGE_UNAUTHORIZED;
  }

  const data = await executeWebGraphql({
    session,
    query: ADMIN_USERS_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  });

  return {
    viewer,
    users: Array.isArray(data.adminUsers) ? data.adminUsers : [],
  };
}

async function loadProjectTrendPanels({
  session,
  projectKey,
  latestRunId,
  overallTrend,
  releaseNotes,
  fetchImpl,
  requestId,
  requestTrace,
  profiler = null,
}) {
  const overlays = buildTrendOverlays(overallTrend, releaseNotes);
  if (!latestRunId) {
    return {
      overall: overallTrend,
      overlays,
      packageTrends: [],
      moduleTrends: [],
      fileTrends: [],
    };
  }

  const scopeCatalogResult = await measureProfileStep(profiler, 'project-scope-catalog-query', () => executeWebGraphqlRequest({
    session,
    query: RUN_SCOPE_TREND_CATALOG_QUERY,
    variables: { runId: latestRunId },
    fetchImpl,
    requestId,
    requestTrace,
  }), (response) => ({
    query: 'RUN_SCOPE_TREND_CATALOG_QUERY',
    runId: latestRunId,
    ...response?.meta,
  }));
  const scopeCatalog = scopeCatalogResult.data;
  const runFiles = Array.isArray(scopeCatalog.runFiles) ? scopeCatalog.runFiles : [];

  const packageSelections = rankTrendSelections(runFiles, (entry) => entry.packageName)
    .slice(0, 3)
    .map((entry) => ({
      label: entry.label,
      packageName: entry.label,
    }));
  const moduleSelections = rankTrendSelections(runFiles, (entry) => (
    entry.moduleName && entry.moduleName !== 'uncategorized'
      ? entry.moduleName
      : null
  ))
    .slice(0, 3)
    .map((entry) => ({
      label: entry.label,
      moduleName: entry.label,
    }));
  const fileSelections = runFiles
    .sort((left, right) => {
      const failedDelta = (right.failedTestCount || 0) - (left.failedTestCount || 0);
      if (failedDelta !== 0) {
        return failedDelta;
      }
      const testDelta = (right.testCount || 0) - (left.testCount || 0);
      if (testDelta !== 0) {
        return testDelta;
      }
      return String(left.path || '').localeCompare(String(right.path || ''));
    })
    .slice(0, 3)
    .map((entry) => ({
      label: entry.path,
      filePath: entry.path,
    }));

  const [packageTrends, moduleTrends, fileTrends] = await Promise.all([
    measureProfileStep(profiler, 'package-trend-query-group', () => loadScopedTrendPanels({
      session,
      projectKey,
      selections: packageSelections,
      fetchImpl,
      requestId,
      requestTrace,
    }), {
      selectionCount: packageSelections.length,
      scopeType: 'package',
    }),
    measureProfileStep(profiler, 'module-trend-query-group', () => loadScopedTrendPanels({
      session,
      projectKey,
      selections: moduleSelections,
      fetchImpl,
      requestId,
      requestTrace,
    }), {
      selectionCount: moduleSelections.length,
      scopeType: 'module',
    }),
    measureProfileStep(profiler, 'file-trend-query-group', () => loadScopedTrendPanels({
      session,
      projectKey,
      selections: fileSelections,
      fetchImpl,
      requestId,
      requestTrace,
    }), {
      selectionCount: fileSelections.length,
      scopeType: 'file',
    }),
  ]);

  return {
    overall: overallTrend,
    overlays,
    packageTrends,
    moduleTrends,
    fileTrends,
  };
}

async function loadProjectBenchmarkPanels({
  session,
  projectKey,
  benchmarkCatalog,
  fetchImpl,
  requestId,
  requestTrace,
}) {
  const catalogEntries = normalizeBenchmarkCatalogEntries(benchmarkCatalog);
  if (catalogEntries.length === 0) {
    return [];
  }

  const result = await executeWebGraphqlRequest({
    session,
    query: PERFORMANCE_TRENDS_QUERY,
    variables: {
      projectKey,
      metrics: catalogEntries.flatMap((entry) => entry.statNames.map((statName) => ({
        statGroup: entry.statGroup,
        statName,
      }))),
      limit: 18,
    },
    fetchImpl,
    requestId,
    requestTrace,
  });
  const metricResponses = Array.isArray(result.data.performanceTrends) ? result.data.performanceTrends : [];

  const panelMap = new Map(catalogEntries.map((entry) => [entry.statGroup, {
    ...entry,
    metrics: [],
  }]));

  for (const response of metricResponses) {
    const panel = panelMap.get(response.statGroup);
    if (!panel) {
      continue;
    }

    panel.metrics.push({
      statName: response.statName,
      points: response.points,
      unit: response.points[0]?.unit || panel.units[0] || null,
      seriesIds: uniqueStrings(response.points.map((point) => point.seriesId)),
      runnerKeys: uniqueStrings(response.points.map((point) => point.runnerKey)),
      branches: uniqueStrings(response.points.map((point) => point.branch)),
    });
  }

  return Array.from(panelMap.values())
    .map((panel) => ({
      ...panel,
      metrics: panel.metrics
        .filter((metric) => metric.points.length > 0)
        .sort((left, right) => left.statName.localeCompare(right.statName)),
    }))
    .filter((panel) => panel.metrics.length > 0)
    .sort(compareBenchmarkPanelsNewestFirst);
}

async function loadScopedTrendPanels({ session, projectKey, selections, fetchImpl, requestId, requestTrace }) {
  const resolvedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
  const responses = await Promise.all(resolvedSelections.map(async (selection) => {
    const result = await executeWebGraphql({
      session,
      query: SCOPED_COVERAGE_TREND_QUERY,
      variables: {
        projectKey,
        packageName: selection.packageName || null,
        moduleName: selection.moduleName || null,
        filePath: selection.filePath || null,
        limit: 12,
      },
      fetchImpl,
      requestId,
      requestTrace,
    });

    return {
      ...selection,
      points: Array.isArray(result.coverageTrend) ? result.coverageTrend : [],
    };
  }));

  return responses.filter((entry) => entry.points.length > 0);
}

function rankTrendSelections(files, selectLabel) {
  const scores = new Map();

  for (const entry of Array.isArray(files) ? files : []) {
    const label = typeof selectLabel === 'function' ? selectLabel(entry) : null;
    if (!label) {
      continue;
    }

    const current = scores.get(label) || {
      label,
      failedTestCount: 0,
      testCount: 0,
    };

    current.failedTestCount = Math.max(current.failedTestCount, entry.failedTestCount || 0);
    current.testCount = Math.max(current.testCount, entry.testCount || 0);
    scores.set(label, current);
  }

  return Array.from(scores.values()).sort((left, right) => {
    const failedDelta = right.failedTestCount - left.failedTestCount;
    if (failedDelta !== 0) {
      return failedDelta;
    }

    const testDelta = right.testCount - left.testCount;
    if (testDelta !== 0) {
      return testDelta;
    }

    return left.label.localeCompare(right.label);
  });
}

function normalizeBenchmarkCatalogEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry.statGroup === 'string' && entry.statGroup.trim() !== '')
    .map((entry) => ({
      projectKey: entry.projectKey || null,
      statGroup: entry.statGroup,
      statNames: uniqueStrings(entry.statNames),
      units: uniqueStrings(entry.units),
      seriesIds: uniqueStrings(entry.seriesIds),
      runnerKeys: uniqueStrings(entry.runnerKeys),
      latestCompletedAt: entry.latestCompletedAt || null,
      pointCount: Number.isFinite(entry.pointCount) ? entry.pointCount : 0,
    }));
}

async function loadAdminViewer({ session, fetchImpl, requestId, requestTrace }) {
  const data = await executeWebGraphql({
    session,
    query: VIEWER_ACCESS_QUERY,
    fetchImpl,
    requestId,
    requestTrace,
  });

  return data.viewer?.isAdmin === true ? data.viewer : null;
}

export {
  executeWebGraphqlRequest,
  loadRunReportHtmlResult,
};

function buildTrendOverlays(points, releaseNotes) {
  const overlays = [];
  const seenVersions = new Set();

  for (const point of Array.isArray(points) ? points : []) {
    if (point.versionKey && !seenVersions.has(point.versionKey)) {
      overlays.push({
        kind: 'version',
        label: point.versionKey,
        recordedAt: point.completedAt || point.recordedAt,
      });
      seenVersions.add(point.versionKey);
    }
  }

  for (const note of Array.isArray(releaseNotes) ? releaseNotes : []) {
    overlays.push({
      kind: 'release',
      label: note.title,
      recordedAt: note.publishedAt,
    });
  }

  return overlays
    .filter((overlay) => overlay.recordedAt)
    .sort((left, right) => new Date(right.recordedAt).valueOf() - new Date(left.recordedAt).valueOf())
    .slice(0, 8);
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim())))
    .sort((left, right) => left.localeCompare(right));
}

function compareBenchmarkPanelsNewestFirst(left, right) {
  return compareNullableIsoDates(right.latestCompletedAt, left.latestCompletedAt)
    || left.statGroup.localeCompare(right.statGroup);
}

function compareNullableIsoDates(left, right) {
  const leftValue = left ? new Date(left).valueOf() : 0;
  const rightValue = right ? new Date(right).valueOf() : 0;
  return leftValue - rightValue;
}
