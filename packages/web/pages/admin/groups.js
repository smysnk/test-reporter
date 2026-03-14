import React from 'react';
import { AdminCatalogEditor, AdminNotice, useAdminPageActions } from '../../components/AdminBits.js';
import { MetricGrid, SectionCard } from '../../components/WebBits.js';
import {
  ADMIN_CREATE_GROUP_MUTATION,
  ADMIN_DELETE_GROUP_MUTATION,
  ADMIN_UPDATE_GROUP_MUTATION,
} from '../../lib/queries.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminGroupsPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminGroupsPage({ data }) {
  const actions = useAdminPageActions();
  const groups = Array.isArray(data?.groups) ? data.groups : [];

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Groups',
        title: 'Manual access groups',
        copy: 'Groups work well for teams, customers, or environments that need multi-project access without redefining roles.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Groups', value: String(groups.length), copy: 'Configured manual groups' },
          { label: 'User Links', value: String(groups.reduce((sum, entry) => sum + entry.userCount, 0)), copy: 'Total user-group memberships' },
          { label: 'Project Grants', value: String(groups.reduce((sum, entry) => sum + entry.projectCount, 0)), copy: 'Total project-group grants' },
        ],
      }),
      h(AdminNotice, { error: actions.error }),
    ),
    h(AdminCatalogEditor, {
      eyebrow: 'Group Catalog',
      title: 'Create, update, and retire groups',
      copy: 'Groups stay manual in the first pass, which keeps the access model predictable and auditable.',
      itemLabel: 'Group',
      emptyTitle: 'No groups configured',
      emptyCopy: 'Create a group to manage cross-project access for a set of users.',
      items: groups,
      pending: actions.pending,
      onCreate: (input) => actions.runGraphqlAction({
        query: ADMIN_CREATE_GROUP_MUTATION,
        variables: { input },
      }),
      onUpdate: (id, input) => actions.runGraphqlAction({
        query: ADMIN_UPDATE_GROUP_MUTATION,
        variables: { id, input },
      }),
      onDelete: (id) => actions.runGraphqlAction({
        query: ADMIN_DELETE_GROUP_MUTATION,
        variables: { id },
      }),
    }),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminGroupsPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
