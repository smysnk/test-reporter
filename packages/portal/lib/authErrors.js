import { signIn } from 'next-auth/react';

export function handleUnauthorizedApolloError({ graphQLErrors, networkError }) {
  const unauthorized = (Array.isArray(graphQLErrors) && graphQLErrors.some((error) => error?.extensions?.code === 'UNAUTHORIZED'))
    || networkError?.statusCode === 401
    || networkError?.response?.status === 401;

  if (!unauthorized || typeof window === 'undefined') {
    return;
  }

  const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  signIn(undefined, { callbackUrl });
}
