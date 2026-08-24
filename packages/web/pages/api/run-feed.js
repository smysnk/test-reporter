import { getWebSession } from '../../lib/auth.js';
import { loadWebRunFeedPage } from '../../lib/serverGraphql.js';
import { resolveWebRequestTrace, applyTraceHeadersToNextResponse } from '../../lib/requestTrace.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getWebSession(req, res);
  const requestTrace = resolveWebRequestTrace(req);
  applyTraceHeadersToNextResponse(res, requestTrace);
  try {
    const page = await loadWebRunFeedPage({
      session,
      after: typeof req.query.after === 'string' ? req.query.after : null,
      projectKey: typeof req.query.projectKey === 'string' ? req.query.projectKey : null,
      requestTrace,
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(page);
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      error: error instanceof Error ? error.message : 'Unable to load run feed',
    });
  }
}
