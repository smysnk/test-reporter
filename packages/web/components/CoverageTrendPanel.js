import React from 'react';
import { formatCoveragePct, formatDateTime, formatSignedDelta } from '../lib/format.js';

export function CoverageTrendPanel({ title, subtitle = null, points = [], overlays = [], compact = false }) {
  const normalizedPoints = Array.isArray(points) ? [...points].sort(compareTrendPointsAscending) : [];
  const latestPoint = normalizedPoints[normalizedPoints.length - 1] || null;
  const previousPoint = normalizedPoints[normalizedPoints.length - 2] || null;
  const delta = Number.isFinite(latestPoint?.linesPct) && Number.isFinite(previousPoint?.linesPct)
    ? Number((latestPoint.linesPct - previousPoint.linesPct).toFixed(2))
    : null;
  const chartPoints = createChartPoints(normalizedPoints);

  return React.createElement(
    'article',
    { className: compact ? 'web-trend-card web-trend-card--compact' : 'web-trend-card' },
    React.createElement(
      'div',
      { className: 'web-list__row' },
      React.createElement(
        'div',
        { className: 'web-stack' },
        React.createElement('strong', { className: 'web-list__title' }, title),
        subtitle ? React.createElement('span', { className: 'web-list__meta' }, subtitle) : null,
      ),
      React.createElement(
        'div',
        { className: 'web-stack' },
        React.createElement('strong', { className: 'web-trend-card__value' }, formatCoveragePct(latestPoint?.linesPct)),
        React.createElement('span', { className: 'web-list__meta' }, formatSignedDelta(delta)),
      ),
    ),
    normalizedPoints.length > 0
      ? React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'svg',
          { className: 'web-trend-card__chart', viewBox: '0 0 320 120', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${title} trend` },
          React.createElement('path', {
            className: 'web-trend-card__baseline',
            d: 'M 0 108 L 320 108',
          }),
          React.createElement('polyline', {
            className: 'web-trend-card__line',
            points: chartPoints.map((point) => `${point.x},${point.y}`).join(' '),
          }),
          ...chartPoints.map((point) => React.createElement('circle', {
            key: point.key,
            className: 'web-trend-card__dot',
            cx: point.x,
            cy: point.y,
            r: point.latest ? 4 : 3,
          })),
          ...createOverlayMarkers(normalizedPoints, overlays).map((overlay) => React.createElement('g', {
            key: overlay.key,
            className: 'web-trend-card__overlay',
          },
          React.createElement('line', {
            x1: overlay.x,
            x2: overlay.x,
            y1: 10,
            y2: 108,
          }),
          React.createElement('circle', {
            cx: overlay.x,
            cy: 14,
            r: 4,
          }))),
        ),
        React.createElement(
          'div',
          { className: 'web-list__row' },
          React.createElement('span', { className: 'web-list__meta' }, formatDateTime(latestPoint?.completedAt || latestPoint?.recordedAt)),
          React.createElement('span', { className: 'web-list__meta' }, `${normalizedPoints.length} points`),
        ),
        overlays.length > 0
          ? React.createElement(
            'div',
            { className: 'web-inline-list' },
            ...overlays.slice(0, 4).map((overlay) => React.createElement(
              'span',
              { className: `web-chip ${overlay.kind === 'release' ? 'web-chip--release' : ''}`, key: `${overlay.kind}:${overlay.label}:${overlay.recordedAt}` },
              overlay.kind === 'release' ? `release ${overlay.label}` : `version ${overlay.label}`,
            )),
          )
          : null,
      )
      : React.createElement('span', { className: 'web-list__meta' }, 'No historical points available.'),
  );
}

function createChartPoints(points) {
  if (points.length === 1) {
    return [{
      x: 160,
      y: scalePoint(points[0].linesPct),
      key: points[0].runId || points[0].label || 'single',
      latest: true,
    }];
  }

  return points.map((point, index) => ({
    x: 16 + (index * (288 / Math.max(1, points.length - 1))),
    y: scalePoint(point.linesPct),
    key: point.runId || `${point.label}:${index}`,
    latest: index === points.length - 1,
  }));
}

function createOverlayMarkers(points, overlays) {
  const source = Array.isArray(overlays) ? overlays : [];
  return source.map((overlay) => {
    const overlayTime = new Date(overlay.recordedAt).valueOf();
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [index, point] of points.entries()) {
      const pointTime = new Date(point.completedAt || point.recordedAt).valueOf();
      const distance = Math.abs(pointTime - overlayTime);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    const x = points.length === 1
      ? 160
      : 16 + (nearestIndex * (288 / Math.max(1, points.length - 1)));

    return {
      ...overlay,
      x,
      key: `${overlay.kind}:${overlay.label}:${overlay.recordedAt}`,
    };
  });
}

function scalePoint(value) {
  if (!Number.isFinite(value)) {
    return 108;
  }
  const clamped = Math.max(0, Math.min(100, value));
  return 108 - ((clamped / 100) * 92);
}

function compareTrendPointsAscending(left, right) {
  const leftTime = new Date(left.completedAt || left.recordedAt || 0).valueOf();
  const rightTime = new Date(right.completedAt || right.recordedAt || 0).valueOf();
  return leftTime - rightTime;
}
