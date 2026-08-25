import { getWebSession } from '../../../../../lib/auth.js';
import { requireGet, sendApiError, sendApiResource, sendUnexpectedApiError } from '../../../../../lib/apiResponse.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../../lib/requestTrace.js';
import { loadTestExplorerDetail } from '../../../../../lib/serverGraphql.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  try {
    const data = await loadTestExplorerDetail({
      session: await getWebSession(req, res), runId: String(req.query.id || ''),
      testExecutionId: String(req.query.testId || ''), requestTrace: trace,
    });
    if (!data) return sendApiError(res, { status: 404, code: 'TEST_NOT_FOUND', message: 'The requested test is not available in this run.', requestId: trace.requestId });
    return sendApiResource(res, data, { requestId: trace.requestId, cache: 'private, max-age=31536000, immutable' });
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load test detail.');
  }
}
