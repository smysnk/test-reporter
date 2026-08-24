import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const requestProfileStorage = new AsyncLocalStorage();
const runtimeMetrics = new Map();

export function runWithRequestProfile(input, callback) {
  const profile = createRequestProfile(input);
  return requestProfileStorage.run(profile, callback);
}

export function getRequestProfile() {
  return requestProfileStorage.getStore() || null;
}

export async function measureProfileStage(name, callback, details = null) {
  const profile = getRequestProfile();
  const startedAt = performance.now();
  const previousSpan = profile?.activeSpan || null;
  if (profile) profile.activeSpan = normalizeMetricName(name);

  try {
    const value = await callback();
    recordStage(profile, name, performance.now() - startedAt, 'ok', resolveDetails(details, value));
    return value;
  } catch (error) {
    recordStage(profile, name, performance.now() - startedAt, 'error', {
      ...resolveDetails(details),
      errorCategory: normalizeErrorCategory(error),
    });
    throw error;
  } finally {
    if (profile) profile.activeSpan = previousSpan;
  }
}

export function recordDatabaseQuery(durationMs, details = {}) {
  const profile = getRequestProfile();
  const normalizedDuration = finiteNumber(durationMs) || 0;
  if (profile) {
    profile.database.queryCount += 1;
    profile.database.durationMs += normalizedDuration;
    profile.database.rows += finiteNumber(details.rows) || 0;
    profile.database.operations[normalizeMetricName(details.name || profile.activeSpan || 'unattributed')] = (
      profile.database.operations[normalizeMetricName(details.name || profile.activeSpan || 'unattributed')] || 0
    ) + normalizedDuration;
  }
  observeRuntimeMetric('test_station_database_query_duration_ms', normalizedDuration, {
    operation: normalizeMetricName(details.name || profile?.activeSpan || 'unattributed'),
  });
}

export function recordPoolWait(durationMs) {
  const normalizedDuration = finiteNumber(durationMs) || 0;
  const profile = getRequestProfile();
  if (profile) {
    profile.database.poolAcquireCount += 1;
    profile.database.poolWaitMs += normalizedDuration;
  }
  observeRuntimeMetric('test_station_database_pool_wait_ms', normalizedDuration);
}

export function recordDatabaseTimeout() {
  const profile = getRequestProfile();
  if (profile) profile.database.timeoutCount += 1;
  incrementRuntimeMetric('test_station_database_timeouts_total');
}

export function recordCacheOutcome(cacheName, outcome, details = {}) {
  const normalizedCache = normalizeMetricName(cacheName || 'unknown');
  const normalizedOutcome = normalizeMetricName(outcome || 'unknown');
  const profile = getRequestProfile();
  if (profile) {
    profile.cache.push({
      cache: normalizedCache,
      outcome: normalizedOutcome,
      durationMs: finiteNumber(details.durationMs),
      bytes: finiteNumber(details.bytes),
    });
  }
  incrementRuntimeMetric('test_station_cache_outcomes_total', {
    cache: normalizedCache,
    outcome: normalizedOutcome,
  });
  if (Number.isFinite(details.durationMs)) {
    observeRuntimeMetric('test_station_cache_operation_duration_ms', details.durationMs, {
      cache: normalizedCache,
      outcome: normalizedOutcome,
    });
  }
}

export function recordProjectionLag(durationMs) {
  const normalized = Math.max(0, finiteNumber(durationMs) || 0);
  setRuntimeGauge('test_station_projection_lag_ms', normalized);
}

export function recordIngestOutcome(outcome, details = {}) {
  const normalizedOutcome = normalizeMetricName(outcome || 'unknown');
  incrementRuntimeMetric('test_station_ingest_requests_total', { outcome: normalizedOutcome });
  if (Number.isFinite(details.durationMs)) {
    observeRuntimeMetric('test_station_ingest_duration_ms', details.durationMs, { outcome: normalizedOutcome });
  }
  if (Number.isFinite(details.payloadBytes)) {
    observeRuntimeMetric('test_station_ingest_payload_bytes', details.payloadBytes, { outcome: normalizedOutcome });
  }
  if (Number.isFinite(details.heapDeltaBytes)) {
    observeRuntimeMetric('test_station_ingest_heap_delta_bytes', details.heapDeltaBytes, { outcome: normalizedOutcome });
  }
}

export function finalizeRequestProfile(details = {}) {
  const profile = getRequestProfile();
  if (!profile || profile.finishedAtMs !== null) return profile;
  profile.finishedAtMs = performance.now();
  profile.durationMs = round(profile.finishedAtMs - profile.startedAtMs);
  profile.statusCode = Number.isInteger(details.statusCode) ? details.statusCode : null;
  profile.responseBytes = finiteNumber(details.responseBytes);
  profile.errorCategory = details.errorCategory || null;
  const outcome = profile.statusCode >= 500 || profile.errorCategory ? 'error' : 'ok';
  incrementRuntimeMetric('test_station_http_requests_total', {
    route: profile.route,
    method: profile.method,
    outcome,
  });
  observeRuntimeMetric('test_station_http_request_duration_ms', profile.durationMs, {
    route: profile.route,
    method: profile.method,
    outcome,
  });
  if (Number.isFinite(profile.responseBytes)) {
    observeRuntimeMetric('test_station_http_response_bytes', profile.responseBytes, {
      route: profile.route,
      method: profile.method,
    });
  }
  return profile;
}

export function summarizeRequestProfile(profile = getRequestProfile()) {
  if (!profile) return null;
  return {
    traceId: profile.traceId,
    requestId: profile.requestId,
    route: profile.route,
    method: profile.method,
    operationName: profile.operationName,
    durationMs: round(profile.durationMs ?? (performance.now() - profile.startedAtMs)),
    statusCode: profile.statusCode,
    responseBytes: profile.responseBytes,
    database: {
      queryCount: profile.database.queryCount,
      durationMs: round(profile.database.durationMs),
      rows: profile.database.rows,
      poolAcquireCount: profile.database.poolAcquireCount,
      poolWaitMs: round(profile.database.poolWaitMs),
      timeoutCount: profile.database.timeoutCount,
      operations: Object.fromEntries(
        Object.entries(profile.database.operations).map(([name, value]) => [name, round(value)]),
      ),
    },
    stages: profile.stages.map((stage) => ({ ...stage })),
    cache: profile.cache.map((entry) => ({ ...entry })),
    errorCategory: profile.errorCategory,
  };
}

export function setProfileOperationName(name) {
  const profile = getRequestProfile();
  if (profile) profile.operationName = normalizeMetricName(name || 'anonymous');
}

export function incrementRuntimeMetric(name, labels = {}, amount = 1) {
  const metric = getOrCreateRuntimeMetric(name, labels, 'counter');
  metric.value += finiteNumber(amount) || 0;
}

export function setRuntimeGauge(name, value, labels = {}) {
  const metric = getOrCreateRuntimeMetric(name, labels, 'gauge');
  metric.value = finiteNumber(value) || 0;
}

export function observeRuntimeMetric(name, value, labels = {}) {
  const normalized = finiteNumber(value);
  if (!Number.isFinite(normalized)) return;
  const metric = getOrCreateRuntimeMetric(name, labels, 'histogram');
  metric.count += 1;
  metric.sum += normalized;
  metric.max = metric.count === 1 ? normalized : Math.max(metric.max, normalized);
}

export function getRuntimeMetricsSnapshot() {
  return Array.from(runtimeMetrics.values()).map((metric) => ({
    ...metric,
    labels: { ...metric.labels },
    ...(metric.type === 'histogram' ? {
      average: metric.count > 0 ? round(metric.sum / metric.count) : 0,
      sum: round(metric.sum),
      max: round(metric.max),
    } : {}),
  }));
}

export function renderPrometheusMetrics() {
  const lines = [];
  for (const metric of getRuntimeMetricsSnapshot().sort((left, right) => left.name.localeCompare(right.name))) {
    const labels = formatLabels(metric.labels);
    if (metric.type === 'histogram') {
      lines.push(`${metric.name}_count${labels} ${metric.count}`);
      lines.push(`${metric.name}_sum${labels} ${metric.sum}`);
      lines.push(`${metric.name}_max${labels} ${metric.max}`);
    } else {
      lines.push(`${metric.name}${labels} ${metric.value}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function resetRuntimeMetrics() {
  runtimeMetrics.clear();
}

function createRequestProfile(input = {}) {
  return {
    requestId: input.requestId || null,
    traceId: input.traceId || null,
    route: normalizeRoute(input.route),
    method: String(input.method || 'UNKNOWN').toUpperCase(),
    operationName: null,
    startedAtMs: performance.now(),
    finishedAtMs: null,
    durationMs: null,
    statusCode: null,
    responseBytes: null,
    activeSpan: null,
    database: {
      queryCount: 0,
      durationMs: 0,
      rows: 0,
      poolAcquireCount: 0,
      poolWaitMs: 0,
      timeoutCount: 0,
      operations: {},
    },
    stages: [],
    cache: [],
    errorCategory: null,
  };
}

function recordStage(profile, name, durationMs, outcome, details) {
  const normalizedName = normalizeMetricName(name);
  const normalizedDuration = round(durationMs);
  if (profile) {
    profile.stages.push({
      name: normalizedName,
      durationMs: normalizedDuration,
      outcome,
      details: details || null,
    });
  }
  observeRuntimeMetric('test_station_stage_duration_ms', normalizedDuration, {
    stage: normalizedName,
    outcome,
  });
}

function getOrCreateRuntimeMetric(name, labels, type) {
  const normalizedName = normalizePrometheusName(name);
  const normalizedLabels = Object.fromEntries(
    Object.entries(labels || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => [normalizePrometheusName(key), normalizeLabelValue(value)]),
  );
  const key = `${normalizedName}\0${JSON.stringify(normalizedLabels)}`;
  if (!runtimeMetrics.has(key)) {
    runtimeMetrics.set(key, {
      name: normalizedName,
      type,
      labels: normalizedLabels,
      ...(type === 'histogram' ? { count: 0, sum: 0, max: 0 } : { value: 0 }),
    });
  }
  return runtimeMetrics.get(key);
}

function resolveDetails(details, value) {
  if (typeof details === 'function') return sanitizeDetails(details(value));
  return sanitizeDetails(details);
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  return Object.fromEntries(
    Object.entries(details)
      .filter(([key, value]) => !/(secret|token|password|report|failure|user|email|sql|bind)/i.test(key) && value !== undefined)
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 120) : value]),
  );
}

function normalizeErrorCategory(error) {
  const code = error?.code || error?.name || 'error';
  return normalizeMetricName(code);
}

function normalizeRoute(value) {
  const route = String(value || 'unknown').split('?')[0];
  return route
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/runs\/[^/]+/g, '/runs/:id')
    .replace(/\/projects\/[^/]+/g, '/projects/:slug')
    .slice(0, 160);
}

function normalizeMetricName(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'unknown';
}

function normalizePrometheusName(value) {
  return String(value || 'metric').replace(/[^a-zA-Z0-9_:]/g, '_');
}

function normalizeLabelValue(value) {
  return String(value).slice(0, 120);
}

function formatLabels(labels) {
  const entries = Object.entries(labels || {});
  if (entries.length === 0) return '';
  return `{${entries.map(([key, value]) => `${key}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}
