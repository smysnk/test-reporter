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
    logGoogleCallbackRequest(req, 'incoming');

    try {
      return await nextAuthHandler(req, res, createAuthOptions());
    } catch (error) {
      logGoogleCallbackRequest(req, 'error', error);
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

function logGoogleCallbackRequest(req, stage, error = null) {
  if (!isGoogleCallbackRequest(req)) {
    return;
  }

  const cookieHeader = typeof req?.headers?.cookie === 'string' ? req.headers.cookie : '';
  const cookieNames = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split('=')[0])
    .filter(Boolean);
  const redactedUrl = redactGoogleCallbackUrl(typeof req?.url === 'string' ? req.url : '');
  const payload = {
    stage,
    url: redactedUrl,
    method: typeof req?.method === 'string' ? req.method : 'GET',
    host: headerValue(req, 'host'),
    forwardedHost: headerValue(req, 'x-forwarded-host'),
    forwardedProto: headerValue(req, 'x-forwarded-proto'),
    referer: headerValue(req, 'referer'),
    origin: headerValue(req, 'origin'),
    cookieHeaderPresent: Boolean(cookieHeader),
    cookieNames,
    hasSecureStateCookie: cookieNames.includes('__Secure-next-auth.state'),
    hasLegacyStateCookie: cookieNames.includes('next-auth.state'),
    hasSecurePkceCookie: cookieNames.includes('__Secure-next-auth.pkce.code_verifier'),
    hasLegacyPkceCookie: cookieNames.includes('next-auth.pkce.code_verifier'),
    hasSecureCallbackCookie: cookieNames.includes('__Secure-next-auth.callback-url'),
    hasCsrfCookie: cookieNames.includes('__Host-next-auth.csrf-token') || cookieNames.includes('next-auth.csrf-token'),
    queryKeys: extractGoogleCallbackQueryKeys(req),
  };

  if (error) {
    payload.error = {
      name: error?.name || null,
      message: error?.message || null,
      causeName: error?.cause?.name || null,
      causeMessage: error?.cause?.message || null,
    };
  }

  process.stderr.write(`[auth:google-callback] ${JSON.stringify(payload)}\n`);
}

function redactGoogleCallbackUrl(url) {
  if (!url) {
    return url;
  }

  try {
    const resolvedUrl = new URL(url, 'https://test-station.local');
    for (const key of ['code', 'state']) {
      if (resolvedUrl.searchParams.has(key)) {
        resolvedUrl.searchParams.set(key, '<redacted>');
      }
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}`;
  } catch {
    return url;
  }
}

function extractGoogleCallbackQueryKeys(req) {
  const url = typeof req?.url === 'string' ? req.url : '';
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return [];
  }

  try {
    return Array.from(new URLSearchParams(url.slice(queryIndex + 1)).keys());
  } catch {
    return [];
  }
}

function headerValue(req, name) {
  const value = req?.headers?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildExpiredCookie({ name, secure }) {
  return `${name}=; Path=/; Expires=${EXPIRED_COOKIE_TIMESTAMP}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export default createWebAuthHandler();
