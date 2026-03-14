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

  return {
    providers: resolveAuthProviders({
      ...options,
      adminEmails,
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
        } else {
          token.role = typeof token.role === 'string' && token.role.trim() ? token.role : resolveRole(token.email, adminEmails);
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
  };
}

export function describeAuthProviders(options = {}) {
  return createAuthOptions(options).providers.map((provider) => ({
    id: provider.id,
    name: provider.type === 'credentials' ? 'Demo Access' : provider.name,
    type: provider.type,
  }));
}

export function resolveAutoSignInProviderId(providers = [], options = {}) {
  if (options?.signedOut || options?.error) {
    return null;
  }

  return Array.isArray(providers) && providers.some((provider) => provider?.id === 'google')
    ? 'google'
    : null;
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
