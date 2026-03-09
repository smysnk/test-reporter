import React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useSelector } from 'react-redux';

export function PortalShell({ children }) {
  const { data: session } = useSession();
  const selectedProjectSlug = useSelector((state) => state.explorer.selectedProjectSlug);
  const selectedRunId = useSelector((state) => state.explorer.selectedRunId);

  return React.createElement(
    'div',
    { className: 'portal-shell' },
    React.createElement(
      'header',
      { className: 'portal-shell__header' },
      React.createElement(
        'div',
        null,
        React.createElement('p', { className: 'portal-shell__eyebrow' }, 'Test Station Portal'),
        React.createElement('h1', { className: 'portal-shell__title' }, 'Execution history, failures, and coverage drift'),
        React.createElement(
          'p',
          { className: 'portal-shell__copy' },
          'Track projects, inspect individual runs, and move from regression signals to raw evidence without leaving the portal.',
        ),
      ),
      React.createElement(
        'div',
        { className: 'portal-shell__toolbar' },
        React.createElement(
          'nav',
          { className: 'portal-shell__nav', 'aria-label': 'Primary' },
          React.createElement(Link, { href: '/' }, 'Overview'),
          selectedProjectSlug ? React.createElement(Link, { href: `/projects/${selectedProjectSlug}` }, 'Current Project') : null,
          selectedRunId ? React.createElement(Link, { href: `/runs/${selectedRunId}` }, 'Current Run') : null,
        ),
        session
          ? React.createElement(
            'div',
            { className: 'portal-shell__identity' },
            React.createElement('span', { className: 'portal-shell__identity-label' }, session.user?.name || session.user?.email || session.userId || 'Operator'),
            React.createElement('span', { className: 'portal-shell__identity-meta' }, `${session.role || 'member'} access`),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'portal-button portal-button--ghost',
                onClick: () => signOut({ callbackUrl: '/auth/signin' }),
              },
              'Sign out',
            ),
          )
          : null,
      ),
    ),
    React.createElement('main', { className: 'portal-shell__main' }, children),
  );
}
