import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BenchmarkExplorer, PerformanceDomainSummary, RunBenchmarkDeltaSummary, RunBenchmarkSummary } from '../../components/BenchmarkBits.js';
import { CoverageTrendPanel } from '../../components/CoverageTrendPanel.js';
import { EmptyState, InlineList, MetricGrid, RunSourceLink, SectionCard, StatusPill } from '../../components/WebBits.js';
import { formatCommitSha, formatCoveragePct, formatDateTime, formatDuration, formatRepositoryName, formatRunBuildLabel, formatSignedDelta } from '../../lib/format.js';
import { getWebSession } from '../../lib/auth.js';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../lib/requestTrace.js';
import { recordClientPageMark, createPageLoadProfiler, buildServerTimingHeader } from '../../lib/pageProfiling.js';
import { buildRunPageResult } from '../../lib/pageProps.js';
import { RUNNER_REPORT_HEIGHT_MESSAGE_TYPE } from '../../lib/runReportTemplate.js';
import { buildRunTemplateHref, resolveRunTemplateMode } from '../../lib/runTemplateRouting.js';
import { loadRunExplorerPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function RunDetailPage({ data, templateMode = 'runner' }) {
  const router = useRouter();
  const activeTemplateMode = resolveRunTemplateMode(router.query?.template ?? templateMode);
  const runId = data?.run?.id || null;
  const insights = useRunResource(runId, runId ? `/api/runs/${encodeURIComponent(runId)}/insights` : null);
  const operations = useRunResource(
    runId,
    runId && activeTemplateMode === 'web' ? `/api/runs/${encodeURIComponent(runId)}/operations` : null,
  );
  const resolvedData = {
    ...(data || {}),
    ...(insights.data || {}),
    ...(operations.data || {}),
    run: operations.data?.run || data?.run || null,
  };
  const run = resolvedData?.run || null;

  React.useEffect(() => {
    if (!run?.id) return;
    recordClientPageMark('run-page-ready', {
      runId: run.id,
      templateMode: activeTemplateMode,
      failedTestCount: Array.isArray(resolvedData?.failedTests) ? resolvedData.failedTests.length : 0,
    });
  }, [activeTemplateMode, resolvedData?.failedTests?.length, run?.id]);

  if (!run) {
    return React.createElement(
      SectionCard,
      {
        eyebrow: 'Run Explorer',
        title: 'Run not found',
        copy: 'The requested execution could not be resolved from the reporting backend.',
      },
    );
  }

  const runBuildLabel = formatRunBuildLabel(run);
  const runBuildCopy = run.sourceRunId ? `run ${run.sourceRunId}` : 'run link unavailable';

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Run Detail',
        title: run.externalKey,
        copy: activeTemplateMode === 'runner'
          ? 'Switch between the web operator view and the exact HTML template emitted by the test runner.'
          : 'A single execution view that combines summary counts, suite health, failure details, files, and raw artifacts.',
      },
      React.createElement(
        'div',
        { className: 'web-run-detail__header' },
        React.createElement(
          'div',
          { className: 'web-list__row' },
          React.createElement(
            Link,
            {
              href: `/projects/${run.project?.slug}`,
              'data-perf-id': 'run-project-link',
            },
            run.project?.name || 'Project',
          ),
          React.createElement(StatusPill, { status: run.status }),
        ),
        React.createElement(
          'div',
          { className: 'web-run-detail__controls' },
          React.createElement(RunSourceLink, { run }),
          React.createElement(TemplateSwitch, {
            runId: run.id,
            activeTemplate: activeTemplateMode,
          }),
        ),
      ),
    React.createElement(MetricGrid, {
        items: [
          { label: 'Completed', value: formatDateTime(run.completedAt), copy: run.branch || 'no branch' },
          { label: 'Duration', value: formatDuration(run.durationMs), copy: run.projectVersion?.versionKey || 'version unavailable' },
          { label: 'Commit', value: formatCommitSha(run.commitSha), copy: formatRepositoryName(run.project?.repositoryUrl) },
          { label: 'Build', value: runBuildLabel || 'Unavailable', copy: runBuildCopy },
          { label: 'Line Coverage', value: formatCoveragePct(run.coverageSnapshot?.linesPct), copy: `branch ${formatCoveragePct(run.coverageSnapshot?.branchesPct)}` },
        ],
      }),
    ),
    React.createElement(PanelResourceState, { label: 'historical signals', resource: insights }),
    React.createElement(RunHistoricalSignals, { data: resolvedData, run, loading: insights.loading }),
    activeTemplateMode === 'runner'
      ? React.createElement(RunnerReportSection, {
        runId: run.id,
        externalKey: run.externalKey,
      })
      : React.createElement(
        React.Fragment,
        null,
        React.createElement(PanelResourceState, { label: 'operations detail', resource: operations }),
        operations.data ? React.createElement(OperationsRunDetail, { data: resolvedData }) : null,
      ),
  );
}

function useRunResource(key, url) {
  const [state, setState] = React.useState({ data: null, loading: Boolean(url), error: null, revision: 0 });
  const retry = React.useCallback(() => setState((current) => ({ ...current, revision: current.revision + 1 })), []);
  React.useEffect(() => {
    if (!key || !url) {
      setState({ data: null, loading: false, error: null, revision: 0 });
      return undefined;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, data: null, loading: true, error: null }));
    fetch(url, { signal: controller.signal })
      .then(readJsonResponse)
      .then((resourceData) => setState((current) => ({ ...current, data: resourceData, loading: false, error: null })))
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Unable to load panel.' }));
        }
      });
    return () => controller.abort();
  }, [key, url, state.revision]);
  return { ...state, retry };
}

function PanelResourceState({ label, resource }) {
  if (resource.loading) return React.createElement('p', { className: 'web-card__copy', role: 'status' }, `Loading ${label}…`);
  if (!resource.error) return null;
  return React.createElement(
    'div',
    { className: 'web-list__row', role: 'alert' },
    React.createElement('span', { className: 'web-card__copy' }, resource.error),
    React.createElement('button', { type: 'button', className: 'web-button web-button--ghost', onClick: resource.retry }, `Retry ${label}`),
  );
}

async function readJsonResponse(response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`);
  return payload;
}

function RunHistoricalSignals({ data, run }) {
  const coverageTrend = Array.isArray(data?.coverageTrend) ? data.coverageTrend : [];
  const coverageTrendOverlays = Array.isArray(data?.coverageTrendOverlays) ? data.coverageTrendOverlays : [];
  const benchmarkPanels = Array.isArray(data?.benchmarkPanels) ? data.benchmarkPanels : [];

  return React.createElement(
    'div',
    { className: 'web-grid web-grid--two' },
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Historical Coverage',
        title: 'Coverage movement',
        copy: 'Track how this project has been trending across recent runs without leaving the run detail view.',
        compact: true,
      },
      coverageTrend.length > 0
        ? React.createElement(CoverageTrendPanel, {
          title: run.project?.name || 'Project line coverage',
          subtitle: 'Recent project-wide line coverage',
          points: coverageTrend,
          overlays: coverageTrendOverlays,
        })
        : React.createElement(EmptyState, {
          title: 'No historical coverage yet',
          copy: 'Coverage trend points will appear here once this project has repeated runs with stored coverage snapshots.',
        }),
    ),
    React.createElement(
      'div',
      { id: 'run-benchmark-history' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Historical Performance',
          title: 'Performance graphs',
          copy: 'Review recent performance movement for this project directly from the run page.',
          compact: true,
        },
        benchmarkPanels.length > 0
          ? React.createElement(BenchmarkExplorer, {
            benchmarkPanels,
          })
          : React.createElement(EmptyState, {
            title: 'No benchmark history yet',
            copy: 'Benchmark charts appear once this project begins publishing benchmark trend data.',
          }),
      ),
    ),
  );
}

function OperationsRunDetail({ data }) {
  const [showExactPerformanceRows, setShowExactPerformanceRows] = React.useState(false);
  const [showAllFiles, setShowAllFiles] = React.useState(false);
  const [showPerformancePanels, setShowPerformancePanels] = React.useState(false);
  const run = data?.run || null;
  const runPackages = Array.isArray(data?.runPackages) ? data.runPackages : [];
  const runModules = Array.isArray(data?.runModules) ? data.runModules : [];
  const runFiles = Array.isArray(data?.runFiles) ? data.runFiles : [];
  const failedTests = Array.isArray(data?.failedTests) ? data.failedTests : [];
  const runPerformanceStats = Array.isArray(data?.runPerformanceStats) ? data.runPerformanceStats : [];
  const coverageComparison = data?.coverageComparison || null;

  React.useEffect(() => {
    recordClientPageMark('run-operations-ready', {
      packageCount: runPackages.length,
      moduleCount: runModules.length,
      fileCount: runFiles.length,
      failedTestCount: failedTests.length,
      benchmarkStatCount: runPerformanceStats.length,
      hasCoverageComparison: coverageComparison !== null,
    });
  }, [coverageComparison, failedTests.length, runFiles.length, runModules.length, runPackages.length, runPerformanceStats.length]);

  React.useEffect(() => {
    const reveal = () => setShowPerformancePanels(true);
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(reveal, { timeout: 1_000 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(reveal, 250);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'div',
      { className: 'web-grid web-grid--two' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Coverage Delta',
          title: 'Run-to-run comparison',
          copy: 'This summary compares the current run to the immediately previous run in the same project using precomputed trend points.',
          compact: true,
        },
        coverageComparison
          ? React.createElement(
            React.Fragment,
            null,
            React.createElement(MetricGrid, {
              items: [
                { label: 'Current lines', value: formatCoveragePct(coverageComparison.currentLinesPct), copy: coverageComparison.currentVersionKey || run.externalKey },
                { label: 'Previous lines', value: formatCoveragePct(coverageComparison.previousLinesPct), copy: coverageComparison.previousVersionKey || coverageComparison.previousExternalKey || 'No previous run' },
                { label: 'Delta', value: formatSignedDelta(coverageComparison.deltaLinesPct), copy: 'Current minus previous' },
              ],
            }),
            React.createElement(
              'div',
              { className: 'web-grid web-grid--two' },
              React.createElement(ChangeListCard, {
                title: 'Package changes',
                changes: coverageComparison.packageChanges,
              }),
              React.createElement(ChangeListCard, {
                title: 'Module changes',
                changes: coverageComparison.moduleChanges,
              }),
            ),
            React.createElement(ChangeListCard, {
              title: 'File changes',
              changes: coverageComparison.fileChanges,
            }),
          )
          : React.createElement(EmptyState, {
            title: 'No comparison baseline',
            copy: 'A previous run is required before the web can compute a coverage delta.',
          }),
      ),
      showPerformancePanels
        ? React.createElement(
          React.Fragment,
          null,
          React.createElement(
            SectionCard,
            {
              eyebrow: 'Performance Delta',
              title: 'Run benchmark movement',
              copy: 'This run is compared against the most recent matching benchmark history before raw metric rows are shown.',
              compact: true,
            },
            React.createElement(RunBenchmarkDeltaSummary, {
              stats: runPerformanceStats,
              benchmarkPanels: Array.isArray(data?.benchmarkPanels) ? data.benchmarkPanels : [],
              historyHref: '#run-benchmark-history',
            }),
          ),
          React.createElement(
            SectionCard,
            {
              eyebrow: 'Performance Rows',
              title: 'Recorded performance stats',
              copy: 'Namespaced performance rows remain available when you need the exact stored values behind the delta summaries.',
              compact: true,
            },
            React.createElement(PerformanceDomainSummary, {
              stats: runPerformanceStats,
            }),
            showExactPerformanceRows
              ? React.createElement(RunBenchmarkSummary, {
                stats: runPerformanceStats,
                historyHref: '#run-benchmark-history',
              })
              : React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'web-button web-button--secondary',
                  onClick: () => setShowExactPerformanceRows(true),
                },
                `Show ${runPerformanceStats.length} recorded rows`,
              ),
          ),
        )
        : React.createElement('p', { className: 'web-card__copy', role: 'status' }, 'Loading performance panels…'),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Packages',
          title: 'Package outcomes',
          copy: 'Each package keeps its own status, duration, and framework footprint.',
          compact: true,
        },
        runPackages.length > 0
          ? React.createElement(
            'div',
            { className: 'web-list' },
            ...runPackages.map((pkg) => React.createElement(
              'article',
              { className: 'web-list__item', key: pkg.name },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, pkg.name),
                React.createElement(StatusPill, { status: pkg.status }),
              ),
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('span', { className: 'web-chip' }, `${pkg.suiteCount} suites`),
                React.createElement('span', { className: 'web-chip' }, formatDuration(pkg.durationMs)),
              ),
              React.createElement(InlineList, { items: pkg.frameworks || [] }),
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No package summaries',
            copy: 'This run did not include package-level reporting details.',
          }),
      ),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Artifacts',
          title: 'Raw evidence',
          copy: 'Use artifact links to jump from summary to logs, traces, and captured attachments.',
          compact: true,
        },
        Array.isArray(run.artifacts) && run.artifacts.length > 0
          ? React.createElement(
            'div',
            { className: 'web-list' },
            ...run.artifacts.map((artifact) => React.createElement(
              'article',
              { className: 'web-list__item', key: artifact.id },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, artifact.label || artifact.relativePath || artifact.href || artifact.id),
                React.createElement('span', { className: 'web-chip' }, artifact.kind),
              ),
              artifact.href
                ? React.createElement('a', {
                  href: artifact.href,
                  target: '_blank',
                  rel: 'noreferrer',
                  className: 'web-link--break',
                }, artifact.href)
                : React.createElement('span', { className: 'web-list__meta' }, artifact.relativePath || 'No public href'),
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No artifacts linked',
            copy: 'This run has no stored artifacts yet.',
          }),
      ),
    ),
    React.createElement(
      'div',
      { className: 'web-grid web-grid--two' },
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Failing Tests',
          title: 'Regression focus',
          copy: 'The failing slice is broken out first so the operator lands on the highest-signal evidence.',
          compact: true,
        },
        failedTests.length > 0
          ? React.createElement(
            'div',
            { className: 'web-list' },
            ...failedTests.map((test) => React.createElement(
              'article',
              { className: 'web-list__item', key: test.id },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, test.fullName),
                React.createElement(StatusPill, { status: test.status }),
              ),
              React.createElement(
                'div',
                { className: 'web-list__meta' },
                `${test.moduleName || 'uncategorized'} • ${test.filePath || 'no file path'}`,
              ),
              test.failureMessages?.length
                ? React.createElement(
                  'div',
                  { className: 'web-stack' },
                  ...test.failureMessages.map((message, index) => React.createElement('span', { className: 'web-chip', key: `${test.id}-${index}` }, message)),
                )
                : null,
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No failing tests',
            copy: 'This run did not record any failed test executions.',
          }),
      ),
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Files and Modules',
          title: 'Coverage and ownership surface',
          copy: 'Modules and files provide the bridge from run outcomes to longer-term trend analysis.',
          compact: true,
        },
        React.createElement(
          React.Fragment,
          null,
          runModules.length > 0
            ? React.createElement(
              'div',
              { className: 'web-list' },
              ...runModules.slice(0, 4).map((moduleEntry) => React.createElement(
                'article',
                { className: 'web-list__item', key: moduleEntry.module },
                React.createElement(
                  'div',
                  { className: 'web-list__row' },
                  React.createElement('strong', { className: 'web-list__title' }, moduleEntry.module),
                  React.createElement('span', { className: 'web-chip' }, formatCoveragePct(moduleEntry.coverage?.lines?.pct)),
                ),
                React.createElement('div', { className: 'web-list__meta' }, `${moduleEntry.owner || 'unowned'} • ${moduleEntry.packageCount} packages`),
                React.createElement(InlineList, { items: moduleEntry.packages || [] }),
              )),
            )
            : React.createElement(EmptyState, {
              title: 'No module summaries',
              copy: 'Module-level ownership and coverage records are not available for this run.',
            }),
          runFiles.length > 0
            ? React.createElement(
              'div',
              { className: 'web-table-wrap' },
              React.createElement(
                'table',
                { className: 'web-table' },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', null, 'File'),
                    React.createElement('th', null, 'Module'),
                    React.createElement('th', null, 'Status'),
                    React.createElement('th', null, 'Tests'),
                    React.createElement('th', null, 'Coverage'),
                  ),
                ),
                React.createElement(
                  'tbody',
                  null,
                  ...(showAllFiles ? runFiles : runFiles.slice(0, 30)).map((file) => React.createElement(
                    'tr',
                    { key: file.path },
                    React.createElement('td', { className: 'web-table__path' }, file.path),
                    React.createElement('td', null, file.moduleName || 'uncategorized'),
                    React.createElement('td', null, React.createElement(StatusPill, { status: file.status })),
                    React.createElement('td', null, `${file.failedTestCount}/${file.testCount}`),
                    React.createElement('td', null, formatCoveragePct(file.coverage?.linesPct)),
                  )),
                ),
              ),
              runFiles.length > 30 && !showAllFiles
                ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'web-button web-button--secondary',
                    onClick: () => setShowAllFiles(true),
                  },
                  `Show all ${runFiles.length} files`,
                )
                : null,
            )
            : null,
        ),
      ),
    ),
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Suites',
        title: 'Execution breakdown',
        copy: 'Each suite keeps its own tests, warnings, and timing footprint.',
        compact: true,
      },
      Array.isArray(run.suites) && run.suites.length > 0
        ? React.createElement(ProgressiveSuiteList, { runId: run.id, suites: run.suites })
        : React.createElement(EmptyState, {
          title: 'No suites stored',
          copy: 'This run did not expose suite-level detail.',
        }),
    ),
  );
}

function ProgressiveSuiteList({ runId, suites }) {
  const [expandedSuiteId, setExpandedSuiteId] = React.useState(null);
  const [testsBySuite, setTestsBySuite] = React.useState({});
  const [loadingSuiteId, setLoadingSuiteId] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [searchFilter, setSearchFilter] = React.useState('');
  const requestRef = React.useRef(null);
  const filterKeyRef = React.useRef(`${statusFilter}\0${searchFilter}`);

  const loadSuitePage = React.useCallback(async (suite, append = false) => {
    const existing = testsBySuite[suite.id] || { tests: [], hasMore: false, nextCursor: null };
    const params = new URLSearchParams({ suiteRunId: suite.id });
    if (append && existing.nextCursor) params.set('after', existing.nextCursor);
    if (statusFilter) params.set('status', statusFilter);
    if (searchFilter.trim()) params.set('search', searchFilter.trim());
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingSuiteId(suite.id);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/suite-tests?${params.toString()}`, { signal: controller.signal });
      const payload = await readJsonResponse(response);
      setTestsBySuite((current) => ({
        ...current,
        [suite.id]: {
          tests: append
            ? [...(current[suite.id]?.tests || []), ...(Array.isArray(payload.tests) ? payload.tests : [])]
            : (Array.isArray(payload.tests) ? payload.tests : []),
          hasMore: payload.hasMore === true,
          nextCursor: payload.nextCursor || null,
        },
      }));
    } catch (loadError) {
      if (loadError?.name !== 'AbortError') setError(loadError instanceof Error ? loadError.message : 'Unable to load suite tests');
    } finally {
      if (!controller.signal.aborted) setLoadingSuiteId(null);
    }
  }, [runId, searchFilter, statusFilter, testsBySuite]);

  React.useEffect(() => () => requestRef.current?.abort(), []);

  React.useEffect(() => {
    const filterKey = `${statusFilter}\0${searchFilter}`;
    if (filterKeyRef.current === filterKey) return undefined;
    filterKeyRef.current = filterKey;
    if (!expandedSuiteId) return undefined;
    const suite = suites.find((entry) => entry.id === expandedSuiteId);
    if (!suite) return undefined;
    const timer = setTimeout(() => {
      setTestsBySuite((current) => ({ ...current, [suite.id]: undefined }));
      void loadSuitePage(suite, false);
      const url = new URL(window.location.href);
      if (statusFilter) url.searchParams.set('testStatus', statusFilter); else url.searchParams.delete('testStatus');
      if (searchFilter.trim()) url.searchParams.set('testSearch', searchFilter.trim()); else url.searchParams.delete('testSearch');
      window.history.replaceState(window.history.state, '', url);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchFilter, statusFilter]);

  const toggleSuite = React.useCallback(async (suite) => {
    if (expandedSuiteId === suite.id) {
      setExpandedSuiteId(null);
      return;
    }
    setExpandedSuiteId(suite.id);
    if (testsBySuite[suite.id]) return;
    await loadSuitePage(suite);
  }, [expandedSuiteId, loadSuitePage, testsBySuite]);

  return React.createElement(
    'div',
    { className: 'web-list' },
    React.createElement(
      'div',
      { className: 'web-list__row' },
      React.createElement(
        'label',
        { className: 'web-list__meta' },
        'Status ',
        React.createElement(
          'select',
          { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value), 'aria-label': 'Filter suite tests by status' },
          React.createElement('option', { value: '' }, 'All'),
          React.createElement('option', { value: 'failed' }, 'Failed'),
          React.createElement('option', { value: 'passed' }, 'Passed'),
          React.createElement('option', { value: 'skipped' }, 'Skipped'),
        ),
      ),
      React.createElement('input', {
        type: 'search',
        value: searchFilter,
        placeholder: 'Search tests',
        'aria-label': 'Search suite tests',
        onChange: (event) => setSearchFilter(event.target.value),
      }),
    ),
    ...suites.map((suite) => {
      const expanded = expandedSuiteId === suite.id;
      const suitePage = testsBySuite[suite.id] || { tests: [], hasMore: false, nextCursor: null };
      const tests = suitePage.tests;
      const totalTests = Number.isFinite(suite.summary?.total) ? suite.summary.total : null;
      return React.createElement(
        'article',
        { className: 'web-list__item', key: suite.id },
        React.createElement(
          'div',
          { className: 'web-list__row' },
          React.createElement('strong', { className: 'web-list__title' }, suite.label),
          React.createElement(StatusPill, { status: suite.status }),
        ),
        React.createElement(
          'div',
          { className: 'web-list__row' },
          React.createElement('span', { className: 'web-chip' }, suite.runtime),
          React.createElement('span', { className: 'web-chip' }, formatDuration(suite.durationMs)),
          React.createElement('span', { className: 'web-chip' }, totalTests === null ? 'tests unavailable' : `${totalTests} tests`),
          React.createElement('button', {
            type: 'button',
            className: 'web-button web-button--ghost',
            onClick: () => void toggleSuite(suite),
            'aria-expanded': expanded,
          }, expanded ? 'Collapse tests' : 'Load tests'),
        ),
        suite.warnings?.length ? React.createElement(InlineList, { items: suite.warnings }) : null,
        expanded
          ? React.createElement(
            'div',
            { className: 'web-list', 'aria-live': 'polite' },
            loadingSuiteId === suite.id
              ? React.createElement('span', { className: 'web-list__meta' }, 'Loading tests…')
              : tests.length > 0
                ? React.createElement(VirtualTestRows, { tests })
                : React.createElement('span', { className: 'web-list__meta' }, 'No test rows returned.'),
            suitePage.hasMore
              ? React.createElement('button', {
                type: 'button',
                className: 'web-button web-button--ghost',
                disabled: loadingSuiteId === suite.id,
                onClick: () => void loadSuitePage(suite, true),
              }, loadingSuiteId === suite.id ? 'Loading more…' : `Load next 100${totalTests ? ` of ${totalTests}` : ''}`)
              : null,
          )
          : null,
        expanded && error ? React.createElement('span', { className: 'web-list__meta', role: 'alert' }, error) : null,
      );
    }),
  );
}

function VirtualTestRows({ tests, height = 360, rowHeight = 76 }) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const overscan = 4;
  const visibleCount = Math.ceil(height / rowHeight);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(tests.length, start + visibleCount + overscan * 2);
  return React.createElement(
    'div',
    {
      role: 'list',
      tabIndex: 0,
      'aria-label': `${tests.length} loaded tests`,
      onScroll: (event) => setScrollTop(event.currentTarget.scrollTop),
      style: { height: `${height}px`, overflowY: 'auto', position: 'relative' },
    },
    React.createElement(
      'div',
      { style: { height: `${tests.length * rowHeight}px`, position: 'relative' } },
      ...tests.slice(start, end).map((test, index) => React.createElement(
        'div',
        {
          role: 'listitem',
          className: 'web-list__item',
          key: test.id,
          style: { position: 'absolute', top: `${(start + index) * rowHeight}px`, left: 0, right: 0, minHeight: `${rowHeight}px` },
        },
        React.createElement('div', { className: 'web-list__row' },
          React.createElement('span', { className: 'web-list__title' }, test.fullName),
          React.createElement(StatusPill, { status: test.status }),
        ),
        React.createElement('span', { className: 'web-list__meta' }, `${test.filePath || 'no file'} • ${formatDuration(test.durationMs)}`),
      )),
    ),
  );
}

function TemplateSwitch({ runId, activeTemplate }) {
  return React.createElement(
    'nav',
    { className: 'web-segmented-control', 'aria-label': 'Run report templates' },
    React.createElement(
      Link,
      {
        href: buildRunTemplateHref(runId, 'web'),
        shallow: true,
        'data-perf-id': 'run-template-web',
        className: activeTemplate === 'web'
          ? 'web-segmented-control__link web-segmented-control__link--active'
          : 'web-segmented-control__link',
      },
      'Operations view',
    ),
    React.createElement(
      Link,
      {
        href: buildRunTemplateHref(runId, 'runner'),
        shallow: true,
        'data-perf-id': 'run-template-runner',
        className: activeTemplate === 'runner'
          ? 'web-segmented-control__link web-segmented-control__link--active'
          : 'web-segmented-control__link',
      },
      'Runner report',
    ),
  );
}

function RunnerReportSection({ runId, externalKey }) {
  return React.createElement(RunnerReportFrame, {
    runId,
    title: `${externalKey} runner report`,
  });
}

function RunnerReportFrame({ runId, title }) {
  const iframeRef = React.useRef(null);
  const [frameHeight, setFrameHeight] = React.useState(1200);
  const hasReportedHeightRef = React.useRef(false);

  React.useEffect(() => {
    const handleMessage = (event) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) {
        return;
      }

      if (event.data?.type !== RUNNER_REPORT_HEIGHT_MESSAGE_TYPE) {
        return;
      }

      const nextHeight = Number.parseInt(event.data.height, 10);
      if (Number.isFinite(nextHeight) && nextHeight > 0) {
        setFrameHeight(Math.max(960, nextHeight));
        if (!hasReportedHeightRef.current) {
          hasReportedHeightRef.current = true;
          recordClientPageMark('runner-frame-height-ready', {
            runId,
            height: Math.max(960, nextHeight),
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return React.createElement('iframe', {
    ref: iframeRef,
    src: `/api/runs/${encodeURIComponent(runId)}/report`,
    title,
    className: 'web-runner-frame',
    scrolling: 'no',
    sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    onLoad: () => {
      recordClientPageMark('runner-frame-load', { runId });
    },
    style: {
      height: `${frameHeight}px`,
    },
  });
}

function ChangeListCard({ title, changes }) {
  return React.createElement(
    'div',
    { className: 'web-card web-card--compact' },
    React.createElement('p', { className: 'web-card__eyebrow' }, title),
    Array.isArray(changes) && changes.length > 0
      ? React.createElement(
        'div',
        { className: 'web-list' },
        ...changes.map((change) => React.createElement(
          'article',
          { className: 'web-list__item', key: `${change.scopeType}:${change.label}` },
          React.createElement(
            'div',
            { className: 'web-list__row' },
            React.createElement('strong', { className: 'web-list__title' }, change.label),
            React.createElement('span', { className: 'web-chip' }, formatSignedDelta(change.deltaLinesPct)),
          ),
          React.createElement(
            'div',
            { className: 'web-list__meta' },
            `${formatCoveragePct(change.previousLinesPct)} -> ${formatCoveragePct(change.currentLinesPct)}`,
          ),
        )),
      )
      : React.createElement(EmptyState, {
        title: 'No changes recorded',
        copy: 'This scope did not produce a comparison delta for the current run.',
      }),
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) => async (context) => {
  const session = await getWebSession(context.req, context.res);
  const runId = typeof context.params?.id === 'string' ? context.params.id : '';
  const templateMode = resolveRunTemplateMode(context.query?.template);
  const requestTrace = resolveWebRequestTrace(context.req);
  applyTraceHeadersToNextResponse(context.res, requestTrace);
  const pageProfiler = createPageLoadProfiler({
    pageType: 'run',
    route: `/runs/${runId}${templateMode === 'web' ? '?template=web' : ''}`,
  });
  const data = await loadRunExplorerPage({
    session,
    runId,
    templateMode,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
    requestTrace,
    profiler: pageProfiler,
  });
  const pageProfile = pageProfiler.finalize({
    trace: requestTrace,
    runId,
    templateMode,
    failedTestCount: Array.isArray(data?.failedTests) ? data.failedTests.length : 0,
    benchmarkStatCount: Array.isArray(data?.runPerformanceStats) ? data.runPerformanceStats.length : 0,
    artifactCount: Array.isArray(data?.run?.artifacts) ? data.run.artifacts.length : 0,
  });
  const serverTimingHeader = buildServerTimingHeader(pageProfile);
  if (serverTimingHeader && context.res && typeof context.res.setHeader === 'function') {
    context.res.setHeader('Server-Timing', serverTimingHeader);
    pageProfile.serverTiming = serverTimingHeader;
  }

  return buildRunPageResult({
    store,
    session,
    runId,
    templateMode,
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
