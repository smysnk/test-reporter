export function createCoverageMetric(covered, total) {
  if (!Number.isFinite(total)) {
    return null;
  }
  const safeTotal = Math.max(0, total);
  const safeCovered = Number.isFinite(covered) ? Math.max(0, Math.min(safeTotal, covered)) : 0;
  const pct = safeTotal === 0 ? 100 : Number(((safeCovered / safeTotal) * 100).toFixed(2));
  return {
    covered: safeCovered,
    total: safeTotal,
    pct,
  };
}

export function normalizeCoverageSummary(coverage, packageName = null) {
  if (!coverage) {
    return null;
  }

  const files = Array.isArray(coverage.files)
    ? coverage.files.map((file) => ({
        path: file.path,
        lines: file.lines || null,
        statements: file.statements || null,
        functions: file.functions || null,
        branches: file.branches || null,
        packageName: file.packageName || packageName || null,
        module: file.module || null,
        theme: file.theme || null,
        shared: Boolean(file.shared),
        attributionSource: file.attributionSource || null,
        attributionReason: file.attributionReason || null,
        attributionWeight: Number.isFinite(file.attributionWeight) ? file.attributionWeight : 1,
      }))
    : [];

  return {
    lines: coverage.lines || aggregateCoverageMetric(files, 'lines'),
    statements: coverage.statements || aggregateCoverageMetric(files, 'statements'),
    functions: coverage.functions || aggregateCoverageMetric(files, 'functions'),
    branches: coverage.branches || aggregateCoverageMetric(files, 'branches'),
    files,
  };
}

export function aggregateCoverageMetric(files, metricKey) {
  const valid = files
    .map((file) => ({
      metric: file?.[metricKey],
      weight: Number.isFinite(file?.attributionWeight) ? file.attributionWeight : 1,
    }))
    .filter((entry) => entry.metric && Number.isFinite(entry.metric.total));

  if (valid.length === 0) {
    return null;
  }

  const total = valid.reduce((sum, entry) => sum + (entry.metric.total * entry.weight), 0);
  const covered = valid.reduce((sum, entry) => sum + (entry.metric.covered * entry.weight), 0);
  return createCoverageMetric(covered, total);
}

export function mergeCoverageMetric(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return createCoverageMetric(Math.max(left.covered, right.covered), Math.max(left.total, right.total));
}

export function mergeCoverageSummaries(items) {
  const summaries = (items || []).filter(Boolean);
  if (summaries.length === 0) {
    return null;
  }

  const fileMap = new Map();
  for (const coverage of summaries) {
    for (const file of coverage.files || []) {
      if (!fileMap.has(file.path)) {
        fileMap.set(file.path, { ...file });
        continue;
      }
      const current = fileMap.get(file.path);
      current.lines = mergeCoverageMetric(current.lines, file.lines);
      current.statements = mergeCoverageMetric(current.statements, file.statements);
      current.functions = mergeCoverageMetric(current.functions, file.functions);
      current.branches = mergeCoverageMetric(current.branches, file.branches);
      current.packageName = current.packageName || file.packageName || null;
      current.module = current.module || file.module || null;
      current.theme = current.theme || file.theme || null;
      current.shared = current.shared || Boolean(file.shared);
      current.attributionSource = current.attributionSource || file.attributionSource || null;
      current.attributionReason = current.attributionReason || file.attributionReason || null;
      current.attributionWeight = Number.isFinite(current.attributionWeight) ? current.attributionWeight : (Number.isFinite(file.attributionWeight) ? file.attributionWeight : 1);
    }
  }

  return normalizeCoverageSummary({ files: Array.from(fileMap.values()) });
}
