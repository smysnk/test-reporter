import React from 'react';
import '../../lib/nextAuthEnv.js';
import { getServerSession } from 'next-auth/next';
import { signIn } from 'next-auth/react';
import { createAuthOptions, describeAuthProviders, resolveAutoSignInProviderId } from '../../lib/auth.js';

export default function WebSignInPage({ callbackUrl, providers, autoSignInProviderId, error }) {
  const credentialProvider = providers.find((provider) => provider.type === 'credentials') || null;
  const oauthProviders = providers.filter((provider) => provider.type !== 'credentials');

  React.useEffect(() => {
    if (!autoSignInProviderId) {
      return;
    }

    void signIn(autoSignInProviderId, {
      callbackUrl,
    });
  }, [autoSignInProviderId, callbackUrl]);

  async function handleDemoSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await signIn('demo-access', {
      callbackUrl,
      email: formData.get('email'),
      name: formData.get('name'),
      projectKeys: formData.get('projectKeys'),
    });
  }

  async function handleProviderSignIn(providerId) {
    await signIn(providerId, {
      callbackUrl,
    });
  }

  return React.createElement(
    'section',
    { className: 'web-auth web-card' },
    React.createElement('p', { className: 'web-card__eyebrow' }, 'Web Sign-In'),
    React.createElement('h2', { className: 'web-card__title' }, 'Authenticate to explore runs and coverage history'),
    React.createElement(
      'p',
      { className: 'web-card__copy' },
      autoSignInProviderId
        ? `Redirecting to ${formatProviderName(autoSignInProviderId)} sign-in...`
        : error
          ? `Authentication failed (${error}). Try the configured provider again or adjust the web auth environment.`
          : credentialProvider && oauthProviders.length > 0
            ? 'Use one of the configured SSO providers below, or use demo access if you have enabled it for this deployment.'
            : oauthProviders.length > 0
              ? 'Use one of the configured SSO providers below.'
              : credentialProvider
                ? 'Demo access is enabled for this deployment.'
                : 'No web auth providers are configured. Set Google OAuth or explicitly enable WEB_DEMO_AUTH_ENABLED=true.',
    ),
    error
      ? React.createElement(
        'p',
        { className: 'web-card__copy', role: 'alert' },
        `Sign-in error: ${error}`,
      )
      : null,
    autoSignInProviderId
      ? null
      : oauthProviders.length > 0
        ? React.createElement(
          'div',
          { className: 'web-auth__providers' },
          ...oauthProviders.map((provider) => React.createElement(
            'button',
            {
              key: provider.id,
              type: 'button',
              className: 'web-button web-button--primary',
              onClick: () => handleProviderSignIn(provider.id),
            },
            `Continue with ${provider.name}`,
          )),
        )
        : null,
    !autoSignInProviderId && credentialProvider
      ? React.createElement(
        'form',
        { className: 'web-auth__form', onSubmit: handleDemoSubmit },
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
          'label',
          { className: 'web-field' },
          React.createElement('span', { className: 'web-field__label' }, 'Project Keys'),
          React.createElement('input', {
            className: 'web-field__input',
            type: 'text',
            name: 'projectKeys',
            defaultValue: '*',
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
  const error = typeof context.query.error === 'string' && context.query.error.trim()
    ? context.query.error.trim()
    : null;
  const session = await getServerSession(context.req, context.res, createAuthOptions());
  if (session) {
    return {
      redirect: {
        destination: callbackUrl,
        permanent: false,
      },
    };
  }

  const providers = describeAuthProviders();
  return {
    props: {
      callbackUrl,
      providers,
      autoSignInProviderId: error ? null : resolveAutoSignInProviderId(providers),
      error,
    },
  };
}

function formatProviderName(providerId) {
  return providerId === 'google' ? 'Google' : providerId;
}
