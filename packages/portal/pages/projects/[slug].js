import React from 'react';
import Link from 'next/link';
import { CoverageTrendPanel } from '../../components/CoverageTrendPanel.js';
import { EmptyState, MetricGrid, SectionCard, StatusPill } from '../../components/PortalBits.js';
import { formatCoveragePct, formatDateTime, formatDuration } from '../../lib/format.js';
import { requirePortalSession } from '../../lib/auth.js';
import { loadProjectExplorerPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function ProjectExplorerPage({ data }) {
  const project = data?.project || null;
  const runs = Array.isArray(data?.runs) ? data.runs : [];
  const coverageTrend = Array.isArray(data?.coverageTrend) ? data.coverageTrend : [];
  const releaseNotes = Array.isArray(data?.releaseNotes) ? data.releaseNotes : [];
  const trendPanels = data?.trendPanels || {};

  if (!project) {
    return React.createElement(
      SectionCard,
      {
        eyebrow: 'Project Explorer',
        title: 'Project not found',
        copy: 'The requested project is not available to the current session.',
      },
    );
  }

  const latestCoverage = coverageTrend[0]?.linesPct ?? runs[0]?.coverageSnapshot?.linesPct ?? null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Project Explorer',
        title: project.name,
        copy: 'Track release context, recent runs, and coverage direction for a single project.',
      },
      React.createElement(MetricGrid, {
        items: [
          { label: 'Project Key', value: project.key, copy: project.defaultBranch ? `default branch ${project.defaultBranch}` : 'default branch unavailable' },
          { label: 'Recent Runs', value: String(runs.length), copy: 'Most recent executions available through GraphQL' },
          { label: 'Latest Line Coverage', value: formatCoveragePct(latestCoverage), copy: 'Recent trend point or run snapshot' },
        ],
      }),
    ),
    React.createElement(
      'div',
      { className: 'portal-grid portal-grid--two' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Recent Runs',
          title: 'Execution feed',
          copy: 'Open a run to inspect suites, failures, files, and artifacts.',
          compact: true,
        },
        runs.length > 0
          ? React.createElement(
            'div',
            { className: 'portal-list' },
            ...runs.map((run) => React.createElement(
              Link,
              { key: run.id, href: `/runs/${run.id}`, className: 'portal-list__item' },
              React.createElement(
                'div',
                { className: 'portal-list__row' },
                React.createElement('strong', { className: 'portal-list__title' }, run.externalKey),
                React.createElement(StatusPill, { status: run.status }),
              ),
              React.createElement(
                'div',
                { className: 'portal-list__meta' },
                `${formatDateTime(run.completedAt)} • ${run.projectVersion?.versionKey || 'version unavailable'}`,
              ),
              React.createElement(
                'div',
                { className: 'portal-list__row' },
                React.createElement('span', { className: 'portal-chip' }, run.branch || 'no-branch'),
                React.createElement('span', { className: 'portal-chip' }, formatDuration(run.durationMs)),
                React.createElement('span', { className: 'portal-chip' }, `lines ${formatCoveragePct(run.coverageSnapshot?.linesPct)}`),
              ),
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No runs ingested',
            copy: 'Once CI begins posting reports, this project timeline will fill in automatically.',
          }),
      ),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Coverage Trend',
          title: 'Historical coverage movement',
          copy: 'Phase 6 upgrades the lightweight strip into a real historical view backed by precomputed trend points.',
          compact: true,
        },
        coverageTrend.length > 0
          ? React.createElement(CoverageTrendPanel, {
            title: 'Project line coverage',
            subtitle: 'Release notes and version keys are overlaid directly on the chart.',
            points: trendPanels.overall || coverageTrend,
            overlays: trendPanels.overlays || [],
          })
          : React.createElement(EmptyState, {
            title: 'No coverage trend yet',
            copy: 'Coverage points appear after runs with stored coverage snapshots are ingested.',
          }),
      ),
    ),
    React.createElement(
      'div',
      { className: 'portal-grid portal-grid--two' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Package Trends',
          title: 'Package coverage over time',
          copy: 'Trend panels are seeded from the latest run so the operator lands on the most relevant packages first.',
          compact: true,
        },
        Array.isArray(trendPanels.packageTrends) && trendPanels.packageTrends.length > 0
          ? React.createElement(
            'div',
            { className: 'portal-stack' },
            ...trendPanels.packageTrends.map((entry) => React.createElement(CoverageTrendPanel, {
              key: `package:${entry.label}`,
              title: entry.label,
              subtitle: 'Package scope',
              points: entry.points,
              compact: true,
            })),
          )
          : React.createElement(EmptyState, {
            title: 'No package trends',
            copy: 'Package-level coverage points will appear once package coverage is ingested for multiple runs.',
          }),
      ),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Module Trends',
          title: 'Module coverage over time',
          copy: 'Module-level trends make ownership changes and regressions much easier to spot.',
          compact: true,
        },
        Array.isArray(trendPanels.moduleTrends) && trendPanels.moduleTrends.length > 0
          ? React.createElement(
            'div',
            { className: 'portal-stack' },
            ...trendPanels.moduleTrends.map((entry) => React.createElement(CoverageTrendPanel, {
              key: `module:${entry.label}`,
              title: entry.label,
              subtitle: 'Module scope',
              points: entry.points,
              compact: true,
            })),
          )
          : React.createElement(EmptyState, {
            title: 'No module trends',
            copy: 'Module coverage trends will appear once repeated runs include module attribution.',
          }),
      ),
    ),
    React.createElement(
      'div',
      { className: 'portal-grid portal-grid--two' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'File Trends',
          title: 'File coverage over time',
          copy: 'This focuses the trend view on the riskiest files from the latest run.',
          compact: true,
        },
        Array.isArray(trendPanels.fileTrends) && trendPanels.fileTrends.length > 0
          ? React.createElement(
            'div',
            { className: 'portal-stack' },
            ...trendPanels.fileTrends.map((entry) => React.createElement(CoverageTrendPanel, {
              key: `file:${entry.label}`,
              title: entry.label,
              subtitle: 'File scope',
              points: entry.points,
              compact: true,
            })),
          )
          : React.createElement(EmptyState, {
            title: 'No file trends',
            copy: 'File trend cards appear once the same files have been covered across multiple runs.',
          }),
      ),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Release Notes',
          title: 'Version context',
          copy: 'Release metadata sits beside the run timeline so coverage and failures can be read in context.',
          compact: true,
        },
        releaseNotes.length > 0
        ? React.createElement(
          'div',
          { className: 'portal-list' },
          ...releaseNotes.map((note) => React.createElement(
            'article',
            { className: 'portal-list__item', key: note.id },
            React.createElement(
              'div',
              { className: 'portal-list__row' },
              React.createElement('strong', { className: 'portal-list__title' }, note.title),
              React.createElement('span', { className: 'portal-chip' }, note.projectVersion?.versionKey || 'unversioned'),
            ),
            React.createElement('div', { className: 'portal-list__meta' }, formatDateTime(note.publishedAt)),
            React.createElement('p', { className: 'portal-card__copy' }, note.body),
            note.sourceUrl
              ? React.createElement('a', { href: note.sourceUrl, target: '_blank', rel: 'noreferrer' }, 'Open source note')
              : null,
          )),
        )
        : React.createElement(EmptyState, {
          title: 'No release notes stored',
            copy: 'Release notes will appear here once project version metadata is populated.',
          }),
      ),
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const auth = await requirePortalSession(context);
  if (auth.redirect) {
    return {
      redirect: auth.redirect,
    };
  }

  const slug = typeof context.params?.slug === 'string' ? context.params.slug : '';
  const data = await loadProjectExplorerPage({
    session: auth.session,
    slug,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
  });

  if (!data) {
    return {
      notFound: true,
    };
  }

  store.dispatch(setViewMode('project'));
  store.dispatch(setRuntimeConfig({ graphqlPath: '/graphql' }));
  store.dispatch(setSelectedProjectSlug(slug));
  store.dispatch(setSelectedRunId(null));

  return {
    props: {
      session: auth.session,
      data,
    },
  };
});
