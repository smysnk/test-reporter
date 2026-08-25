import { getWebSession } from '../../../../lib/auth.js';
import { requireGet, sendApiError, sendApiResource, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';
import { loadProjectExplorerPage, loadWebRunFeedPage } from '../../../../lib/serverGraphql.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  try {
    const session = await getWebSession(req, res);
    const shell = await loadProjectExplorerPage({ session, slug: String(req.query.slug || ''), requestTrace: trace });
    if (!shell?.project) return sendApiError(res, { status: 404, code: 'PROJECT_NOT_FOUND', message: 'The requested project is not available.', requestId: trace.requestId });
    const page = await loadWebRunFeedPage({
      session, projectKey: shell.project.key,
      after: typeof req.query.after === 'string' ? req.query.after : null, requestTrace: trace,
      status: typeof req.query.status === 'string' ? req.query.status : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      search: typeof req.query.search === 'string' ? req.query.search : null,
    });
    return sendApiResource(res, page, { requestId: trace.requestId });
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load project runs.');
  }
}
