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

function normalizeCallbackTarget(value) {
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
