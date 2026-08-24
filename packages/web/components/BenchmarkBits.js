import React from 'react';
import {
  classifyBenchmarkComparison,
  compareBenchmarkStatusRank,
  isBenchmarkRegressionStatus,
  resolveBenchmarkSemantics,
  resolveBenchmarkBudgetStatus,
} from '../../core/src/benchmark-semantics.js';
import {
  formatBenchmarkMetricLabel,
  formatBenchmarkNamespace,
  formatBenchmarkValue,
  formatCommitSha,
  formatDateTime,
} from '../lib/format.js';
import { EmptyState, MetricGrid } from './WebBits.js';

const SERIES_COLORS = ['#6bb2ff', '#4ee38b', '#ffd166', '#ff6b9a', '#c792ea', '#7dd3fc'];

export function ProjectBenchmarkExplorer({ benchmarkSummary = null, benchmarkPanels = [] }) {
  const panels = Array.isArray(benchmarkPanels) ? benchmarkPanels.filter((panel) => Array.isArray(panel.metrics) && panel.metrics.length > 0) : [];
  const [activeStatGroup, setActiveStatGroup] = React.useState(panels[0]?.statGroup || '');
  const selectedPanel = panels.find((panel) => panel.statGroup === activeStatGroup) || panels[0] || null;
  const selectedPanelMetrics = Array.isArray(selectedPanel?.metrics) ? selectedPanel.metrics : [];
  const [activeMetricName, setActiveMetricName] = React.useState(selectedPanelMetrics[0]?.statName || '');
  const benchmarkChanges = buildBenchmarkChangeEntries(panels);
  const selectedMetric = selectedPanelMetrics.find((metric) => metric.statName === activeMetricName) || selectedPanelMetrics[0] || null;
  const normalizedBenchmarkSummary = benchmarkSummary && typeof benchmarkSummary === 'object'
    ? benchmarkSummary
    : null;
  const summaryItems = normalizedBenchmarkSummary
    ? buildProjectBenchmarkSummaryItemsFromSummary(normalizedBenchmarkSummary)
    : buildProjectBenchmarkSummaryItems({ panels, benchmarkChanges });
  const namespaceCards = normalizedBenchmarkSummary
    ? buildNamespaceCardsFromSummary({ panels, summary: normalizedBenchmarkSummary })
    : buildNamespaceCards({ panels, benchmarkChanges });
  const metricCards = buildMetricCards({ panel: selectedPanel, benchmarkChanges });
  const topChanges = normalizedBenchmarkSummary
    ? normalizeBenchmarkSummaryTopChanges(normalizedBenchmarkSummary.topChanges)
    : normalizeLocalBenchmarkChangeEntries(benchmarkChanges)
      .filter((entry) => Number.isFinite(entry.deltaPercent))
      .slice(0, 8);

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
    const nextMetricName = selectedPanelMetrics[0]?.statName || '';
    if (!selectedMetric && activeMetricName !== nextMetricName) {
      setActiveMetricName(nextMetricName);
      return;
    }
    if (selectedMetric && selectedMetric.statName !== activeMetricName) {
      setActiveMetricName(selectedMetric.statName);
    }
  }, [activeMetricName, selectedMetric, selectedPanelMetrics]);

  if (panels.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No performance trends',
      copy: 'Performance charts will appear once suites begin publishing namespaced performance stats.',
    });
  }

  return React.createElement(
    'div',
    { className: 'web-stack web-stack--tight web-benchmark-dashboard' },
    React.createElement(MetricGrid, { items: summaryItems }),
    React.createElement(
      'section',
      { className: 'web-benchmark-section', 'data-perf-id': 'benchmark-top-changes' },
      React.createElement(
        'div',
        { className: 'web-benchmark-section__header' },
        React.createElement('strong', { className: 'web-list__title' }, 'Top changes'),
        React.createElement('span', { className: 'web-list__meta' }, 'Ranked by regression severity, then improvement size'),
      ),
      topChanges.length > 0
        ? React.createElement(
          'div',
          { className: 'web-table-wrap' },
          React.createElement(
            'table',
            { className: 'web-table web-benchmark-table' },
            React.createElement(
              'thead',
              null,
              React.createElement(
                'tr',
                null,
                React.createElement('th', null, 'Namespace'),
                React.createElement('th', null, 'Metric'),
                React.createElement('th', null, 'Latest'),
                React.createElement('th', null, 'Change'),
                React.createElement('th', null, 'Branch'),
                React.createElement('th', null, 'Runner'),
                React.createElement('th', null, 'Run'),
              ),
            ),
            React.createElement(
              'tbody',
              null,
              ...topChanges.map((entry) => React.createElement(
                'tr',
                { key: entry.key },
                React.createElement(
                  'td',
                  null,
                  React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkNamespace(entry.statGroup)),
                  React.createElement('div', { className: 'web-list__meta' }, `${entry.metricCount} metric${entry.metricCount === 1 ? '' : 's'} in namespace`),
                ),
                React.createElement(
                  'td',
                  null,
                  React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkMetricLabel(entry.statName)),
                  React.createElement(
                    'div',
                    { className: 'web-inline-list' },
                    React.createElement('span', { className: benchmarkStatusClassName(entry.status) }, benchmarkStatusLabel(entry.status)),
                    entry.latestSeriesId
                      ? React.createElement('span', { className: 'web-chip web-chip--muted' }, entry.latestSeriesId)
                      : null,
                  ),
                ),
                React.createElement('td', null, formatBenchmarkValue(entry.latestValue, entry.unit)),
                React.createElement(
                  'td',
                  null,
                  React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkDelta(entry.deltaPercent)),
                  React.createElement('div', { className: 'web-list__meta' }, `previous ${formatBenchmarkDeltaValue(entry.deltaValue, entry.unit)}`),
                  entry.baselineId
                    ? React.createElement('div', { className: 'web-list__meta' }, `baseline ${entry.baselineId}: ${formatBenchmarkDelta(entry.baselineDeltaPercent)}`)
                    : null,
                ),
                React.createElement('td', null, entry.latestBranch || 'no branch'),
                React.createElement('td', null, entry.latestRunnerKey || 'runner unavailable'),
                React.createElement(
                  'td',
                  null,
                  entry.latestRunId
                    ? React.createElement(
                      'a',
                      { href: `/runs/${entry.latestRunId}` },
                      entry.latestVersionKey || entry.latestExternalKey || entry.latestRunId,
                    )
                    : (entry.latestVersionKey || entry.latestExternalKey || 'n/a'),
                ),
              )),
            ),
          ),
        )
        : React.createElement(EmptyState, {
          title: 'No benchmark deltas yet',
          copy: 'Top changes appear once a namespace has repeated benchmark points for the same metric series.',
        }),
    ),
    React.createElement(
      'div',
      { className: 'web-grid web-grid--two' },
      React.createElement(
        'section',
        { className: 'web-benchmark-section' },
        React.createElement(
          'div',
          { className: 'web-benchmark-section__header' },
          React.createElement('strong', { className: 'web-list__title' }, 'Namespaces'),
          React.createElement('span', { className: 'web-list__meta' }, `${namespaceCards.length} benchmark areas`),
        ),
        React.createElement(
          'div',
          { className: 'web-benchmark-namespace-grid' },
          ...namespaceCards.map((card) => React.createElement(
            'button',
            {
              type: 'button',
              key: card.statGroup,
              'data-perf-id': `benchmark-namespace:${card.statGroup}`,
              className: card.statGroup === (selectedPanel?.statGroup || '')
                ? 'web-benchmark-namespace-card web-benchmark-namespace-card--active'
                : 'web-benchmark-namespace-card',
              onClick: () => {
                setActiveStatGroup(card.statGroup);
                setActiveMetricName(card.primaryMetricName || '');
              },
            },
            React.createElement(
              'div',
              { className: 'web-list__row' },
              React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkNamespace(card.statGroup)),
              React.createElement('span', { className: benchmarkStatusClassName(card.status) }, formatNamespaceStatusChip(card)),
            ),
            React.createElement('div', { className: 'web-list__meta' }, `${card.metricCount} metrics • ${card.seriesCount} series`),
            React.createElement(BenchmarkSparkline, {
              points: card.sparklinePoints,
              color: benchmarkStatusColor(card.status),
            }),
            React.createElement('div', { className: 'web-list__meta' }, card.latestCompletedAt ? `Latest ${formatDateTime(card.latestCompletedAt)}` : 'No recent point'),
          )),
        ),
      ),
      React.createElement(
        'section',
        { className: 'web-benchmark-section' },
        React.createElement(
          'div',
          { className: 'web-benchmark-section__header' },
          React.createElement('strong', { className: 'web-list__title' }, 'Metric snapshots'),
          React.createElement('span', { className: 'web-list__meta' }, selectedPanel ? formatBenchmarkNamespace(selectedPanel.statGroup) : 'Select a namespace'),
        ),
        metricCards.length > 0
          ? React.createElement(
            'div',
            { className: 'web-benchmark-metric-grid' },
            ...metricCards.map((card) => React.createElement(
              'button',
              {
                type: 'button',
                key: card.statName,
                'data-perf-id': `benchmark-metric:${card.statName}`,
                className: card.statName === (selectedMetric?.statName || '')
                  ? 'web-benchmark-metric-card web-benchmark-metric-card--active'
                  : 'web-benchmark-metric-card',
                onClick: () => setActiveMetricName(card.statName),
              },
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkMetricLabel(card.statName)),
                React.createElement('span', { className: benchmarkStatusClassName(card.status) }, benchmarkStatusLabel(card.status)),
              ),
              React.createElement('strong', { className: 'web-trend-card__value' }, card.latestValueLabel),
              React.createElement('div', { className: 'web-list__meta' }, `${card.seriesCount} series • ${card.pointCount} points • warn ${card.warningThresholdPct}% / severe ${card.severeThresholdPct}%`),
              React.createElement(BenchmarkSparkline, {
                points: card.sparklinePoints,
                color: benchmarkStatusColor(card.status),
              }),
              React.createElement(
                'div',
                { className: 'web-list__row' },
                React.createElement('span', { className: 'web-list__meta' }, formatBenchmarkDelta(card.deltaPercent)),
                React.createElement('span', { className: 'web-list__meta' }, formatBenchmarkDeltaValue(card.deltaValue, card.unit)),
              ),
            )),
          )
          : React.createElement(EmptyState, {
            title: 'No metrics for this namespace',
            copy: 'Metric cards appear when the selected namespace contains benchmark points.',
          }),
      ),
    ),
    React.createElement(
      'section',
      { className: 'web-benchmark-section', 'data-perf-id': 'benchmark-detail-inspector' },
      React.createElement(
        'div',
        { className: 'web-benchmark-section__header' },
        React.createElement('strong', { className: 'web-list__title' }, 'Detailed chart inspector'),
        React.createElement('span', { className: 'web-list__meta' }, 'Use the filters to compare runners, branches, and profile modes in context'),
      ),
      React.createElement(BenchmarkExplorer, {
        benchmarkPanels: panels,
        activeStatGroup,
        onActiveStatGroupChange: setActiveStatGroup,
        activeMetricName,
        onActiveMetricNameChange: setActiveMetricName,
      }),
    ),
  );
}

export function BenchmarkExplorer({
  benchmarkPanels = [],
  activeStatGroup: controlledStatGroup = null,
  onActiveStatGroupChange = null,
  activeMetricName: controlledMetricName = null,
  onActiveMetricNameChange = null,
}) {
  const panels = Array.isArray(benchmarkPanels) ? benchmarkPanels.filter((panel) => Array.isArray(panel.metrics) && panel.metrics.length > 0) : [];
  const [uncontrolledStatGroup, setUncontrolledStatGroup] = React.useState(panels[0]?.statGroup || '');
  const activeStatGroup = controlledStatGroup ?? uncontrolledStatGroup;
  const setActiveStatGroup = React.useCallback((value) => {
    if (typeof onActiveStatGroupChange === 'function') {
      onActiveStatGroupChange(value);
    }
    if (controlledStatGroup === null || controlledStatGroup === undefined) {
      setUncontrolledStatGroup(value);
    }
  }, [controlledStatGroup, onActiveStatGroupChange]);
  const selectedPanel = panels.find((panel) => panel.statGroup === activeStatGroup) || panels[0] || null;
  const metrics = Array.isArray(selectedPanel?.metrics) ? selectedPanel.metrics : [];
  const [uncontrolledMetricName, setUncontrolledMetricName] = React.useState(metrics[0]?.statName || '');
  const activeMetricName = controlledMetricName ?? uncontrolledMetricName;
  const setActiveMetricName = React.useCallback((value) => {
    if (typeof onActiveMetricNameChange === 'function') {
      onActiveMetricNameChange(value);
    }
    if (controlledMetricName === null || controlledMetricName === undefined) {
      setUncontrolledMetricName(value);
    }
  }, [controlledMetricName, onActiveMetricNameChange]);
  const selectedMetric = metrics.find((metric) => metric.statName === activeMetricName) || metrics[0] || null;
  const allPoints = Array.isArray(selectedMetric?.points) ? selectedMetric.points.filter((point) => Number.isFinite(point.numericValue)) : [];
  const runnerKeys = uniqueStrings(allPoints.map((point) => point.runnerKey));
  const branches = uniqueStrings(allPoints.map((point) => point.branch));
  const profileModes = uniqueStrings(allPoints.map((point) => resolveProfileMode(point)));
  const seriesIds = uniqueStrings(allPoints.map((point) => point.seriesId || 'default'));
  const [runnerFilter, setRunnerFilter] = React.useState('all');
  const [branchFilter, setBranchFilter] = React.useState('all');
  const [profileModeFilter, setProfileModeFilter] = React.useState('all');
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
    if (profileModeFilter !== 'all' && !profileModes.includes(profileModeFilter)) {
      setProfileModeFilter('all');
    }
  }, [profileModeFilter, profileModes]);

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
      title: 'No performance trends',
      copy: 'Performance charts will appear once suites begin publishing namespaced performance stats.',
    });
  }

  const timeframeCutoff = resolveTimeframeCutoff(allPoints, timeframeFilter);
  const filteredPoints = allPoints.filter((point) => (
    (runnerFilter === 'all' || point.runnerKey === runnerFilter)
    && (branchFilter === 'all' || point.branch === branchFilter)
    && (profileModeFilter === 'all' || resolveProfileMode(point) === profileModeFilter)
    && (!timeframeCutoff || new Date(point.completedAt || 0).valueOf() >= timeframeCutoff)
  ));
  const visiblePoints = filteredPoints.filter((point) => visibleSeriesIds.includes(point.seriesId || 'default'));
  const visibleSeries = buildBenchmarkSeries(visiblePoints);
  const latestPoint = visiblePoints[0] || null;
  const summaryItems = buildPerformanceSummaryItems({
    points: visiblePoints,
    series: visibleSeries,
    selectedMetric,
  });

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
        React.createElement('span', { className: 'web-field__label' }, 'Profile mode'),
        React.createElement(
          'select',
          {
            className: 'web-field__input',
            value: profileModeFilter,
            onChange: (event) => setProfileModeFilter(event.target.value),
          },
          React.createElement('option', { value: 'all' }, 'All modes'),
          ...profileModes.map((profileMode) => React.createElement('option', { key: profileMode, value: profileMode }, profileMode)),
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
    React.createElement(MetricGrid, { items: summaryItems }),
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

function buildProjectBenchmarkSummaryItems({ panels, benchmarkChanges }) {
  const allPoints = panels.flatMap((panel) => (Array.isArray(panel.metrics) ? panel.metrics : [])
    .flatMap((metric) => (Array.isArray(metric.points) ? metric.points : [])))
    .filter((point) => Number.isFinite(point?.numericValue));
  const latestPoint = [...allPoints].sort(compareBenchmarkPointsDescending)[0] || null;
  const latestRunId = latestPoint?.runId || null;
  const namespaceCount = panels.length;
  const metricCount = panels.reduce((total, panel) => total + (Array.isArray(panel.metrics) ? panel.metrics.length : 0), 0);
  const activeSeriesCount = uniqueStrings(panels.flatMap((panel) => panel.seriesIds || [])).length;
  const latestRunRegressions = benchmarkChanges.filter((entry) => isBenchmarkRegressionStatus(entry.status) && entry.latestPoint?.runId === latestRunId);
  const biggestRegression = benchmarkChanges.find((entry) => isBenchmarkRegressionStatus(entry.status)) || null;
  const biggestImprovement = benchmarkChanges.find((entry) => entry.status === 'improved') || null;

  return [
    {
      label: 'Last Benchmarked Run',
      value: latestPoint?.versionKey || latestPoint?.externalKey || latestPoint?.runId || 'n/a',
      copy: latestPoint ? `${formatDateTime(latestPoint.completedAt)} • ${latestPoint.branch || 'no branch'}` : 'No benchmark points yet',
    },
    {
      label: 'Tracked Namespaces',
      value: String(namespaceCount),
      copy: `${metricCount} metrics across the current project catalog`,
    },
    {
      label: 'Active Series',
      value: String(activeSeriesCount),
      copy: 'Distinct benchmark lanes visible in project history',
    },
    {
      label: 'Regressions In Latest Run',
      value: String(latestRunRegressions.length),
      copy: latestRunId ? `Compared inside ${latestPoint?.versionKey || latestPoint?.externalKey || latestRunId}` : 'Waiting for repeated runs',
    },
    {
      label: 'Biggest Regression',
      value: biggestRegression ? formatBenchmarkDelta(biggestRegression.deltaPercent) : 'n/a',
      copy: biggestRegression ? `${formatBenchmarkMetricLabel(biggestRegression.statName)} • ${formatBenchmarkNamespace(biggestRegression.statGroup)}` : 'No regressions ranked yet',
    },
    {
      label: 'Biggest Improvement',
      value: biggestImprovement ? formatBenchmarkDelta(biggestImprovement.deltaPercent) : 'n/a',
      copy: biggestImprovement ? `${formatBenchmarkMetricLabel(biggestImprovement.statName)} • ${formatBenchmarkNamespace(biggestImprovement.statGroup)}` : 'No improvements ranked yet',
    },
  ];
}

function buildProjectBenchmarkSummaryItemsFromSummary(summary) {
  const biggestRegression = Array.isArray(summary?.topRegressions) ? summary.topRegressions[0] || null : null;
  const biggestImprovement = Array.isArray(summary?.topImprovements) ? summary.topImprovements[0] || null : null;

  return [
    {
      label: 'Last Benchmarked Run',
      value: summary?.latestVersionKey || summary?.latestExternalKey || summary?.latestRunId || 'n/a',
      copy: summary?.latestCompletedAt ? `${formatDateTime(summary.latestCompletedAt)} • project summary` : 'No benchmark points yet',
    },
    {
      label: 'Tracked Namespaces',
      value: String(Number.isFinite(summary?.namespaceCount) ? summary.namespaceCount : 0),
      copy: `${Number.isFinite(summary?.metricCount) ? summary.metricCount : 0} metrics across the current project catalog`,
    },
    {
      label: 'Active Series',
      value: String(Number.isFinite(summary?.seriesCount) ? summary.seriesCount : 0),
      copy: 'Distinct benchmark lanes visible in project history',
    },
    {
      label: 'Regressions In Latest Run',
      value: String(Number.isFinite(summary?.latestRunRegressionCount) ? summary.latestRunRegressionCount : 0),
      copy: summary?.latestRunId ? `Compared inside ${summary?.latestVersionKey || summary?.latestExternalKey || summary.latestRunId}` : 'Waiting for repeated runs',
    },
    {
      label: 'Biggest Regression',
      value: biggestRegression ? formatBenchmarkDelta(biggestRegression.deltaPercent) : 'n/a',
      copy: biggestRegression ? `${formatBenchmarkMetricLabel(biggestRegression.statName)} • ${formatBenchmarkNamespace(biggestRegression.statGroup)}` : 'No regressions ranked yet',
    },
    {
      label: 'Biggest Improvement',
      value: biggestImprovement ? formatBenchmarkDelta(biggestImprovement.deltaPercent) : 'n/a',
      copy: biggestImprovement ? `${formatBenchmarkMetricLabel(biggestImprovement.statName)} • ${formatBenchmarkNamespace(biggestImprovement.statGroup)}` : 'No improvements ranked yet',
    },
  ];
}

function buildNamespaceCards({ panels, benchmarkChanges }) {
  return panels.map((panel) => {
    const panelChanges = benchmarkChanges.filter((entry) => entry.statGroup === panel.statGroup);
    const primaryMetric = [...(Array.isArray(panel.metrics) ? panel.metrics : [])]
      .sort((left, right) => ((right.points?.length || 0) - (left.points?.length || 0)) || left.statName.localeCompare(right.statName))[0] || null;
    const sparklinePoints = resolveRepresentativeSparklinePoints(primaryMetric?.points || []);

    return {
      statGroup: panel.statGroup,
      primaryMetricName: primaryMetric?.statName || '',
      metricCount: Array.isArray(panel.metrics) ? panel.metrics.length : 0,
      seriesCount: uniqueStrings((Array.isArray(panel.metrics) ? panel.metrics : []).flatMap((metric) => metric.seriesIds || [])).length,
      latestCompletedAt: panel.latestCompletedAt || primaryMetric?.points?.[0]?.completedAt || null,
      status: panelChanges[0]?.status || resolveMetricStatusFromPoint(primaryMetric?.points?.[0] || null, primaryMetric?.statName || null),
      regressionCount: panelChanges.filter((entry) => isBenchmarkRegressionStatus(entry.status)).length,
      warningCount: panelChanges.filter((entry) => entry.status === 'warning').length,
      severeRegressionCount: panelChanges.filter((entry) => entry.status === 'severe-regression').length,
      sparklinePoints,
    };
  }).sort((left, right) => compareNullableIsoDates(right.latestCompletedAt, left.latestCompletedAt));
}

function buildNamespaceCardsFromSummary({ panels, summary }) {
  const panelMap = new Map((Array.isArray(panels) ? panels : []).map((panel) => [panel.statGroup, panel]));
  const namespaces = Array.isArray(summary?.namespaces) ? summary.namespaces : [];

  return namespaces.map((namespace) => {
    const panel = panelMap.get(namespace.statGroup) || null;
    const primaryMetric = panel && Array.isArray(panel.metrics)
      ? panel.metrics.find((metric) => metric.statName === namespace.primaryMetricName) || panel.metrics[0] || null
      : null;

    return {
      statGroup: namespace.statGroup,
      primaryMetricName: namespace.primaryMetricName || primaryMetric?.statName || '',
      status: namespace.status || 'insufficient-baseline',
      metricCount: Number.isFinite(namespace.metricCount) ? namespace.metricCount : 0,
      seriesCount: Number.isFinite(namespace.seriesCount) ? namespace.seriesCount : 0,
      latestCompletedAt: namespace.latestCompletedAt || primaryMetric?.points?.[0]?.completedAt || null,
      regressionCount: Number.isFinite(namespace.regressionCount) ? namespace.regressionCount : 0,
      warningCount: Number.isFinite(namespace.warningCount) ? namespace.warningCount : 0,
      severeRegressionCount: Number.isFinite(namespace.severeRegressionCount) ? namespace.severeRegressionCount : 0,
      sparklinePoints: resolveRepresentativeSparklinePoints(primaryMetric?.points || []),
    };
  }).sort((left, right) => compareNullableIsoDates(right.latestCompletedAt, left.latestCompletedAt));
}

function buildMetricCards({ panel, benchmarkChanges }) {
  const metrics = Array.isArray(panel?.metrics) ? panel.metrics : [];

  return metrics.map((metric) => {
    const metricChanges = benchmarkChanges.filter((entry) => entry.statGroup === panel.statGroup && entry.statName === metric.statName);
    const primaryChange = metricChanges[0] || null;
    const latestPoint = primaryChange?.latestPoint || [...(Array.isArray(metric.points) ? metric.points : [])].sort(compareBenchmarkPointsDescending)[0] || null;
    const regressionCount = metricChanges.filter((entry) => isBenchmarkRegressionStatus(entry.status)).length;
    const improvementCount = metricChanges.filter((entry) => entry.status === 'improved').length;
    const status = primaryChange?.status || inferMetricCardStatus({ latestPoint, regressionCount, improvementCount, statName: metric.statName });
    const semantics = resolveBenchmarkSemanticsForPoint(latestPoint, metric.statName, metric.unit);

    return {
      statName: metric.statName,
      unit: metric.unit || latestPoint?.unit || null,
      latestValueLabel: latestPoint ? formatBenchmarkValue(latestPoint.numericValue, metric.unit || latestPoint.unit) : 'n/a',
      deltaPercent: primaryChange?.deltaPercent ?? null,
      deltaValue: primaryChange?.deltaValue ?? null,
      seriesCount: uniqueStrings(metric.points?.map((point) => point.seriesId || 'default')).length,
      pointCount: Array.isArray(metric.points) ? metric.points.length : 0,
      status,
      budgetStatus: semantics.budgetStatus,
      warningThresholdPct: semantics.warningDeltaPct,
      severeThresholdPct: semantics.severeDeltaPct,
      sparklinePoints: resolveRepresentativeSparklinePoints(metric.points || []),
    };
  }).sort((left, right) => compareBenchmarkStatus(left.status, right.status)
    || compareNullableNumbersDesc(Math.abs(left.deltaPercent || 0), Math.abs(right.deltaPercent || 0))
    || left.statName.localeCompare(right.statName));
}

function buildBenchmarkChangeEntries(panels) {
  const changes = [];

  for (const panel of Array.isArray(panels) ? panels : []) {
    const metricCount = Array.isArray(panel.metrics) ? panel.metrics.length : 0;

    for (const metric of Array.isArray(panel.metrics) ? panel.metrics : []) {
      const groups = new Map();
      for (const point of Array.isArray(metric.points) ? metric.points : []) {
        if (!Number.isFinite(point?.numericValue)) {
          continue;
        }

        const groupKey = [
          point.seriesId || 'default',
          point.runnerKey || 'runner unavailable',
          point.branch || 'no branch',
        ].join('::');
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(point);
      }

      for (const [groupKey, points] of groups.entries()) {
        const orderedPoints = [...points].sort(compareBenchmarkPointsDescending);
        const latestPoint = orderedPoints[0] || null;
        const previousPoint = orderedPoints.find((point) => point !== latestPoint) || null;
        const classification = classifyBenchmarkComparison({
          projectKey: latestPoint?.projectKey || previousPoint?.projectKey || panel.projectKey || null,
          latestPoint,
          previousPoint,
          statGroup: panel.statGroup,
          statName: metric.statName,
          unit: metric.unit || latestPoint?.unit || null,
        });

        changes.push({
          key: `${panel.statGroup}:${metric.statName}:${groupKey}`,
          statGroup: panel.statGroup,
          statName: metric.statName,
          unit: metric.unit || latestPoint?.unit || null,
          metricCount,
          latestPoint,
          previousPoint,
          deltaValue: classification.deltaValue,
          deltaPercent: classification.deltaPercent,
          status: classification.status,
          directionStatus: classification.directionStatus,
          budgetStatus: classification.budgetStatus,
          lowerIsBetter: classification.lowerIsBetter,
          warningThresholdPct: classification.warningDeltaPct,
          severeThresholdPct: classification.severeDeltaPct,
          semanticsSource: classification.semanticsSource,
          seriesId: latestPoint?.seriesId || 'default',
          latestCompletedAt: latestPoint?.completedAt || null,
        });
      }
    }
  }

  return changes.sort((left, right) => compareBenchmarkStatus(left.status, right.status)
    || compareNullableNumbersDesc(Math.abs(left.deltaPercent || 0), Math.abs(right.deltaPercent || 0))
    || compareNullableIsoDates(right.latestCompletedAt, left.latestCompletedAt)
    || left.statGroup.localeCompare(right.statGroup)
    || left.statName.localeCompare(right.statName));
}

function normalizeLocalBenchmarkChangeEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    key: entry.key,
    statGroup: entry.statGroup,
    statName: entry.statName,
    unit: entry.unit,
    metricCount: entry.metricCount,
    status: entry.status,
    directionStatus: entry.directionStatus || null,
    budgetStatus: entry.budgetStatus || null,
    lowerIsBetter: typeof entry.lowerIsBetter === 'boolean' ? entry.lowerIsBetter : null,
    warningThresholdPct: Number.isFinite(entry.warningThresholdPct) ? entry.warningThresholdPct : null,
    severeThresholdPct: Number.isFinite(entry.severeThresholdPct) ? entry.severeThresholdPct : null,
    semanticsSource: entry.semanticsSource || null,
    latestRunId: entry.latestPoint?.runId || null,
    latestExternalKey: entry.latestPoint?.externalKey || null,
    latestVersionKey: entry.latestPoint?.versionKey || null,
    latestCompletedAt: entry.latestPoint?.completedAt || null,
    latestBranch: entry.latestPoint?.branch || null,
    latestRunnerKey: entry.latestPoint?.runnerKey || null,
    latestSeriesId: entry.seriesId || null,
    latestValue: Number.isFinite(entry.latestPoint?.numericValue) ? entry.latestPoint.numericValue : null,
    previousRunId: entry.previousPoint?.runId || null,
    previousExternalKey: entry.previousPoint?.externalKey || null,
    previousVersionKey: entry.previousPoint?.versionKey || null,
    previousCompletedAt: entry.previousPoint?.completedAt || null,
    previousValue: Number.isFinite(entry.previousPoint?.numericValue) ? entry.previousPoint.numericValue : null,
    deltaValue: entry.deltaValue,
    deltaPercent: entry.deltaPercent,
  }));
}

function normalizeBenchmarkSummaryTopChanges(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => Number.isFinite(entry?.deltaPercent))
    .map((entry) => ({
      key: `${entry.statGroup}:${entry.statName}:${entry.latestSeriesId || 'default'}:${entry.latestRunnerKey || 'runner unavailable'}:${entry.latestBranch || 'no branch'}`,
      statGroup: entry.statGroup,
      statName: entry.statName,
      unit: entry.unit || null,
      metricCount: Number.isFinite(entry.metricCount) ? entry.metricCount : 0,
      status: entry.status || 'insufficient-baseline',
      directionStatus: entry.directionStatus || null,
      budgetStatus: entry.budgetStatus || null,
      lowerIsBetter: typeof entry.lowerIsBetter === 'boolean' ? entry.lowerIsBetter : null,
      warningThresholdPct: Number.isFinite(entry.warningThresholdPct) ? entry.warningThresholdPct : null,
      severeThresholdPct: Number.isFinite(entry.severeThresholdPct) ? entry.severeThresholdPct : null,
      semanticsSource: entry.semanticsSource || null,
      latestRunId: entry.latestRunId || null,
      latestExternalKey: entry.latestExternalKey || null,
      latestVersionKey: entry.latestVersionKey || null,
      latestCompletedAt: entry.latestCompletedAt || null,
      latestBranch: entry.latestBranch || null,
      latestRunnerKey: entry.latestRunnerKey || null,
      latestSeriesId: entry.latestSeriesId || null,
      latestValue: Number.isFinite(entry.latestValue) ? entry.latestValue : null,
      previousRunId: entry.previousRunId || null,
      previousExternalKey: entry.previousExternalKey || null,
      previousVersionKey: entry.previousVersionKey || null,
      previousCompletedAt: entry.previousCompletedAt || null,
      previousValue: Number.isFinite(entry.previousValue) ? entry.previousValue : null,
      deltaValue: Number.isFinite(entry.deltaValue) ? entry.deltaValue : null,
      deltaPercent: Number.isFinite(entry.deltaPercent) ? entry.deltaPercent : null,
      ...(entry.baselineId ? {
        baselineId: entry.baselineId,
        baselineRunId: entry.baselineRunId || null,
        baselineValue: Number.isFinite(entry.baselineValue) ? entry.baselineValue : null,
        baselineDeltaValue: Number.isFinite(entry.baselineDeltaValue) ? entry.baselineDeltaValue : null,
        baselineDeltaPercent: Number.isFinite(entry.baselineDeltaPercent) ? entry.baselineDeltaPercent : null,
        baselineStatus: entry.baselineStatus || null,
      } : {}),
    }));
}

function inferMetricCardStatus({ latestPoint, regressionCount, improvementCount, statName }) {
  const standaloneStatus = resolveMetricStatusFromPoint(latestPoint, statName);
  if (!latestPoint) {
    return standaloneStatus;
  }
  if (regressionCount > 0) {
    return standaloneStatus && isBenchmarkRegressionStatus(standaloneStatus) ? standaloneStatus : 'regressed';
  }
  if (improvementCount > 0) {
    return 'improved';
  }
  return standaloneStatus || 'stable';
}

function BenchmarkSparkline({ points = [], color = '#6bb2ff' }) {
  const normalizedPoints = Array.isArray(points) ? points.filter((point) => Number.isFinite(point?.numericValue)) : [];
  if (normalizedPoints.length < 2) {
    return React.createElement(
      'div',
      { className: 'web-benchmark-sparkline web-benchmark-sparkline--empty', 'aria-hidden': 'true' },
      React.createElement('span', null, 'No trend'),
    );
  }

  const minimum = Math.min(...normalizedPoints.map((point) => point.numericValue));
  const maximum = Math.max(...normalizedPoints.map((point) => point.numericValue));
  const span = Math.max(1, maximum - minimum);
  const coordinates = normalizedPoints.map((point, index) => {
    const x = normalizedPoints.length === 1 ? 80 : (index * (160 / Math.max(1, normalizedPoints.length - 1)));
    const y = 44 - (((point.numericValue - minimum) / span) * 36);
    return `${x},${y}`;
  }).join(' ');

  return React.createElement(
    'svg',
    { className: 'web-benchmark-sparkline', viewBox: '0 0 160 48', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Benchmark sparkline' },
    React.createElement('path', { className: 'web-benchmark-sparkline__axis', d: 'M 0 44 L 160 44' }),
    React.createElement('polyline', {
      className: 'web-benchmark-sparkline__line',
      points: coordinates,
      style: { stroke: color },
    }),
  );
}

export function PerformanceDomainSummary({ stats = [], benchmarkPanels = [] }) {
  const items = buildPerformanceDomainSummaryItems({ stats, benchmarkPanels });

  if (items.length === 0) {
    return null;
  }

  return React.createElement(MetricGrid, { items });
}

export function RunBenchmarkDeltaSummary({ stats = [], benchmarkPanels = [], historyHref = null }) {
  const entries = buildRunBenchmarkDeltaEntries({ stats, benchmarkPanels });
  const comparedEntries = entries.filter((entry) => entry.previousPoint);
  const regressionLikeEntries = comparedEntries.filter((entry) => isBenchmarkRegressionStatus(entry.status));
  const regressions = regressionLikeEntries.slice(0, 6);
  const improvements = comparedEntries.filter((entry) => entry.status === 'improved').slice(0, 6);
  const stableCount = comparedEntries.filter((entry) => entry.status === 'stable').length;
  const unmatchedCount = entries.length - comparedEntries.length;
  const biggestRegression = regressions[0] || null;
  const biggestImprovement = improvements[0] || null;
  const summaryItems = [
    {
      label: 'Compared Metrics',
      value: String(comparedEntries.length),
      copy: `${entries.length} recorded metric rows in this run`,
    },
    {
      label: 'Regressions',
      value: String(regressions.length),
      copy: biggestRegression
        ? `${formatBenchmarkMetricLabel(biggestRegression.statName)} ${formatBenchmarkDelta(biggestRegression.deltaPercent)}`
        : 'No regressions detected',
    },
    {
      label: 'Improvements',
      value: String(improvements.length),
      copy: biggestImprovement
        ? `${formatBenchmarkMetricLabel(biggestImprovement.statName)} ${formatBenchmarkDelta(biggestImprovement.deltaPercent)}`
        : 'No improvements detected',
    },
    {
      label: 'Stable',
      value: String(stableCount),
      copy: unmatchedCount > 0 ? `${unmatchedCount} missing baseline` : 'All metrics had a baseline',
    },
  ];

  return React.createElement(
    'div',
    { className: 'web-stack web-stack--tight', 'data-perf-id': 'run-benchmark-delta' },
    React.createElement(MetricGrid, { items: summaryItems }),
    React.createElement(
      'div',
      { className: 'web-grid web-grid--two' },
      React.createElement(BenchmarkDeltaListCard, {
        eyebrow: 'Run Benchmark Delta',
        title: 'Top regressions',
        entries: regressions,
        emptyTitle: 'No regressions detected',
        emptyCopy: 'This run did not record benchmark regressions against the most recent matching baseline.',
        historyHref,
      }),
      React.createElement(BenchmarkDeltaListCard, {
        eyebrow: 'Run Benchmark Delta',
        title: 'Top improvements',
        entries: improvements,
        emptyTitle: 'No improvements detected',
        emptyCopy: 'This run did not record benchmark improvements against the most recent matching baseline.',
        historyHref,
      }),
    ),
  );
}

export function RunBenchmarkSummary({ stats = [], historyHref = null }) {
  const groups = buildRunBenchmarkGroups(stats);

  if (groups.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No performance stats recorded',
      copy: 'This run does not include performance metrics yet.',
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
          React.createElement('span', { className: 'web-chip' }, group.domain),
          ...uniqueStrings(group.stats.map((stat) => stat.seriesId)).map((seriesId) => React.createElement('span', { className: 'web-chip web-chip--muted', key: `${group.statGroup}:${seriesId}` }, seriesId)),
          ...uniqueStrings(group.stats.map((stat) => resolveProfileMode(stat))).map((profileMode) => React.createElement('span', { className: 'web-chip web-chip--muted', key: `${group.statGroup}:profile:${profileMode}` }, profileMode)),
          group.budgetWarningCount > 0
            ? React.createElement('span', { className: 'web-chip web-chip--muted' }, `${group.budgetWarningCount} budget warnings`)
            : null,
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
            `${stat.seriesId || 'default'} • ${resolveProfileMode(stat)} • ${stat.runnerKey || 'runner unavailable'} • ${resolveBenchmarkScopeLabel(stat)}`,
          ),
          React.createElement(
            'div',
            { className: 'web-list__meta' },
            `${formatDateTime(stat.completedAt)} • ${stat.branch || 'no branch'} • ${formatCommitSha(stat.commitSha)}`,
          ),
          historyHref
            ? React.createElement(
              'a',
              { href: historyHref, className: 'web-list__meta' },
              'Open history chart',
            )
            : null,
          renderBenchmarkMetadataInspector(stat),
        )),
      ),
    )),
  );
}

function BenchmarkDeltaListCard({ eyebrow, title, entries = [], emptyTitle, emptyCopy, historyHref = null }) {
  return React.createElement(
    'div',
    { className: 'web-card web-card--compact' },
    eyebrow ? React.createElement('p', { className: 'web-card__eyebrow' }, eyebrow) : null,
    title ? React.createElement('h3', { className: 'web-card__title' }, title) : null,
    Array.isArray(entries) && entries.length > 0
      ? React.createElement(
        'div',
        { className: 'web-list' },
        ...entries.map((entry) => React.createElement(
          'article',
          { className: 'web-list__item', key: entry.key },
          React.createElement(
            'div',
            { className: 'web-list__row' },
            React.createElement('strong', { className: 'web-list__title' }, formatBenchmarkMetricLabel(entry.statName)),
            React.createElement(
              'div',
              { className: 'web-inline-list' },
              React.createElement('span', { className: benchmarkStatusClassName(entry.status) }, benchmarkStatusLabel(entry.status)),
              React.createElement('span', { className: 'web-list__meta' }, formatBenchmarkDelta(entry.deltaPercent)),
            ),
          ),
          React.createElement('div', { className: 'web-list__meta' }, formatBenchmarkNamespace(entry.statGroup)),
          React.createElement(
            'div',
            { className: 'web-list__meta' },
            `${formatBenchmarkValue(entry.previousPoint?.numericValue, entry.unit)} -> ${formatBenchmarkValue(entry.latestPoint?.numericValue, entry.unit)} • ${formatBenchmarkDeltaValue(entry.deltaValue, entry.unit)}`,
          ),
          React.createElement(
            'div',
            { className: 'web-list__meta' },
            `${entry.latestPoint?.seriesId || 'default'} • ${entry.latestPoint?.runnerKey || 'runner unavailable'} • ${entry.latestPoint?.branch || 'no branch'}`,
          ),
          historyHref
            ? React.createElement(
              'a',
              { href: historyHref, className: 'web-list__meta' },
              'Open history chart',
            )
            : null,
        )),
      )
      : React.createElement(EmptyState, {
        title: emptyTitle,
        copy: emptyCopy,
      }),
  );
}

function BenchmarkTrendCard({ title, subtitle, unit, series }) {
  const normalizedSeries = Array.isArray(series) ? series.filter((entry) => Array.isArray(entry.points) && entry.points.length > 0) : [];

  if (normalizedSeries.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No performance points in view',
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

function buildPerformanceSummaryItems({ points, series, selectedMetric }) {
  const orderedPoints = [...(Array.isArray(points) ? points : [])].sort(compareBenchmarkPointsDescending);
  const latestPoint = orderedPoints[0] || null;
  const previousPoint = latestPoint
    ? orderedPoints.find((point) => point !== latestPoint && (point.seriesId || 'default') === (latestPoint.seriesId || 'default')) || orderedPoints[1] || null
    : null;
  const unit = selectedMetric?.unit || latestPoint?.unit || null;
  const delta = latestPoint && previousPoint && Number.isFinite(previousPoint.numericValue) && previousPoint.numericValue !== 0
    ? ((latestPoint.numericValue - previousPoint.numericValue) / Math.abs(previousPoint.numericValue)) * 100
    : null;
  const comparisons = summarizeSeriesComparisons(series, selectedMetric?.statName);
  const budgetWarningCount = orderedPoints.filter(hasBudgetWarning).length;
  const slowestPoint = orderedPoints
    .filter((point) => Number.isFinite(point.numericValue))
    .sort((left, right) => right.numericValue - left.numericValue)[0] || null;

  return [
    {
      label: 'Latest',
      value: latestPoint ? formatBenchmarkValue(latestPoint.numericValue, unit) : 'n/a',
      copy: latestPoint ? `${latestPoint.seriesId || 'default'} at ${formatDateTime(latestPoint.completedAt)}` : 'No point in view',
    },
    {
      label: 'Delta',
      value: Number.isFinite(delta) ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : 'n/a',
      copy: describeDelta(latestPoint, previousPoint, delta, selectedMetric?.statName),
    },
    {
      label: 'Regressions',
      value: String(comparisons.regressions),
      copy: `${comparisons.comparedSeries} series compared`,
    },
    {
      label: 'Improvements',
      value: String(comparisons.improvements),
      copy: `${comparisons.stable} stable`,
    },
    {
      label: 'Budget warnings',
      value: String(budgetWarningCount),
      copy: budgetWarningCount > 0 ? 'Current view includes warning-only budget misses' : 'No warning-only budget misses in view',
    },
    {
      label: 'Slowest current',
      value: slowestPoint ? formatBenchmarkValue(slowestPoint.numericValue, slowestPoint.unit || unit) : 'n/a',
      copy: slowestPoint ? `${formatBenchmarkMetricLabel(slowestPoint.statName)} / ${slowestPoint.seriesId || 'default'}` : 'No current metric',
    },
  ];
}

function buildPerformanceDomainSummaryItems({ stats, benchmarkPanels }) {
  const domainMap = new Map();

  for (const stat of Array.isArray(stats) ? stats : []) {
    addPerformanceDomainEntry(domainMap, {
      statGroup: stat?.statGroup,
      statName: stat?.statName,
      numericValue: stat?.numericValue,
      runnerKey: stat?.runnerKey,
      seriesId: stat?.seriesId,
      budgetWarning: hasBudgetWarning(stat),
    });
  }

  for (const panel of Array.isArray(benchmarkPanels) ? benchmarkPanels : []) {
    for (const metric of Array.isArray(panel?.metrics) ? panel.metrics : []) {
      for (const point of Array.isArray(metric?.points) ? metric.points : []) {
        addPerformanceDomainEntry(domainMap, {
          statGroup: point?.statGroup || panel.statGroup,
          statName: point?.statName || metric.statName,
          numericValue: point?.numericValue,
          runnerKey: point?.runnerKey,
          seriesId: point?.seriesId,
          budgetWarning: hasBudgetWarning(point),
        });
      }
    }
  }

  return Array.from(domainMap.values())
    .filter((entry) => entry.pointCount > 0)
    .sort((left, right) => right.pointCount - left.pointCount || left.domain.localeCompare(right.domain))
    .slice(0, 6)
    .map((entry) => ({
      label: entry.domain,
      value: String(entry.pointCount),
      copy: [
        `${entry.statGroups.size} namespaces`,
        `${entry.statNames.size} metrics`,
        `${entry.runnerKeys.size} runners`,
        entry.budgetWarningCount > 0 ? `${entry.budgetWarningCount} warnings` : null,
      ].filter(Boolean).join(' / '),
    }));
}

function addPerformanceDomainEntry(domainMap, entry) {
  if (!entry?.statGroup) {
    return;
  }

  const domain = resolvePerformanceDomain(entry.statGroup);
  if (!domainMap.has(domain)) {
    domainMap.set(domain, {
      domain,
      pointCount: 0,
      statGroups: new Set(),
      statNames: new Set(),
      runnerKeys: new Set(),
      seriesIds: new Set(),
      budgetWarningCount: 0,
    });
  }

  const bucket = domainMap.get(domain);
  bucket.pointCount += Number.isFinite(entry.numericValue) ? 1 : 0;
  bucket.statGroups.add(entry.statGroup);
  if (entry.statName) {
    bucket.statNames.add(entry.statName);
  }
  if (entry.runnerKey) {
    bucket.runnerKeys.add(entry.runnerKey);
  }
  if (entry.seriesId) {
    bucket.seriesIds.add(entry.seriesId);
  }
  if (entry.budgetWarning) {
    bucket.budgetWarningCount += 1;
  }
}

function summarizeSeriesComparisons(series, statName) {
  const summary = {
    comparedSeries: 0,
    regressions: 0,
    improvements: 0,
    stable: 0,
  };

  for (const entry of Array.isArray(series) ? series : []) {
    if (!Array.isArray(entry.points) || entry.points.length < 2) {
      continue;
    }

    const latest = entry.points[entry.points.length - 1];
    const previous = entry.points[entry.points.length - 2];
    if (!Number.isFinite(latest.numericValue) || !Number.isFinite(previous.numericValue)) {
      continue;
    }

    summary.comparedSeries += 1;
    const classification = classifyBenchmarkComparison({
      projectKey: latest.projectKey || previous.projectKey || null,
      latestPoint: latest,
      previousPoint: previous,
      statGroup: latest.statGroup || previous.statGroup || null,
      statName,
      unit: latest.unit || previous.unit || null,
    });

    if (classification.status === 'improved') {
      summary.improvements += 1;
    } else if (isBenchmarkRegressionStatus(classification.status)) {
      summary.regressions += 1;
    } else {
      summary.stable += 1;
    }
  }

  return summary;
}

function describeDelta(latestPoint, previousPoint, delta, statName) {
  if (!latestPoint || !previousPoint || !Number.isFinite(delta)) {
    return 'No previous point for comparison';
  }
  const classification = classifyBenchmarkComparison({
    projectKey: latestPoint.projectKey || previousPoint.projectKey || null,
    latestPoint,
    previousPoint,
    statGroup: latestPoint.statGroup || previousPoint.statGroup || null,
    statName,
    unit: latestPoint.unit || previousPoint.unit || null,
  });
  if (classification.status === 'stable') {
    return 'Stable versus previous point';
  }
  return `${benchmarkStatusLabel(classification.status)} versus previous ${latestPoint.seriesId || 'default'} point`;
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
      domain: resolvePerformanceDomain(statGroup),
      budgetWarningCount: groupedStats.filter(hasBudgetWarning).length,
      stats: [...groupedStats].sort(compareRunBenchmarkStats),
    }))
    .sort((left, right) => left.statGroup.localeCompare(right.statGroup));
}

function buildRunBenchmarkDeltaEntries({ stats, benchmarkPanels }) {
  const panelsByGroup = new Map((Array.isArray(benchmarkPanels) ? benchmarkPanels : [])
    .map((panel) => [panel.statGroup, panel]));

  return (Array.isArray(stats) ? stats : [])
    .filter((stat) => stat && typeof stat.statGroup === 'string' && typeof stat.statName === 'string' && Number.isFinite(stat.numericValue))
    .map((stat) => {
      const panel = panelsByGroup.get(stat.statGroup) || null;
      const metric = Array.isArray(panel?.metrics)
        ? panel.metrics.find((entry) => entry.statName === stat.statName) || null
        : null;
      const previousPoint = resolvePreviousBenchmarkPoint(stat, metric?.points || []);
      const classification = classifyBenchmarkComparison({
        projectKey: stat.projectKey || previousPoint?.projectKey || panel?.projectKey || null,
        latestPoint: stat,
        previousPoint,
        statGroup: stat.statGroup,
        statName: stat.statName,
        unit: stat.unit || previousPoint?.unit || null,
      });

      return {
        key: `${stat.id || stat.runId}:${stat.statGroup}:${stat.statName}:${stat.seriesId || 'default'}`,
        statGroup: stat.statGroup,
        statName: stat.statName,
        unit: stat.unit || previousPoint?.unit || null,
        latestPoint: stat,
        previousPoint,
        deltaValue: classification.deltaValue,
        deltaPercent: classification.deltaPercent,
        status: classification.status,
        directionStatus: classification.directionStatus,
        budgetStatus: classification.budgetStatus,
        warningThresholdPct: classification.warningDeltaPct,
        severeThresholdPct: classification.severeDeltaPct,
      };
    })
    .sort((left, right) => compareBenchmarkStatus(left.status, right.status)
      || compareNullableNumbersDesc(Math.abs(left.deltaPercent || 0), Math.abs(right.deltaPercent || 0))
      || left.statGroup.localeCompare(right.statGroup)
      || left.statName.localeCompare(right.statName));
}

function resolvePreviousBenchmarkPoint(stat, points) {
  const candidates = (Array.isArray(points) ? points : [])
    .filter((point) => point && Number.isFinite(point.numericValue))
    .filter((point) => point.runId !== stat.runId)
    .sort(compareBenchmarkPointsDescending);

  const exact = candidates.find((point) => (point.seriesId || 'default') === (stat.seriesId || 'default')
    && (point.runnerKey || 'runner unavailable') === (stat.runnerKey || 'runner unavailable')
    && (point.branch || 'no branch') === (stat.branch || 'no branch'));
  if (exact) {
    return exact;
  }

  const runnerMatch = candidates.find((point) => (point.seriesId || 'default') === (stat.seriesId || 'default')
    && (point.runnerKey || 'runner unavailable') === (stat.runnerKey || 'runner unavailable'));
  if (runnerMatch) {
    return runnerMatch;
  }

  const seriesMatch = candidates.find((point) => (point.seriesId || 'default') === (stat.seriesId || 'default'));
  if (seriesMatch) {
    return seriesMatch;
  }

  return candidates[0] || null;
}

function resolvePerformanceDomain(statGroup) {
  const group = typeof statGroup === 'string' ? statGroup : '';
  if (group.includes('.route.')) return 'route';
  if (group.includes('.gallery.')) return 'gallery';
  if (group.includes('.scad.')) return 'SCAD';
  if (group.includes('.jscad.')) return 'JSCAD';
  if (group.includes('.library.')) return 'library';
  if (group.includes('.render.')) return 'renderer';
  if (group.includes('.module_interpreter.') || group.includes('.interpreter.')) return 'interpreter';
  if (group.includes('.node.engine.')) return 'interpreter';
  return 'performance';
}

function resolveProfileMode(point) {
  const metadata = point && typeof point.metadata === 'object' && point.metadata !== null ? point.metadata : {};
  return normalizeString(metadata.profileMode) || normalizeString(point?.profileMode) || 'unknown';
}

function resolveBenchmarkSemanticsForPoint(point, statName, unit = null) {
  return resolveBenchmarkSemantics({
    projectKey: point?.projectKey || null,
    statGroup: point?.statGroup || null,
    statName: statName || point?.statName || null,
    unit: unit || point?.unit || null,
    metadata: point?.metadata || null,
  });
}

function resolveMetricStatusFromPoint(point, statName) {
  if (!point) {
    return 'insufficient-baseline';
  }

  const classification = classifyBenchmarkComparison({
    projectKey: point?.projectKey || null,
    latestPoint: point,
    previousPoint: null,
    statGroup: point.statGroup || null,
    statName: statName || point.statName || null,
    unit: point.unit || null,
  });

  return classification.status || 'insufficient-baseline';
}

function hasBudgetWarning(point) {
  return resolveBenchmarkBudgetStatus(point?.metadata) != null;
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

function renderBenchmarkMetadataInspector(stat) {
  const rows = buildBenchmarkMetadataRows(stat);
  if (rows.length === 0) {
    return null;
  }

  return React.createElement(
    'div',
    { className: 'web-benchmark-metadata', 'aria-label': 'Performance metric metadata' },
    ...rows.map((row) => React.createElement(
      'span',
      { className: 'web-chip web-chip--muted', key: row.label },
      `${row.label}: ${row.value}`,
    )),
  );
}

function buildBenchmarkMetadataRows(stat) {
  const metadata = stat && typeof stat.metadata === 'object' && stat.metadata !== null ? stat.metadata : {};
  const candidates = [
    ['route', metadata.route || metadata.pathname],
    ['example', metadata.example || metadata.exampleName || metadata.galleryExample],
    ['widget', metadata.widget || metadata.widgetName || metadata.controlName],
    ['step', metadata.step || metadata.phase],
    ['profile', metadata.profileMode || stat?.profileMode],
    ['artifact', metadata.artifactName || metadata.sourceArtifactDir],
    ['budget', metadata.budgetStatus || metadata.budget_status],
  ];

  return candidates
    .map(([label, value]) => ({ label, value: normalizeString(value) }))
    .filter((row) => row.value)
    .slice(0, 6);
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

function benchmarkStatusLabel(status) {
  if (status === 'severe-regression') return 'severe regression';
  if (status === 'warning') return 'warning';
  if (status === 'regressed') return 'regressed';
  if (status === 'improved') return 'improved';
  if (status === 'stable') return 'stable';
  return 'needs baseline';
}

function formatNamespaceStatusChip(card) {
  if (card?.status === 'severe-regression') {
    return `${card.severeRegressionCount || card.regressionCount || 1} severe`;
  }
  if (card?.status === 'warning') {
    return `${card.warningCount || card.regressionCount || 1} warnings`;
  }
  if (card?.status === 'regressed') {
    return `${card.regressionCount || 1} regressions`;
  }
  if (card?.status === 'improved') {
    return 'improved';
  }
  if (card?.status === 'stable') {
    return 'stable';
  }
  return 'needs baseline';
}

function benchmarkStatusClassName(status) {
  return `web-chip web-benchmark-status web-benchmark-status--${status || 'insufficient-baseline'}`;
}

function benchmarkStatusColor(status) {
  if (status === 'severe-regression') return '#ff4d6d';
  if (status === 'warning') return '#ffd166';
  if (status === 'regressed') return '#ff6b9a';
  if (status === 'improved') return '#4ee38b';
  if (status === 'stable') return '#6bb2ff';
  return '#c792ea';
}

function formatBenchmarkDelta(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatBenchmarkDeltaValue(value, unit) {
  if (!Number.isFinite(value)) {
    return 'No previous point';
  }

  const absoluteValue = formatBenchmarkValue(Math.abs(value), unit);
  return `${value >= 0 ? '+' : '-'}${absoluteValue}`;
}

function resolveRepresentativeSparklinePoints(points) {
  const series = buildBenchmarkSeries((Array.isArray(points) ? points : []).filter((point) => Number.isFinite(point?.numericValue)));
  if (series.length === 0) {
    return [];
  }

  return [...series].sort((left, right) => right.points.length - left.points.length
    || new Date((right.points[right.points.length - 1]?.completedAt) || 0).valueOf() - new Date((left.points[left.points.length - 1]?.completedAt) || 0).valueOf()
    || left.seriesId.localeCompare(right.seriesId))[0]?.points || [];
}

function compareBenchmarkPointsAscending(left, right) {
  return new Date(left.completedAt || 0).valueOf() - new Date(right.completedAt || 0).valueOf();
}

function compareBenchmarkPointsDescending(left, right) {
  return new Date(right.completedAt || 0).valueOf() - new Date(left.completedAt || 0).valueOf();
}

function compareRunBenchmarkStats(left, right) {
  return left.statName.localeCompare(right.statName)
    || String(left.seriesId || '').localeCompare(String(right.seriesId || ''))
    || String(left.id || '').localeCompare(String(right.id || ''));
}

function compareBenchmarkStatus(left, right) {
  return compareBenchmarkStatusRank(left, right);
}

function compareNullableNumbersDesc(left, right) {
  const leftValue = Number.isFinite(left) ? left : -Infinity;
  const rightValue = Number.isFinite(right) ? right : -Infinity;
  return rightValue - leftValue;
}

function compareNullableIsoDates(left, right) {
  const leftValue = left ? new Date(left).valueOf() : 0;
  const rightValue = right ? new Date(right).valueOf() : 0;
  return leftValue - rightValue;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim())));
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
