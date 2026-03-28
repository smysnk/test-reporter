import React from 'react';
import '../../lib/nextAuthEnv.js';
import { getServerSession } from 'next-auth/next';
import { getCsrfToken } from 'next-auth/react';
import { createAuthOptions, describeAuthProviders, logWebSessionProbe } from '../../lib/auth.js';

export default function WebSignInPage({ callbackUrl, csrfToken, providers, error, signedOut }) {
  const credentialProvider = providers.find((provider) => provider.type === 'credentials') || null;
  const oauthProviders = providers.filter((provider) => provider.type !== 'credentials');

  return React.createElement(
    'section',
    { className: 'web-auth web-card' },
    React.createElement('p', { className: 'web-card__eyebrow' }, 'Web Sign-In'),
    React.createElement('h2', { className: 'web-card__title' }, 'Authenticate to explore runs and coverage history'),
    React.createElement(
      'p',
      { className: 'web-card__copy' },
      signedOut
        ? 'You have signed out. Choose a provider below when you are ready to sign in again.'
        : error
        ? `Authentication failed (${error}). Try the configured provider again or adjust the web auth environment.`
        : credentialProvider && oauthProviders.length > 0
          ? 'Use one of the configured SSO providers below, or use demo access if you have enabled it for this deployment. Guests can see public projects, and signed-in users can see the full workspace.'
          : oauthProviders.length > 0
            ? 'Use one of the configured SSO providers below.'
            : credentialProvider
              ? 'Demo access is enabled for this deployment. Guests can see public projects, and signed-in users can see the full workspace.'
              : 'No web auth providers are configured. Set Google OAuth or explicitly enable WEB_DEMO_AUTH_ENABLED=true.',
    ),
    error
      ? React.createElement(
        'p',
        { className: 'web-card__copy', role: 'alert' },
        `Sign-in error: ${error}`,
      )
      : null,
    oauthProviders.length > 0
      ? React.createElement(
        'div',
        { className: 'web-auth__providers' },
        ...oauthProviders.map((provider) => React.createElement(
          'form',
          {
            key: provider.id,
            action: `/api/auth/signin/${provider.id}`,
            method: 'post',
            className: 'web-auth__provider-form',
          },
          React.createElement('input', {
            type: 'hidden',
            name: 'csrfToken',
            value: csrfToken,
          }),
          React.createElement('input', {
            type: 'hidden',
            name: 'callbackUrl',
            value: callbackUrl,
          }),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'web-button web-button--primary',
            },
            `Continue with ${provider.name}`,
          ),
        )),
      )
      : null,
    credentialProvider
      ? React.createElement(
        'form',
        { className: 'web-auth__form', action: '/api/auth/callback/demo-access', method: 'post' },
        React.createElement('input', {
          type: 'hidden',
          name: 'csrfToken',
          value: csrfToken,
        }),
        React.createElement('input', {
          type: 'hidden',
          name: 'callbackUrl',
          value: callbackUrl,
        }),
        React.createElement(
          'label',
          { className: 'web-field' },
          React.createElement('span', { className: 'web-field__label' }, 'Email'),
          React.createElement('input', {
            className: 'web-field__input',
            type: 'email',
            name: 'email',
            defaultValue: 'demo@test-station.local',
            required: true,
          }),
        ),
        React.createElement(
          'label',
          { className: 'web-field' },
          React.createElement('span', { className: 'web-field__label' }, 'Name'),
          React.createElement('input', {
            className: 'web-field__input',
            type: 'text',
            name: 'name',
            defaultValue: 'Web Operator',
          }),
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'web-button',
          },
          'Enter demo web',
        ),
      )
      : null,
  );
}

export async function getServerSideProps(context) {
  const callbackUrl = typeof context.query.callbackUrl === 'string' && context.query.callbackUrl.trim()
    ? context.query.callbackUrl
    : '/';
  const signedOut = context.query.signedOut === '1' || context.query.signedOut === 'true';
  const error = typeof context.query.error === 'string' && context.query.error.trim()
    ? context.query.error.trim()
    : null;
  const session = await getServerSession(context.req, context.res, createAuthOptions());
  logWebSessionProbe({
    req: context.req,
    route: '/auth/signin',
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

  const csrfToken = await getCsrfToken(context);
  const providers = describeAuthProviders();
  return {
    props: {
      callbackUrl,
      csrfToken: typeof csrfToken === 'string' ? csrfToken : '',
      providers,
      error,
      signedOut,
    },
  };
}
