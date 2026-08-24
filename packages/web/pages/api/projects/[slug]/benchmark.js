import { getWebSession } from '../../../../lib/auth.js';
import { readRequiredQueryString, requireGet, sendApiError, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';
import { loadProjectBenchmarkNamespace, loadProjectExplorerPage } from '../../../../lib/serverGraphql.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  const slug = readRequiredQueryString(req, res, 'slug', trace.requestId);
  const statGroup = readRequiredQueryString(req, res, 'statGroup', trace.requestId);
  if (!slug || !statGroup) return;
  try {
    const session = await getWebSession(req, res);
    const shell = await loadProjectExplorerPage({ session, slug, requestTrace: trace });
    if (!shell?.project) return sendApiError(res, { status: 404, code: 'PROJECT_NOT_FOUND', message: 'The requested project is not available.', requestId: trace.requestId });
    const data = await loadProjectBenchmarkNamespace({ session, projectKey: shell.project.key, statGroup, requestTrace: trace });
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load benchmark namespace.');
  }
}
