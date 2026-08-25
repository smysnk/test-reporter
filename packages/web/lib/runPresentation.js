export const RUN_STATUSES = Object.freeze(['passed', 'failed', 'partial', 'warning', 'skipped', 'unknown']);
export const SUBMISSION_KINDS = Object.freeze(['tests', 'coverage', 'performance', 'combined']);
export const RUN_WORKSPACE_VIEWS = Object.freeze([
  'summary',
  'tests',
  'failures',
  'coverage',
  'performance',
  'artifacts',
  'report',
]);

const STATUS_SYMBOLS = Object.freeze({
  passed: '✓',
  failed: '×',
  partial: '!',
  warning: '!',
  skipped: '–',
  unknown: '?',
});

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function normalizeRunStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return RUN_STATUSES.includes(normalized) ? normalized : 'unknown';
}

export function normalizePublicationKinds(values) {
  const kinds = Array.isArray(values) ? values : [];
  return [...new Set(kinds
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => SUBMISSION_KINDS.includes(value)))];
}

export function buildRunPresentation(run = {}) {
  const publicationKinds = normalizePublicationKinds(run.publicationKinds);
  const summaryTotal = finite(run.summary?.totalTests) ?? finite(run.summary?.total);
  const hasTests = publicationKinds.includes('tests')
    || (Array.isArray(run.suites) && run.suites.length > 0)
    || (summaryTotal !== null && summaryTotal > 0);
  const hasCoverage = publicationKinds.includes('coverage')
    || Boolean(run.coverageSnapshot);
  const hasPerformance = publicationKinds.includes('performance') || run.performanceAvailable === true;
  const artifactCount = finite(run.artifactCount)
    ?? (Array.isArray(run.artifacts) ? run.artifacts.length : 0);
  const failedTests = finite(run.failedTests)
    ?? finite(run.summary?.failedTests)
    ?? finite(run.summary?.failed)
    ?? 0;
  const hasReport = Boolean(run.hasReportArtifact || run.reportUrl || run.reportAvailable);
  const status = normalizeRunStatus(run.status);

  let testStatus = 'missing';
  if (hasTests) {
    testStatus = failedTests > 0 ? 'failed' : status;
  }

  const availableViews = ['summary'];
  if (hasTests) availableViews.push('tests');
  if (hasTests && failedTests > 0) availableViews.push('failures');
  if (hasCoverage) availableViews.push('coverage');
  if (hasPerformance) availableViews.push('performance');
  if (artifactCount > 0) availableViews.push('artifacts');
  if (hasReport) availableViews.push('report');

  let defaultView = 'summary';
  if (hasTests && failedTests > 0) defaultView = 'failures';
  else if (hasTests) defaultView = 'tests';
  else if (hasCoverage && !hasPerformance) defaultView = 'coverage';
  else if (hasPerformance && !hasCoverage) defaultView = 'performance';

  let overallStatus = status;
  if (!hasTests && hasPerformance && !hasCoverage) overallStatus = 'benchmark';
  else if (!hasTests && hasCoverage && !hasPerformance) overallStatus = 'coverage';

  return {
    overallStatus,
    testStatus,
    coverageStatus: hasCoverage ? 'available' : 'missing',
    performanceStatus: hasPerformance ? (run.performanceStatus || 'available') : 'missing',
    publicationKinds,
    availableViews,
    defaultView,
    freshness: run.freshness || 'current',
  };
}

export function compactRunPresentation(run = {}) {
  const presentation = buildRunPresentation(run);
  if (presentation.overallStatus === 'benchmark') {
    return { kind: 'performance', label: 'Benchmark', status: 'benchmark', symbol: 'B' };
  }
  if (presentation.overallStatus === 'coverage') {
    return { kind: 'coverage', label: 'Coverage', status: 'coverage', symbol: 'C' };
  }
  const status = normalizeRunStatus(presentation.overallStatus);
  return {
    kind: 'tests',
    label: status.charAt(0).toUpperCase() + status.slice(1),
    status,
    symbol: STATUS_SYMBOLS[status] || '?',
  };
}
