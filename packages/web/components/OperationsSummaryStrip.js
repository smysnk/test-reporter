import React from 'react';
import { formatCoveragePct, formatDuration } from '../lib/format.js';

function formatPassRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a';
}

export function OperationsSummaryStrip({ summary, windowDays }) {
  const items = [
    { label: 'Passing', value: formatPassRate(summary?.passRate), detail: `${summary?.passed || 0}/${summary?.terminal || 0} terminal` },
    { label: 'Failures', value: String(summary?.failed || 0), detail: 'failed test runs' },
    { label: 'Coverage', value: formatCoveragePct(summary?.latestCoverage), detail: 'latest scoped value' },
    { label: 'Median duration', value: formatDuration(summary?.medianDurationMs), detail: 'completed publications' },
    { label: 'Runs', value: String(summary?.total || 0), detail: `${windowDays}-day filtered window` },
  ];
  return React.createElement(
    'section',
    { className: 'operations-summary-strip', 'aria-label': `${windowDays}-day operations summary` },
    ...items.map((item) => React.createElement(
      'div',
      { className: 'operations-summary-strip__item', key: item.label },
      React.createElement('span', { className: 'operations-summary-strip__label' }, item.label),
      React.createElement('strong', { className: 'operations-summary-strip__value' }, item.value),
      React.createElement('span', { className: 'operations-summary-strip__detail' }, item.detail),
    )),
  );
}
