import React from 'react';
import { ProjectWorkspace } from '../../components/workspaces/ProjectWorkspace.jsx';
import { getWebSession } from '../../lib/auth.js';
import { buildProjectPageResult } from '../../lib/pageProps.js';
import { buildServerTimingHeader, createPageLoadProfiler } from '../../lib/pageProfiling.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../lib/requestTrace.js';
import { loadProjectExplorerPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function ProjectPage({ data }) {
  return React.createElement(ProjectWorkspace, { initialData: data });
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  const slug = typeof context.params?.slug === 'string' ? context.params.slug : '';
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const profiler = createPageLoadProfiler({ pageType:'project', route:`/projects/${slug}` });
  const data = await loadProjectExplorerPage({ session, slug, requestTrace, profiler });
  const pageProfile = profiler.finalize({ trace:requestTrace, projectSlug:data?.project?.slug || slug });
  const serverTiming = buildServerTimingHeader(pageProfile);
  if (serverTiming) context.res.setHeader('Server-Timing', serverTiming);
  return buildProjectPageResult({
    store, session, slug, data, pageProfile,
    dispatchers:{ setViewMode, setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId },
  });
});
