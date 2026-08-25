import React from 'react';

function buildScale(points) {
  const values = points.filter((point) => Number.isFinite(point.linesPct)).map((point) => point.linesPct);
  if (values.length === 0) return { min: 0, max: 100 };
  let min = Math.max(0, Math.floor(Math.min(...values) - 2));
  let max = Math.min(100, Math.ceil(Math.max(...values) + 2));
  if (max - min < 6) {
    const midpoint = (min + max) / 2;
    min = Math.max(0, midpoint - 3);
    max = Math.min(100, midpoint + 3);
  }
  return { min, max };
}

function pointY(value, height, padding, scale) {
  return padding + ((scale.max - value) / Math.max(1, scale.max - scale.min)) * (height - padding * 2);
}

function buildPath(points, width, height, padding, scale) {
  const valid = points.map((point, index) => ({ ...point, index })).filter((point) => Number.isFinite(point.linesPct));
  if (valid.length === 0) return '';
  return valid.map((point, position) => {
    const x = padding + (point.index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = pointY(point.linesPct, height, padding, scale);
    return `${position === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export function OperationsCoverageChart({ points, scopeLabel, threshold = null }) {
  const width = 520;
  const height = 132;
  const padding = 16;
  const scale = buildScale(Array.isArray(points) ? points : []);
  const path = buildPath(points, width, height, padding, scale);
  const latest = [...(Array.isArray(points) ? points : [])].reverse().find((point) => Number.isFinite(point.linesPct));
  const thresholdY = Number.isFinite(threshold) && threshold >= scale.min && threshold <= scale.max
    ? pointY(threshold, height, padding, scale)
    : null;
  return React.createElement(
    'section',
    { className: 'operations-analysis-panel operations-coverage-chart', 'aria-labelledby': 'operations-coverage-title' },
    React.createElement('div', { className: 'operations-analysis-panel__heading' },
      React.createElement('div', null,
        React.createElement('p', { className: 'operations-kicker' }, 'Daily latest'),
        React.createElement('h3', { id: 'operations-coverage-title' }, 'Coverage trend')),
      React.createElement('span', null, latest ? `${latest.linesPct.toFixed(1)}% · ${latest.projectCount} project${latest.projectCount === 1 ? '' : 's'}` : 'No coverage')),
    path
      ? React.createElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${scopeLabel} line coverage over the active window`, preserveAspectRatio: 'none' },
        React.createElement('line', { x1: padding, y1: padding, x2: padding, y2: height - padding, className: 'operations-coverage-chart__axis' }),
        React.createElement('line', { x1: padding, y1: height - padding, x2: width - padding, y2: height - padding, className: 'operations-coverage-chart__axis' }),
        React.createElement('text', { x: padding + 3, y: padding + 8, className: 'operations-coverage-chart__axis-label' }, `${scale.max.toFixed(0)}%`),
        React.createElement('text', { x: padding + 3, y: height - padding - 4, className: 'operations-coverage-chart__axis-label' }, `${scale.min.toFixed(0)}%`),
        thresholdY !== null ? React.createElement('line', { x1: padding, y1: thresholdY, x2: width - padding, y2: thresholdY, className: 'operations-coverage-chart__threshold' }) : null,
        React.createElement('path', { d: path, className: 'operations-coverage-chart__line' }),
        ...(points || []).map((point, index) => {
          if (!Number.isFinite(point.linesPct)) return null;
          const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
          const y = pointY(point.linesPct, height, padding, scale);
          return React.createElement('circle', { key: point.key, cx: x, cy: y, r: 3, className: 'operations-coverage-chart__point' },
            React.createElement('title', null, `${point.key}: ${point.linesPct.toFixed(1)}% from ${point.projectCount} project${point.projectCount === 1 ? '' : 's'}`));
        }))
      : React.createElement('p', { className: 'operations-analysis-panel__empty' }, 'No line coverage was published in this window.'),
    React.createElement('ul', { className: 'sr-only', 'aria-label': 'Coverage values by day' },
      ...(points || []).filter((point) => Number.isFinite(point.linesPct)).map((point) => React.createElement('li', { key: point.key },
        `${point.key}: ${point.linesPct.toFixed(1)}% from ${point.projectCount} project${point.projectCount === 1 ? '' : 's'}`))),
  );
}
