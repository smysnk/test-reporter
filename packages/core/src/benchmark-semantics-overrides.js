export const BENCHMARK_SEMANTIC_OVERRIDES = [
  {
    id: 'varcad-neutral-benchmark-counts',
    test: ({ projectKey, statGroup, statName }) => (
      projectKey === 'varcad-io'
      && startsWith(statGroup, 'benchmark.varcad.')
      && endsWith(statName, '_count')
      && !containsAny(statName, ['error', 'failure', 'bad_response', 'repeated_work'])
    ),
    comparisonMode: 'neutral',
    warningDeltaPct: 25,
    severeDeltaPct: 50,
  },
  {
    id: 'varcad-output-footprint',
    test: ({ projectKey, statGroup, statName }) => (
      projectKey === 'varcad-io'
      && startsWith(statGroup, 'benchmark.varcad.')
      && containsAny(statName, ['output_bytes'])
    ),
    comparisonMode: 'neutral',
    warningDeltaPct: 10,
    severeDeltaPct: 20,
  },
  {
    id: 'varcad-throughput-ops',
    test: ({ projectKey, statGroup, statName, unit }) => (
      projectKey === 'varcad-io'
      && startsWith(statGroup, 'benchmark.varcad.')
      && (containsAny(statName, ['operations_per_second']) || unit === 'ops/s')
    ),
    lowerIsBetter: false,
    warningDeltaPct: 7,
    severeDeltaPct: 15,
  },
];

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : '';
}

function containsAny(value, tokens) {
  const normalizedValue = normalizeString(value);
  return tokens.some((token) => normalizedValue.includes(token));
}

function startsWith(value, prefix) {
  return normalizeString(value).startsWith(normalizeString(prefix));
}

function endsWith(value, suffix) {
  return normalizeString(value).endsWith(normalizeString(suffix));
}
