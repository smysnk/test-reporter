const SECRETISH_ENV_NAME = /(TOKEN|SECRET|PASSWORD|PRIVATE|ACCESS_KEY|SESSION_KEY|AUTHORIZATION|CREDENTIAL)/i;

export function captureGitHubDefaultEnvironment(env = process.env) {
  if (!env || typeof env !== 'object') {
    return {};
  }

  const entries = Object.entries(env)
    .filter(([name]) => isGitHubDefaultEnvironmentName(name) && !isSecretLikeEnvironmentName(name))
    .map(([name, value]) => [name, normalizeEnvironmentValue(value)])
    .filter(([, value]) => value !== null)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

export function isGitHubDefaultEnvironmentName(name) {
  return name === 'CI'
    || name.startsWith('GITHUB_')
    || name.startsWith('RUNNER_');
}

function isSecretLikeEnvironmentName(name) {
  return SECRETISH_ENV_NAME.test(name);
}

function normalizeEnvironmentValue(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return null;
}
