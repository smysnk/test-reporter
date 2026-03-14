import React from 'react';
import { formatRunBuildLabel } from '../lib/format.js';

export function SectionCard({ eyebrow, title, copy, children, compact = false }) {
  return React.createElement(
    'section',
    { className: compact ? 'web-card web-card--compact' : 'web-card' },
    eyebrow ? React.createElement('p', { className: 'web-card__eyebrow' }, eyebrow) : null,
    title ? React.createElement('h2', { className: 'web-card__title' }, title) : null,
    copy ? React.createElement('p', { className: 'web-card__copy' }, copy) : null,
    children,
  );
}

export function MetricGrid({ items }) {
  return React.createElement(
    'div',
    { className: 'web-metrics' },
    ...(Array.isArray(items) ? items : []).map((item) => React.createElement(
      'article',
      { className: 'web-metric', key: item.label },
      React.createElement('span', { className: 'web-metric__label' }, item.label),
      React.createElement('strong', { className: 'web-metric__value' }, item.value),
      item.copy ? React.createElement('span', { className: 'web-metric__copy' }, item.copy) : null,
    )),
  );
}

export function StatusPill({ status }) {
  const normalized = typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : 'unknown';
  return React.createElement(
    'span',
    { className: `web-pill web-pill--${normalized}` },
    normalized,
  );
}

export function EmptyState({ title, copy }) {
  return React.createElement(
    'div',
    { className: 'web-empty' },
    React.createElement('strong', { className: 'web-empty__title' }, title),
    React.createElement('p', { className: 'web-empty__copy' }, copy),
  );
}

export function InlineList({ items }) {
  return React.createElement(
    'div',
    { className: 'web-inline-list' },
    ...(Array.isArray(items) ? items : []).map((item) => React.createElement(
      'span',
      { className: 'web-inline-list__item', key: item },
      item,
    )),
  );
}

export function RunBuildChip({ run }) {
  const label = formatRunBuildLabel(run);
  const href = typeof run?.sourceUrl === 'string' && run.sourceUrl.trim() ? run.sourceUrl.trim() : null;

  if (!label) {
    return null;
  }

  if (href) {
    return React.createElement(
      'a',
      {
        href,
        target: '_blank',
        rel: 'noreferrer',
        className: 'web-chip',
      },
      label,
    );
  }

  return React.createElement('span', { className: 'web-chip' }, label);
}
