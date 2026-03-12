import env from '../../../config/env.mjs';

export function resolveNextAuthUrl(options = {}) {
  if (typeof options.nextAuthUrl === 'string' && options.nextAuthUrl.trim()) {
    return options.nextAuthUrl.trim();
  }

  const configured = env.get('NEXTAUTH_URL').default('').asString().trim();
  if (configured) {
    return configured;
  }

  const webPort = env.get('WEB_PORT').default(3001).asPortNumber();
  return `http://localhost:${webPort}`;
}

export function ensureNextAuthUrl(options = {}) {
  if (typeof options.nextAuthUrl === 'string' && options.nextAuthUrl.trim()) {
    process.env.NEXTAUTH_URL = options.nextAuthUrl.trim();
    return process.env.NEXTAUTH_URL;
  }

  if (!process.env.NEXTAUTH_URL || !process.env.NEXTAUTH_URL.trim()) {
    process.env.NEXTAUTH_URL = resolveNextAuthUrl();
  }

  return process.env.NEXTAUTH_URL;
}

ensureNextAuthUrl();
