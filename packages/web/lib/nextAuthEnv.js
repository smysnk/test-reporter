export function resolveNextAuthUrl(options = {}) {
  if (typeof options.nextAuthUrl === 'string' && options.nextAuthUrl.trim()) {
    return options.nextAuthUrl.trim();
  }

  const configured = normalizeEnvValue(process.env.NEXTAUTH_URL);
  if (configured) {
    return configured;
  }

  const webPort = resolveWebPort();
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

function normalizeEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveWebPort() {
  const configured = normalizeEnvValue(process.env.WEB_PORT);
  const parsed = Number.parseInt(configured, 10);

  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }

  return 3001;
}

ensureNextAuthUrl();
