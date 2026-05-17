const DEFAULT_BENCHMARK_THRESHOLDS = {
  warningDeltaPct: 5,
  severeDeltaPct: 10,
};

const BENCHMARK_SEMANTIC_RULES = [
  {
    id: 'memory',
    test: ({ statName, unit }) => containsAny(statName, ['heap_delta_bytes', 'memory', 'resident', 'rss', 'bytes'])
      || unit === 'bytes',
    lowerIsBetter: true,
    warningDeltaPct: 10,
    severeDeltaPct: 20,
  },
  {
    id: 'throughput',
    test: ({ statName, unit }) => containsAny(statName, ['per_second', 'ops_per_sec', 'throughput', 'frames_per_second', 'fps'])
      || unit === 'ops_per_sec',
    lowerIsBetter: false,
    warningDeltaPct: 5,
    severeDeltaPct: 10,
  },
  {
    id: 'latency',
    test: ({ statName, unit }) => containsAny(statName, ['elapsed', 'duration', 'time_to_', '_ms', '_us'])
      || unit === 'ms'
      || unit === 'us',
    lowerIsBetter: true,
    warningDeltaPct: 5,
    severeDeltaPct: 10,
  },
];

export function resolveBenchmarkSemantics({ statGroup = null, statName = null, unit = null, metadata = null } = {}) {
  const normalizedMetadata = normalizeMetadata(metadata);
  const normalizedStatName = normalizeString(statName) || '';
  const normalizedUnit = normalizeString(unit) || '';
  const matchedRule = BENCHMARK_SEMANTIC_RULES.find((rule) => rule.test({
    statGroup: normalizeString(statGroup) || '',
    statName: normalizedStatName,
    unit: normalizedUnit,
    metadata: normalizedMetadata,
  })) || null;

  const lowerIsBetter = typeof normalizedMetadata.lowerIsBetter === 'boolean'
    ? normalizedMetadata.lowerIsBetter
    : matchedRule?.lowerIsBetter ?? true;
  const warningDeltaPct = coercePositiveNumber(
    normalizedMetadata.warningDeltaPct
    ?? normalizedMetadata.warning_delta_pct
    ?? normalizedMetadata.budgetWarningDeltaPct
    ?? normalizedMetadata.budget_warning_delta_pct,
  ) ?? matchedRule?.warningDeltaPct ?? DEFAULT_BENCHMARK_THRESHOLDS.warningDeltaPct;
  const severeDeltaPct = coercePositiveNumber(
    normalizedMetadata.severeDeltaPct
    ?? normalizedMetadata.severe_delta_pct
    ?? normalizedMetadata.budgetSevereDeltaPct
    ?? normalizedMetadata.budget_severe_delta_pct,
  ) ?? matchedRule?.severeDeltaPct ?? Math.max(warningDeltaPct, DEFAULT_BENCHMARK_THRESHOLDS.severeDeltaPct);
  const budgetStatus = resolveBenchmarkBudgetStatus(normalizedMetadata);

  return {
    lowerIsBetter,
    warningDeltaPct,
    severeDeltaPct: Math.max(warningDeltaPct, severeDeltaPct),
    semanticsSource: typeof normalizedMetadata.lowerIsBetter === 'boolean'
      || coercePositiveNumber(
        normalizedMetadata.warningDeltaPct
        ?? normalizedMetadata.warning_delta_pct
        ?? normalizedMetadata.budgetWarningDeltaPct
        ?? normalizedMetadata.budget_warning_delta_pct
        ?? normalizedMetadata.severeDeltaPct
        ?? normalizedMetadata.severe_delta_pct
        ?? normalizedMetadata.budgetSevereDeltaPct
        ?? normalizedMetadata.budget_severe_delta_pct,
      ) != null
      ? 'metadata'
      : matchedRule
        ? 'rule'
        : 'default',
    budgetStatus,
  };
}

export function resolveBenchmarkBudgetStatus(metadata) {
  const normalizedMetadata = normalizeMetadata(metadata);
  const rawBudgetStatus = normalizeString(
    normalizedMetadata.budgetStatus
    ?? normalizedMetadata.budget_status
    ?? normalizedMetadata.thresholdStatus
    ?? normalizedMetadata.threshold_status,
  );

  if (!rawBudgetStatus) {
    return null;
  }

  if (['warn', 'warning'].includes(rawBudgetStatus)) {
    return 'warning';
  }

  if (['fail', 'failed', 'error', 'critical', 'severe', 'over_budget', 'over-budget', 'exceeded'].includes(rawBudgetStatus)) {
    return 'severe-regression';
  }

  return null;
}

export function classifyBenchmarkComparison({ latestPoint = null, previousPoint = null, statGroup = null, statName = null, unit = null, metadata = null } = {}) {
  const latestValue = toFiniteNumber(latestPoint?.numericValue);
  const previousValue = toFiniteNumber(previousPoint?.numericValue);
  const semantics = resolveBenchmarkSemantics({
    statGroup: statGroup ?? latestPoint?.statGroup ?? previousPoint?.statGroup ?? null,
    statName: statName ?? latestPoint?.statName ?? previousPoint?.statName ?? null,
    unit: unit ?? latestPoint?.unit ?? previousPoint?.unit ?? null,
    metadata: metadata ?? latestPoint?.metadata ?? previousPoint?.metadata ?? null,
  });
  const budgetStatus = resolveBenchmarkBudgetStatus(latestPoint?.metadata ?? metadata);

  if (!Number.isFinite(latestValue) || !Number.isFinite(previousValue) || previousValue === 0) {
    return {
      status: budgetStatus || 'insufficient-baseline',
      directionStatus: 'insufficient-baseline',
      deltaValue: Number.isFinite(latestValue) && Number.isFinite(previousValue) ? latestValue - previousValue : null,
      deltaPercent: null,
      ...semantics,
    };
  }

  const deltaValue = latestValue - previousValue;
  const deltaPercent = (deltaValue / Math.abs(previousValue)) * 100;
  if (Math.abs(deltaPercent) < 0.000001) {
    return {
      status: budgetStatus || 'stable',
      directionStatus: 'stable',
      deltaValue,
      deltaPercent: 0,
      ...semantics,
    };
  }

  const improved = semantics.lowerIsBetter ? deltaValue < 0 : deltaValue > 0;
  const directionStatus = improved ? 'improved' : 'regressed';

  if (improved) {
    return {
      status: 'improved',
      directionStatus,
      deltaValue,
      deltaPercent,
      ...semantics,
    };
  }

  const absoluteDeltaPct = Math.abs(deltaPercent);
  const status = budgetStatus === 'severe-regression' || absoluteDeltaPct >= semantics.severeDeltaPct
    ? 'severe-regression'
    : budgetStatus === 'warning' || absoluteDeltaPct >= semantics.warningDeltaPct
      ? 'warning'
      : 'regressed';

  return {
    status,
    directionStatus,
    deltaValue,
    deltaPercent,
    ...semantics,
  };
}

export function isBenchmarkRegressionStatus(status) {
  return status === 'regressed' || status === 'warning' || status === 'severe-regression';
}

export function compareBenchmarkStatusRank(left, right) {
  return benchmarkStatusRank(left) - benchmarkStatusRank(right);
}

export function benchmarkStatusRank(status) {
  if (status === 'severe-regression') return 0;
  if (status === 'warning') return 1;
  if (status === 'regressed') return 2;
  if (status === 'improved') return 3;
  if (status === 'stable') return 4;
  return 5;
}

function normalizeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function coercePositiveNumber(value) {
  const normalized = toFiniteNumber(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function toFiniteNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function containsAny(value, tokens) {
  const normalizedValue = normalizeString(value) || '';
  return tokens.some((token) => normalizedValue.includes(token));
}
