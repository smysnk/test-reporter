import React from 'react';
import { formatDateTime, formatRunBuildLabel, resolveRunBuildNumber } from '../lib/format.js';
import { resolveRunPresentation } from '../lib/operationsOverview.js';

export function OperationsStatus({ run }) {
  const presentation = resolveRunPresentation(run);
  return React.createElement('span', { className: `web-pill web-pill--${presentation.status}` }, presentation.label);
}

export function formatOperationsBuild(run) {
  const buildNumber = resolveRunBuildNumber(run);
  return Number.isFinite(buildNumber) ? `#${Math.trunc(buildNumber)}` : formatRunBuildLabel(run);
}

export function formatOperationsSummary(run) {
  const presentation = resolveRunPresentation(run);
  if (presentation.kind === 'performance') return 'Performance publication';
  if (presentation.kind === 'coverage') return 'Coverage publication';
  const passed = run?.summary?.passedTests;
  const failed = run?.summary?.failedTests;
  if (!Number.isFinite(passed) || !Number.isFinite(failed)) return 'Test summary unavailable';
  return `${passed} passed${failed > 0 ? ` · ${failed} failed` : ''}`;
}

export function formatRelativeTime(value, now = Date.now()) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'Unavailable';
  const elapsed = Math.max(0, now - parsed);
  for (const [duration, suffix] of [[86_400_000, 'd'], [3_600_000, 'h'], [60_000, 'm']]) {
    if (elapsed >= duration) return `${Math.floor(elapsed / duration)}${suffix} ago`;
  }
  return 'just now';
}

export function completedTimeProps(run) {
  return {
    title: formatDateTime(run?.completedAt),
    suppressHydrationWarning: true,
  };
}
