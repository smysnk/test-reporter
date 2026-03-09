import env from '../../../config/env.mjs';
import { buildPortalActorHeaders } from './auth.js';
import {
  PORTAL_HOME_QUERY,
  PROJECT_ACTIVITY_QUERY,
  PROJECT_BY_SLUG_QUERY,
  RUN_SCOPE_TREND_CATALOG_QUERY,
  RUN_DETAIL_QUERY,
  SCOPED_COVERAGE_TREND_QUERY,
} from './queries.js';

const defaultServerUrl = `http://localhost:${env.get('SERVER_PORT').default(4400).asPortNumber()}`;

export function resolvePortalServerUrl() {
  return process.env.NEXT_PUBLIC_SERVER_URL
    || process.env.SERVER_URL
    || defaultServerUrl;
}

export function resolvePortalGraphqlUrl() {
  return `${resolvePortalServerUrl().replace(/\/$/, '')}/graphql`;
}

export async function executePortalGraphql({ session, query, variables = {}, fetchImpl = fetch, requestId = null }) {
  const response = await fetchImpl(resolvePortalGraphqlUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(requestId ? { 'x-request-id': requestId } : {}),
      ...buildPortalActorHeaders(session),
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const payload = await response.json();
  if (!response.ok || Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = Array.isArray(payload.errors) && payload.errors.length > 0
      ? payload.errors[0].message
      : `GraphQL request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.data || {};
}

export async function loadPortalHomePage({ session, fetchImpl = fetch, requestId = null }) {
  const data = await executePortalGraphql({
    session,
    query: PORTAL_HOME_QUERY,
    fetchImpl,
    requestId,
  });

  return {
    me: data.me || null,
    projects: Array.isArray(data.projects) ? data.projects : [],
    runs: Array.isArray(data.runs) ? data.runs : [],
  };
}

export async function loadProjectExplorerPage({ session, slug, fetchImpl = fetch, requestId = null }) {
  const base = await executePortalGraphql({
    session,
    query: PROJECT_BY_SLUG_QUERY,
    variables: { slug },
    fetchImpl,
    requestId,
  });

  if (!base.project) {
    return null;
  }

  const activity = await executePortalGraphql({
    session,
    query: PROJECT_ACTIVITY_QUERY,
    variables: { projectKey: base.project.key },
    fetchImpl,
    requestId,
  });

  return {
    project: base.project,
    runs: Array.isArray(activity.runs) ? activity.runs : [],
    coverageTrend: Array.isArray(activity.coverageTrend) ? activity.coverageTrend : [],
    releaseNotes: Array.isArray(activity.releaseNotes) ? activity.releaseNotes : [],
    trendPanels: await loadProjectTrendPanels({
      session,
      projectKey: base.project.key,
      latestRunId: Array.isArray(activity.runs) && activity.runs[0] ? activity.runs[0].id : null,
      overallTrend: Array.isArray(activity.coverageTrend) ? activity.coverageTrend : [],
      releaseNotes: Array.isArray(activity.releaseNotes) ? activity.releaseNotes : [],
      fetchImpl,
      requestId,
    }),
  };
}

export async function loadRunExplorerPage({ session, runId, fetchImpl = fetch, requestId = null }) {
  const data = await executePortalGraphql({
    session,
    query: RUN_DETAIL_QUERY,
    variables: { runId },
    fetchImpl,
    requestId,
  });

  if (!data.run) {
    return null;
  }

  return {
    run: data.run,
    runPackages: Array.isArray(data.runPackages) ? data.runPackages : [],
    runModules: Array.isArray(data.runModules) ? data.runModules : [],
    runFiles: Array.isArray(data.runFiles) ? data.runFiles : [],
    failedTests: Array.isArray(data.tests) ? data.tests : [],
    coverageComparison: data.runCoverageComparison || null,
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

  const scopeCatalog = await executePortalGraphql({
    session,
    query: RUN_SCOPE_TREND_CATALOG_QUERY,
    variables: { runId: latestRunId },
    fetchImpl,
    requestId,
  });

  const packageSelections = (Array.isArray(scopeCatalog.runPackages) ? scopeCatalog.runPackages : [])
    .slice(0, 3)
    .map((entry) => ({
      label: entry.name,
      packageName: entry.name,
    }));
  const moduleSelections = (Array.isArray(scopeCatalog.runModules) ? scopeCatalog.runModules : [])
    .slice(0, 3)
    .map((entry) => ({
      label: entry.module,
      moduleName: entry.module,
    }));
  const fileSelections = (Array.isArray(scopeCatalog.runFiles) ? scopeCatalog.runFiles : [])
    .sort((left, right) => {
      const failedDelta = (right.failedTestCount || 0) - (left.failedTestCount || 0);
      if (failedDelta !== 0) {
        return failedDelta;
      }
      const leftCoverage = Number.isFinite(left.coverage?.linesPct) ? left.coverage.linesPct : 101;
      const rightCoverage = Number.isFinite(right.coverage?.linesPct) ? right.coverage.linesPct : 101;
      return leftCoverage - rightCoverage;
    })
    .slice(0, 3)
    .map((entry) => ({
      label: entry.path,
      filePath: entry.path,
    }));

  const [packageTrends, moduleTrends, fileTrends] = await Promise.all([
    loadScopedTrendPanels({ session, projectKey, selections: packageSelections, fetchImpl, requestId }),
    loadScopedTrendPanels({ session, projectKey, selections: moduleSelections, fetchImpl, requestId }),
    loadScopedTrendPanels({ session, projectKey, selections: fileSelections, fetchImpl, requestId }),
  ]);

  return {
    overall: overallTrend,
    overlays,
    packageTrends,
    moduleTrends,
    fileTrends,
  };
}

async function loadScopedTrendPanels({ session, projectKey, selections, fetchImpl, requestId }) {
  const resolvedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
  const responses = await Promise.all(resolvedSelections.map(async (selection) => {
    const result = await executePortalGraphql({
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
    });

    return {
      ...selection,
      points: Array.isArray(result.coverageTrend) ? result.coverageTrend : [],
    };
  }));

  return responses.filter((entry) => entry.points.length > 0);
}

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
