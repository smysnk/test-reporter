import crypto from 'node:crypto';
import './nextAuthEnv.js';
import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import GithubProvider from 'next-auth/providers/github';
import env from '../../../config/env.mjs';
import { buildSignInRedirectUrl } from './routeProtection.js';
import { ensureNextAuthUrl, resolveNextAuthUrl } from './nextAuthEnv.js';

export { ensureNextAuthUrl, resolveNextAuthUrl } from './nextAuthEnv.js';

const DEVELOPMENT_AUTH_SECRET = 'test-station-web-development-secret';

export function createAuthOptions(options = {}) {
  ensureNextAuthUrl(options);

  const adminEmails = resolveAdminEmails(options);
  const defaultProjectKeys = resolveDefaultProjectKeys(options);

  return {
    providers: resolveAuthProviders({
      ...options,
      adminEmails,
      defaultProjectKeys,
    }),
    secret: resolveAuthSecret(options),
    session: {
      strategy: 'jwt',
    },
    pages: {
      signIn: '/auth/signin',
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.userId = user.id || token.userId || token.sub || crypto.randomUUID();
          token.email = user.email || token.email || null;
          token.name = user.name || token.name || token.email || token.userId;
          token.role = user.role || resolveRole(user.email, adminEmails);
          token.projectKeys = normalizeProjectKeys(user.projectKeys, defaultProjectKeys);
        } else {
          token.role = typeof token.role === 'string' && token.role.trim() ? token.role : resolveRole(token.email, adminEmails);
          token.projectKeys = normalizeProjectKeys(token.projectKeys, defaultProjectKeys);
          token.userId = token.userId || token.sub || token.email || 'web-user';
        }

        token.sub = token.userId;
        return token;
      },
      async session({ session, token }) {
        return {
          ...session,
          user: {
            ...session.user,
            name: token.name || session.user?.name || null,
            email: token.email || session.user?.email || null,
            image: typeof token.picture === 'string' && token.picture.trim()
              ? token.picture
              : session.user?.image || null,
          },
          userId: token.userId || token.sub || null,
          role: typeof token.role === 'string' ? token.role : 'member',
          projectKeys: normalizeProjectKeys(token.projectKeys, defaultProjectKeys),
        };
      },
    },
  };
}

export async function getWebSession(req, res, options = {}) {
  return getServerSession(req, res, createAuthOptions(options));
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
    'x-test-station-actor-id': session.userId || session.user?.email || 'web-user',
    'x-test-station-actor-email': session.user?.email || '',
    'x-test-station-actor-name': session.user?.name || session.user?.email || session.userId || 'Web User',
    'x-test-station-actor-role': session.role || 'member',
    'x-test-station-actor-project-keys': normalizeProjectKeys(session.projectKeys, ['*']).join(','),
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

export function resolveDefaultProjectKeys(options = {}) {
  const values = normalizeProjectKeys(
    options.defaultProjectKeys,
    splitConfiguredValues(env.get('WEB_DEFAULT_PROJECT_KEYS').default('*').asString()),
  );
  return values.length > 0 ? values : ['*'];
}

export function resolveAdminEmails(options = {}) {
  if (Array.isArray(options.adminEmails)) {
    return normalizeEmailList(options.adminEmails);
  }

  return normalizeEmailList(splitConfiguredValues(env.get('WEB_ADMIN_EMAILS').default('').asString()));
}

function resolveAuthProviders(options = {}) {
  const providers = [];
  const githubClientId = env.get('GITHUB_CLIENT_ID').default('').asString();
  const githubClientSecret = env.get('GITHUB_CLIENT_SECRET').default('').asString();
  const discordClientId = env.get('DISCORD_CLIENT_ID').default('').asString();
  const discordClientSecret = env.get('DISCORD_CLIENT_SECRET').default('').asString();
  const githubProviderFactory = unwrapProviderFactory(GithubProvider);
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

  if (discordClientId && discordClientSecret) {
    providers.push(discordProviderFactory({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    }));
  }

  const demoAuthEnabled = options.demoAuthEnabled !== false;
  if (demoAuthEnabled) {
    providers.push(credentialsProviderFactory({
      id: 'demo-access',
      name: 'Demo Access',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
        projectKeys: { label: 'Project Keys', type: 'text' },
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
          projectKeys: normalizeProjectKeys(credentials?.projectKeys, options.defaultProjectKeys),
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

function normalizeProjectKeys(value, fallback = []) {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : Array.isArray(fallback)
        ? fallback
        : [];

  const normalized = Array.from(new Set(
    entries
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean),
  ));

  return normalized.length > 0 ? normalized : Array.from(new Set(
    (Array.isArray(fallback) ? fallback : [])
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean),
  ));
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
