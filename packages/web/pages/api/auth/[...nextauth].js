import '../../../lib/nextAuthEnv.js';
import NextAuth from 'next-auth';
import { createAuthOptions } from '../../../lib/auth.js';
import { buildSignInRedirectUrl } from '../../../lib/routeProtection.js';

const EXPIRED_COOKIE_TIMESTAMP = 'Thu, 01 Jan 1970 00:00:00 GMT';
const RECOVERABLE_AUTH_COOKIE_NAMES = [
  { name: 'next-auth.session-token', secure: false },
  { name: '__Secure-next-auth.session-token', secure: true },
  { name: '__Host-next-auth.csrf-token', secure: true },
  { name: 'next-auth.csrf-token', secure: false },
  { name: '__Secure-next-auth.callback-url', secure: true },
  { name: 'next-auth.callback-url', secure: false },
  { name: '__Secure-next-auth.state', secure: true },
  { name: 'next-auth.state', secure: false },
  { name: '__Secure-next-auth.pkce.code_verifier', secure: true },
  { name: 'next-auth.pkce.code_verifier', secure: false },
];

export function resolveNextAuthHandler() {
  if (typeof NextAuth === 'function') {
    return NextAuth;
  }

  if (NextAuth && typeof NextAuth.default === 'function') {
    return NextAuth.default;
  }

  if (NextAuth?.default && typeof NextAuth.default.default === 'function') {
    return NextAuth.default.default;
  }

  throw new TypeError('Invalid NextAuth export shape.');
}

export function createWebAuthHandler(nextAuthHandler = resolveNextAuthHandler()) {
  return async function webAuth(req, res) {
    try {
      return await nextAuthHandler(req, res, createAuthOptions());
    } catch (error) {
      if (handleRecoverableOAuthCallbackError(req, res, error)) {
        return undefined;
      }
      throw error;
    }
  };
}

export function isRecoverableOAuthCallbackError(req, error) {
  if (!isGoogleCallbackRequest(req)) {
    return false;
  }

  const errorText = [
    error?.name,
    error?.message,
    error?.cause?.name,
    error?.cause?.message,
  ]
    .filter(Boolean)
    .join(' ');

  return /oauthcallbackerror|invalid_grant/i.test(errorText);
}

export function handleRecoverableOAuthCallbackError(req, res, error) {
  if (!isRecoverableOAuthCallbackError(req, error)) {
    return false;
  }

  const location = `${buildSignInRedirectUrl('/')}&error=OAuthCallback`;
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Set-Cookie', RECOVERABLE_AUTH_COOKIE_NAMES.map(buildExpiredCookie));
  res.end();
  return true;
}

function isGoogleCallbackRequest(req) {
  const url = typeof req?.url === 'string' ? req.url : '';
  return url.startsWith('/api/auth/callback/google');
}

function buildExpiredCookie({ name, secure }) {
  return `${name}=; Path=/; Expires=${EXPIRED_COOKIE_TIMESTAMP}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export default createWebAuthHandler();
