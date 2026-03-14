import React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useSelector } from 'react-redux';
import { buildSignedOutRedirectUrl } from '../lib/authRoutes.js';

export function WebShell({ children }) {
  const { data: session } = useSession();
  const selectedProjectSlug = useSelector((state) => state.explorer.selectedProjectSlug);
  const selectedRunId = useSelector((state) => state.explorer.selectedRunId);

  return React.createElement(
    'div',
    { className: 'web-shell' },
    React.createElement(
      'header',
      { className: 'web-shell__header' },
      React.createElement(
        'div',
        null,
        React.createElement('p', { className: 'web-shell__eyebrow' }, 'Test Station Web'),
        React.createElement('h1', { className: 'web-shell__title' }, 'Execution history, failures, and coverage drift'),
        React.createElement(
          'p',
          { className: 'web-shell__copy' },
          'Track projects, inspect individual runs, and move from regression signals to raw evidence without leaving the web.',
        ),
      ),
      React.createElement(
        'div',
        { className: 'web-shell__toolbar' },
        React.createElement(
          'nav',
          { className: 'web-shell__nav', 'aria-label': 'Primary' },
          React.createElement(Link, { href: '/' }, 'Overview'),
          selectedProjectSlug ? React.createElement(Link, { href: `/projects/${selectedProjectSlug}` }, 'Current Project') : null,
          selectedRunId ? React.createElement(Link, { href: `/runs/${selectedRunId}` }, 'Current Run') : null,
        ),
        session
          ? React.createElement(
            'div',
            { className: 'web-shell__identity' },
            React.createElement('span', { className: 'web-shell__identity-label' }, session.user?.name || session.user?.email || session.userId || 'Operator'),
            React.createElement('span', { className: 'web-shell__identity-meta' }, `${session.role || 'member'} access`),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'web-button web-button--ghost',
                onClick: () => signOut({ callbackUrl: buildSignedOutRedirectUrl() }),
              },
              'Sign out',
            ),
          )
          : null,
      ),
    ),
    React.createElement('main', { className: 'web-shell__main' }, children),
  );
}
