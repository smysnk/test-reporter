import React from 'react';

export function SectionCard({ eyebrow, title, copy, children, compact = false }) {
  return React.createElement(
    'section',
    { className: compact ? 'portal-card portal-card--compact' : 'portal-card' },
    eyebrow ? React.createElement('p', { className: 'portal-card__eyebrow' }, eyebrow) : null,
    title ? React.createElement('h2', { className: 'portal-card__title' }, title) : null,
    copy ? React.createElement('p', { className: 'portal-card__copy' }, copy) : null,
    children,
  );
}

export function MetricGrid({ items }) {
  return React.createElement(
    'div',
    { className: 'portal-metrics' },
    ...(Array.isArray(items) ? items : []).map((item) => React.createElement(
      'article',
      { className: 'portal-metric', key: item.label },
      React.createElement('span', { className: 'portal-metric__label' }, item.label),
      React.createElement('strong', { className: 'portal-metric__value' }, item.value),
      item.copy ? React.createElement('span', { className: 'portal-metric__copy' }, item.copy) : null,
    )),
  );
}

export function StatusPill({ status }) {
  const normalized = typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : 'unknown';
  return React.createElement(
    'span',
    { className: `portal-pill portal-pill--${normalized}` },
    normalized,
  );
}

export function EmptyState({ title, copy }) {
  return React.createElement(
    'div',
    { className: 'portal-empty' },
    React.createElement('strong', { className: 'portal-empty__title' }, title),
    React.createElement('p', { className: 'portal-empty__copy' }, copy),
  );
}

export function InlineList({ items }) {
  return React.createElement(
    'div',
    { className: 'portal-inline-list' },
    ...(Array.isArray(items) ? items : []).map((item) => React.createElement(
      'span',
      { className: 'portal-inline-list__item', key: item },
      item,
    )),
  );
}
