export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-test-station-trace-id';
export const PARENT_REQUEST_ID_HEADER = 'x-test-station-parent-request-id';
export const UPSTREAM_REQUEST_ID_HEADER = 'x-test-station-upstream-request-id';
export const UPSTREAM_TRACE_ID_HEADER = 'x-test-station-upstream-trace-id';
export const UPSTREAM_PARENT_REQUEST_ID_HEADER = 'x-test-station-upstream-parent-request-id';
export const TRACE_COOKIE_NAME = '__test_station_trace';

export function normalizeTraceValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function generateTraceIdentifier(prefix = 'ts') {
  const base = generateOpaqueId();
  return `${prefix}-${base}`;
}

export function resolveIncomingTraceContext({
  headers = {},
  cookieHeader = '',
  fallbackRequestId = null,
  fallbackTraceId = null,
  requestIdPrefix = 'req',
  traceIdPrefix = 'trace',
} = {}) {
  const requestId = normalizeTraceValue(readHeaderValue(headers, REQUEST_ID_HEADER))
    || normalizeTraceValue(fallbackRequestId)
    || generateTraceIdentifier(requestIdPrefix);
  const cookies = parseCookieHeader(cookieHeader);
  const traceId = normalizeTraceValue(readHeaderValue(headers, TRACE_ID_HEADER))
    || normalizeTraceValue(cookies[TRACE_COOKIE_NAME])
    || normalizeTraceValue(fallbackTraceId)
    || requestId
    || generateTraceIdentifier(traceIdPrefix);
  const parentRequestId = normalizeTraceValue(readHeaderValue(headers, PARENT_REQUEST_ID_HEADER));

  return {
    requestId,
    traceId,
    parentRequestId,
  };
}

export function createChildTraceContext(parentTrace = null, { requestIdPrefix = 'req' } = {}) {
  return {
    requestId: generateTraceIdentifier(requestIdPrefix),
    traceId: normalizeTraceValue(parentTrace?.traceId) || generateTraceIdentifier('trace'),
    parentRequestId: normalizeTraceValue(parentTrace?.requestId) || normalizeTraceValue(parentTrace?.parentRequestId) || null,
  };
}

export function buildTraceHeaders(traceContext = null) {
  const requestId = normalizeTraceValue(traceContext?.requestId);
  const traceId = normalizeTraceValue(traceContext?.traceId);
  const parentRequestId = normalizeTraceValue(traceContext?.parentRequestId);

  return {
    ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
    ...(traceId ? { [TRACE_ID_HEADER]: traceId } : {}),
    ...(parentRequestId ? { [PARENT_REQUEST_ID_HEADER]: parentRequestId } : {}),
  };
}

export function extractTraceContextFromHeaders(headers = {}) {
  const requestId = normalizeTraceValue(readHeaderValue(headers, REQUEST_ID_HEADER));
  const traceId = normalizeTraceValue(readHeaderValue(headers, TRACE_ID_HEADER));
  const parentRequestId = normalizeTraceValue(readHeaderValue(headers, PARENT_REQUEST_ID_HEADER));

  if (!requestId && !traceId && !parentRequestId) {
    return null;
  }

  return {
    requestId,
    traceId,
    parentRequestId,
  };
}

export function parseCookieHeader(cookieHeader = '') {
  if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) {
    return {};
  }

  const cookiePairs = cookieHeader.split(';');
  const cookies = {};
  for (const cookiePair of cookiePairs) {
    const separatorIndex = cookiePair.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function serializeTraceCookie(traceId, maxAgeSeconds = 120) {
  const normalizedTraceId = normalizeTraceValue(traceId);
  if (!normalizedTraceId) {
    return `${TRACE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  }

  return `${TRACE_COOKIE_NAME}=${encodeURIComponent(normalizedTraceId)}; Path=/; Max-Age=${Math.max(1, Number(maxAgeSeconds) || 120)}; SameSite=Lax`;
}

export function readHeaderValue(headers = {}, name) {
  const normalizedName = String(name || '').toLowerCase();
  if (!normalizedName) {
    return null;
  }

  if (headers && typeof headers.get === 'function') {
    return normalizeTraceValue(headers.get(normalizedName) || headers.get(name));
  }

  const rawValue = headers?.[normalizedName] ?? headers?.[name];
  if (Array.isArray(rawValue)) {
    return normalizeTraceValue(rawValue[0]);
  }

  return normalizeTraceValue(rawValue);
}

function generateOpaqueId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replaceAll('-', '');
  }

  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buffer = new Uint8Array(16);
    globalThis.crypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`;
}
