import React from 'react';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions, logWebSessionProbe } from '../../lib/auth.js';
import { buildSignInRedirectUrl, normalizeCallbackTarget } from '../../lib/routeProtection.js';

export default function WebAuthErrorPage({ callbackUrl, error, requestId }) {
  return React.createElement(
    'section',
    { className: 'web-auth web-card' },
    React.createElement('p', { className: 'web-card__eyebrow' }, 'Authentication Error'),
    React.createElement('h2', { className: 'web-card__title' }, 'We could not finish signing you in'),
    React.createElement(
      'p',
      { className: 'web-card__copy' },
      'The sign-in flow did not complete cleanly. You can try again, or use the request id below to correlate the failure with the server logs.',
    ),
    React.createElement(
      'div',
      { className: 'web-meta' },
      React.createElement(
        'div',
        { className: 'web-meta__item' },
        React.createElement('span', { className: 'web-meta__label' }, 'Error'),
        React.createElement('strong', null, error || 'AuthError'),
      ),
      requestId
        ? React.createElement(
          'div',
          { className: 'web-meta__item' },
          React.createElement('span', { className: 'web-meta__label' }, 'Request Id'),
          React.createElement('code', null, requestId),
        )
        : null,
      React.createElement(
        'div',
        { className: 'web-meta__item' },
        React.createElement('span', { className: 'web-meta__label' }, 'Next Step'),
        React.createElement('span', null, 'Try the sign-in flow again from the dedicated auth screen.'),
      ),
    ),
    React.createElement(
      'div',
      { className: 'web-explorer__actions' },
      React.createElement('a', {
        href: buildSignInRedirectUrl(callbackUrl),
        className: 'web-button web-button--primary',
      }, 'Try Sign-In Again'),
      React.createElement('a', {
        href: callbackUrl,
        className: 'web-button web-button--ghost',
      }, 'Back to App'),
    ),
  );
}

export async function getServerSideProps(context) {
  const callbackUrl = normalizeCallbackTarget(
    typeof context.query.callbackUrl === 'string' && context.query.callbackUrl.trim()
      ? context.query.callbackUrl.trim()
      : '/',
  );
  const error = typeof context.query.error === 'string' && context.query.error.trim()
    ? context.query.error.trim()
    : 'AuthError';
  const requestId = typeof context.query.requestId === 'string' && context.query.requestId.trim()
    ? context.query.requestId.trim()
    : null;
  const session = await getServerSession(context.req, context.res, createAuthOptions());
  logWebSessionProbe({
    req: context.req,
    route: '/auth/error',
    session,
  });

  if (session) {
    return {
      redirect: {
        destination: callbackUrl,
        permanent: false,
      },
    };
  }

  return {
    props: {
      callbackUrl,
      error,
      requestId,
    },
  };
}
