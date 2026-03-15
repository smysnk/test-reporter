import { performance } from 'node:perf_hooks';
import {
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  PARENT_REQUEST_ID_HEADER,
  resolveIncomingTraceContext,
  buildTraceHeaders,
} from '../../config/request-trace.mjs';

export function resolveServerRequestTrace(req) {
  return resolveIncomingTraceContext({
    headers: req?.headers || {},
    cookieHeader: typeof req?.headers?.cookie === 'string' ? req.headers.cookie : '',
    requestIdPrefix: 'srvreq',
    traceIdPrefix: 'trace',
  });
}

export function applyTraceHeadersToNodeResponse(res, traceContext, extraHeaders = {}) {
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

export function appendServerTimingHeader(target, entry) {
  if (!entry) {
    return;
  }

  const normalizedEntry = String(entry).trim();
  if (!normalizedEntry) {
    return;
  }

  const existing = getHeaderValue(target, 'server-timing');
  const nextValue = existing ? `${existing}, ${normalizedEntry}` : normalizedEntry;

  if (target?.http?.headers && typeof target.http.headers.set === 'function') {
    target.http.headers.set('server-timing', nextValue);
    return;
  }

  if (typeof target?.setHeader === 'function') {
    target.setHeader('server-timing', nextValue);
  }
}

export function createGraphqlTracePlugin() {
  return {
    async requestDidStart() {
      const startedAt = performance.now();

      return {
        async willSendResponse(requestContext) {
          const durationMs = roundMetric(performance.now() - startedAt);
          const traceContext = requestContext.contextValue?.requestTrace || null;
          const operationName = requestContext.operationName || null;
          const serverTimingEntry = `graphql;dur=${durationMs}`;

          if (requestContext.response?.http?.headers && traceContext) {
            for (const [name, value] of Object.entries(buildTraceHeaders(traceContext))) {
              if (value) {
                requestContext.response.http.headers.set(name, value);
              }
            }
          }

          appendServerTimingHeader(requestContext.response, serverTimingEntry);

          if (requestContext.response?.body?.kind === 'single') {
            requestContext.response.body.singleResult.extensions = {
              ...(requestContext.response.body.singleResult.extensions || {}),
              testStationTrace: {
                requestId: traceContext?.requestId || null,
                traceId: traceContext?.traceId || null,
                parentRequestId: traceContext?.parentRequestId || null,
                operationName,
                durationMs,
              },
            };
          }
        },
      };
    },
  };
}

function getHeaderValue(target, name) {
  if (target?.http?.headers && typeof target.http.headers.get === 'function') {
    return target.http.headers.get(name);
  }

  return null;
}

function roundMetric(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

export {
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  PARENT_REQUEST_ID_HEADER,
};
