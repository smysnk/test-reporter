import { getWebSession } from '../../../../lib/auth.js';
import { readRequiredQueryString, requireGet, sendApiError, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';
import { loadProjectActivity, loadProjectExplorerPage } from '../../../../lib/serverGraphql.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';

export default async function handler(req, res) {
  const requestTrace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, requestTrace);
  if (!requireGet(req, res, requestTrace.requestId)) return;
  const slug = readRequiredQueryString(req, res, 'slug', requestTrace.requestId);
  if (!slug) return;

  try {
    const session = await getWebSession(req, res);
    const shell = await loadProjectExplorerPage({ session, slug, requestTrace });
    if (!shell?.project) {
      sendApiError(res, {
        status: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'The requested project is not available.',
        requestId: requestTrace.requestId,
      });
      return;
    }
    const data = await loadProjectActivity({
      session,
      projectKey: shell.project.key,
      requestTrace,
    });
    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (error) {
    sendUnexpectedApiError(res, error, requestTrace.requestId, 'Unable to load project activity.');
  }
}
