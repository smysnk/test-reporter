import { requireWebSession } from './auth.js';
import { buildAdminPageResult } from './pageProps.js';
import { ADMIN_PAGE_UNAUTHORIZED } from './serverGraphql.js';

export async function loadAdminServerPage({
  context,
  store,
  loader,
  selectedProjectSlug = null,
  dispatchers = {},
}) {
  const auth = await requireWebSession(context);
  if (auth.redirect) {
    return {
      redirect: auth.redirect,
    };
  }

  const requestId = typeof context.req.headers['x-request-id'] === 'string'
    ? context.req.headers['x-request-id']
    : null;

  const data = await loader({
    session: auth.session,
    requestId,
  });

  if (data === ADMIN_PAGE_UNAUTHORIZED || !data) {
    return {
      notFound: true,
    };
  }

  return buildAdminPageResult({
    store,
    session: auth.session,
    data,
    selectedProjectSlug,
    dispatchers,
  });
}
