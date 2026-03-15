import {
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  PARENT_REQUEST_ID_HEADER,
  UPSTREAM_REQUEST_ID_HEADER,
  UPSTREAM_TRACE_ID_HEADER,
  UPSTREAM_PARENT_REQUEST_ID_HEADER,
  resolveIncomingTraceContext,
  createChildTraceContext,
  buildTraceHeaders,
  extractTraceContextFromHeaders,
  readHeaderValue,
} from '../../../config/request-trace.mjs';

export function resolveWebRequestTrace(req) {
  return req?.testStationTrace || resolveIncomingTraceContext({
    headers: req?.headers || {},
    cookieHeader: typeof req?.headers?.cookie === 'string' ? req.headers.cookie : '',
    requestIdPrefix: 'webreq',
    traceIdPrefix: 'trace',
  });
}

export function createWebChildTrace(parentTrace, requestIdPrefix = 'webcall') {
  return createChildTraceContext(parentTrace, { requestIdPrefix });
}

export function createStandaloneWebTrace(requestId = null, requestIdPrefix = 'webcall') {
  return resolveIncomingTraceContext({
    headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : {},
    fallbackRequestId: requestId,
    fallbackTraceId: requestId,
    requestIdPrefix,
    traceIdPrefix: 'trace',
  });
}

export function applyTraceHeadersToNextResponse(res, traceContext, extraHeaders = {}) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }

  const headers = {
    ...buildTraceHeaders(traceContext),
    ...extraHeaders,
  };

  for (const [name, value] of Object.entries(headers)) {
    if (value) {
      res.setHeader(name, value);
    }
  }
}

export function extractTraceResponseMeta(headers) {
  return {
    trace: extractTraceContextFromHeaders(headers),
    serverTiming: readHeaderValue(headers, 'server-timing'),
    upstreamRequestId: readHeaderValue(headers, UPSTREAM_REQUEST_ID_HEADER),
    upstreamTraceId: readHeaderValue(headers, UPSTREAM_TRACE_ID_HEADER),
    upstreamParentRequestId: readHeaderValue(headers, UPSTREAM_PARENT_REQUEST_ID_HEADER),
  };
}

export {
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  PARENT_REQUEST_ID_HEADER,
  UPSTREAM_REQUEST_ID_HEADER,
  UPSTREAM_TRACE_ID_HEADER,
  UPSTREAM_PARENT_REQUEST_ID_HEADER,
  buildTraceHeaders,
};
