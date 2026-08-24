import { getWebSession } from '../../../../lib/auth.js';
import { loadSuiteTests } from '../../../../lib/serverGraphql.js';
import { resolveWebRequestTrace, applyTraceHeadersToNextResponse } from '../../../../lib/requestTrace.js';
import { requireGet, readRequiredQueryString, sendApiError, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';

export default async function handler(req, res) {
  const requestTrace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, requestTrace);
  if (!requireGet(req, res, requestTrace.requestId)) return;
  const suiteRunId = readRequiredQueryString(req, res, 'suiteRunId', requestTrace.requestId);
  if (!suiteRunId) return;
  const runId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!runId) return sendApiError(res, 400, 'INVALID_REQUEST', 'Run id is required.', requestTrace.requestId);
  const session = await getWebSession(req, res);
  try {
    const data = await loadSuiteTests({
      session,
      runId,
      suiteRunId,
      limit: 100,
      after: typeof req.query.after === 'string' ? req.query.after : null,
      status: typeof req.query.status === 'string' ? req.query.status : null,
      search: typeof req.query.search === 'string' ? req.query.search : null,
      requestTrace,
    });
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (error) {
    return sendUnexpectedApiError(res, error, requestTrace.requestId, 'Unable to load suite tests.');
  }
}
