import React from 'react';
import Link from 'next/link';
import { AdminAssignmentChips, AdminVisibilityChip } from '../../../components/AdminBits.js';
import { EmptyState, MetricGrid, SectionCard } from '../../../components/WebBits.js';
import { loadAdminServerPage } from '../../../lib/adminPageLoader.js';
import { loadAdminProjectsPage } from '../../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../../store/index.js';

const h = React.createElement;

export default function AdminProjectsPage({ data }) {
  const projects = Array.isArray(data?.projects) ? data.projects : [];

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin Projects',
        title: 'Project visibility and grants',
        copy: 'Set a project public for guest access, or keep it private and grant access through roles and groups.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Projects', value: String(projects.length), copy: 'Tracked reporting projects' },
          { label: 'Public', value: String(projects.filter((entry) => entry.isPublic).length), copy: 'Visible to guests' },
          { label: 'Private', value: String(projects.filter((entry) => !entry.isPublic).length), copy: 'Protected by grants' },
        ],
      }),
    ),
    h(
      SectionCard,
      {
        eyebrow: 'Project Access',
        title: 'All tracked projects',
        copy: 'Open a project to change its visibility and manage its role/group assignments.',
        compact: true,
      },
      projects.length > 0
        ? h(
          'div',
          { className: 'web-list' },
          ...projects.map((entry) => h(
            Link,
            {
              key: entry.project.id,
              href: `/admin/projects/${entry.project.slug}`,
              className: 'web-list__item',
            },
            h(
              'div',
              { className: 'web-list__row' },
              h('strong', { className: 'web-list__title' }, entry.project.name),
              h(AdminVisibilityChip, { isPublic: entry.isPublic }),
            ),
            h(
              'div',
              { className: 'web-list__meta' },
              `${entry.project.key} • ${entry.project.defaultBranch || 'no default branch'} • ${entry.project.repositoryUrl || 'repository unavailable'}`,
            ),
            h(
              'div',
              { className: 'web-list__row' },
              h(
                'div',
                { className: 'web-stack web-stack--tight' },
                h('span', { className: 'web-shell__eyebrow' }, 'Roles'),
                h(AdminAssignmentChips, {
                  items: entry.roleKeys,
                  emptyLabel: 'No role grants',
                }),
              ),
              h(
                'div',
                { className: 'web-stack web-stack--tight' },
                h('span', { className: 'web-shell__eyebrow' }, 'Groups'),
                h(AdminAssignmentChips, {
                  items: entry.groupKeys,
                  emptyLabel: 'No group grants',
                }),
              ),
            ),
          )),
        )
        : h(EmptyState, {
          title: 'No projects found',
          copy: 'Ingest a run first so project access can be managed here.',
        }),
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminProjectsPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
