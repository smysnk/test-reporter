import { getWebSession } from '../../../../lib/auth.js';
import { requireGet, sendApiResource, sendUnexpectedApiError } from '../../../../lib/apiResponse.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../../lib/requestTrace.js';
import { loadCoverageFilePage } from '../../../../lib/serverGraphql.js';

export default async function handler(req, res) {
  const trace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, trace);
  if (!requireGet(req, res, trace.requestId)) return;
  try {
    const data = await loadCoverageFilePage({
      session: await getWebSession(req, res), runId: String(req.query.id || ''),
      after: typeof req.query.after === 'string' ? req.query.after : null,
      search: typeof req.query.search === 'string' ? req.query.search : null,
      below: typeof req.query.below === 'string' ? req.query.below : null,
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'lines-asc', requestTrace: trace,
    });
    return sendApiResource(res, data, { requestId: trace.requestId, cache: 'private, max-age=30, stale-while-revalidate=120' });
  } catch (error) {
    return sendUnexpectedApiError(res, error, trace.requestId, 'Unable to load coverage files.');
  }
}
