import crypto from 'node:crypto';
import './nextAuthEnv.js';
import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import env from '../../../config/env.mjs';
import { buildSignInRedirectUrl } from './routeProtection.js';
import { ensureNextAuthUrl, resolveNextAuthUrl } from './nextAuthEnv.js';

export { ensureNextAuthUrl, resolveNextAuthUrl } from './nextAuthEnv.js';

const DEVELOPMENT_AUTH_SECRET = 'test-station-web-development-secret';

export function createAuthOptions(options = {}) {
  ensureNextAuthUrl(options);

  const adminEmails = resolveAdminEmails(options);
  const useSecureCookies = shouldUseSecureCookies(options);

  return {
    providers: resolveAuthProviders({
      ...options,
      adminEmails,
    }),
    secret: resolveAuthSecret(options),
    session: {
      strategy: 'jwt',
    },
    cookies: {
      sessionToken: {
        name: useSecureCookies
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
        options: {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          secure: useSecureCookies,
        },
      },
    },
    trustHost: true,
    logger: createNextAuthLogger(),
    pages: {
      signIn: '/auth/signin',
      error: '/auth/signin',
    },
    callbacks: {
      async jwt({ token, user }) {
        writeNextAuthLog('debug', 'JWT_CALLBACK_INPUT', {
          hasUser: Boolean(user),
          tokenPreview: buildTokenPreview(token),
          userPreview: buildUserPreview(user),
        });

        if (user) {
          token.sub = user.id || token.sub || crypto.randomUUID();
          token.role = user.role || resolveRole(user.email, adminEmails);
        } else {
          token.sub = typeof token.sub === 'string' && token.sub.trim() ? token.sub : 'web-user';
          token.role = typeof token.role === 'string' && token.role.trim() ? token.role : 'member';
        }

        delete token.userId;
        delete token.email;
        delete token.name;
        delete token.picture;
        delete token.image;
        writeNextAuthLog('debug', 'JWT_CALLBACK_OUTPUT', buildTokenPreview(token));
        return token;
      },
      async session({ session, token }) {
        writeNextAuthLog('debug', 'SESSION_CALLBACK_INPUT', {
          sessionPreview: buildSessionPreview(session),
          tokenPreview: buildTokenPreview(token),
        });

        const nextSession = {
          ...session,
          user: null,
          userId: token.sub || null,
          role: typeof token.role === 'string' ? token.role : 'member',
        };

        writeNextAuthLog('debug', 'SESSION_CALLBACK_OUTPUT', buildSessionPreview(nextSession));
        return nextSession;
      },
    },
  };
}

export async function getWebSession(req, res, options = {}) {
  return getServerSession(req, res, createAuthOptions(options));
}

export function logWebSessionProbe({ req, route, session }) {
  const cookieHeader = typeof req?.headers?.cookie === 'string' ? req.headers.cookie : '';
  const cookieNames = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split('=')[0])
    .filter(Boolean);

  process.stderr.write(`[web:session-probe] ${JSON.stringify({
    route,
    hasCookieHeader: Boolean(cookieHeader),
    cookieNames,
    hasSecureSessionToken: cookieNames.includes('__Secure-next-auth.session-token'),
    hasLegacySessionToken: cookieNames.includes('next-auth.session-token'),
    sessionResolved: Boolean(session),
    sessionUserId: session?.userId || null,
    sessionEmail: session?.user?.email || null,
    sessionRole: session?.role || null,
  })}\n`);
}

export async function requireWebSession(context, options = {}) {
  const session = await getWebSession(context.req, context.res, options);
  if (session) {
    return {
      session,
      redirect: null,
    };
  }

  return {
    session: null,
    redirect: {
      destination: buildSignInRedirectUrl(context.resolvedUrl || '/'),
      permanent: false,
    },
  };
}

export function buildWebActorHeaders(session) {
  if (!session) {
    return {};
  }

  return {
    'x-test-station-actor-id': session.userId || 'web-user',
    'x-test-station-actor-email': '',
    'x-test-station-actor-name': session.userId || 'Web User',
    'x-test-station-actor-role': session.role || 'member',
  };
}

export function describeAuthProviders(options = {}) {
  return createAuthOptions(options).providers.map((provider) => ({
    id: provider.id,
    name: provider.type === 'credentials' ? 'Demo Access' : provider.name,
    type: provider.type,
  }));
}

export function resolveAuthSecret(options = {}) {
  if (typeof options.secret === 'string' && options.secret.trim()) {
    return options.secret.trim();
  }

  return env.get('NEXTAUTH_SECRET').default(DEVELOPMENT_AUTH_SECRET).asString();
}

export function resolveAdminEmails(options = {}) {
  if (Array.isArray(options.adminEmails)) {
    return normalizeEmailList(options.adminEmails);
  }

  return normalizeEmailList(splitConfiguredValues(env.get('WEB_ADMIN_EMAILS').default('').asString()));
}

export function resolveDemoAuthEnabled(options = {}) {
  if (typeof options.demoAuthEnabled === 'boolean') {
    return options.demoAuthEnabled;
  }

  if (typeof options.demoAuthEnabled === 'string') {
    return parseBooleanFlag(options.demoAuthEnabled, false);
  }

  return parseBooleanFlag(env.get('WEB_DEMO_AUTH_ENABLED').default('false').asString(), false);
}

export function createNextAuthLogger() {
  return {
    error(code, metadata) {
      writeNextAuthLog('error', code, metadata);
    },
    warn(code, metadata) {
      writeNextAuthLog('warn', code, metadata);
    },
    debug(code, metadata) {
      writeNextAuthLog('debug', code, metadata);
    },
  };
}

function shouldUseSecureCookies(options = {}) {
  const candidates = [
    typeof options.nextAuthUrl === 'string' ? options.nextAuthUrl : null,
    process.env.NEXTAUTH_URL,
    process.env.WEB_URL,
  ]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean);

  if (candidates.some((value) => value.startsWith('https://'))) {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function resolveAuthProviders(options = {}) {
  const providers = [];
  const githubClientId = env.get('GITHUB_CLIENT_ID').default('').asString();
  const githubClientSecret = env.get('GITHUB_CLIENT_SECRET').default('').asString();
  const googleClientId = env.get('GOOGLE_CLIENT_ID').default('').asString();
  const googleClientSecret = env.get('GOOGLE_CLIENT_SECRET').default('').asString();
  const discordClientId = env.get('DISCORD_CLIENT_ID').default('').asString();
  const discordClientSecret = env.get('DISCORD_CLIENT_SECRET').default('').asString();
  const githubProviderFactory = unwrapProviderFactory(GithubProvider);
  const googleProviderFactory = unwrapProviderFactory(GoogleProvider);
  const discordProviderFactory = unwrapProviderFactory(DiscordProvider);
  const credentialsProviderFactory = unwrapProviderFactory(CredentialsProvider);

  if (githubClientId && githubClientSecret) {
    providers.push(githubProviderFactory({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }));
  }

  if (googleClientId && googleClientSecret) {
    providers.push(googleProviderFactory({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }));
  }

  if (discordClientId && discordClientSecret) {
    providers.push(discordProviderFactory({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    }));
  }

  const demoAuthEnabled = resolveDemoAuthEnabled(options) && !(googleClientId && googleClientSecret);
  if (demoAuthEnabled) {
    providers.push(credentialsProviderFactory({
      id: 'demo-access',
      name: 'Demo Access',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email) || 'demo@test-station.local';
        const name = typeof credentials?.name === 'string' && credentials.name.trim()
          ? credentials.name.trim()
          : email;
        return {
          id: email,
          email,
          name,
          role: resolveRole(email, options.adminEmails),
        };
      },
    }));
  }

  return providers;
}

function unwrapProviderFactory(providerModule) {
  if (typeof providerModule === 'function') {
    return providerModule;
  }

  if (providerModule && typeof providerModule.default === 'function') {
    return providerModule.default;
  }

  if (providerModule?.default && typeof providerModule.default.default === 'function') {
    return providerModule.default.default;
  }

  throw new TypeError('Invalid NextAuth provider export shape.');
}

function resolveRole(email, adminEmails) {
  return email && normalizeEmailList(adminEmails).includes(normalizeEmail(email))
    ? 'admin'
    : 'member';
}

function writeNextAuthLog(level, code, metadata) {
  const payload = {
    level,
    code: typeof code === 'string' ? code : String(code),
    metadata: sanitizeNextAuthMetadata(metadata),
  };

  process.stderr.write(`[next-auth:logger] ${JSON.stringify(payload)}\n`);
}

function sanitizeNextAuthMetadata(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeNextAuthString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: sanitizeNextAuthString(value.message || ''),
      stack: typeof value.stack === 'string' ? sanitizeStack(value.stack) : null,
      cause: sanitizeNextAuthMetadata(value.cause, seen),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeNextAuthMetadata(entry, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);

    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = sanitizeSensitiveKey(key)
        ? '<redacted>'
        : sanitizeNextAuthMetadata(entry, seen);
    }
    return result;
  }

  return String(value);
}

function sanitizeNextAuthString(value) {
  return value
    .replace(/([?&](?:code|state|access_token|id_token|refresh_token|token)=)[^&]+/gi, '$1<redacted>')
    .replace(/(client_secret=)[^&\s]+/gi, '$1<redacted>');
}

function sanitizeStack(stack) {
  return stack
    .split('\n')
    .slice(0, 12)
    .map((line) => sanitizeNextAuthString(line))
    .join('\n');
}

function sanitizeSensitiveKey(key) {
  return /token|secret|code_verifier|clientsecret|access_token|refresh_token|id_token/i.test(key);
}

function buildTokenPreview(token) {
  if (!token || typeof token !== 'object') {
    return null;
  }

  return {
    sub: token.sub || null,
    userId: token.userId || null,
    email: token.email || null,
    name: token.name || null,
    role: token.role || null,
    picturePresent: Boolean(token.picture),
  };
}

function buildUserPreview(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return {
    id: user.id || null,
    email: user.email || null,
    name: user.name || null,
    role: user.role || null,
    imagePresent: Boolean(user.image),
  };
}

function buildSessionPreview(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  return {
    userId: session.userId || null,
    role: session.role || null,
    user: session.user
      ? {
        name: session.user.name || null,
        email: session.user.email || null,
        imagePresent: Boolean(session.user.image),
      }
      : null,
  };
}

function normalizeEmailList(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  ));
}

function normalizeEmail(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function splitConfiguredValues(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseBooleanFlag(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  return fallback;
}
