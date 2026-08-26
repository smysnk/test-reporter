import React from 'react';
import { OperationsOverview } from '../components/OperationsOverview.js';
import { getWebSession, logWebSessionProbe } from '../lib/auth.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../lib/requestTrace.js';
import { createPageLoadProfiler, buildServerTimingHeader } from '../lib/pageProfiling.js';
import { buildOverviewPageResult } from '../lib/pageProps.js';
import { loadWebHomePage } from '../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../store/index.js';

export default function WebIndexPage({ data }) {
  return React.createElement(OperationsOverview, { data });
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  logWebSessionProbe({ req: context.req, route: '/', session });
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const pageProfiler = createPageLoadProfiler({ pageType: 'overview', route: '/' });
  const data = await loadWebHomePage({
    session,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
    requestTrace,
    profiler: pageProfiler,
    cacheTtlMs: session ? 0 : 15_000,
  });
  const pageProfile = pageProfiler.finalize({
    trace: requestTrace,
    visibleProjectCount: Array.isArray(data?.projects) ? data.projects.length : 0,
    visibleRunCount: Array.isArray(data?.runs) ? data.runs.length : 0,
  });
  const serverTimingHeader = buildServerTimingHeader(pageProfile);
  if (serverTimingHeader && context.res && typeof context.res.setHeader === 'function') {
    context.res.setHeader('Server-Timing', serverTimingHeader);
    pageProfile.serverTiming = serverTimingHeader;
  }
  return buildOverviewPageResult({
    store,
    session,
    data,
    pageProfile,
    dispatchers: { setViewMode, setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId },
  });
});
