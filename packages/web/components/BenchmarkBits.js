import React from 'react';
import {
  formatBenchmarkMetricLabel,
  formatBenchmarkNamespace,
  formatBenchmarkValue,
  formatCommitSha,
  formatDateTime,
} from '../lib/format.js';
import { EmptyState } from './WebBits.js';

const SERIES_COLORS = ['#6bb2ff', '#4ee38b', '#ffd166', '#ff6b9a', '#c792ea', '#7dd3fc'];

export function BenchmarkExplorer({ benchmarkPanels = [] }) {
  const panels = Array.isArray(benchmarkPanels) ? benchmarkPanels.filter((panel) => Array.isArray(panel.metrics) && panel.metrics.length > 0) : [];
  const [activeStatGroup, setActiveStatGroup] = React.useState(panels[0]?.statGroup || '');
  const selectedPanel = panels.find((panel) => panel.statGroup === activeStatGroup) || panels[0] || null;
  const metrics = Array.isArray(selectedPanel?.metrics) ? selectedPanel.metrics : [];
  const [activeMetricName, setActiveMetricName] = React.useState(metrics[0]?.statName || '');
  const selectedMetric = metrics.find((metric) => metric.statName === activeMetricName) || metrics[0] || null;
  const allPoints = Array.isArray(selectedMetric?.points) ? selectedMetric.points.filter((point) => Number.isFinite(point.numericValue)) : [];
  const runnerKeys = uniqueStrings(allPoints.map((point) => point.runnerKey));
  const branches = uniqueStrings(allPoints.map((point) => point.branch));
  const seriesIds = uniqueStrings(allPoints.map((point) => point.seriesId || 'default'));
  const [runnerFilter, setRunnerFilter] = React.useState('all');
  const [branchFilter, setBranchFilter] = React.useState('all');
  const [timeframeFilter, setTimeframeFilter] = React.useState('all');
  const [visibleSeriesIds, setVisibleSeriesIds] = React.useState(seriesIds.slice(0, 4));

  React.useEffect(() => {
    if (!selectedPanel && activeStatGroup !== '') {
      setActiveStatGroup('');
      return;
    }
    if (selectedPanel && selectedPanel.statGroup !== activeStatGroup) {
      setActiveStatGroup(selectedPanel.statGroup);
    }
  }, [activeStatGroup, selectedPanel]);

  React.useEffect(() => {
    const nextMetricName = metrics[0]?.statName || '';
    if (!selectedMetric && activeMetricName !== nextMetricName) {
      setActiveMetricName(nextMetricName);
      return;
    }
    if (selectedMetric && selectedMetric.statName !== activeMetricName) {
      setActiveMetricName(selectedMetric.statName);
    }
  }, [activeMetricName, metrics, selectedMetric]);

  React.useEffect(() => {
    if (runnerFilter !== 'all' && !runnerKeys.includes(runnerFilter)) {
      setRunnerFilter('all');
    }
  }, [runnerFilter, runnerKeys]);

  React.useEffect(() => {
    if (branchFilter !== 'all' && !branches.includes(branchFilter)) {
      setBranchFilter('all');
    }
  }, [branchFilter, branches]);

  React.useEffect(() => {
    const defaults = seriesIds.slice(0, Math.min(4, seriesIds.length));
    const preserved = visibleSeriesIds.filter((seriesId) => seriesIds.includes(seriesId));
    const nextVisible = preserved.length > 0 ? preserved : defaults;
    if (!arraysEqual(visibleSeriesIds, nextVisible)) {
      setVisibleSeriesIds(nextVisible);
    }
  }, [seriesIds, visibleSeriesIds]);

  if (panels.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No benchmark trends',
      copy: 'Benchmark charts will appear once benchmark suites begin publishing namespaced performance stats.',
    });
  }

  const timeframeCutoff = resolveTimeframeCutoff(allPoints, timeframeFilter);
  const filteredPoints = allPoints.filter((point) => (
    (runnerFilter === 'all' || point.runnerKey === runnerFilter)
    && (branchFilter === 'all' || point.branch === branchFilter)
    && (!timeframeCutoff || new Date(point.completedAt || 0).valueOf() >= timeframeCutoff)
  ));
  const visiblePoints = filteredPoints.filter((point) => visibleSeriesIds.includes(point.seriesId || 'default'));
  const visibleSeries = buildBenchmarkSeries(visiblePoints);
  const latestPoint = visiblePoints[0] || null;

  return React.createElement(
    'div',
    { className: 'web-stack web-stack--tight' },
    React.createElement(
      'div',
      { className: 'web-benchmark-toolbar' },
      React.createElement(
        'label',
        { className: 'web-field' },
        React.createElement('span', { className: 'web-field__label' }, 'Namespace'),
        React.createElement(
          'select',
          {
            className: 'web-field__input',
            value: selectedPanel?.statGroup || '',
            onChange: (event) => setActiveStatGroup(event.target.value),
          },
          ...panels.map((panel) => React.createElement('option', { key: panel.statGroup, value: panel.statGroup }, formatBenchmarkNamespace(panel.statGroup))),
        ),
      ),
      React.createElement(
        'label',
        { className: 'web-field' },
        React.createElement('span', { className: 'web-field__label' }, 'Metric'),
        React.createElement(
          'select',
          {
            className: 'web-field__input',
            value: selectedMetric?.statName || '',
            onChange: (event) => setActiveMetricName(event.target.value),
          },
          ...metrics.map((metric) => React.createElement('option', { key: metric.statName, value: metric.statName }, formatBenchmarkMetricLabel(metric.statName))),
        ),
      ),
      React.createElement(
        'label',
        { className: 'web-field' },
        React.createElement('span', { className: 'web-field__label' }, 'Runner'),
        React.createElement(
          'select',
          {
            className: 'web-field__input',
            value: runnerFilter,
            onChange: (event) => setRunnerFilter(event.target.value),
          },
          React.createElement('option', { value: 'all' }, 'All runners'),
          ...runnerKeys.map((runnerKey) => React.createElement('option', { key: runnerKey, value: runnerKey }, runnerKey)),
        ),
      ),
      React.createElement(
        'label',
        { className: 'web-field' },
        React.createElement('span', { className: 'web-field__label' }, 'Branch'),
        React.createElement(
          'select',
          {
            className: 'web-field__input',
            value: branchFilter,
            onChange: (event) => setBranchFilter(event.target.value),
          },
          React.createElement('option', { value: 'all' }, 'All branches'),
          ...branches.map((branch) => React.createElement('option', { key: branch, value: branch }, branch)),
        ),
      ),
      React.createElement(
        'label',
        { className: 'web-field' },
        React.createElement('span', { className: 'web-field__label' }, 'Timeframe'),
        React.createElement(
          'select',
          {
            className: 'web-field__input',
            value: timeframeFilter,
            onChange: (event) => setTimeframeFilter(event.target.value),
          },
          React.createElement('option', { value: 'all' }, 'All time'),
          React.createElement('option', { value: '30d' }, 'Last 30 days'),
          React.createElement('option', { value: '90d' }, 'Last 90 days'),
          React.createElement('option', { value: '365d' }, 'Last year'),
        ),
      ),
    ),
    seriesIds.length > 1
      ? React.createElement(
        'div',
        { className: 'web-benchmark-series-toggles', role: 'group', 'aria-label': 'Visible benchmark series' },
        ...seriesIds.map((seriesId, index) => {
          const active = visibleSeriesIds.includes(seriesId);
          return React.createElement(
            'button',
            {
              type: 'button',
              key: seriesId,
              className: active
                ? 'web-benchmark-series-toggle web-benchmark-series-toggle--active'
                : 'web-benchmark-series-toggle',
              onClick: () => {
                if (active) {
                  if (visibleSeriesIds.length > 1) {
                    setVisibleSeriesIds(visibleSeriesIds.filter((value) => value !== seriesId));
                  }
                  return;
                }

                setVisibleSeriesIds([...visibleSeriesIds, seriesId]);
              },
            },
            React.createElement('span', {
              className: 'web-benchmark-series-toggle__swatch',
              style: { backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] },
            }),
            seriesId,
          );
        }),
      )
      : null,
    latestPoint
      ? React.createElement(
        'div',
        { className: 'web-list__row' },
        React.createElement('span', { className: 'web-list__meta' }, `Latest ${formatBenchmarkValue(latestPoint.numericValue, selectedMetric?.unit || latestPoint.unit)}`),
        React.createElement('span', { className: 'web-list__meta' }, `${visiblePoints.length} points across ${visibleSeries.length} series`),
      )
      : null,
    React.createElement(BenchmarkTrendCard, {
      title: formatBenchmarkMetricLabel(selectedMetric?.statName || ''),
      subtitle: formatBenchmarkNamespace(selectedPanel?.statGroup || ''),
      unit: selectedMetric?.unit || null,
      series: visibleSeries,
    }),
  );
}

export function RunBenchmarkSummary({ stats = [] }) {
  const groups = buildRunBenchmarkGroups(stats);

  if (groups.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No benchmark stats recorded',
      copy: 'This run does not include benchmark metrics yet.',
    });
  }

  return React.createElement(
    'div',
    { className: 'web-stack web-stack--tight' },
    ...groups.map((group) => React.createElement(
      'div',
      { className: 'web-benchmark-group', key: group.statGroup },
      React.createElement(
        'div',
        { className: 'web-stack web-stack--tight' },
        React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkNamespace(group.statGroup)),
        React.createElement(
          'div',
          { className: 'web-inline-list' },
          ...uniqueStrings(group.stats.map((stat) => stat.seriesId)).map((seriesId) => React.createElement('span', { className: 'web-chip web-chip--muted', key: `${group.statGroup}:${seriesId}` }, seriesId)),
        ),
      ),
      React.createElement(
        'div',
        { className: 'web-list' },
        ...group.stats.map((stat) => React.createElement(
          'article',
          { className: 'web-list__item', key: stat.id || `${stat.statGroup}:${stat.statName}:${stat.seriesId || 'default'}` },
          React.createElement(
            'div',
            { className: 'web-list__row' },
            React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkMetricLabel(stat.statName)),
            React.createElement('span', { className: 'web-chip' }, formatBenchmarkValue(stat.numericValue, stat.unit)),
          ),
          React.createElement(
            'div',
            { className: 'web-list__meta' },
            `${stat.seriesId || 'default'} • ${stat.runnerKey || 'runner unavailable'} • ${resolveBenchmarkScopeLabel(stat)}`,
          ),
          React.createElement(
            'div',
            { className: 'web-list__meta' },
            `${formatDateTime(stat.completedAt)} • ${stat.branch || 'no branch'} • ${formatCommitSha(stat.commitSha)}`,
          ),
        )),
      ),
    )),
  );
}

function BenchmarkTrendCard({ title, subtitle, unit, series }) {
  const normalizedSeries = Array.isArray(series) ? series.filter((entry) => Array.isArray(entry.points) && entry.points.length > 0) : [];

  if (normalizedSeries.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No benchmark points in view',
      copy: 'Try widening the timeframe or clearing branch and runner filters.',
    });
  }

  const chartModel = buildBenchmarkChartModel(normalizedSeries);

  return React.createElement(
    'article',
    { className: 'web-trend-card' },
    React.createElement(
      'div',
      { className: 'web-list__row' },
      React.createElement(
        'div',
        { className: 'web-stack web-stack--tight' },
        React.createElement('strong', { className: 'web-list__title' }, title),
        subtitle ? React.createElement('span', { className: 'web-list__meta' }, subtitle) : null,
      ),
      React.createElement(
        'div',
        { className: 'web-stack web-stack--tight' },
        React.createElement('strong', { className: 'web-trend-card__value' }, formatBenchmarkValue(chartModel.latestValue, unit)),
        React.createElement('span', { className: 'web-list__meta' }, `${chartModel.pointCount} points`),
      ),
    ),
    React.createElement(
      'svg',
      { className: 'web-trend-card__chart', viewBox: '0 0 320 120', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${title} benchmark trend` },
      React.createElement('path', {
        className: 'web-benchmark-chart__axis',
        d: 'M 0 108 L 320 108',
      }),
      ...chartModel.series.map((entry, index) => React.createElement(
        'g',
        { key: entry.seriesId },
        React.createElement('polyline', {
          className: 'web-benchmark-chart__line',
          points: entry.points.map((point) => `${point.x},${point.y}`).join(' '),
          style: { stroke: SERIES_COLORS[index % SERIES_COLORS.length] },
        }),
        ...entry.points.map((point) => React.createElement('circle', {
          key: point.key,
          className: 'web-benchmark-chart__dot',
          cx: point.x,
          cy: point.y,
          r: point.latest ? 4 : 3,
          style: { fill: SERIES_COLORS[index % SERIES_COLORS.length] },
        })),
      )),
    ),
    React.createElement(
      'div',
      { className: 'web-list__row' },
      React.createElement('span', { className: 'web-list__meta' }, formatDateTime(chartModel.firstCompletedAt)),
      React.createElement('span', { className: 'web-list__meta' }, formatDateTime(chartModel.lastCompletedAt)),
    ),
    React.createElement(
      'div',
      { className: 'web-benchmark-legend' },
      ...chartModel.series.map((entry, index) => React.createElement(
        'div',
        { className: 'web-benchmark-legend__item', key: entry.seriesId },
        React.createElement('span', {
          className: 'web-benchmark-legend__swatch',
          style: { backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] },
        }),
        React.createElement(
          'div',
          { className: 'web-stack web-stack--tight' },
          React.createElement('strong', { className: 'web-list__title' }, entry.seriesId),
          React.createElement('span', { className: 'web-list__meta' }, formatBenchmarkValue(entry.latestValue, unit)),
        ),
      )),
    ),
  );
}

function buildBenchmarkSeries(points) {
  const grouped = new Map();

  for (const point of Array.isArray(points) ? points : []) {
    const seriesId = point.seriesId || 'default';
    if (!grouped.has(seriesId)) {
      grouped.set(seriesId, []);
    }
    grouped.get(seriesId).push(point);
  }

  return Array.from(grouped.entries())
    .map(([seriesId, seriesPoints]) => ({
      seriesId,
      points: [...seriesPoints].sort(compareBenchmarkPointsAscending),
    }))
    .sort((left, right) => left.seriesId.localeCompare(right.seriesId));
}

function buildBenchmarkChartModel(series) {
  const allPoints = series.flatMap((entry) => entry.points);
  const orderedTimestamps = Array.from(new Set(allPoints
    .map((point) => point.completedAt || point.recordedAt || null)
    .filter(Boolean)))
    .sort((left, right) => new Date(left).valueOf() - new Date(right).valueOf());
  const xMap = new Map(orderedTimestamps.map((timestamp, index) => ([
    timestamp,
    orderedTimestamps.length === 1
      ? 160
      : 16 + (index * (288 / Math.max(1, orderedTimestamps.length - 1))),
  ])));
  const values = allPoints.map((point) => point.numericValue).filter(Number.isFinite);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = minimum === maximum
    ? Math.max(1, Math.abs(maximum || 1) * 0.05)
    : (maximum - minimum) * 0.08;
  const domainMin = minimum - padding;
  const domainMax = maximum + padding;
  const domainSpan = Math.max(1, domainMax - domainMin);
  const latestPoint = [...allPoints].sort((left, right) => new Date(right.completedAt || 0).valueOf() - new Date(left.completedAt || 0).valueOf())[0] || null;

  return {
    series: series.map((entry) => ({
      seriesId: entry.seriesId,
      latestValue: entry.points[entry.points.length - 1]?.numericValue ?? null,
      points: entry.points.map((point, index) => ({
        x: xMap.get(point.completedAt || point.recordedAt) ?? 160,
        y: 108 - (((point.numericValue - domainMin) / domainSpan) * 92),
        latest: index === entry.points.length - 1,
        key: `${entry.seriesId}:${point.runId || point.id || index}`,
      })),
    })),
    latestValue: latestPoint?.numericValue ?? null,
    pointCount: allPoints.length,
    firstCompletedAt: orderedTimestamps[0] || null,
    lastCompletedAt: orderedTimestamps[orderedTimestamps.length - 1] || null,
  };
}

function buildRunBenchmarkGroups(stats) {
  const grouped = new Map();

  for (const stat of Array.isArray(stats) ? stats : []) {
    if (!stat || typeof stat.statGroup !== 'string') {
      continue;
    }

    if (!grouped.has(stat.statGroup)) {
      grouped.set(stat.statGroup, []);
    }
    grouped.get(stat.statGroup).push(stat);
  }

  return Array.from(grouped.entries())
    .map(([statGroup, groupedStats]) => ({
      statGroup,
      stats: [...groupedStats].sort(compareRunBenchmarkStats),
    }))
    .sort((left, right) => left.statGroup.localeCompare(right.statGroup));
}

function resolveBenchmarkScopeLabel(stat) {
  if (stat.testExecutionId) {
    return 'test scope';
  }
  if (stat.suiteRunId) {
    return 'suite scope';
  }
  return 'run scope';
}

function resolveTimeframeCutoff(points, timeframe) {
  if (timeframe === 'all') {
    return null;
  }

  const latestTimestamp = Math.max(...(Array.isArray(points) ? points : [])
    .map((point) => new Date(point.completedAt || 0).valueOf())
    .filter(Number.isFinite));

  if (!Number.isFinite(latestTimestamp)) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  if (timeframe === '30d') {
    return latestTimestamp - (30 * dayMs);
  }
  if (timeframe === '90d') {
    return latestTimestamp - (90 * dayMs);
  }
  if (timeframe === '365d') {
    return latestTimestamp - (365 * dayMs);
  }
  return null;
}

function compareBenchmarkPointsAscending(left, right) {
  return new Date(left.completedAt || 0).valueOf() - new Date(right.completedAt || 0).valueOf();
}

function compareRunBenchmarkStats(left, right) {
  return left.statName.localeCompare(right.statName)
    || String(left.seriesId || '').localeCompare(String(right.seriesId || ''))
    || String(left.id || '').localeCompare(String(right.id || ''));
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim())));
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
