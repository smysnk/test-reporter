import { getWebSession, buildWebActorHeaders } from '../../lib/auth.js';
import {
  UPSTREAM_REQUEST_ID_HEADER,
  UPSTREAM_TRACE_ID_HEADER,
  UPSTREAM_PARENT_REQUEST_ID_HEADER,
  applyTraceHeadersToNextResponse,
  buildTraceHeaders,
  createWebChildTrace,
  extractTraceResponseMeta,
  resolveWebRequestTrace,
} from '../../lib/requestTrace.js';
import { resolveWebGraphqlUrl } from '../../lib/serverGraphql.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export function createGraphqlProxyHandler({ getSession = getWebSession, fetchImpl = fetch } = {}) {
  return async function graphqlProxy(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({
        errors: [{
          message: 'Method Not Allowed',
        }],
      });
      return;
    }

    const session = await getSession(req, res);
    const requestTrace = resolveWebRequestTrace(req);
    const upstreamTrace = createWebChildTrace(requestTrace, 'webproxy');
    applyTraceHeadersToNextResponse(res, requestTrace);
    const upstream = await fetchImpl(resolveWebGraphqlUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...buildWebActorHeaders(session),
        ...buildTraceHeaders(upstreamTrace),
      },
      body: JSON.stringify(req.body || {}),
    });

    const responseText = await upstream.text();
    const upstreamResponseMeta = extractTraceResponseMeta(upstream.headers);
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    if (upstreamResponseMeta.serverTiming) {
      res.setHeader('server-timing', upstreamResponseMeta.serverTiming);
    }
    if (upstreamResponseMeta.trace?.requestId) {
      res.setHeader(UPSTREAM_REQUEST_ID_HEADER, upstreamResponseMeta.trace.requestId);
    }
    if (upstreamResponseMeta.trace?.traceId) {
      res.setHeader(UPSTREAM_TRACE_ID_HEADER, upstreamResponseMeta.trace.traceId);
    }
    if (upstreamResponseMeta.trace?.parentRequestId) {
      res.setHeader(UPSTREAM_PARENT_REQUEST_ID_HEADER, upstreamResponseMeta.trace.parentRequestId);
    }
    res.send(responseText);
  };
}

export default createGraphqlProxyHandler();
