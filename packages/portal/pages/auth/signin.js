import React from 'react';
import { getServerSession } from 'next-auth/next';
import { signIn } from 'next-auth/react';
import { createAuthOptions, describeAuthProviders } from '../../lib/auth.js';

export default function PortalSignInPage({ callbackUrl, providers }) {
  const credentialProvider = providers.find((provider) => provider.type === 'credentials') || null;
  const oauthProviders = providers.filter((provider) => provider.type !== 'credentials');

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
    { className: 'portal-auth portal-card' },
    React.createElement('p', { className: 'portal-card__eyebrow' }, 'Portal Sign-In'),
    React.createElement('h2', { className: 'portal-card__title' }, 'Authenticate to explore runs and coverage history'),
    React.createElement(
      'p',
      { className: 'portal-card__copy' },
      'Use one of the configured SSO providers below. If external OAuth is not configured yet, the demo access form gives you a local operator session.',
    ),
    oauthProviders.length > 0
      ? React.createElement(
        'div',
        { className: 'portal-auth__providers' },
        ...oauthProviders.map((provider) => React.createElement(
          'button',
          {
            key: provider.id,
            type: 'button',
            className: 'portal-button portal-button--primary',
            onClick: () => handleProviderSignIn(provider.id),
          },
          `Continue with ${provider.name}`,
        )),
      )
      : null,
    credentialProvider
      ? React.createElement(
        'form',
        { className: 'portal-auth__form', onSubmit: handleDemoSubmit },
        React.createElement(
          'label',
          { className: 'portal-field' },
          React.createElement('span', { className: 'portal-field__label' }, 'Email'),
          React.createElement('input', {
            className: 'portal-field__input',
            type: 'email',
            name: 'email',
            defaultValue: 'demo@test-station.local',
            required: true,
          }),
        ),
        React.createElement(
          'label',
          { className: 'portal-field' },
          React.createElement('span', { className: 'portal-field__label' }, 'Name'),
          React.createElement('input', {
            className: 'portal-field__input',
            type: 'text',
            name: 'name',
            defaultValue: 'Portal Operator',
          }),
        ),
        React.createElement(
          'label',
          { className: 'portal-field' },
          React.createElement('span', { className: 'portal-field__label' }, 'Project Keys'),
          React.createElement('input', {
            className: 'portal-field__input',
            type: 'text',
            name: 'projectKeys',
            defaultValue: '*',
          }),
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'portal-button',
          },
          'Enter demo portal',
        ),
      )
      : null,
  );
}

export async function getServerSideProps(context) {
  const callbackUrl = typeof context.query.callbackUrl === 'string' && context.query.callbackUrl.trim()
    ? context.query.callbackUrl
    : '/';
  const session = await getServerSession(context.req, context.res, createAuthOptions());
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
      providers: describeAuthProviders(),
    },
  };
}
