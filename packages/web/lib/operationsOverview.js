export const OPERATIONS_WINDOW_DAYS = 14;
export const OPERATIONS_PAGE_SIZE = 50;

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateKey(value, timeZone = 'UTC') {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function resolveRunPresentation(run) {
  const publicationKinds = Array.isArray(run?.publicationKinds) ? run.publicationKinds : [];
  const normalizedStatus = typeof run?.status === 'string' && run.status.trim()
    ? run.status.trim().toLowerCase()
    : 'unknown';

  if (!publicationKinds.includes('tests') && publicationKinds.includes('performance')) {
    return { kind: 'performance', label: 'Benchmark', status: 'benchmark', symbol: 'B' };
  }
  if (!publicationKinds.includes('tests') && publicationKinds.includes('coverage')) {
    return { kind: 'coverage', label: 'Coverage', status: 'coverage', symbol: 'C' };
  }

  const symbols = { passed: '✓', failed: '×', partial: '!', warning: '!', skipped: '–', unknown: '?' };
  return {
    kind: 'tests',
    label: normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1),
    status: normalizedStatus,
    symbol: symbols[normalizedStatus] || '?',
  };
}

export function buildDateWindow({ now = new Date(), days = OPERATIONS_WINDOW_DAYS, timeZone = 'UTC' } = {}) {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.trunc(days)) : OPERATIONS_WINDOW_DAYS;
  const endKey = dateKey(now, timeZone) || dateKey(new Date(), 'UTC');
  const end = new Date(`${endKey}T12:00:00.000Z`);
  return Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (safeDays - index - 1));
    return { key: date.toISOString().slice(0, 10), date: date.toISOString() };
  });
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function buildOperationsSummary(runs) {
  const runList = Array.isArray(runs) ? runs : [];
  const result = {
    total: runList.length,
    passed: 0,
    failed: 0,
    terminal: 0,
    passRate: null,
    benchmarks: 0,
    coveragePublications: 0,
    latestCoverage: null,
    medianDurationMs: median(runList.map((run) => finite(run?.durationMs))),
  };
  const newestCoverageRun = [...runList]
    .sort((left, right) => timestamp(right?.completedAt) - timestamp(left?.completedAt))
    .find((run) => finite(run?.coverageSnapshot?.linesPct) !== null);
  result.latestCoverage = finite(newestCoverageRun?.coverageSnapshot?.linesPct);

  for (const run of runList) {
    const presentation = resolveRunPresentation(run);
    if (presentation.status === 'passed') result.passed += 1;
    if (presentation.status === 'failed') result.failed += 1;
    if (presentation.status === 'benchmark') result.benchmarks += 1;
    if (presentation.status === 'coverage') result.coveragePublications += 1;
  }
  result.terminal = result.passed + result.failed;
  result.passRate = result.terminal > 0 ? (result.passed / result.terminal) * 100 : null;
  return result;
}

export function buildProjectDistribution(runs) {
  const counts = { passed: 0, failed: 0, other: 0, total: 0 };
  for (const run of Array.isArray(runs) ? runs : []) {
    const status = resolveRunPresentation(run).status;
    counts.total += 1;
    if (status === 'passed') counts.passed += 1;
    else if (status === 'failed') counts.failed += 1;
    else counts.other += 1;
  }
  return {
    ...counts,
    passedPct: counts.total ? (counts.passed / counts.total) * 100 : 0,
    failedPct: counts.total ? (counts.failed / counts.total) * 100 : 0,
    otherPct: counts.total ? (counts.other / counts.total) * 100 : 0,
  };
}

function worstPresentation(runs) {
  const priorities = { failed: 7, partial: 6, warning: 6, unknown: 5, skipped: 4, benchmark: 3, coverage: 2, passed: 1 };
  return (Array.isArray(runs) ? runs : [])
    .map(resolveRunPresentation)
    .sort((left, right) => (priorities[right.status] || 0) - (priorities[left.status] || 0))[0] || null;
}

export function buildActivityRows(projects, runs, dateWindow, timeZone = 'UTC') {
  const runList = Array.isArray(runs) ? runs : [];
  return (Array.isArray(projects) ? projects : []).map((project) => {
    const projectRuns = runList.filter((run) => run?.project?.slug === project.slug);
    return {
      project,
      cells: dateWindow.map((day) => {
        const dayRuns = projectRuns
          .filter((run) => dateKey(run?.completedAt, timeZone) === day.key)
          .sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt));
        const counts = buildProjectDistribution(dayRuns);
        return {
          ...day,
          runs: dayRuns,
          latestRun: dayRuns[0] || null,
          presentation: worstPresentation(dayRuns),
          counts,
        };
      }),
    };
  });
}

export function buildCoverageSeries(projects, runs, dateWindow, selectedProjectSlug = null, timeZone = 'UTC') {
  const projectList = (Array.isArray(projects) ? projects : [])
    .filter((project) => !selectedProjectSlug || project.slug === selectedProjectSlug);
  const runList = Array.isArray(runs) ? runs : [];
  return dateWindow.map((day) => {
    const values = [];
    for (const project of projectList) {
      const latest = runList
        .filter((run) => run?.project?.slug === project.slug && dateKey(run?.completedAt, timeZone) === day.key)
        .filter((run) => finite(run?.coverageSnapshot?.linesPct) !== null)
        .sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt))[0];
      const value = finite(latest?.coverageSnapshot?.linesPct);
      if (value !== null) values.push(value);
    }
    return {
      ...day,
      linesPct: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      projectCount: values.length,
    };
  });
}

function runSearchText(run) {
  const presentation = resolveRunPresentation(run);
  const buildNumber = run?.projectVersion?.buildNumber;
  return [
    run?.project?.name,
    run?.project?.slug,
    run?.project?.repositoryUrl,
    run?.externalKey,
    run?.branch,
    run?.commitSha,
    run?.sourceRunId,
    Number.isFinite(buildNumber) ? String(buildNumber) : null,
    presentation.label,
    run?.summary?.passedTests,
    run?.summary?.failedTests,
  ].filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
}

export function filterOperationRuns(runs, { search = '', status = 'all', day = null, timeZone = 'UTC' } = {}) {
  const normalizedSearch = String(search || '').trim().toLowerCase();
  return (Array.isArray(runs) ? runs : []).filter((run) => {
    const presentation = resolveRunPresentation(run);
    if (status && status !== 'all' && presentation.status !== status) return false;
    if (day && dateKey(run?.completedAt, timeZone) !== day) return false;
    return !normalizedSearch || runSearchText(run).includes(normalizedSearch);
  });
}

function compareProjectsByActivity(left, right) {
  const delta = timestamp(right.latestRun?.completedAt) - timestamp(left.latestRun?.completedAt);
  return delta || String(left.name || '').localeCompare(String(right.name || ''));
}

export function buildOperationsOverviewModel({
  projects,
  runs,
  selectedProjectSlug = null,
  search = '',
  status = 'all',
  day = null,
  now = new Date(),
  timeZone = 'UTC',
  windowDays = OPERATIONS_WINDOW_DAYS,
} = {}) {
  const projectList = Array.isArray(projects) ? projects : [];
  const runList = [...(Array.isArray(runs) ? runs : [])]
    .sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt));
  const dateWindow = buildDateWindow({ now, days: windowDays, timeZone });
  const windowKeys = new Set(dateWindow.map((entry) => entry.key));
  const windowRuns = runList.filter((run) => windowKeys.has(dateKey(run?.completedAt, timeZone)));

  const sidebarProjects = projectList.map((project) => {
    const projectRuns = windowRuns.filter((run) => run?.project?.slug === project.slug);
    const latestRun = projectRuns[0] || (project.latestRunId ? {
      id: project.latestRunId,
      status: project.latestStatus || 'unknown',
      publicationKinds: Array.isArray(project.latestPublicationKinds) ? project.latestPublicationKinds : [],
      completedAt: project.latestCompletedAt || null,
      coverageSnapshot: finite(project.latestLinesPct) !== null ? { linesPct: finite(project.latestLinesPct) } : null,
    } : null);
    return {
      ...project,
      latestRun,
      distribution: buildProjectDistribution(projectRuns),
      windowRunCount: projectRuns.length,
      recentRunCount: Number.isFinite(project.runCount) ? project.runCount : projectRuns.length,
    };
  }).sort(compareProjectsByActivity);

  const selectedProject = sidebarProjects.find((project) => project.slug === selectedProjectSlug) || null;
  const scopedRuns = selectedProject
    ? windowRuns.filter((run) => run?.project?.slug === selectedProject.slug)
    : windowRuns;
  const filteredRuns = filterOperationRuns(scopedRuns, { search, status, day, timeZone });
  const scopedProjects = selectedProject ? [selectedProject] : sidebarProjects;
  const coverageSeries = buildCoverageSeries(scopedProjects, scopedRuns, dateWindow, selectedProject?.slug || null, timeZone);
  const summary = buildOperationsSummary(filteredRuns);
  summary.latestCoverage = [...coverageSeries].reverse().find((point) => Number.isFinite(point.linesPct))?.linesPct ?? null;

  return {
    dateWindow,
    projects: sidebarProjects,
    selectedProject,
    scopedRuns,
    filteredRuns,
    summary,
    activityRows: buildActivityRows(scopedProjects, scopedRuns, dateWindow, timeZone),
    coverageSeries,
    totalProjects: sidebarProjects.length,
    totalLoadedRuns: runList.length,
    windowRunCount: windowRuns.length,
  };
}

export function resolveNextPage(page, totalRows, pageSize = OPERATIONS_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.trunc(pageSize) || OPERATIONS_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalRows) / safePageSize));
  return Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
}
