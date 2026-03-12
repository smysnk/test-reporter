import { getWebSession } from '../../../../lib/auth.js';
import { buildSignInRedirectUrl } from '../../../../lib/routeProtection.js';
import { loadRunReportHtml } from '../../../../lib/serverGraphql.js';

export default async function webRunReportHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const session = await getWebSession(req, res);
  if (!session) {
    res.redirect(307, buildSignInRedirectUrl(resolveRunReportPath(req)));
    return;
  }

  const runId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!runId) {
    renderHtmlResponse(res, 400, renderStatusHtml({
      title: 'Run report unavailable',
      copy: 'A run identifier is required before the runner template can be rendered.',
    }));
    return;
  }

  try {
    const html = await loadRunReportHtml({
      session,
      runId,
      requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null,
    });

    if (!html) {
      renderHtmlResponse(res, 404, renderStatusHtml({
        title: 'Run report not found',
        copy: 'The requested execution could not be resolved from the reporting backend.',
      }));
      return;
    }

    renderHtmlResponse(res, 200, html);
  } catch (error) {
    renderHtmlResponse(res, 500, renderStatusHtml({
      title: 'Runner report failed to load',
      copy: error instanceof Error && error.message
        ? error.message
        : 'The runner template could not be rendered for this execution.',
    }));
  }
}

function resolveRunReportPath(req) {
  const runId = typeof req?.query?.id === 'string' && req.query.id.trim()
    ? req.query.id.trim()
    : '';
  return runId
    ? `/runs/${encodeURIComponent(runId)}?template=runner`
    : '/';
}

function renderHtmlResponse(res, statusCode, html) {
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.status(statusCode).send(html);
}

function renderStatusHtml({ title, copy }) {
  const safeTitle = escapeHtml(title || 'Runner report unavailable');
  const safeCopy = escapeHtml(copy || 'The requested content could not be loaded.');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f3efe6;
      color: #1e1a16;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    main {
      width: min(680px, calc(100vw - 32px));
      padding: 28px;
      border-radius: 24px;
      border: 1px solid #d6c9b2;
      background: #fffaf3;
      box-shadow: 0 20px 60px rgba(75, 48, 26, 0.12);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 2rem;
      line-height: 1;
    }
    p {
      margin: 0;
      line-height: 1.6;
      color: #6f6558;
    }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeCopy}</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
