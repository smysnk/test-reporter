import { normalizeCallbackTarget } from './routeProtection.js';

export function buildSignedOutRedirectUrl() {
  return '/';
}

export function buildAuthErrorUrl({ callbackUrl = '/', error = 'AuthError', requestId = null } = {}) {
  const params = new URLSearchParams({
    callbackUrl: normalizeCallbackTarget(callbackUrl),
    error: typeof error === 'string' && error.trim() ? error.trim() : 'AuthError',
  });

  if (typeof requestId === 'string' && requestId.trim()) {
    params.set('requestId', requestId.trim());
  }

  return `/auth/error?${params.toString()}`;
}
