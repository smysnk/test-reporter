import React from 'react';
import Link from 'next/link';
import { EmptyState } from './WebBits.js';
import { formatCoveragePct, formatDuration } from '../lib/format.js';
import { OPERATIONS_PAGE_SIZE } from '../lib/operationsOverview.js';
import { OperationsStatus, completedTimeProps, formatOperationsBuild, formatOperationsSummary, formatRelativeTime } from './OperationsBits.js';

function interactiveTarget(target) {
  return Boolean(target?.closest?.('a, button, input, select, textarea, summary'));
}

export function OperationsRunGrid({ runs, selectedRunId, page, onPage, onSelectRun }) {
  const runList = Array.isArray(runs) ? runs : [];
  const totalPages = Math.max(1, Math.ceil(runList.length / OPERATIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRuns = runList.slice((safePage - 1) * OPERATIONS_PAGE_SIZE, safePage * OPERATIONS_PAGE_SIZE);
  if (runList.length === 0) {
    return React.createElement(EmptyState, { title: 'No matching publications', copy: 'Clear filters or load more history to expand the result set.' });
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'div',
      { className: 'web-table-wrap operations-table-wrap' },
      React.createElement(
        'table',
        { className: 'web-table web-explorer-table operations-table' },
        React.createElement('colgroup', null,
          React.createElement('col', { className: 'operations-table__col--run' }),
          React.createElement('col', { className: 'operations-table__col--status' }),
          React.createElement('col', { className: 'operations-table__col--build' }),
          React.createElement('col', { className: 'operations-table__col--branch' }),
          React.createElement('col', { className: 'operations-table__col--duration' }),
          React.createElement('col', { className: 'operations-table__col--coverage' }),
          React.createElement('col', { className: 'operations-table__col--completed' })),
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, 'Project / result'),
            React.createElement('th', null, 'Status'),
            React.createElement('th', null, 'Build'),
            React.createElement('th', null, 'Branch'),
            React.createElement('th', null, 'Duration'),
            React.createElement('th', null, 'Coverage'),
            React.createElement('th', null, 'Completed'))),
        React.createElement(
          'tbody',
          null,
          ...pageRuns.map((run) => {
            const selected = selectedRunId === run.id;
            const buildLabel = formatOperationsBuild(run);
            return React.createElement(
              'tr',
              {
                key: run.id,
                className: selected ? 'web-explorer-table__row operations-table__row operations-table__row--selected' : 'web-explorer-table__row operations-table__row',
                tabIndex: 0,
                'aria-selected': selected,
                'aria-label': `Inspect run ${run.externalKey || run.id}`,
                'data-perf-id': `run-row:${run.id}`,
                'data-run-id': run.id,
                onClick: (event) => {
                  if (!interactiveTarget(event.target)) onSelectRun(run);
                },
                onKeyDown: (event) => {
                  if (!interactiveTarget(event.target) && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onSelectRun(run);
                  }
                },
              },
              React.createElement('td', null,
                React.createElement('div', { className: 'operations-table__entity' },
                  React.createElement(Link, { href: `/runs/${run.id}`, className: 'operations-table__run-link', 'data-perf-id': `run-row-link:${run.id}` }, run.project?.name || 'Unknown project'),
                  React.createElement('span', { className: 'operations-table__summary' }, formatOperationsSummary(run)))),
              React.createElement('td', null, React.createElement(OperationsStatus, { run })),
              React.createElement('td', null,
                buildLabel
                  ? run.sourceUrl
                    ? React.createElement('a', { href: run.sourceUrl, target: '_blank', rel: 'noreferrer', className: 'operations-table__link' }, buildLabel)
                    : buildLabel
                  : React.createElement('span', { className: 'operations-muted' }, '—')),
              React.createElement('td', { className: 'operations-table__branch' }, run.branch || '—'),
              React.createElement('td', { className: 'operations-table__duration' }, formatDuration(run.durationMs)),
              React.createElement('td', { className: 'operations-table__coverage' }, formatCoveragePct(run.coverageSnapshot?.linesPct)),
              React.createElement('td', { className: 'operations-table__completed', ...completedTimeProps(run) }, formatRelativeTime(run.completedAt)),
            );
          }),
        ),
      ),
    ),
    totalPages > 1
      ? React.createElement('nav', { className: 'operations-pagination', 'aria-label': 'Run pages' },
        React.createElement('button', { type: 'button', disabled: safePage <= 1, onClick: () => onPage(safePage - 1) }, 'Previous'),
        React.createElement('span', null, `Page ${safePage} of ${totalPages}`),
        React.createElement('button', { type: 'button', disabled: safePage >= totalPages, onClick: () => onPage(safePage + 1) }, 'Next'))
      : null,
  );
}
