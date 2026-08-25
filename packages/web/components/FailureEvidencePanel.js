import React from 'react';
import Link from 'next/link';
import { formatCoveragePct, formatDateTime, formatDuration } from '../lib/format.js';
import { OperationsStatus, formatOperationsBuild, formatOperationsSummary } from './OperationsBits.js';

const evidenceCache = new Map();

function useFailureEvidence(runId) {
  const [retryKey, setRetryKey] = React.useState(0);
  const hasCached = Boolean(runId && evidenceCache.has(runId));
  const cached = hasCached ? evidenceCache.get(runId) : null;
  const [state, setState] = React.useState(() => ({ data: cached, loading: Boolean(runId && !hasCached), error: null }));
  React.useEffect(() => {
    if (!runId) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    if (evidenceCache.has(runId)) {
      const existing = evidenceCache.get(runId);
      setState({ data: existing, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });
    fetch(`/api/runs/${encodeURIComponent(runId)}/failure-evidence`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Evidence request failed (${response.status})`);
        return payload.evidence;
      })
      .then((data) => {
        evidenceCache.set(runId, data);
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [retryKey, runId]);
  return {
    ...state,
    retry() {
      if (runId) evidenceCache.delete(runId);
      setRetryKey((value) => value + 1);
    },
  };
}

export function FailureEvidencePanel({ run, runId = null, outOfScope = false, onClearFilters = null, onClose }) {
  const selectedRunId = run?.id || runId;
  const evidenceState = useFailureEvidence(selectedRunId);
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  if (!selectedRunId) return null;

  const evidence = evidenceState.data;
  const displayRun = run || (evidence ? {
    id: evidence.runId,
    externalKey: evidence.externalKey,
    status: evidence.status,
    publicationKinds: ['tests'],
    project: { key: evidence.projectKey, slug: evidence.projectSlug, name: evidence.projectName },
    projectVersion: Number.isFinite(evidence.buildNumber) ? { buildNumber: evidence.buildNumber } : null,
    branch: evidence.branch,
    commitSha: evidence.commitSha,
    sourceUrl: evidence.sourceUrl,
    completedAt: evidence.completedAt,
  } : {
    id: selectedRunId,
    externalKey: selectedRunId,
    status: 'unknown',
    publicationKinds: [],
    project: null,
  });

  const details = [
    ['Project', displayRun.project?.name || 'Unknown project'],
    ['Build', formatOperationsBuild(displayRun) || 'Unavailable'],
    ['Branch', displayRun.branch || 'Unavailable'],
    ['Commit', displayRun.commitSha ? displayRun.commitSha.slice(0, 12) : 'Unavailable'],
    ['Triggered by', evidence?.triggeredBy || 'Unavailable'],
    ['Duration', formatDuration(displayRun.durationMs)],
    ['Coverage', formatCoveragePct(displayRun.coverageSnapshot?.linesPct)],
    ['Completed', formatDateTime(displayRun.completedAt)],
  ];
  const failureMessage = evidence?.failedTest?.failureMessages?.[0] || evidence?.error?.message || null;
  const failureStack = evidence?.error?.stack || null;

  return React.createElement(
    'aside',
    { className: 'operations-inspector', 'aria-label': 'Run inspector', 'aria-live': 'polite' },
    React.createElement('div', { className: 'operations-inspector__header' },
      React.createElement('div', null,
        React.createElement('p', { className: 'operations-kicker' }, 'Selected publication'),
        React.createElement('h2', null, displayRun.project?.name || displayRun.externalKey || 'Run')),
      React.createElement('button', { type: 'button', className: 'operations-icon-button', onClick: onClose, 'aria-label': 'Close run inspector' }, '×')),
    React.createElement('div', { className: 'operations-inspector__status' }, React.createElement(OperationsStatus, { run: displayRun }), React.createElement('span', null, formatOperationsSummary(displayRun))),
    !run || outOfScope ? React.createElement('div', { className: 'operations-inspector__scope-note' },
      React.createElement('span', null, 'This publication is outside the currently loaded or filtered rows. Evidence remains selected.'),
      onClearFilters ? React.createElement('button', { type: 'button', className: 'operations-text-button', onClick: onClearFilters }, 'Clear filters') : null) : null,
    React.createElement('dl', { className: 'operations-inspector__details' },
      ...details.flatMap(([label, value]) => [React.createElement('dt', { key: `${label}-label` }, label), React.createElement('dd', { key: `${label}-value` }, value)])),
    React.createElement(
      'section',
      { className: 'operations-inspector__evidence', 'aria-label': 'Failure evidence' },
      React.createElement('h3', null, 'Failure evidence'),
      evidenceState.loading ? React.createElement('p', { className: 'operations-inspector__loading' }, 'Loading evidence…') : null,
      evidenceState.error ? React.createElement(React.Fragment, null,
        React.createElement('p', { className: 'operations-inspector__error', role: 'alert' }, evidenceState.error),
        React.createElement('button', { type: 'button', className: 'operations-text-button', onClick: evidenceState.retry }, 'Retry evidence')) : null,
      !evidenceState.loading && !evidenceState.error && evidence?.failedTest
        ? React.createElement(React.Fragment, null,
          React.createElement('strong', { className: 'operations-inspector__test-name' }, evidence.failedTest.fullName),
          evidence.failedTest.filePath ? React.createElement('p', { className: 'operations-inspector__file' }, `${evidence.failedTest.filePath}${evidence.failedTest.line ? `:${evidence.failedTest.line}` : ''}`) : null,
          failureMessage ? React.createElement('pre', { className: 'operations-inspector__failure' }, failureMessage) : null,
          failureStack
            ? React.createElement('pre', { className: 'operations-inspector__stack' }, failureStack)
            : React.createElement('p', { className: 'operations-inspector__empty' }, 'No stack trace was attached.'))
        : null,
      !evidenceState.loading && !evidenceState.error && evidence && !evidence.failedTest
        ? React.createElement('p', { className: 'operations-inspector__empty' }, 'No failed test evidence is attached to this publication.')
        : null,
    ),
    React.createElement('div', { className: 'operations-inspector__actions' },
      React.createElement(Link, { href: `/runs/${selectedRunId}`, className: 'web-button' }, 'Open run'),
      evidence?.reportUrl ? React.createElement('a', { href: evidence.reportUrl, target: '_blank', rel: 'noreferrer', className: 'web-button web-button--ghost' }, 'View logs') : null,
      !evidenceState.loading && !evidenceState.error && !evidence?.reportUrl
        ? React.createElement('span', { className: 'operations-inspector__action-note' }, 'No report or log artifact available.')
        : null,
      displayRun.sourceUrl ? React.createElement('a', { href: displayRun.sourceUrl, target: '_blank', rel: 'noreferrer', className: 'web-button web-button--ghost' }, 'Source run') : null),
  );
}
