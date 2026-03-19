import { signIn } from 'next-auth/react';

const AUTO_SIGN_IN_RECOVERY_KEY = 'test-station:auto-sign-in-recovery';
const AUTO_SIGN_IN_RECOVERY_COOLDOWN_MS = 60_000;

const isUnauthorized = ({ graphQLErrors, networkError }) => (
  (Array.isArray(graphQLErrors) && graphQLErrors.some((error) => error?.extensions?.code === 'UNAUTHORIZED'))
    || networkError?.statusCode === 401
    || networkError?.response?.status === 401
);

const expireCookie = (name) => {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
};

const clearSessionCookies = () => {
  expireCookie('next-auth.session-token');
  expireCookie('__Secure-next-auth.session-token');
};

const readRecoveryState = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(AUTO_SIGN_IN_RECOVERY_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const timestamp = Number(parsed?.timestamp);
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    return {
      callbackUrl: typeof parsed?.callbackUrl === 'string' ? parsed.callbackUrl : null,
      timestamp,
    };
  } catch {
    return null;
  }
};

const writeRecoveryState = (callbackUrl) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(
    AUTO_SIGN_IN_RECOVERY_KEY,
    JSON.stringify({
      callbackUrl,
      timestamp: Date.now(),
    }),
  );
};

const hasRecentRecovery = (callbackUrl) => {
  const state = readRecoveryState();
  if (!state) {
    return false;
  }
  if ((Date.now() - state.timestamp) > AUTO_SIGN_IN_RECOVERY_COOLDOWN_MS) {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(AUTO_SIGN_IN_RECOVERY_KEY);
    }
    return false;
  }
  return state.callbackUrl === callbackUrl;
};

export function handleUnauthorizedApolloError({ graphQLErrors, networkError }) {
  if (!isUnauthorized({ graphQLErrors, networkError }) || typeof window === 'undefined') {
    return;
  }

  if (
    window.location.pathname.startsWith('/auth/signin')
    || window.location.pathname.startsWith('/api/auth')
  ) {
    return;
  }

  const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (hasRecentRecovery(callbackUrl)) {
    clearSessionCookies();
    return;
  }

  writeRecoveryState(callbackUrl);
  signIn(undefined, { callbackUrl });
}
