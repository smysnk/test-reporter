import crypto from 'node:crypto';
import '../../../lib/nextAuthEnv.js';
import NextAuth from 'next-auth';
import { createAuthOptions } from '../../../lib/auth.js';
import { buildAuthErrorUrl } from '../../../lib/authRoutes.js';

const EXPIRED_COOKIE_TIMESTAMP = 'Thu, 01 Jan 1970 00:00:00 GMT';
const GOOGLE_CALLBACK_REPLAY_TTL_MS = 15 * 60 * 1000;
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
const successfulGoogleCallbackCodes = new Map();

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
    if (handleGoogleCallbackReplay(req, res)) {
      logGoogleCallbackResponse(req, res, 'replay');
      return undefined;
    }

    const restoreResponseInterceptors = installGoogleCallbackResponseNormalizer(req, res);
    try {
      const result = await nextAuthHandler(req, res, createAuthOptions());
      logGoogleCallbackResponse(req, res);
      return result;
    } catch (error) {
      logGoogleCallbackRequest(req, 'error', error);
      if (handleRecoverableOAuthCallbackError(req, res, error)) {
        return undefined;
      }
      throw error;
    } finally {
      restoreResponseInterceptors();
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

  const location = buildAuthErrorUrl({
    callbackUrl: '/',
    error: 'OAuthCallback',
    requestId: resolveRequestId(req),
  });
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

function handleGoogleCallbackReplay(req, res) {
  if (!isGoogleCallbackRequest(req)) {
    return false;
  }

  const entry = resolveSuccessfulGoogleCallback(req);
  if (!entry) {
    return false;
  }

  res.statusCode = 302;
  res.setHeader('Location', entry.location || '/');
  res.end();
  return true;
}

function installGoogleCallbackResponseNormalizer(req, res) {
  if (!isGoogleCallbackRequest(req) || typeof res?.end !== 'function') {
    return () => {};
  }

  const originalEnd = res.end.bind(res);
  res.end = function patchedEnd(...args) {
    normalizeGoogleCallbackResponse(req, res);
    return originalEnd(...args);
  };

  return () => {
    res.end = originalEnd;
  };
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

function logGoogleCallbackResponse(req, res, stage = 'response') {
  if (!isGoogleCallbackRequest(req)) {
    return;
  }

  const setCookie = normalizeSetCookieHeader(res?.getHeader?.('Set-Cookie'));
  const setCookieNames = setCookie
    .map((value) => typeof value === 'string' ? value.split(';')[0] : '')
    .filter(Boolean)
    .map((value) => value.split('=')[0])
    .filter(Boolean);
  const location = headerValue({ headers: { location: res?.getHeader?.('Location') } }, 'location');
  if (stage === 'response' && setCookieNames.includes('__Secure-next-auth.session-token')) {
    rememberSuccessfulGoogleCallback(req, location || '/');
  }
  const sessionCookieDiagnostics = buildSessionCookieDiagnostics(setCookie);

  const payload = {
    stage,
    url: redactGoogleCallbackUrl(typeof req?.url === 'string' ? req.url : ''),
    statusCode: Number.isInteger(res?.statusCode) ? res.statusCode : null,
    location,
    setCookiePresent: setCookie.length > 0,
    setCookieNames,
    setsSecureSessionToken: setCookieNames.includes('__Secure-next-auth.session-token'),
    setsLegacySessionToken: setCookieNames.includes('next-auth.session-token'),
    clearsSecureStateCookie: setCookie.some((value) => includesCookieDirective(value, '__Secure-next-auth.state', EXPIRED_COOKIE_TIMESTAMP)),
    clearsSecurePkceCookie: setCookie.some((value) => includesCookieDirective(value, '__Secure-next-auth.pkce.code_verifier', EXPIRED_COOKIE_TIMESTAMP)),
    sessionCookie: sessionCookieDiagnostics,
  };

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

function resolveSuccessfulGoogleCallback(req, now = Date.now()) {
  pruneSuccessfulGoogleCallbacks(now);
  const codeHash = hashGoogleCallbackCode(extractGoogleCallbackCode(req));
  if (!codeHash) {
    return null;
  }

  const entry = successfulGoogleCallbackCodes.get(codeHash);
  if (!entry || entry.expiresAt <= now) {
    successfulGoogleCallbackCodes.delete(codeHash);
    return null;
  }

  return entry;
}

function rememberSuccessfulGoogleCallback(req, location, now = Date.now()) {
  pruneSuccessfulGoogleCallbacks(now);
  const codeHash = hashGoogleCallbackCode(extractGoogleCallbackCode(req));
  if (!codeHash) {
    return;
  }

  successfulGoogleCallbackCodes.set(codeHash, {
    location,
    expiresAt: now + GOOGLE_CALLBACK_REPLAY_TTL_MS,
  });
}

function pruneSuccessfulGoogleCallbacks(now = Date.now()) {
  for (const [key, entry] of successfulGoogleCallbackCodes.entries()) {
    if (!entry || entry.expiresAt <= now) {
      successfulGoogleCallbackCodes.delete(key);
    }
  }
}

function extractGoogleCallbackCode(req) {
  const url = typeof req?.url === 'string' ? req.url : '';
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return '';
  }

  try {
    return new URLSearchParams(url.slice(queryIndex + 1)).get('code') || '';
  } catch {
    return '';
  }
}

function hashGoogleCallbackCode(code) {
  if (typeof code !== 'string' || code.trim() === '') {
    return '';
  }

  return crypto.createHash('sha256').update(code).digest('hex');
}

function headerValue(req, name) {
  const value = req?.headers?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSetCookieHeader(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    return [value];
  }

  return [];
}

function includesCookieDirective(setCookieValue, cookieName, directive) {
  return typeof setCookieValue === 'string'
    && setCookieValue.startsWith(`${cookieName}=`)
    && setCookieValue.includes(directive);
}

function buildExpiredCookie({ name, secure }) {
  return `${name}=; Path=/; Expires=${EXPIRED_COOKIE_TIMESTAMP}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function resolveRequestId(req) {
  const value = req?.headers?.['x-request-id'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildSessionCookieDiagnostics(setCookieHeaders) {
  const matchingCookies = setCookieHeaders
    .filter((value) => typeof value === 'string')
    .map(parseSetCookieDiagnostics)
    .filter((entry) => entry && isSessionCookieName(entry.name));

  if (matchingCookies.length === 0) {
    return null;
  }

  const primaryCookie = matchingCookies[0];
  return {
    name: primaryCookie.name,
    matchingCookieCount: matchingCookies.length,
    totalBytes: primaryCookie.totalBytes,
    valueBytes: primaryCookie.valueBytes,
    attributeBytes: primaryCookie.attributeBytes,
    attributes: primaryCookie.attributes,
  };
}

function parseSetCookieDiagnostics(setCookieValue) {
  if (typeof setCookieValue !== 'string' || !setCookieValue.trim()) {
    return null;
  }

  const parts = setCookieValue.split(';').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const [nameValue, ...attributeParts] = parts;
  const equalsIndex = nameValue.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const name = nameValue.slice(0, equalsIndex);
  const value = nameValue.slice(equalsIndex + 1);
  const attributes = {};

  for (const attributePart of attributeParts) {
    const [rawKey, ...rawValueParts] = attributePart.split('=');
    const key = String(rawKey || '').trim().toLowerCase();
    const joinedValue = rawValueParts.join('=').trim();

    if (!key) {
      continue;
    }

    if (key === 'httponly' || key === 'secure') {
      attributes[key] = true;
      continue;
    }

    attributes[key] = joinedValue || true;
  }

  return {
    name,
    totalBytes: Buffer.byteLength(setCookieValue, 'utf8'),
    valueBytes: Buffer.byteLength(value, 'utf8'),
    attributeBytes: Buffer.byteLength(attributeParts.join('; '), 'utf8'),
    attributes,
  };
}

function isSessionCookieName(value) {
  return value === '__Secure-next-auth.session-token' || value === 'next-auth.session-token';
}

function normalizeGoogleCallbackResponse(req, res) {
  const normalized = resolveGoogleCallbackErrorRedirect(req, res);
  if (!normalized) {
    return false;
  }

  res.statusCode = 302;
  res.setHeader('Location', normalized.location);
  res.setHeader('Set-Cookie', RECOVERABLE_AUTH_COOKIE_NAMES.map(buildExpiredCookie));
  return true;
}

function resolveGoogleCallbackErrorRedirect(req, res) {
  if (!isGoogleCallbackRequest(req)) {
    return null;
  }

  const statusCode = Number.isInteger(res?.statusCode) ? res.statusCode : null;
  const locationHeader = headerValue({ headers: { location: res?.getHeader?.('Location') } }, 'location');
  const locationUrl = normalizeAuthErrorLocation(locationHeader);

  if (locationUrl) {
    return {
      location: buildAuthErrorUrl({
        callbackUrl: '/',
        error: locationUrl.searchParams.get('error') || 'OAuthCallback',
        requestId: resolveRequestId(req),
      }),
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      location: buildAuthErrorUrl({
        callbackUrl: '/',
        error: 'OAuthCallback',
        requestId: resolveRequestId(req),
      }),
    };
  }

  return null;
}

function normalizeAuthErrorLocation(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value, 'https://test-station.local');
    if (url.pathname !== '/api/auth/error') {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export default createWebAuthHandler();
