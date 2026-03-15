import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import { useSelector } from 'react-redux';
import { executeBrowserGraphql } from '../lib/adminClient.js';
import { buildSignedOutRedirectUrl } from '../lib/authRoutes.js';
import { VIEWER_ACCESS_QUERY } from '../lib/queries.js';
import { buildSignInRedirectUrl } from '../lib/routeProtection.js';

export function WebShell({ children, viewer = null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const selectedProjectSlug = useSelector((state) => state.explorer.selectedProjectSlug);
  const selectedRunId = useSelector((state) => state.explorer.selectedRunId);
  const [resolvedViewer, setResolvedViewer] = React.useState(viewer);

  React.useEffect(() => {
    setResolvedViewer(viewer || null);
  }, [viewer]);

  React.useEffect(() => {
    let cancelled = false;

    if (!session) {
      setResolvedViewer(viewer || null);
      return () => {
        cancelled = true;
      };
    }

    if (viewer?.isAdmin === true) {
      setResolvedViewer(viewer);
      return () => {
        cancelled = true;
      };
    }

    executeBrowserGraphql({
      query: VIEWER_ACCESS_QUERY,
    }).then((data) => {
      if (!cancelled) {
        setResolvedViewer(data.viewer || null);
      }
    }).catch(() => {
      if (!cancelled) {
        setResolvedViewer(viewer || null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session, viewer]);

  const isAdmin = resolvedViewer?.isAdmin === true;
  const accessLabel = isAdmin
    ? 'admin access'
    : session
      ? `${session.role || 'member'} access`
      : 'guest access';
  const navItems = [
    {
      href: '/',
      label: 'Overview',
      active: router.pathname === '/',
    },
    selectedProjectSlug
      ? {
        href: `/projects/${selectedProjectSlug}`,
        label: 'Project',
        active: router.pathname === '/projects/[slug]',
      }
      : null,
    selectedRunId
      ? {
        href: `/runs/${selectedRunId}`,
        label: 'Run',
        active: router.pathname === '/runs/[id]',
      }
      : null,
    isAdmin
      ? {
        href: '/admin',
        label: 'Admin',
        active: router.pathname === '/admin' || router.pathname.startsWith('/admin/'),
      }
      : null,
  ].filter(Boolean);

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
          ...navItems.map((item) => React.createElement(
            Link,
            {
              key: item.href,
              href: item.href,
              className: item.active ? 'web-shell__nav-link web-shell__nav-link--active' : 'web-shell__nav-link',
            },
            item.label,
          )),
        ),
        session
          ? React.createElement(
            'div',
            { className: 'web-shell__identity' },
            React.createElement('span', { className: 'web-shell__identity-kicker' }, 'Signed in as'),
            React.createElement('span', { className: 'web-shell__identity-label' }, session.user?.name || session.user?.email || session.userId || 'Operator'),
            React.createElement('span', { className: 'web-shell__identity-meta' }, accessLabel),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'web-button web-button--ghost web-shell__identity-action',
                onClick: () => signOut({ callbackUrl: buildSignedOutRedirectUrl() }),
              },
              'Sign out',
            ),
          )
          : React.createElement(
            'div',
            { className: 'web-shell__identity web-shell__identity--guest' },
            React.createElement('span', { className: 'web-shell__identity-kicker' }, 'Session'),
            React.createElement('span', { className: 'web-shell__identity-meta' }, accessLabel),
            React.createElement(
              Link,
              {
                href: buildSignInRedirectUrl(router.asPath || '/'),
                className: 'web-button web-button--ghost web-shell__identity-action',
              },
              'Sign in',
            ),
          ),
      ),
    ),
    React.createElement('main', { className: 'web-shell__main' }, children),
  );
}
