import { getWebSession } from '../../../../lib/auth.js';
import { loadRunOperationsData } from '../../../../lib/serverGraphql.js';
import { resolveWebRequestTrace, applyTraceHeadersToNextResponse } from '../../../../lib/requestTrace.js';
import { requireGet, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';

export default async function handler(req, res) {
  const requestTrace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, requestTrace);
  if (!requireGet(req, res, requestTrace.requestId)) return;
  const session = await getWebSession(req, res);
  try {
    const data = await loadRunOperationsData({
      session,
      runId: String(req.query.id || ''),
      requestTrace,
    });
    res.setHeader('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (error) {
    return sendUnexpectedApiError(res, error, requestTrace.requestId, 'Unable to load run operations.');
  }
}
