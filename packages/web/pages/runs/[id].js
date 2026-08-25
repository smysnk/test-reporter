import React from 'react';
import { RunWorkspace } from '../../components/workspaces/RunWorkspace.jsx';
import { getWebSession } from '../../lib/auth.js';
import { buildRunPageResult } from '../../lib/pageProps.js';
import { buildServerTimingHeader, createPageLoadProfiler } from '../../lib/pageProfiling.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../lib/requestTrace.js';
import { loadRunWorkspace } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function RunPage({ data }) {
  return React.createElement(RunWorkspace, { initialData: data });
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  const runId = typeof context.params?.id === 'string' ? context.params.id : '';
  if (context.query?.template === 'runner' || context.query?.template === 'web') {
    const { template: _template, ...query } = context.query;
    return {
      redirect: {
        destination: { pathname: `/runs/${runId}`, query: { ...query, view: context.query.template === 'runner' ? 'report' : 'summary' } },
        permanent: false,
      },
    };
  }
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const profiler = createPageLoadProfiler({ pageType:'run', route:`/runs/${runId}` });
  const data = await loadRunWorkspace({ session, runId, requestTrace, profiler });
  const pageProfile = profiler.finalize({ trace:requestTrace, runId, suiteCount:data?.run?.suites?.length || 0, artifactCount:data?.run?.artifacts?.length || 0 });
  const serverTiming = buildServerTimingHeader(pageProfile);
  if (serverTiming) context.res.setHeader('Server-Timing', serverTiming);
  return buildRunPageResult({
    store, session, runId, templateMode:'workspace', data, pageProfile,
    dispatchers:{ setViewMode, setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId },
  });
});
