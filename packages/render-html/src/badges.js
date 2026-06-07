export function createTestsBadgePayload(summary = {}) {
  const total = Number(summary.totalTests || 0);
  const passed = Number(summary.passedTests || 0);
  const failed = Number(summary.failedTests || 0);
  const skipped = Number(summary.skippedTests || 0);

  if (total === 0) {
    return createBadge('tests', 'no tests', 'lightgrey');
  }
  if (failed > 0) {
    return createBadge('tests', `${passed} passed / ${failed} failed`, 'red');
  }
  if (skipped > 0) {
    return createBadge('tests', `${passed} passed / ${skipped} skipped`, 'yellow');
  }
  return createBadge('tests', `${passed} passed`, 'brightgreen');
}

export function createCoverageBadgePayload(summary = {}) {
  const linesPct = summary?.coverage?.lines?.pct;
  if (!Number.isFinite(linesPct)) {
    return createBadge('coverage', 'n/a', 'lightgrey');
  }
  return createBadge('coverage', `${Number(linesPct).toFixed(1)}%`, badgeCoverageColor(linesPct));
}

export function createHealthBadgePayload(summary = {}) {
  const linesPct = summary?.coverage?.lines?.pct;
  if (!Number.isFinite(linesPct)) {
    return createBadge('health', 'n/a', 'lightgrey');
  }
  return createBadge('health', `${Math.round(Number(linesPct))}%`, badgeCoverageColor(linesPct));
}

function createBadge(label, message, color) {
  return {
    schemaVersion: 1,
    label,
    message,
    color,
  };
}

function badgeCoverageColor(pct) {
  if (pct >= 90) {
    return 'brightgreen';
  }
  if (pct >= 75) {
    return 'yellowgreen';
  }
  if (pct >= 60) {
    return 'yellow';
  }
  return 'red';
}
