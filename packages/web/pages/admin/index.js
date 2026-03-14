import React from 'react';
import Link from 'next/link';
import { AdminAssignmentChips, AdminShortcutGrid, AdminVisibilityChip } from '../../components/AdminBits.js';
import { EmptyState, MetricGrid, SectionCard } from '../../components/WebBits.js';
import { loadAdminServerPage } from '../../lib/adminPageLoader.js';
import { loadAdminOverviewPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

const h = React.createElement;

export default function AdminOverviewPage({ data }) {
  const users = Array.isArray(data?.users) ? data.users : [];
  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const publicProjectCount = projects.filter((entry) => entry.isPublic).length;

  return h(
    React.Fragment,
    null,
    h(
      SectionCard,
      {
        eyebrow: 'Admin',
        title: 'Access control overview',
        copy: 'Manage who can see which projects, which projects are public, and how users are grouped.',
      },
      h(MetricGrid, {
        items: [
          { label: 'Users', value: String(users.length), copy: 'Persisted viewer accounts' },
          { label: 'Roles', value: String(roles.length), copy: 'Global role definitions' },
          { label: 'Groups', value: String(groups.length), copy: 'Manual membership groups' },
          { label: 'Public Projects', value: String(publicProjectCount), copy: `${projects.length} total tracked projects` },
        ],
      }),
      h(AdminShortcutGrid, {
        items: [
          { href: '/admin/projects', title: 'Projects', copy: 'Control public visibility and project-to-role/group grants.' },
          { href: '/admin/users', title: 'Users', copy: 'Toggle admin access and manage role/group membership.' },
          { href: '/admin/roles', title: 'Roles', copy: 'Define reusable access roles for multiple projects.' },
          { href: '/admin/groups', title: 'Groups', copy: 'Curate manual groups for cross-project visibility.' },
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
          copy: 'Public projects are visible to guests. Private projects require explicit role or group access.',
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
              h(
                'div',
                { className: 'web-list__row' },
                h(AdminAssignmentChips, {
                  items: entry.roleKeys,
                  emptyLabel: 'No role grants',
                }),
                h(AdminAssignmentChips, {
                  items: entry.groupKeys,
                  emptyLabel: 'No group grants',
                }),
              ),
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
          title: 'Membership summary',
          copy: 'Roles and groups stay global, then projects opt into whichever definitions should grant access.',
          compact: true,
        },
        h(MetricGrid, {
          items: [
            { label: 'Admins', value: String(users.filter((entry) => entry.isAdmin).length), copy: 'Durable admin accounts' },
            { label: 'Users With Roles', value: String(users.filter((entry) => entry.roleKeys.length > 0).length), copy: 'At least one role assignment' },
            { label: 'Users In Groups', value: String(users.filter((entry) => entry.groupKeys.length > 0).length), copy: 'At least one group assignment' },
          ],
        }),
        roles.length > 0
          ? h(
            'div',
            { className: 'web-list' },
            ...roles.slice(0, 3).map((role) => h(
              'article',
              { className: 'web-list__item', key: role.id },
              h(
                'div',
                { className: 'web-list__row' },
                h('strong', { className: 'web-list__title' }, role.name),
                h('span', { className: 'web-chip' }, role.key),
              ),
              h('div', { className: 'web-list__meta' }, role.description || 'No description configured.'),
              h(
                'div',
                { className: 'web-list__row' },
                h('span', { className: 'web-chip' }, `${role.userCount} users`),
                h('span', { className: 'web-chip' }, `${role.projectCount} projects`),
              ),
            )),
          )
          : h(EmptyState, {
            title: 'No roles configured',
            copy: 'Create your first role to start granting project visibility by reusable capability.',
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
