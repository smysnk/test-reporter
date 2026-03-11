export function isProtectedWebPath(pathname) {
  if (typeof pathname !== 'string' || pathname.length === 0) {
    return false;
  }

  return pathname === '/'
    || pathname.startsWith('/projects/')
    || pathname === '/projects'
    || pathname.startsWith('/runs/')
    || pathname === '/runs';
}

export function buildSignInRedirectUrl(callbackUrl) {
  const target = typeof callbackUrl === 'string' && callbackUrl.trim() ? callbackUrl : '/';
  return `/auth/signin?callbackUrl=${encodeURIComponent(target)}`;
}
