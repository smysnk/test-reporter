import React from 'react';
import {
  AdminNotice,
  useAdminPageActions,
} from '../../components/AdminBits.js';
import { EmptyState, MetricGrid, SectionCard } from '../../components/WebBits.js';
import { ADMIN_SET_USER_ADMIN_MUTATION } from '../../lib/queries.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminUsersPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminUsersPage({ data }) {
  const actions = useAdminPageActions();
  const users = Array.isArray(data?.users) ? data.users : [];

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Users',
        title: 'Admin privileges',
        copy: 'Use this page to decide which authenticated users can manage project visibility.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Users', value: String(users.length), copy: 'Persisted user identities' },
          { label: 'Admins', value: String(users.filter((entry) => entry.isAdmin).length), copy: 'Can manage visibility settings' },
          { label: 'Members', value: String(users.filter((entry) => entry.isAdmin !== true).length), copy: 'Signed-in non-admin users' },
          { label: 'Guest Access', value: 'Public only', copy: 'Unauthenticated visitors see only public projects' },
        ],
      }),
      h(AdminNotice, { error: actions.error }),
    ),
    h(
      SectionCard,
      {
        eyebrow: 'Users',
        title: 'All known users',
        copy: 'Admin changes take effect server-side for project visibility management. Existing sessions continue to identify the same user record.',
        compact: true,
      },
      users.length > 0
        ? h(
          'div',
          { className: 'web-list' },
          ...users.map((user) => h(UserAdminCard, {
            key: user.id,
            user,
            actions,
          })),
        )
        : h(EmptyState, {
          title: 'No users stored',
          copy: 'Users are persisted the first time they authenticate through the web app.',
        }),
    ),
  );
}

function UserAdminCard({ user, actions }) {
  return h(
    'article',
    { className: 'web-list__item' },
    h(
      'div',
      { className: 'web-list__row' },
      h(
        'div',
        { className: 'web-stack web-stack--tight' },
        h('strong', { className: 'web-list__title' }, user.name || user.email),
        h('span', { className: 'web-list__meta' }, user.email),
      ),
      h(
        'div',
        { className: 'web-inline-list' },
        h('span', { className: user.isAdmin ? 'web-chip web-chip--admin-public' : 'web-chip web-chip--muted' }, user.isAdmin ? 'Admin' : 'Member'),
        h(
          'button',
          {
            type: 'button',
            className: 'web-button web-button--ghost',
            disabled: actions.pending,
            onClick: () => actions.runGraphqlAction({
              query: ADMIN_SET_USER_ADMIN_MUTATION,
              variables: {
                userId: user.id,
                isAdmin: !user.isAdmin,
              },
            }),
          },
          user.isAdmin ? 'Remove admin' : 'Make admin',
        ),
      ),
    ),
    h(
      'p',
      { className: 'web-card__copy' },
      user.isAdmin
        ? 'This user can manage project visibility and other admin settings.'
        : 'This user can sign in and view private projects, but cannot change workspace visibility.',
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminUsersPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
