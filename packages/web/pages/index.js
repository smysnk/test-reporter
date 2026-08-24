import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { MetricGrid, SectionCard, StatusPill, EmptyState } from '../components/WebBits.js';
import { formatCoveragePct, formatDateTime, formatDuration, formatRepositoryName, formatRunBuildLabel, resolveRunBuildNumber } from '../lib/format.js';
import { buildHomeExplorerModel } from '../lib/homeExplorer.js';
import { getWebSession, logWebSessionProbe } from '../lib/auth.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../lib/requestTrace.js';
import { recordClientPageMark, createPageLoadProfiler, buildServerTimingHeader } from '../lib/pageProfiling.js';
import { buildOverviewPageResult } from '../lib/pageProps.js';
import { loadWebHomePage } from '../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../store/index.js';

function selectOverviewProject(dispatch, slug) {
  dispatch(setSelectedProjectSlug(slug));
  dispatch(setSelectedRunId(null));
  dispatch(setViewMode('overview'));
}

function SidebarButton({ active = false, title, meta, status, onClick, perfId = null, projectSlug = null }) {
  const hasStatusMetaRow = Boolean(status || meta);

  return React.createElement(
    'button',
    {
      type: 'button',
      className: active ? 'web-explorer__sidebar-item web-explorer__sidebar-item--active' : 'web-explorer__sidebar-item',
      onClick,
      'aria-pressed': active,
      ...(perfId ? { 'data-perf-id': perfId } : {}),
      ...(projectSlug ? { 'data-project-slug': projectSlug } : {}),
    },
    React.createElement(
      'div',
      { className: 'web-explorer__sidebar-row' },
      React.createElement('strong', { className: 'web-explorer__sidebar-title' }, title),
    ),
    hasStatusMetaRow
      ? React.createElement(
        'div',
        { className: 'web-explorer__sidebar-status' },
        status ? React.createElement(StatusPill, { status }) : React.createElement('span', { className: 'web-explorer__sidebar-status-spacer', 'aria-hidden': 'true' }),
        meta ? React.createElement('span', { className: 'web-explorer__sidebar-meta' }, meta) : null,
      )
      : null,
  );
}

function formatLandingBuildLabel(run) {
  const buildNumber = resolveRunBuildNumber(run);
  if (Number.isFinite(buildNumber)) {
    return `#${Math.trunc(Number(buildNumber))}`;
  }

  return formatRunBuildLabel(run);
}

function formatSidebarProjectTitle(project) {
  const repositoryName = formatRepositoryName(project?.repositoryUrl);
  if (repositoryName && repositoryName !== 'Repository unavailable') {
    return repositoryName;
  }

  return project?.name || 'Unknown project';
}

function formatLandingRunSummary(run) {
  const total = run?.summary?.totalTests;
  const passed = run?.summary?.passedTests;
  const failed = run?.summary?.failedTests;
  const completedAt = formatDateTime(run?.completedAt);
  const completedAtLabel = completedAt !== 'Unavailable' ? completedAt : null;

  if (!Number.isFinite(total) || !Number.isFinite(passed) || !Number.isFinite(failed)) {
    return completedAtLabel ? `Test summary unavailable • ${completedAtLabel}` : 'Test summary unavailable';
  }

  return completedAtLabel
    ? `${passed} passed • ${failed} failed • ${total} total • ${completedAtLabel}`
    : `${passed} passed • ${failed} failed • ${total} total`;
}

function isInteractiveRowTarget(target) {
  return Boolean(target?.closest?.('a, button, input, select, textarea, summary'));
}

function RunTable({ runs, selectedProject }) {
  const router = useRouter();

  if (!Array.isArray(runs) || runs.length === 0) {
    return React.createElement(EmptyState, {
      title: selectedProject ? 'No recent runs for this project' : 'No recent runs',
      copy: selectedProject
        ? 'This project is visible, but there are no recent executions in the current feed window yet.'
        : 'Ingest a test-station report to populate the execution feed.',
    });
  }

  return React.createElement(
    'div',
    { className: 'web-table-wrap' },
    React.createElement(
      'table',
      { className: 'web-table web-explorer-table' },
      React.createElement(
        'colgroup',
        null,
        React.createElement('col', { className: 'web-explorer-table__col web-explorer-table__col--run' }),
        React.createElement('col', { className: 'web-explorer-table__col web-explorer-table__col--status' }),
        React.createElement('col', { className: 'web-explorer-table__col web-explorer-table__col--build' }),
        React.createElement('col', { className: 'web-explorer-table__col web-explorer-table__col--branch' }),
        React.createElement('col', { className: 'web-explorer-table__col web-explorer-table__col--duration' }),
        React.createElement('col', { className: 'web-explorer-table__col web-explorer-table__col--coverage' }),
      ),
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          React.createElement('th', null, 'Run'),
          React.createElement('th', { className: 'web-explorer-table__head web-explorer-table__head--tight' }, 'Status'),
          React.createElement('th', { className: 'web-explorer-table__head web-explorer-table__head--tight' }, 'Build'),
          React.createElement('th', { className: 'web-explorer-table__head web-explorer-table__head--tight' }, 'Branch'),
          React.createElement('th', { className: 'web-explorer-table__head web-explorer-table__head--tight' }, 'Duration'),
          React.createElement('th', { className: 'web-explorer-table__head web-explorer-table__head--tight' }, 'Coverage'),
        ),
      ),
      React.createElement(
        'tbody',
        null,
        ...runs.map((run) => {
          const primaryLabel = run.project?.name || 'Unknown project';
          const metaLabel = formatLandingRunSummary(run);
          const buildLabel = formatLandingBuildLabel(run);
          const runHref = `/runs/${run.id}`;

          return React.createElement(
            'tr',
            {
              key: run.id,
              className: 'web-explorer-table__row',
              tabIndex: 0,
              role: 'link',
              'aria-label': `Open run ${run.externalKey || run.id}`,
              'data-perf-id': `run-row:${run.id}`,
              'data-run-id': run.id,
              onClick: (event) => {
                if (isInteractiveRowTarget(event.target)) {
                  return;
                }

                void router.push(runHref);
              },
              onKeyDown: (event) => {
                if (isInteractiveRowTarget(event.target)) {
                  return;
                }

                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void router.push(runHref);
                }
              },
            },
            React.createElement(
              'td',
              null,
              React.createElement(
                'div',
                { className: 'web-explorer-table__entity' },
                React.createElement(
                  Link,
                  {
                    href: runHref,
                    className: 'web-explorer-table__row-link',
                    'data-perf-id': `run-row-link:${run.id}`,
                  },
                  React.createElement('span', { className: 'web-explorer-table__primary' }, primaryLabel),
                  React.createElement(
                    'div',
                    { className: 'web-explorer-table__meta-row' },
                    React.createElement('span', { className: 'web-explorer-table__meta' }, metaLabel),
                  ),
                ),
              ),
            ),
            React.createElement(
              'td',
              { className: 'web-explorer-table__cell web-explorer-table__cell--status web-explorer-table__cell--tight' },
              React.createElement(StatusPill, { status: run.status }),
            ),
            React.createElement(
              'td',
              { className: 'web-explorer-table__cell web-explorer-table__cell--tight' },
              React.createElement(
                'div',
                { className: 'web-explorer-table__build' },
                buildLabel
                  ? (
                    run.sourceUrl
                      ? React.createElement(
                        'a',
                        {
                          href: run.sourceUrl,
                          target: '_blank',
                          rel: 'noreferrer',
                          className: 'web-explorer-table__text-link',
                        },
                        buildLabel,
                      )
                      : React.createElement(
                        'span',
                        { className: 'web-explorer-table__text-value' },
                        buildLabel,
                      )
                  )
                  : React.createElement('span', { className: 'web-explorer-table__text-value web-explorer-table__text-value--muted' }, 'No build'),
              ),
            ),
            React.createElement(
              'td',
              { className: 'web-explorer-table__cell web-explorer-table__cell--tight' },
              React.createElement(
                'span',
                {
                  className: run.branch
                    ? 'web-explorer-table__text-value'
                    : 'web-explorer-table__text-value web-explorer-table__text-value--muted',
                },
                run.branch || 'no-branch',
              ),
            ),
            React.createElement(
              'td',
              { className: 'web-explorer-table__cell web-explorer-table__cell--tight' },
              formatDuration(run.durationMs),
            ),
            React.createElement(
              'td',
              { className: 'web-explorer-table__cell web-explorer-table__cell--tight' },
              formatCoveragePct(run.coverageSnapshot?.linesPct),
            ),
          );
        }),
      ),
    ),
  );
}

export default function WebIndexPage({ data }) {
  const dispatch = useDispatch();
  const selectedProjectSlug = useSelector((state) => state.explorer.selectedProjectSlug);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [loadedRuns, setLoadedRuns] = React.useState(() => Array.isArray(data?.runs) ? data.runs : []);
  const [hasMoreByScope, setHasMoreByScope] = React.useState(() => ({ __all__: Boolean(data?.hasMoreRuns) }));
  const [feedLoading, setFeedLoading] = React.useState(false);
  const [feedError, setFeedError] = React.useState(null);
  const model = buildHomeExplorerModel({
    projects: data?.projects,
    runs: loadedRuns,
    selectedProjectSlug,
  });
  const feedScopeKey = model.selectedProject?.slug || '__all__';
  const loadMoreAnchorRef = React.useRef(null);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    if (selectedProjectSlug && !model.selectedProject) {
      selectOverviewProject(dispatch, null);
    }
  }, [dispatch, model.selectedProject, selectedProjectSlug]);

  const visibleRuns = model.visibleRuns;
  const hasMoreRuns = hasMoreByScope[feedScopeKey] ?? true;
  const loadMoreRuns = React.useCallback(async () => {
    if (feedLoading || !hasMoreRuns) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      const lastRun = visibleRuns[visibleRuns.length - 1] || null;
      const search = new URLSearchParams();
      if (lastRun?.cursor) search.set('after', lastRun.cursor);
      if (model.selectedProject?.key) search.set('projectKey', model.selectedProject.key);
      const response = await fetch(`/api/run-feed?${search.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Run feed request failed (${response.status})`);
      const incoming = Array.isArray(payload.runs) ? payload.runs : [];
      setLoadedRuns((current) => {
        const byId = new Map(current.map((run) => [run.id, run]));
        for (const run of incoming) byId.set(run.id, run);
        return Array.from(byId.values());
      });
      setHasMoreByScope((current) => ({ ...current, [feedScopeKey]: Boolean(payload.hasMoreRuns) }));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Unable to load more runs');
    } finally {
      setFeedLoading(false);
    }
  }, [feedLoading, feedScopeKey, hasMoreRuns, model.selectedProject?.key, visibleRuns]);

  React.useEffect(() => {
    if (!hasMoreRuns || typeof IntersectionObserver !== 'function') {
      return undefined;
    }

    const node = loadMoreAnchorRef.current;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      loadMoreRuns();
    }, {
      rootMargin: '280px 0px',
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRuns, loadMoreRuns, visibleRuns.length]);

  React.useEffect(() => {
    recordClientPageMark('overview-page-ready', {
      focusMode: model.selectedProject ? 'project' : 'all-runs',
      selectedProjectSlug: model.selectedProject?.slug || null,
      visibleProjectCount: model.totalProjects,
      visibleRunCount: visibleRuns.length,
      totalRunCount: model.visibleRuns.length,
    });
  }, [model.selectedProject?.slug, model.totalProjects, model.visibleRuns.length, visibleRuns.length]);

  const sectionTitle = model.selectedProject
    ? model.selectedProject.name
    : 'Recent test runs';
  const sectionCopy = model.selectedProject
    ? 'Project context now owns the main view: recent executions, latest status, and quick links stay focused on the selected repository.'
    : 'No project is pinned right now, so the main view stays wide and shows the latest activity across every visible repository.';
  const metricItems = model.selectedProject
    ? [
      {
        label: 'Repository',
        value: formatRepositoryName(model.selectedProject.repositoryUrl),
        copy: model.selectedProject.defaultBranch
          ? `default branch ${model.selectedProject.defaultBranch}`
          : 'default branch unavailable',
      },
      {
        label: 'Recent Runs',
        value: String(model.visibleRuns.length),
        copy: 'Runs currently visible in this focused feed',
      },
      {
        label: 'Latest Line Coverage',
        value: formatCoveragePct(model.selectedProject.latestCoverage),
        copy: 'Most recent line coverage snapshot for this project',
      },
    ]
    : [
      { label: 'Projects', value: String(model.totalProjects), copy: 'Visible to this viewer right now' },
      { label: 'Recent Runs', value: String(model.totalRuns), copy: 'Latest executions across all visible projects' },
      { label: 'Latest Line Coverage', value: formatCoveragePct(model.latestCoverage), copy: 'Most recent run with coverage data' },
    ];

  return React.createElement(
    'div',
    {
      className: 'web-explorer',
      'data-page-interactive': isHydrated ? 'true' : 'false',
    },
    React.createElement(
      'aside',
      { className: 'web-card web-card--compact web-explorer__sidebar' },
      React.createElement('p', { className: 'web-card__eyebrow' }, 'Projects'),
      React.createElement('h2', { className: 'web-card__title' }, 'Explorer sidebar'),
      React.createElement(
        'p',
        { className: 'web-card__copy' },
        'Use the left rail to pin a repository into focus. Clear the selection any time to fall back to the shared recent-run feed.',
      ),
      model.projects.length > 0
        ? React.createElement(
          'div',
          { className: 'web-explorer__sidebar-list' },
          React.createElement(SidebarButton, {
            active: !model.selectedProject,
            title: 'All recent runs',
            meta: `${model.totalRuns} recent runs across ${model.totalProjects} visible project${model.totalProjects === 1 ? '' : 's'}`,
            onClick: () => selectOverviewProject(dispatch, null),
            perfId: 'sidebar-all-runs',
          }),
          ...model.projects.map((project) => React.createElement(SidebarButton, {
            key: project.id,
            active: model.selectedProject?.slug === project.slug,
            title: formatSidebarProjectTitle(project),
            meta: `${project.recentRunCount} recent run${project.recentRunCount === 1 ? '' : 's'}`,
            status: project.latestRun?.status || null,
            onClick: () => selectOverviewProject(dispatch, project.slug),
            perfId: `sidebar-project:${project.slug}`,
            projectSlug: project.slug,
          })),
        )
        : React.createElement(EmptyState, {
          title: 'No projects available',
          copy: 'No public projects are visible yet. Sign in to see private projects granted to your account.',
        }),
    ),
    React.createElement(
      'div',
      { className: 'web-explorer__main' },
      React.createElement(
        SectionCard,
        {
          eyebrow: model.selectedProject ? 'Project focus' : 'Operations overview',
          title: sectionTitle,
          copy: sectionCopy,
        },
        React.createElement(MetricGrid, { items: metricItems }),
        model.selectedProject
          ? React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'div',
              { className: 'web-explorer__summary' },
              React.createElement('span', { className: 'web-chip web-chip--muted' }, model.selectedProject.key),
              model.selectedProject.defaultBranch
                ? React.createElement('span', { className: 'web-chip web-chip--muted' }, model.selectedProject.defaultBranch)
                : null,
              model.selectedProject.latestRun
                ? React.createElement(StatusPill, { status: model.selectedProject.latestRun.status })
                : React.createElement('span', { className: 'web-chip web-chip--muted' }, 'No recent runs'),
            ),
            React.createElement(
              'div',
              { className: 'web-explorer__actions' },
              React.createElement(
                Link,
                {
                  href: `/projects/${model.selectedProject.slug}`,
                  className: 'web-button web-button--ghost',
                },
                'Open project page',
              ),
            ),
          )
          : null,
        React.createElement(
          'div',
          { className: 'web-explorer__section' },
          React.createElement(
            'div',
            { className: 'web-explorer__section-heading' },
            React.createElement(
              'h3',
              { className: 'web-explorer__section-title' },
              model.selectedProject ? `${model.selectedProject.name} recent runs` : 'Latest runs across all visible projects',
            ),
            React.createElement(
              'p',
              { className: 'web-explorer__section-copy' },
              model.selectedProject
                ? 'This table stays scoped to the selected repository until you clear the sidebar selection.'
                : 'Use the sidebar to narrow the feed to a single project without leaving the landing page.',
            ),
          ),
          React.createElement(RunTable, {
            runs: visibleRuns,
            selectedProject: model.selectedProject,
          }),
          model.visibleRuns.length > 0
            ? React.createElement(
              'div',
              { className: 'web-explorer__feed-footer' },
              React.createElement(
                'span',
                { className: 'web-explorer__feed-count' },
                `${visibleRuns.length} runs loaded`,
              ),
              hasMoreRuns
                ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'web-button web-button--ghost',
                    onClick: loadMoreRuns,
                    'data-perf-id': 'home-runs-load-more',
                  },
                  feedLoading ? 'Loading…' : 'Load 30 more',
                )
                : React.createElement(
                  'span',
                  { className: 'web-explorer__feed-status' },
                  'All visible runs loaded',
                ),
            )
            : null,
          feedError
            ? React.createElement('p', { className: 'web-card__copy', role: 'alert' }, feedError)
            : null,
          hasMoreRuns
            ? React.createElement('div', {
              ref: loadMoreAnchorRef,
              className: 'web-explorer__feed-sentinel',
              'aria-hidden': 'true',
            })
            : null,
        ),
      ),
    ),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  logWebSessionProbe({
    req: context.req,
    route: '/',
    session,
  });
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const pageProfiler = createPageLoadProfiler({
    pageType: 'overview',
    route: '/',
  });
  const data = await loadWebHomePage({
    session,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
    requestTrace,
    profiler: pageProfiler,
  });
  const pageProfile = pageProfiler.finalize({
    trace: requestTrace,
    visibleProjectCount: Array.isArray(data?.projects) ? data.projects.length : 0,
    visibleRunCount: Array.isArray(data?.runs) ? data.runs.length : 0,
  });
  const serverTimingHeader = buildServerTimingHeader(pageProfile);
  if (serverTimingHeader && context.res && typeof context.res.setHeader === 'function') {
    context.res.setHeader('Server-Timing', serverTimingHeader);
    pageProfile.serverTiming = serverTimingHeader;
  }

  return buildOverviewPageResult({
    store,
    session,
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
