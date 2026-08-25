import React from 'react';
import { RunWorkspace } from '../../components/workspaces/RunWorkspace.jsx';
import { getWebSession } from '../../lib/auth.js';
import { buildRunPageResult } from '../../lib/pageProps.js';
import { buildServerTimingHeader, createPageLoadProfiler } from '../../lib/pageProfiling.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../lib/requestTrace.js';
import { buildTransientRunWorkspace, loadRunWorkspaceFallback } from '../../lib/serverGraphql.js';
import { buildLegacyRunWorkspaceDestination } from '../../lib/workspaceRouting.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function RunPage({ data }) {
  return React.createElement(RunWorkspace, { initialData: data });
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  const runId = typeof context.params?.id === 'string' ? context.params.id : '';
  if (context.query?.template === 'runner' || context.query?.template === 'web') {
    return {
      redirect: {
        destination: buildLegacyRunWorkspaceDestination(runId, context.query, context.query.template),
        permanent: false,
      },
    };
  }
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const profiler = createPageLoadProfiler({ pageType:'run', route:`/runs/${runId}` });
  let data;
  try {
    data = await loadRunWorkspaceFallback({ session, runId, requestTrace, profiler });
  } catch (error) {
    console.error(`[run-workspace:ssr-transient-shell] requestId=${requestTrace.requestId} runId=${runId} error=${error instanceof Error ? error.message : 'unknown'}`);
    data = buildTransientRunWorkspace(runId);
  }
  const pageProfile = profiler.finalize({ trace:requestTrace, runId, suiteCount:data?.run?.suites?.length || 0, artifactCount:data?.run?.artifacts?.length || 0 });
  const serverTiming = buildServerTimingHeader(pageProfile);
  if (serverTiming) context.res.setHeader('Server-Timing', serverTiming);
  return buildRunPageResult({
    store, session, runId, templateMode:'workspace', data, pageProfile,
    dispatchers:{ setViewMode, setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId },
  });
});
