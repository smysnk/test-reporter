export function buildSignedOutRedirectUrl() {
  return '/';
}

export function buildAuthErrorUrl({ callbackUrl = '/', error = 'AuthError', requestId = null } = {}) {
  const params = new URLSearchParams({
    callbackUrl: normalizeAuthCallbackTarget(callbackUrl),
    error: typeof error === 'string' && error.trim() ? error.trim() : 'AuthError',
  });

  if (typeof requestId === 'string' && requestId.trim()) {
    params.set('requestId', requestId.trim());
  }

  return `/auth/error?${params.toString()}`;
}

function normalizeAuthCallbackTarget(value) {
  const target = typeof value === 'string' && value.trim() ? value.trim() : '/';

  if (target.startsWith('/')) {
    return target;
  }

  try {
    const url = new URL(target);
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return '/';
  }
}
