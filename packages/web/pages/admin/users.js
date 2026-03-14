import React from 'react';
import {
  AdminAssignmentManager,
  AdminAssignmentChips,
  AdminNotice,
  useAdminPageActions,
} from '../../components/AdminBits.js';
import { EmptyState, MetricGrid, SectionCard } from '../../components/WebBits.js';
import {
  ADMIN_ADD_USER_GROUP_MUTATION,
  ADMIN_ADD_USER_ROLE_MUTATION,
  ADMIN_REMOVE_USER_GROUP_MUTATION,
  ADMIN_REMOVE_USER_ROLE_MUTATION,
  ADMIN_SET_USER_ADMIN_MUTATION,
} from '../../lib/queries.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminUsersPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminUsersPage({ data }) {
  const actions = useAdminPageActions();
  const users = Array.isArray(data?.users) ? data.users : [];
  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const groups = Array.isArray(data?.groups) ? data.groups : [];

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Users',
        title: 'User membership and privileges',
        copy: 'Use this page to grant admin capability and attach users to the roles and groups that control project visibility.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Users', value: String(users.length), copy: 'Persisted user identities' },
          { label: 'Admins', value: String(users.filter((entry) => entry.isAdmin).length), copy: 'Full administrative access' },
          { label: 'Users With Roles', value: String(users.filter((entry) => entry.roleKeys.length > 0).length), copy: 'Role-based project access' },
          { label: 'Users In Groups', value: String(users.filter((entry) => entry.groupKeys.length > 0).length), copy: 'Group-based project access' },
        ],
      }),
      h(AdminNotice, { error: actions.error }),
    ),
    h(
      SectionCard,
      {
        eyebrow: 'Memberships',
        title: 'All known users',
        copy: 'Membership changes take effect server-side for access checks. Existing sessions continue to identify the same user record.',
        compact: true,
      },
      users.length > 0
        ? h(
          'div',
          { className: 'web-list' },
          ...users.map((user) => h(UserAdminCard, {
            key: user.id,
            user,
            roles,
            groups,
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

function UserAdminCard({ user, roles, groups, actions }) {
  const assignedRoles = roles.filter((entry) => user.roleKeys.includes(entry.key));
  const assignedGroups = groups.filter((entry) => user.groupKeys.includes(entry.key));
  const availableRoles = roles.filter((entry) => !user.roleKeys.includes(entry.key));
  const availableGroups = groups.filter((entry) => !user.groupKeys.includes(entry.key));

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
      'div',
      { className: 'web-grid web-grid--two' },
      h(
        'div',
        { className: 'web-stack web-stack--tight' },
        h('span', { className: 'web-shell__eyebrow' }, 'Current roles'),
        h(AdminAssignmentChips, {
          items: user.roleKeys,
          emptyLabel: 'No role memberships',
        }),
      ),
      h(
        'div',
        { className: 'web-stack web-stack--tight' },
        h('span', { className: 'web-shell__eyebrow' }, 'Current groups'),
        h(AdminAssignmentChips, {
          items: user.groupKeys,
          emptyLabel: 'No group memberships',
        }),
      ),
    ),
    h(
      'div',
      { className: 'web-grid web-grid--two' },
      h(AdminAssignmentManager, {
        title: 'Role memberships',
        copy: 'Roles grant access wherever projects opt into them.',
        assignedItems: assignedRoles,
        availableOptions: availableRoles,
        addLabel: 'Role membership',
        emptyTitle: 'No role memberships',
        emptyCopy: 'This user does not currently inherit project access through any role.',
        pending: actions.pending,
        onAdd: (role) => actions.runGraphqlAction({
          query: ADMIN_ADD_USER_ROLE_MUTATION,
          variables: {
            userId: user.id,
            roleId: role.id,
          },
        }),
        onRemove: (role) => actions.runGraphqlAction({
          query: ADMIN_REMOVE_USER_ROLE_MUTATION,
          variables: {
            userId: user.id,
            roleId: role.id,
          },
        }),
      }),
      h(AdminAssignmentManager, {
        title: 'Group memberships',
        copy: 'Groups are useful when the same viewer set needs access across many unrelated projects.',
        assignedItems: assignedGroups,
        availableOptions: availableGroups,
        addLabel: 'Group membership',
        emptyTitle: 'No group memberships',
        emptyCopy: 'This user does not currently inherit project access through any group.',
        pending: actions.pending,
        onAdd: (group) => actions.runGraphqlAction({
          query: ADMIN_ADD_USER_GROUP_MUTATION,
          variables: {
            userId: user.id,
            groupId: group.id,
          },
        }),
        onRemove: (group) => actions.runGraphqlAction({
          query: ADMIN_REMOVE_USER_GROUP_MUTATION,
          variables: {
            userId: user.id,
            groupId: group.id,
          },
        }),
      }),
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
