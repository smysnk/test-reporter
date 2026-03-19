import React from 'react';
import Link from 'next/link';
import { RunBenchmarkSummary } from '../../components/BenchmarkBits.js';
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
  const run = data?.run || null;
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

  React.useEffect(() => {
    recordClientPageMark('run-page-ready', {
      runId: run.id,
      templateMode,
      failedTestCount: Array.isArray(data?.failedTests) ? data.failedTests.length : 0,
    });
  }, [data?.failedTests?.length, run.id, templateMode]);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Run Detail',
        title: run.externalKey,
        copy: templateMode === 'runner'
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
            activeTemplate: templateMode,
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
    templateMode === 'runner'
      ? React.createElement(RunnerReportSection, {
        runId: run.id,
        externalKey: run.externalKey,
      })
      : React.createElement(OperationsRunDetail, { data }),
  );
}

function OperationsRunDetail({ data }) {
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
      React.createElement(
        SectionCard,
        {
          eyebrow: 'Benchmarks',
          title: 'Recorded benchmark stats',
          copy: 'Namespaced benchmark rows from the run are grouped here so the operator can inspect the exact values behind the trend charts.',
          compact: true,
        },
        React.createElement(RunBenchmarkSummary, {
          stats: runPerformanceStats,
        }),
      ),
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
                  ...runFiles.map((file) => React.createElement(
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
        ? React.createElement(
          'div',
          { className: 'web-list' },
          ...run.suites.map((suite) => React.createElement(
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
              React.createElement('span', { className: 'web-chip' }, `${suite.tests.length} tests`),
            ),
            suite.warnings?.length
              ? React.createElement(InlineList, { items: suite.warnings })
              : null,
          )),
        )
        : React.createElement(EmptyState, {
          title: 'No suites stored',
          copy: 'This run did not expose suite-level detail.',
        }),
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
