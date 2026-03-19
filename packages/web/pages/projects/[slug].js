import React from 'react';
import Link from 'next/link';
import { BenchmarkExplorer } from '../../components/BenchmarkBits.js';
import { CoverageTrendPanel } from '../../components/CoverageTrendPanel.js';
import { EmptyState, MetricGrid, SectionCard, StatusPill, RunBuildChip } from '../../components/WebBits.js';
import { formatCommitSha, formatCoveragePct, formatDateTime, formatDuration, formatRepositoryName } from '../../lib/format.js';
import { getWebSession } from '../../lib/auth.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../lib/requestTrace.js';
import { recordClientPageMark, createPageLoadProfiler, buildServerTimingHeader } from '../../lib/pageProfiling.js';
import { buildProjectPageResult } from '../../lib/pageProps.js';
import { loadProjectExplorerPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function ProjectExplorerPage({ data }) {
  const project = data?.project || null;
  const runs = Array.isArray(data?.runs) ? data.runs : [];
  const coverageTrend = Array.isArray(data?.coverageTrend) ? data.coverageTrend : [];
  const releaseNotes = Array.isArray(data?.releaseNotes) ? data.releaseNotes : [];
  const benchmarkPanels = Array.isArray(data?.benchmarkPanels) ? data.benchmarkPanels : [];
  const trendPanels = data?.trendPanels || {};
  const [analysisTab, setAnalysisTab] = React.useState(benchmarkPanels.length > 0 ? 'benchmarks' : 'coverage');

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

  React.useEffect(() => {
    if (benchmarkPanels.length === 0 && analysisTab !== 'coverage') {
      setAnalysisTab('coverage');
    }
  }, [analysisTab, benchmarkPanels.length]);

  React.useEffect(() => {
    recordClientPageMark('project-page-ready', {
      projectSlug: project.slug,
      runCount: runs.length,
      coveragePointCount: coverageTrend.length,
      releaseNoteCount: releaseNotes.length,
      benchmarkNamespaceCount: benchmarkPanels.length,
    });
  }, [benchmarkPanels.length, coverageTrend.length, project.slug, releaseNotes.length, runs.length]);

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
      { className: 'web-grid web-grid--two' },
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
            { className: 'web-list' },
            ...runs.map((run) => React.createElement(
              Link,
              { key: run.id, href: `/runs/${run.id}`, className: 'web-list__item' },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, run.externalKey),
                React.createElement(StatusPill, { status: run.status }),
              ),
              React.createElement(
                'div',
                { className: 'web-list__meta' },
                `${formatRepositoryName(project.repositoryUrl)} • ${formatCommitSha(run.commitSha)} • ${formatDateTime(run.completedAt)}`,
              ),
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('span', { className: 'web-chip' }, run.branch || 'no-branch'),
                React.createElement(RunBuildChip, { run }),
                React.createElement('span', { className: 'web-chip' }, formatDuration(run.durationMs)),
                React.createElement('span', { className: 'web-chip' }, `lines ${formatCoveragePct(run.coverageSnapshot?.linesPct)}`),
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
      SectionCard,
      {
        eyebrow: 'Analysis Views',
        title: 'Coverage and benchmark explorer',
        copy: 'Switch between coverage trends and benchmark performance for this project.',
        compact: true,
      },
      React.createElement(
        'nav',
        { className: 'web-segmented-control', 'aria-label': 'Project analysis views' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: analysisTab === 'coverage'
              ? 'web-segmented-control__button web-segmented-control__button--active'
              : 'web-segmented-control__button',
            onClick: () => setAnalysisTab('coverage'),
          },
          'Coverage',
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: analysisTab === 'benchmarks'
              ? 'web-segmented-control__button web-segmented-control__button--active'
              : 'web-segmented-control__button',
            onClick: () => setAnalysisTab('benchmarks'),
            disabled: benchmarkPanels.length === 0,
          },
          'Benchmarks',
        ),
      ),
    ),
    analysisTab === 'coverage'
      ? React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'div',
          { className: 'web-grid web-grid--two' },
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
                { className: 'web-stack' },
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
                { className: 'web-stack' },
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
              { className: 'web-stack' },
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
      )
      : React.createElement(
        SectionCard,
        {
          eyebrow: 'Benchmark Explorer',
          title: 'Historical benchmark movement',
          copy: 'Track one namespace and one metric at a time, then toggle visible series to compare engines, browsers, or runner lanes.',
          compact: true,
        },
        React.createElement(BenchmarkExplorer, {
          benchmarkPanels,
        }),
      ),
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Release Notes',
        title: 'Version context',
        copy: 'Release metadata sits beside the run timeline so coverage, failures, and benchmark shifts can be read in context.',
        compact: true,
      },
      releaseNotes.length > 0
      ? React.createElement(
        'div',
        { className: 'web-list' },
        ...releaseNotes.map((note) => React.createElement(
          'article',
          { className: 'web-list__item', key: note.id },
          React.createElement(
            'div',
            { className: 'web-list__row' },
            React.createElement('strong', { className: 'web-list__title' }, note.title),
            React.createElement('span', { className: 'web-chip' }, note.projectVersion?.versionKey || 'unversioned'),
          ),
          React.createElement('div', { className: 'web-list__meta' }, formatDateTime(note.publishedAt)),
          React.createElement('p', { className: 'web-card__copy' }, note.body),
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
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  const slug = typeof context.params?.slug === 'string' ? context.params.slug : '';
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const pageProfiler = createPageLoadProfiler({
    pageType: 'project',
    route: `/projects/${slug}`,
  });
  const data = await loadProjectExplorerPage({
    session,
    slug,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
    requestTrace,
    profiler: pageProfiler,
  });
  const pageProfile = pageProfiler.finalize({
    trace: requestTrace,
    projectSlug: data?.project?.slug || slug,
    runCount: Array.isArray(data?.runs) ? data.runs.length : 0,
    coveragePointCount: Array.isArray(data?.coverageTrend) ? data.coverageTrend.length : 0,
    releaseNoteCount: Array.isArray(data?.releaseNotes) ? data.releaseNotes.length : 0,
    benchmarkNamespaceCount: Array.isArray(data?.benchmarkPanels) ? data.benchmarkPanels.length : 0,
  });
  const serverTimingHeader = buildServerTimingHeader(pageProfile);
  if (serverTimingHeader && context.res && typeof context.res.setHeader === 'function') {
    context.res.setHeader('Server-Timing', serverTimingHeader);
    pageProfile.serverTiming = serverTimingHeader;
  }

  return buildProjectPageResult({
    store,
    session,
    slug,
    data,
    pageProfile,
    dispatchers: {
      setViewMode,
      setRuntimeConfig,
      setSelectedProjectSlug,
      setSelectedRunId,
    },
  });
});
