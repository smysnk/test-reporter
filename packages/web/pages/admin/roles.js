import React from 'react';
import { AdminCatalogEditor, AdminNotice, useAdminPageActions } from '../../components/AdminBits.js';
import { MetricGrid, SectionCard } from '../../components/WebBits.js';
import {
  ADMIN_CREATE_ROLE_MUTATION,
  ADMIN_DELETE_ROLE_MUTATION,
  ADMIN_UPDATE_ROLE_MUTATION,
} from '../../lib/queries.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminRolesPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminRolesPage({ data }) {
  const actions = useAdminPageActions();
  const roles = Array.isArray(data?.roles) ? data.roles : [];

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Roles',
        title: 'Global role definitions',
        copy: 'Roles are reusable visibility bundles. Projects opt into roles, then user membership controls who can see what.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Roles', value: String(roles.length), copy: 'Configured global roles' },
          { label: 'User Links', value: String(roles.reduce((sum, entry) => sum + entry.userCount, 0)), copy: 'Total user-role memberships' },
          { label: 'Project Grants', value: String(roles.reduce((sum, entry) => sum + entry.projectCount, 0)), copy: 'Total project-role grants' },
        ],
      }),
      h(AdminNotice, { error: actions.error }),
    ),
    h(AdminCatalogEditor, {
      eyebrow: 'Role Catalog',
      title: 'Create, update, and retire roles',
      copy: 'A role becomes useful only once projects grant it and users are assigned to it.',
      itemLabel: 'Role',
      emptyTitle: 'No roles configured',
      emptyCopy: 'Create a role to start defining reusable access bundles.',
      items: roles,
      pending: actions.pending,
      onCreate: (input) => actions.runGraphqlAction({
        query: ADMIN_CREATE_ROLE_MUTATION,
        variables: { input },
      }),
      onUpdate: (id, input) => actions.runGraphqlAction({
        query: ADMIN_UPDATE_ROLE_MUTATION,
        variables: { id, input },
      }),
      onDelete: (id) => actions.runGraphqlAction({
        query: ADMIN_DELETE_ROLE_MUTATION,
        variables: { id },
      }),
    }),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminRolesPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
