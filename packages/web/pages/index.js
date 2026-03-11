import React from 'react';
import Link from 'next/link';
import { MetricGrid, SectionCard, StatusPill, EmptyState } from '../components/WebBits.js';
import { formatCoveragePct, formatDateTime, formatDuration } from '../lib/format.js';
import { requireWebSession } from '../lib/auth.js';
import { loadWebHomePage } from '../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../store/index.js';

export default function WebIndexPage({ data }) {
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const runs = Array.isArray(data?.runs) ? data.runs : [];
  const latestCoverage = runs.find((run) => Number.isFinite(run?.coverageSnapshot?.linesPct))?.coverageSnapshot?.linesPct ?? null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Operations Overview',
        title: 'Project and run explorer',
        copy: 'The web now opens on a live operator dashboard: accessible projects, recent executions, and the latest coverage signal in one place.',
      },
      React.createElement(MetricGrid, {
        items: [
          { label: 'Projects', value: String(projects.length), copy: 'Accessible from this session' },
          { label: 'Recent Runs', value: String(runs.length), copy: 'Latest executions across visible projects' },
          { label: 'Latest Line Coverage', value: formatCoveragePct(latestCoverage), copy: 'Most recent run with coverage data' },
        ],
      }),
    ),
    React.createElement(
      'div',
      { className: 'web-grid web-grid--two' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Projects',
          title: 'Explore by repository',
          copy: 'Jump into a project to inspect release notes, historical runs, and coverage movement.',
          compact: true,
        },
        projects.length > 0
          ? React.createElement(
            'div',
            { className: 'web-list' },
            ...projects.map((project) => React.createElement(
              Link,
              {
                key: project.id,
                href: `/projects/${project.slug}`,
                className: 'web-list__item',
              },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, project.name),
                React.createElement('span', { className: 'web-chip' }, project.key),
              ),
              React.createElement(
                'div',
                { className: 'web-list__meta' },
                project.defaultBranch ? `default branch ${project.defaultBranch}` : 'default branch unavailable',
              ),
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No projects available',
            copy: 'The current session does not have access to any projects yet.',
          }),
      ),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Runs',
          title: 'Recent execution feed',
          copy: 'Focus on the latest regressions first, then pivot into the project and run detail pages.',
          compact: true,
        },
        runs.length > 0
          ? React.createElement(
            'div',
            { className: 'web-list' },
            ...runs.map((run) => React.createElement(
              Link,
              {
                key: run.id,
                href: `/runs/${run.id}`,
                className: 'web-list__item',
              },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, run.project?.name || run.externalKey),
                React.createElement(StatusPill, { status: run.status }),
              ),
              React.createElement(
                'div',
                { className: 'web-list__meta' },
                `${run.externalKey} • ${formatDateTime(run.completedAt)}`,
              ),
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('span', { className: 'web-chip' }, run.branch || 'no-branch'),
                React.createElement('span', { className: 'web-chip' }, formatDuration(run.durationMs)),
                React.createElement('span', { className: 'web-chip' }, `lines ${formatCoveragePct(run.coverageSnapshot?.linesPct)}`),
              ),
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No recent runs',
            copy: 'Ingest a test-station report to populate the execution feed.',
          }),
      ),
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const auth = await requireWebSession(context);
  if (auth.redirect) {
    return {
      redirect: auth.redirect,
    };
  }

  store.dispatch(setViewMode('overview'));
  store.dispatch(setRuntimeConfig({ graphqlPath: '/graphql' }));
  store.dispatch(setSelectedProjectSlug(null));
  store.dispatch(setSelectedRunId(null));

  const data = await loadWebHomePage({
    session: auth.session,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
  });

  return {
    props: {
      session: auth.session,
      data,
    },
  };
});
