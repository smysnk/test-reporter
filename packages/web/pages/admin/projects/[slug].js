import React from 'react';
import Link from 'next/link';
import {
  AdminAssignmentManager,
  AdminNotice,
  AdminVisibilityChip,
  useAdminPageActions,
} from '../../../components/AdminBits.js';
import { MetricGrid, SectionCard } from '../../../components/WebBits.js';
import {
  ADMIN_ADD_PROJECT_GROUP_ACCESS_MUTATION,
  ADMIN_ADD_PROJECT_ROLE_ACCESS_MUTATION,
  ADMIN_REMOVE_PROJECT_GROUP_ACCESS_MUTATION,
  ADMIN_REMOVE_PROJECT_ROLE_ACCESS_MUTATION,
  ADMIN_SET_PROJECT_PUBLIC_MUTATION,
} from '../../../lib/queries.js';
import { loadAdminServerPage } from '../../../lib/adminPageLoader.js';
import { loadAdminProjectAccessPage } from '../../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../../store/index.js';

const h = React.createElement;

export default function AdminProjectAccessPage({ data }) {
  const actions = useAdminPageActions();
  const projectAccess = data?.projectAccess || null;
  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const groups = Array.isArray(data?.groups) ? data.groups : [];

  if (!projectAccess?.project) {
    return h(
      SectionCard,
      {
        eyebrow: 'Admin Projects',
        title: 'Project not found',
        copy: 'The requested project could not be loaded from the admin access service.',
      },
    );
  }

  const projectId = projectAccess.project.id;
  const availableRoles = roles.filter((entry) => !projectAccess.roleKeys.includes(entry.key));
  const availableGroups = groups.filter((entry) => !projectAccess.groupKeys.includes(entry.key));

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Projects',
        title: projectAccess.project.name,
        copy: 'Project visibility is enforced server-side. Guests can see only public projects; private projects require a role or group grant.',
      },
      h(
        'div',
        { className: 'web-list__row' },
        h(Link, { href: '/admin/projects' }, 'Back to projects'),
        h(AdminVisibilityChip, { isPublic: projectAccess.isPublic }),
      ),
      h(MetricGrid, {
        items: [
          { label: 'Project Key', value: projectAccess.project.key, copy: projectAccess.project.defaultBranch || 'no default branch' },
          { label: 'Repository', value: projectAccess.project.repositoryUrl || 'Unavailable', copy: 'Stored project repository URL' },
          { label: 'Role Grants', value: String(projectAccess.roleKeys.length), copy: 'Roles that can view this project' },
          { label: 'Group Grants', value: String(projectAccess.groupKeys.length), copy: 'Groups that can view this project' },
        ],
      }),
      h(
        'div',
        { className: 'web-admin-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'web-button',
            disabled: actions.pending,
            onClick: () => actions.runGraphqlAction({
              query: ADMIN_SET_PROJECT_PUBLIC_MUTATION,
              variables: {
                projectId,
                isPublic: !projectAccess.isPublic,
              },
            }),
          },
          projectAccess.isPublic ? 'Make private' : 'Make public',
        ),
      ),
      h(AdminNotice, { error: actions.error }),
    ),
    h(
      'div',
      { className: 'web-grid web-grid--two' },
      h(AdminAssignmentManager, {
        title: 'Role grants',
        copy: 'Roles are global. Grant one here and every member of that role can see the project.',
        assignedItems: projectAccess.roles,
        availableOptions: availableRoles,
        addLabel: 'Role grant',
        emptyTitle: 'No role grants',
        emptyCopy: 'This private project is not visible through any role yet.',
        pending: actions.pending,
        onAdd: (role) => actions.runGraphqlAction({
          query: ADMIN_ADD_PROJECT_ROLE_ACCESS_MUTATION,
          variables: {
            projectId,
            roleId: role.id,
          },
        }),
        onRemove: (role) => actions.runGraphqlAction({
          query: ADMIN_REMOVE_PROJECT_ROLE_ACCESS_MUTATION,
          variables: {
            projectId,
            roleId: role.id,
          },
        }),
      }),
      h(AdminAssignmentManager, {
        title: 'Group grants',
        copy: 'Groups are useful for cross-project cohorts like teams, departments, or partner accounts.',
        assignedItems: projectAccess.groups,
        availableOptions: availableGroups,
        addLabel: 'Group grant',
        emptyTitle: 'No group grants',
        emptyCopy: 'This private project is not visible through any group yet.',
        pending: actions.pending,
        onAdd: (group) => actions.runGraphqlAction({
          query: ADMIN_ADD_PROJECT_GROUP_ACCESS_MUTATION,
          variables: {
            projectId,
            groupId: group.id,
          },
        }),
        onRemove: (group) => actions.runGraphqlAction({
          query: ADMIN_REMOVE_PROJECT_GROUP_ACCESS_MUTATION,
          variables: {
            projectId,
            groupId: group.id,
          },
        }),
      }),
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const slug = typeof context.params?.slug === 'string' ? context.params.slug : '';

  return loadAdminServerPage({
    context,
    store,
    selectedProjectSlug: slug,
    loader: ({ session, requestId }) => loadAdminProjectAccessPage({
      session,
      slug,
      requestId,
    }),
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  });
});
