const state = globalThis.__testStationWebMetrics || {
  counters: new Map(),
  totals: new Map(),
  counts: new Map(),
};
globalThis.__testStationWebMetrics = state;

export function incrementWebCounter(name, labels = {}) {
  const key = metricKey(name, labels);
  state.counters.set(key, (state.counters.get(key) || 0) + 1);
}

export function observeWebDuration(name, valueMs, labels = {}) {
  if (!Number.isFinite(valueMs)) return;
  const key = metricKey(name, labels);
  state.totals.set(key, (state.totals.get(key) || 0) + valueMs);
  state.counts.set(key, (state.counts.get(key) || 0) + 1);
}

export function renderWebPrometheusMetrics() {
  const lines = [];
  for (const [key, value] of state.counters) lines.push(`${key} ${value}`);
  for (const [key, value] of state.totals) lines.push(`${key}_sum ${value}`);
  for (const [key, value] of state.counts) lines.push(`${key}_count ${value}`);
  return `${lines.sort().join('\n')}\n`;
}

function metricKey(name, labels) {
  const safeName = String(name).replace(/[^a-zA-Z0-9_:]/g, '_');
  const pairs = Object.entries(labels)
    .filter(([, value]) => value !== null && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${String(key).replace(/[^a-zA-Z0-9_]/g, '_')}="${String(value).replace(/["\\\n]/g, '_')}"`);
  return pairs.length ? `${safeName}{${pairs.join(',')}}` : safeName;
}
