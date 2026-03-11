import { getWebSession, buildWebActorHeaders } from '../../lib/auth.js';
import { resolveWebGraphqlUrl } from '../../lib/serverGraphql.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export default async function graphqlProxy(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      errors: [{
        message: 'Method Not Allowed',
      }],
    });
    return;
  }

  const session = await getWebSession(req, res);
  if (!session) {
    res.status(401).json({
      errors: [{
        message: 'Unauthorized',
        extensions: {
          code: 'UNAUTHORIZED',
        },
      }],
    });
    return;
  }

  const upstream = await fetch(resolveWebGraphqlUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...buildWebActorHeaders(session),
      ...(typeof req.headers['x-request-id'] === 'string' ? { 'x-request-id': req.headers['x-request-id'] } : {}),
    },
    body: JSON.stringify(req.body || {}),
  });

  const responseText = await upstream.text();
  res.status(upstream.status);
  res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  res.send(responseText);
}
