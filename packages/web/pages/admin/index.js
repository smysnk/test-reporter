import React from 'react';
import Link from 'next/link';
import { AdminShortcutGrid, AdminVisibilityChip } from '../../components/AdminBits.js';
import { EmptyState, MetricGrid, SectionCard } from '../../components/WebBits.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminOverviewPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminOverviewPage({ data }) {
  const users = Array.isArray(data?.users) ? data.users : [];
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const publicProjectCount = projects.filter((entry) => entry.isPublic).length;
  const privateProjectCount = Math.max(projects.length - publicProjectCount, 0);

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin',
        title: 'Workspace visibility',
        copy: 'Manage which projects are public for guests and which users can administer visibility settings.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Users', value: String(users.length), copy: 'Persisted viewer accounts' },
          { label: 'Admins', value: String(users.filter((entry) => entry.isAdmin).length), copy: 'Can manage project visibility' },
          { label: 'Public Projects', value: String(publicProjectCount), copy: 'Visible to guests' },
          { label: 'Private Projects', value: String(privateProjectCount), copy: 'Require sign-in' },
        ],
      }),
      h(AdminShortcutGrid, {
        items: [
          { href: '/admin/projects', title: 'Projects', copy: 'Control which projects are public and which remain sign-in only.' },
          { href: '/admin/users', title: 'Users', copy: 'Toggle admin access for authenticated users.' },
        ],
      }),
    ),
    h(
      'div',
      { className: 'web-grid web-grid--two' },
      h(
        SectionCard,
        {
          eyebrow: 'Projects',
          title: 'Visibility at a glance',
          copy: 'Public projects are visible to guests. Private projects remain available to signed-in users.',
          compact: true,
        },
        projects.length > 0
          ? h(
            'div',
            { className: 'web-list' },
            ...projects.slice(0, 6).map((entry) => h(
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
              h('div', { className: 'web-list__meta' }, entry.project.repositoryUrl || entry.project.key),
            )),
          )
          : h(EmptyState, {
            title: 'No projects available',
            copy: 'Projects will appear here once ingest creates them in the reporting database.',
          }),
      ),
      h(
        SectionCard,
        {
          eyebrow: 'Identity',
          title: 'Admin summary',
          copy: 'The workspace now uses a simple model: guests see public projects, signed-in users see the full workspace, and admins manage visibility.',
          compact: true,
        },
        h(MetricGrid, {
          items: [
            { label: 'Admins', value: String(users.filter((entry) => entry.isAdmin).length), copy: 'Durable admin accounts' },
            { label: 'Members', value: String(users.filter((entry) => entry.isAdmin !== true).length), copy: 'Signed-in non-admin users' },
            { label: 'Public Projects', value: String(publicProjectCount), copy: 'Visible without signing in' },
          ],
        }),
        users.length > 0
          ? h(
            'div',
            { className: 'web-list' },
            ...users.slice(0, 3).map((user) => h(
              'article',
              { className: 'web-list__item', key: user.id },
              h(
                'div',
                { className: 'web-list__row' },
                h('strong', { className: 'web-list__title' }, user.name || user.email),
                h('span', { className: user.isAdmin ? 'web-chip web-chip--admin-public' : 'web-chip web-chip--muted' }, user.isAdmin ? 'Admin' : 'Member'),
              ),
              h('div', { className: 'web-list__meta' }, user.email),
            )),
          )
          : h(EmptyState, {
            title: 'No users stored',
            copy: 'Users appear here after they authenticate through the web app.',
          }),
      ),
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => (
  loadAdminServerPage({
    context,
    store,
    loader: loadAdminOverviewPage,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  })
));
