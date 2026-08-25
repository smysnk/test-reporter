import { getWebSession } from '../../../../lib/auth.js';
import { requireGet, sendApiError, sendApiResource, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';
import { loadRunWorkspace } from '../../../../lib/serverGraphql.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  try {
    const data = await loadRunWorkspace({ session: await getWebSession(req, res), runId: String(req.query.id || ''), requestTrace: trace });
    if (!data) return sendApiError(res, { status: 404, code: 'RUN_NOT_FOUND', message: 'The requested run is not available.', requestId: trace.requestId });
    return sendApiResource(res, data, { requestId: trace.requestId });
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load run workspace.');
  }
}
