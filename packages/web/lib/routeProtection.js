export function isProtectedWebPath(pathname) {
  if (typeof pathname !== 'string' || pathname.length === 0) {
    return false;
  }

  return pathname === '/admin'
    || pathname.startsWith('/admin/');
}

export function buildSignInRedirectUrl(callbackUrl) {
  const target = normalizeCallbackTarget(callbackUrl);
  return `/auth/signin?callbackUrl=${encodeURIComponent(target)}`;
}

export function normalizeCallbackTarget(value) {
  const target = typeof value === 'string' && value.trim() ? value.trim() : '/';
  const normalizedTarget = normalizeCallbackTargetValue(target);

  if (normalizedTarget.startsWith('/')) {
    return isUnsafeAuthCallbackTarget(normalizedTarget) ? '/' : normalizedTarget;
  }

  try {
    const url = new URL(normalizedTarget);
    const pathTarget = `${url.pathname}${url.search}${url.hash}` || '/';
    return isUnsafeAuthCallbackTarget(pathTarget) ? '/' : pathTarget;
  } catch {
    return '/';
  }
}

function normalizeCallbackTargetValue(value) {
  if (typeof value !== 'string') {
    return '/';
  }

  return value.trim() || '/';
}

function isUnsafeAuthCallbackTarget(target) {
  return target === '/auth/signin'
    || target.startsWith('/auth/signin?')
    || target === '/auth/error'
    || target.startsWith('/auth/error?')
    || target === '/api/auth'
    || target.startsWith('/api/auth/');
}
