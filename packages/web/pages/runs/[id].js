import React from 'react';
import Link from 'next/link';
import { EmptyState, InlineList, MetricGrid, SectionCard, StatusPill } from '../../components/WebBits.js';
import { formatCoveragePct, formatDateTime, formatDuration, formatSignedDelta } from '../../lib/format.js';
import { requireWebSession } from '../../lib/auth.js';
import { loadRunExplorerPage } from '../../lib/serverGraphql.js';
import { setRuntimeConfig, setSelectedProjectSlug, setSelectedRunId, setViewMode, wrapper } from '../../store/index.js';

export default function RunDetailPage({ data }) {
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

  const runPackages = Array.isArray(data?.runPackages) ? data.runPackages : [];
  const runModules = Array.isArray(data?.runModules) ? data.runModules : [];
  const runFiles = Array.isArray(data?.runFiles) ? data.runFiles : [];
  const failedTests = Array.isArray(data?.failedTests) ? data.failedTests : [];
  const coverageComparison = data?.coverageComparison || null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      SectionCard,
      {
        eyebrow: 'Run Detail',
        title: run.externalKey,
        copy: 'A single execution view that combines summary counts, suite health, failure details, files, and raw artifacts.',
      },
      React.createElement(
        'div',
        { className: 'web-list__row' },
        React.createElement(Link, { href: `/projects/${run.project?.slug}` }, run.project?.name || 'Project'),
        React.createElement(StatusPill, { status: run.status }),
      ),
      React.createElement(MetricGrid, {
        items: [
          { label: 'Completed', value: formatDateTime(run.completedAt), copy: run.branch || 'no branch' },
          { label: 'Duration', value: formatDuration(run.durationMs), copy: run.projectVersion?.versionKey || 'version unavailable' },
          { label: 'Line Coverage', value: formatCoveragePct(run.coverageSnapshot?.linesPct), copy: `branch ${formatCoveragePct(run.coverageSnapshot?.branchesPct)}` },
        ],
      }),
    ),
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
                ? React.createElement('a', { href: artifact.href, target: '_blank', rel: 'noreferrer' }, artifact.href)
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
                  React.createElement('td', null, file.path),
                  React.createElement('td', null, file.moduleName || 'uncategorized'),
                  React.createElement('td', null, React.createElement(StatusPill, { status: file.status })),
                  React.createElement('td', null, `${file.failedTestCount}/${file.testCount}`),
                  React.createElement('td', null, formatCoveragePct(file.coverage?.linesPct)),
                )),
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
  const auth = await requireWebSession(context);
  if (auth.redirect) {
    return {
      redirect: auth.redirect,
    };
  }

  const runId = typeof context.params?.id === 'string' ? context.params.id : '';
  const data = await loadRunExplorerPage({
    session: auth.session,
    runId,
    requestId: typeof context.req.headers['x-request-id'] === 'string' ? context.req.headers['x-request-id'] : null,
  });

  if (!data) {
    return {
      notFound: true,
    };
  }

  store.dispatch(setViewMode('run'));
  store.dispatch(setRuntimeConfig({ graphqlPath: '/graphql' }));
  store.dispatch(setSelectedProjectSlug(data.run?.project?.slug || null));
  store.dispatch(setSelectedRunId(runId));

  return {
    props: {
      session: auth.session,
      data,
    },
  };
});
