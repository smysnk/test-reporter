import { getWebSession } from '../../../../lib/auth.js';
import { loadRunPerformance } from '../../../../lib/serverGraphql.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';
import { requireGet, sendApiResource, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  try {
    const session = await getWebSession(req, res);
    const data = await loadRunPerformance({
      session,
      runId: String(req.query.id || ''),
      requestTrace: trace,
    });
    return sendApiResource(res, data, { requestId: trace.requestId, cache: 'private, max-age=15, stale-while-revalidate=60' });
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load run performance.');
  }
}
