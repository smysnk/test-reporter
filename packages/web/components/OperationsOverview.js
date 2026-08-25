import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedProjectSlug, setSelectedRunId, setViewMode } from '../store/index.js';
import { OPERATIONS_PAGE_SIZE, OPERATIONS_WINDOW_DAYS, buildOperationsOverviewModel, operationTimestamp, resolveNextPage } from '../lib/operationsOverview.js';
import { recordClientPageMark } from '../lib/pageProfiling.js';
import { OperationsProjectRail } from './OperationsProjectRail.js';
import { OperationsSummaryStrip } from './OperationsSummaryStrip.js';
import { RunActivityHeatmap } from './RunActivityHeatmap.js';
import { OperationsCoverageChart } from './OperationsCoverageChart.js';
import { OperationsRunGrid } from './OperationsRunGrid.js';
import { FailureEvidencePanel } from './FailureEvidencePanel.js';

function scalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function projectLabel(project) {
  return project?.name || project?.slug || 'All recent publications';
}

export function OperationsOverview({ data }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const storeProjectSlug = useSelector((state) => state.explorer.selectedProjectSlug);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [loadedRuns, setLoadedRuns] = React.useState(() => Array.isArray(data?.runs) ? data.runs : []);
  const [hasMoreByScope, setHasMoreByScope] = React.useState(() => ({ __all__: Boolean(data?.hasMoreRuns) }));
  const [feedLoading, setFeedLoading] = React.useState(false);
  const [feedError, setFeedError] = React.useState(null);
  const [projectSearch, setProjectSearch] = React.useState('');
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  const [railOpen, setRailOpen] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [refreshState, setRefreshState] = React.useState({ lastSuccessAt: Date.now(), error: null, refreshing: false });
  const [timeZone, setTimeZone] = React.useState('UTC');
  const loadMoreAnchorRef = React.useRef(null);
  const commandSearchRef = React.useRef(null);

  const routeProjectSlug = scalar(router.query.project) || null;
  const selectedProjectSlug = routeProjectSlug;
  const overviewMode = scalar(router.query.view) === 'activity' ? 'activity' : 'runs';
  const inspectedRunId = scalar(router.query.inspectRun) || null;
  const search = scalar(router.query.search) || '';
  const status = scalar(router.query.status) || 'all';
  const selectedDay = scalar(router.query.day) || null;
  const requestedPage = Number.parseInt(scalar(router.query.page), 10) || 1;
  const model = buildOperationsOverviewModel({
    projects: data?.projects,
    runs: loadedRuns,
    selectedProjectSlug,
    search,
    status,
    day: selectedDay,
    now: new Date(),
    timeZone,
  });
  const page = resolveNextPage(requestedPage, model.filteredRuns.length, OPERATIONS_PAGE_SIZE);
  const inspectedRun = inspectedRunId ? loadedRuns.find((run) => run.id === inspectedRunId) || null : null;
  const feedScopeKey = model.selectedProject?.slug || '__all__';
  const hasMoreRuns = hasMoreByScope[feedScopeKey] ?? true;

  const replaceQuery = React.useCallback((updates, { replace = true } = {}) => {
    const nextQuery = { ...router.query };
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '' || value === 'all' || value === 1) delete nextQuery[key];
      else nextQuery[key] = value;
    }
    const method = replace ? router.replace : router.push;
    void method({ pathname: '/', query: nextQuery }, undefined, { shallow: true, scroll: false });
  }, [router]);

  const selectProject = React.useCallback((slug) => {
    dispatch(setSelectedProjectSlug(slug));
    dispatch(setSelectedRunId(null));
    dispatch(setViewMode('overview'));
    setRailOpen(false);
    replaceQuery({ project: slug, inspectRun: null, day: null, page: null }, { replace: false });
  }, [dispatch, replaceQuery]);

  const selectRun = React.useCallback((run) => {
    dispatch(setSelectedRunId(run.id));
    replaceQuery({ inspectRun: run.id }, { replace: false });
  }, [dispatch, replaceQuery]);

  const closeInspector = React.useCallback(() => {
    const runId = inspectedRunId;
    dispatch(setSelectedRunId(null));
    replaceQuery({ inspectRun: null }, { replace: false });
    requestAnimationFrame(() => Array.from(document.querySelectorAll('[data-run-id]'))
      .find((node) => node.getAttribute('data-run-id') === String(runId || ''))?.focus());
  }, [dispatch, inspectedRunId, replaceQuery]);

  const mergeRuns = React.useCallback((incoming) => {
    setLoadedRuns((current) => {
      const byId = new Map(current.map((run) => [run.id, run]));
      for (const run of incoming) byId.set(run.id, run);
      return Array.from(byId.values()).sort((left, right) => operationTimestamp(right.completedAt) - operationTimestamp(left.completedAt));
    });
  }, []);

  const requestFeed = React.useCallback(async ({ after = null, refresh = false } = {}) => {
    const searchParams = new URLSearchParams();
    if (after) searchParams.set('after', after);
    if (model.selectedProject?.key) searchParams.set('projectKey', model.selectedProject.key);
    const response = await fetch(`/api/run-feed?${searchParams.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `Run feed request failed (${response.status})`);
    const incoming = Array.isArray(payload.runs) ? payload.runs : [];
    mergeRuns(incoming);
    if (!refresh) setHasMoreByScope((current) => ({ ...current, [feedScopeKey]: Boolean(payload.hasMoreRuns) }));
    return incoming;
  }, [feedScopeKey, mergeRuns, model.selectedProject?.key]);

  const loadMoreRuns = React.useCallback(async () => {
    if (feedLoading || !hasMoreRuns) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      const scopedRuns = model.selectedProject
        ? loadedRuns.filter((run) => run?.project?.slug === model.selectedProject.slug)
        : loadedRuns;
      await requestFeed({ after: scopedRuns.at(-1)?.cursor || null });
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Unable to load more runs');
    } finally {
      setFeedLoading(false);
    }
  }, [feedLoading, hasMoreRuns, loadedRuns, model.selectedProject, requestFeed]);

  const refreshRuns = React.useCallback(async () => {
    if (refreshState.refreshing) return;
    setRefreshState((current) => ({ ...current, refreshing: true, error: null }));
    try {
      await requestFeed({ refresh: true });
      setRefreshState({ refreshing: false, lastSuccessAt: Date.now(), error: null });
    } catch (error) {
      setRefreshState((current) => ({ ...current, refreshing: false, error: error instanceof Error ? error.message : 'Refresh failed' }));
    }
  }, [refreshState.refreshing, requestFeed]);

  React.useEffect(() => {
    setIsHydrated(true);
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  React.useEffect(() => {
    if (routeProjectSlug !== storeProjectSlug) dispatch(setSelectedProjectSlug(routeProjectSlug));
  }, [dispatch, routeProjectSlug, storeProjectSlug]);

  React.useEffect(() => {
    const focusCommandSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        commandSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusCommandSearch);
    return () => window.removeEventListener('keydown', focusCommandSearch);
  }, []);

  React.useEffect(() => {
    if (selectedProjectSlug && !model.selectedProject) selectProject(null);
  }, [model.selectedProject, selectProject, selectedProjectSlug]);

  React.useEffect(() => {
    dispatch(setSelectedRunId(inspectedRun?.id || null));
  }, [dispatch, inspectedRun?.id]);

  React.useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = window.setInterval(refreshRuns, 60_000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, refreshRuns]);

  React.useEffect(() => {
    if (!hasMoreRuns || typeof IntersectionObserver !== 'function') return undefined;
    const node = loadMoreAnchorRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreRuns();
    }, { rootMargin: '280px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRuns, loadMoreRuns, model.filteredRuns.length]);

  React.useEffect(() => {
    recordClientPageMark('overview-page-ready', {
      focusMode: model.selectedProject ? 'project' : 'all-runs',
      overviewMode,
      selectedProjectSlug: model.selectedProject?.slug || null,
      selectedRunId: inspectedRun?.id || null,
      visibleProjectCount: model.totalProjects,
      visibleRunCount: model.filteredRuns.length,
      totalRunCount: model.totalLoadedRuns,
      windowDays: OPERATIONS_WINDOW_DAYS,
    });
  }, [inspectedRun?.id, model.filteredRuns.length, model.selectedProject?.slug, model.totalLoadedRuns, model.totalProjects, overviewMode]);

  const chooseActivityCell = React.useCallback((projectSlug, cell) => {
    if (!cell) {
      replaceQuery({ day: null, page: null });
      return;
    }
    dispatch(setSelectedProjectSlug(projectSlug));
    replaceQuery({ project: projectSlug, day: selectedDay === cell.key ? null : cell.key, page: null }, { replace: false });
  }, [dispatch, replaceQuery, selectedDay]);

  const filterCount = [search, status !== 'all' ? status : null, selectedDay].filter(Boolean).length;
  const stale = Date.now() - refreshState.lastSuccessAt > 120_000 || Boolean(refreshState.error);

  return React.createElement(
    'div',
    {
      className: [
        'operations-overview',
        inspectedRun ? 'operations-overview--inspecting' : '',
        railCollapsed ? 'operations-overview--rail-collapsed' : '',
      ].filter(Boolean).join(' '),
      'data-page-interactive': isHydrated ? 'true' : 'false',
    },
    React.createElement(OperationsProjectRail, {
      projects: model.projects,
      selectedProject: model.selectedProject,
      projectSearch,
      onProjectSearch: setProjectSearch,
      onSelectProject: selectProject,
      totalLoadedRuns: model.totalLoadedRuns,
      collapsed: railCollapsed,
      open: railOpen,
      onCollapse: () => setRailCollapsed((value) => !value),
      onDismiss: () => setRailOpen(false),
    }),
    railOpen ? React.createElement('button', { type: 'button', className: 'operations-rail-backdrop', onClick: () => setRailOpen(false), 'aria-label': 'Close project chooser' }) : null,
    React.createElement(
      'main',
      { className: 'operations-workspace' },
      React.createElement(
        'header',
        { className: 'operations-toolbar' },
        React.createElement('button', { type: 'button', className: 'operations-project-chooser', onClick: () => setRailOpen(true), 'aria-expanded': railOpen }, 'Projects'),
        React.createElement('div', { className: 'operations-toolbar__title' },
          React.createElement('p', { className: 'operations-kicker' }, model.selectedProject ? 'Project focus' : 'Operations'),
          React.createElement('h2', null, projectLabel(model.selectedProject))),
        React.createElement('label', { className: 'operations-command-search' },
          React.createElement('span', { className: 'sr-only' }, 'Search publications'),
          React.createElement('input', {
            ref: commandSearchRef,
            type: 'search',
            value: search,
            onChange: (event) => replaceQuery({ search: event.target.value, page: null }),
            placeholder: 'Search project, build, branch, commit…',
            'aria-label': 'Search publications',
            'data-perf-id': 'operations-search',
          }),
          React.createElement('kbd', { 'aria-hidden': 'true' }, '⌘K')),
        React.createElement('label', { className: 'operations-status-filter' },
          React.createElement('span', { className: 'sr-only' }, 'Filter by status'),
          React.createElement('select', { value: status, onChange: (event) => replaceQuery({ status: event.target.value, page: null }), 'aria-label': 'Filter by status' },
            ...['all', 'passed', 'failed', 'partial', 'skipped', 'benchmark', 'coverage', 'unknown'].map((value) => React.createElement('option', { key: value, value }, value === 'all' ? 'All statuses' : value)))) ,
        React.createElement('div', { className: 'operations-view-switch', role: 'group', 'aria-label': 'Overview layout' },
          React.createElement('button', { type: 'button', className: overviewMode === 'runs' ? 'operations-view-switch__button operations-view-switch__button--active' : 'operations-view-switch__button', 'aria-pressed': overviewMode === 'runs', onClick: () => replaceQuery({ view: null }) }, 'Runs'),
          React.createElement('button', { type: 'button', className: overviewMode === 'activity' ? 'operations-view-switch__button operations-view-switch__button--active' : 'operations-view-switch__button', 'aria-pressed': overviewMode === 'activity', onClick: () => replaceQuery({ view: 'activity' }) }, 'Activity')),
        React.createElement('div', { className: stale ? 'operations-live operations-live--stale' : 'operations-live' },
          React.createElement('span', null, refreshState.refreshing ? 'Refreshing…' : !autoRefresh ? 'Paused' : stale ? 'Stale' : 'Live'),
          React.createElement('button', { type: 'button', onClick: () => setAutoRefresh((value) => !value), 'aria-pressed': autoRefresh }, autoRefresh ? 'Pause · 60s' : 'Resume · 60s'),
          React.createElement('button', { type: 'button', onClick: refreshRuns, disabled: refreshState.refreshing }, 'Refresh')),
        model.selectedProject ? React.createElement(Link, { href: `/projects/${model.selectedProject.slug}`, className: 'operations-toolbar__project-link' }, 'Project details →') : null,
      ),
      React.createElement(OperationsSummaryStrip, { summary: model.summary, windowDays: OPERATIONS_WINDOW_DAYS }),
      filterCount > 0
        ? React.createElement('div', { className: 'operations-active-filters', 'aria-label': 'Active filters' },
          React.createElement('span', null, `${filterCount} active filter${filterCount === 1 ? '' : 's'}`),
          search ? React.createElement('button', { type: 'button', onClick: () => replaceQuery({ search: null, page: null }) }, `Search: ${search} ×`) : null,
          status !== 'all' ? React.createElement('button', { type: 'button', onClick: () => replaceQuery({ status: null, page: null }) }, `${status} ×`) : null,
          selectedDay ? React.createElement('button', { type: 'button', onClick: () => replaceQuery({ day: null, page: null }) }, `${selectedDay} ×`) : null)
        : null,
      overviewMode === 'activity'
        ? React.createElement(React.Fragment, null,
          React.createElement('p', { className: 'operations-window-disclosure' }, hasMoreRuns
            ? `Activity reflects ${model.totalLoadedRuns} loaded publications; load more history to complete the 14-day window.`
            : 'Activity reflects all visible publications in the requested 14-day window.'),
          React.createElement('div', { className: 'operations-analysis-band' },
            React.createElement(RunActivityHeatmap, { rows: model.activityRows, dateWindow: model.dateWindow, selectedDay, onSelectCell: chooseActivityCell }),
            React.createElement(OperationsCoverageChart, { points: model.coverageSeries, scopeLabel: projectLabel(model.selectedProject) })))
        : null,
      React.createElement(
        'section',
        { className: 'operations-feed', 'aria-label': 'Recent publications' },
        React.createElement(OperationsRunGrid, { runs: model.filteredRuns, selectedRunId: inspectedRun?.id || null, page, onPage: (value) => replaceQuery({ page: value }, { replace: false }), onSelectRun: selectRun }),
        React.createElement('footer', { className: 'operations-feed__footer' },
          React.createElement('span', null, `${model.filteredRuns.length} matching · ${model.windowRunCount} in window · ${model.totalLoadedRuns} loaded`),
          hasMoreRuns
            ? React.createElement('button', { type: 'button', className: 'web-button web-button--ghost', onClick: loadMoreRuns, 'data-perf-id': 'home-runs-load-more' }, feedLoading ? 'Loading…' : 'Load 50 more')
            : React.createElement('span', null, 'All visible publications loaded')),
        feedError ? React.createElement('p', { className: 'operations-feed__error', role: 'alert' }, feedError) : null,
        refreshState.error ? React.createElement('p', { className: 'operations-feed__error', role: 'alert' }, `Showing last good data. ${refreshState.error}`) : null,
        hasMoreRuns ? React.createElement('div', { ref: loadMoreAnchorRef, className: 'web-explorer__feed-sentinel', 'aria-hidden': 'true' }) : null,
      ),
    ),
    React.createElement(FailureEvidencePanel, {
      run: inspectedRun,
      runId: inspectedRunId,
      outOfScope: Boolean(inspectedRun && !model.filteredRuns.some((run) => run.id === inspectedRun.id)),
      onClearFilters: filterCount > 0 ? () => replaceQuery({ search: null, status: null, day: null, page: null }) : null,
      onClose: closeInspector,
    }),
  );
}
