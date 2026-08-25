import { getWebSession } from '../../../../lib/auth.js';
import { requireGet, sendApiError, sendApiResource, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';
import { loadProjectActivity, loadProjectExplorerPage, loadWebRunFeedPage } from '../../../../lib/serverGraphql.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  try {
    const session = await getWebSession(req, res);
    const shell = await loadProjectExplorerPage({ session, slug: String(req.query.slug || ''), requestTrace: trace });
    if (!shell?.project) return sendApiError(res, { status: 404, code: 'PROJECT_NOT_FOUND', message: 'The requested project is not available.', requestId: trace.requestId });
    const [activity, runPage] = await Promise.all([
      loadProjectActivity({ session, projectKey: shell.project.key, requestTrace: trace }),
      loadWebRunFeedPage({ session, projectKey: shell.project.key, requestTrace: trace }),
    ]);
    const branches = [...new Set(runPage.runs.map((run) => run.branch).filter(Boolean))].sort();
    return sendApiResource(res, {
      project: shell.project,
      runs: runPage.runs,
      hasMoreRuns: runPage.hasMoreRuns,
      branches,
      coverageTrend: activity.coverageTrend,
      releaseNotes: activity.releaseNotes,
    }, { requestId: trace.requestId });
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load project workspace.');
  }
}
