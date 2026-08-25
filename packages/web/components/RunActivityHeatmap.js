import React from 'react';

function shortDate(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed)
    : value;
}

export function RunActivityHeatmap({ rows, dateWindow, selectedDay, onSelectCell }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return React.createElement(
    'section',
    { className: 'operations-analysis-panel operations-activity', 'aria-labelledby': 'operations-activity-title' },
    React.createElement('div', { className: 'operations-analysis-panel__heading' },
      React.createElement('div', null,
        React.createElement('p', { className: 'operations-kicker' }, '14-day signal'),
        React.createElement('h3', { id: 'operations-activity-title' }, 'Activity')),
      selectedDay ? React.createElement('button', { type: 'button', className: 'operations-text-button', onClick: () => onSelectCell(null, null) }, `Clear ${selectedDay}`) : null),
    React.createElement(
      'div',
      { className: 'operations-activity__scroll' },
      React.createElement(
        'table',
        { className: 'operations-activity__table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, 'Project'),
            ...dateWindow.map((day) => React.createElement('th', { key: day.key, title: day.key }, shortDate(day.date))))),
        React.createElement(
          'tbody',
          null,
          ...rows.map((row) => React.createElement(
            'tr',
            { key: row.project.id },
            React.createElement('th', { scope: 'row' }, row.project.name),
            ...row.cells.map((cell) => {
              const presentation = cell.presentation;
              const label = presentation
                ? `${row.project.name}, ${cell.key}: ${cell.runs.length} runs; ${cell.counts.passed} passed, ${cell.counts.failed} failed, ${cell.counts.other} other`
                : `${row.project.name}, ${cell.key}: no runs`;
              return React.createElement(
                'td',
                { key: cell.key },
                presentation
                  ? React.createElement('button', {
                    type: 'button',
                    className: selectedDay === cell.key
                      ? `operations-activity__cell operations-activity__cell--${presentation.status} operations-activity__cell--selected`
                      : `operations-activity__cell operations-activity__cell--${presentation.status}`,
                    onClick: () => onSelectCell(row.project.slug, cell),
                    title: label,
                    'aria-label': label,
                    'aria-pressed': selectedDay === cell.key,
                  }, presentation.symbol)
                  : React.createElement('span', { className: 'operations-activity__empty', 'aria-label': label }, '·'),
              );
            }),
          )),
        ),
      ),
    ),
    React.createElement('p', { className: 'operations-analysis-panel__legend' }, '✓ passed · × failed · ! partial · – skipped · B benchmark · C coverage · ? unknown'),
  );
}
