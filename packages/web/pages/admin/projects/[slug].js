import React from 'react';
import Link from 'next/link';
import {
  AdminNotice,
  AdminVisibilityChip,
  useAdminPageActions,
} from '../../../components/AdminBits.js';
import { MetricGrid, SectionCard } from '../../../components/WebBits.js';
import {
  ADMIN_SET_PROJECT_PUBLIC_MUTATION,
} from '../../../lib/queries.js';
import { loadAdminServerPage } from '../../../lib/adminPageLoader.js';
import { loadAdminProjectAccessPage } from '../../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../../store/index.js';

const h = React.createElement;

export default function AdminProjectAccessPage({ data }) {
  const actions = useAdminPageActions();
  const projectAccess = data?.projectAccess || null;

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

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Projects',
        title: projectAccess.project.name,
        copy: 'Project visibility is enforced server-side. Public projects are visible to guests, while private projects require sign-in.',
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
          { label: 'Guest Access', value: projectAccess.isPublic ? 'Enabled' : 'Disabled', copy: 'Controls whether guests can open this project' },
          { label: 'Signed-In Access', value: 'Enabled', copy: 'Authenticated users can always view private projects' },
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
      h(
        'p',
        { className: 'web-card__copy' },
        'Role and group grants are no longer required here. Use the visibility toggle above to control whether guests can access this project.',
      ),
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
