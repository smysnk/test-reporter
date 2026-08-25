import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityRows,
  buildCoverageSeries,
  buildDateWindow,
  buildOperationsOverviewModel,
  buildOperationsSummary,
  filterOperationRuns,
  operationTimestamp,
  resolveNextPage,
} from '../packages/web/lib/operationsOverview.js';

const projects = [
  { id: 'project-a', slug: 'alpha', name: 'Alpha' },
  { id: 'project-b', slug: 'beta', name: 'Beta' },
];

const runs = [
  {
    id: 'alpha-failed', externalKey: 'alpha-104', status: 'failed', publicationKinds: ['tests'],
    completedAt: '2026-08-25T17:00:00.000Z', durationMs: 30,
    branch: 'main', commitSha: 'abcdef012345', project: projects[0],
    projectVersion: { buildNumber: 104 }, summary: { passedTests: 9, failedTests: 1 },
    coverageSnapshot: { linesPct: 82 },
  },
  {
    id: 'alpha-passed', externalKey: 'alpha-103', status: 'passed', publicationKinds: ['tests'],
    completedAt: '2026-08-25T15:00:00.000Z', durationMs: 10,
    branch: 'feature/search', commitSha: '123456789abc', project: projects[0],
    projectVersion: { buildNumber: 103 }, summary: { passedTests: 10, failedTests: 0 },
    coverageSnapshot: { linesPct: 80 },
  },
  {
    id: 'beta-benchmark', externalKey: 'beta-12', status: 'unknown', publicationKinds: ['performance'],
    completedAt: '2026-08-24T18:00:00.000Z', durationMs: 20,
    branch: 'main', project: projects[1], projectVersion: { buildNumber: 12 },
  },
  {
    id: 'too-old', externalKey: 'alpha-1', status: 'passed', publicationKinds: ['tests'],
    completedAt: '2026-07-01T12:00:00.000Z', durationMs: 1, project: projects[0],
  },
];

test('operations overview computes 14-day summaries without mutating newest-first input', () => {
  const input = [runs[2], runs[0], runs[1], runs[3]];
  const originalOrder = input.map((run) => run.id);
  const model = buildOperationsOverviewModel({
    projects,
    runs: input,
    now: new Date('2026-08-25T20:00:00.000Z'),
    timeZone: 'UTC',
  });

  assert.deepEqual(input.map((run) => run.id), originalOrder);
  assert.equal(model.dateWindow.length, 14);
  assert.equal(model.dateWindow[0].key, '2026-08-12');
  assert.equal(model.dateWindow[13].key, '2026-08-25');
  assert.deepEqual(model.filteredRuns.map((run) => run.id), ['alpha-failed', 'alpha-passed', 'beta-benchmark']);
  assert.deepEqual(model.summary, {
    total: 3,
    passed: 1,
    failed: 1,
    terminal: 2,
    passRate: 50,
    benchmarks: 1,
    coveragePublications: 0,
    latestCoverage: 82,
    medianDurationMs: 20,
  });
});

test('activity uses worst-state precedence and coverage uses the latest project value per day', () => {
  const dates = buildDateWindow({ now: new Date('2026-08-25T20:00:00.000Z'), days: 2, timeZone: 'UTC' });
  const activity = buildActivityRows(projects, runs, dates, 'UTC');
  const alphaToday = activity[0].cells[1];
  assert.equal(alphaToday.presentation.status, 'failed');
  assert.equal(alphaToday.counts.total, 2);
  assert.equal(alphaToday.counts.failed, 1);

  const coverage = buildCoverageSeries(projects, runs, dates, null, 'UTC');
  assert.equal(coverage[1].linesPct, 82);
  assert.equal(coverage[1].projectCount, 1);
});

test('date windows follow the viewer calendar at extreme timezone boundaries', () => {
  assert.deepEqual(
    buildDateWindow({ now: new Date('2026-08-25T11:30:00.000Z'), days: 2, timeZone: 'Pacific/Kiritimati' }).map((day) => day.key),
    ['2026-08-25', '2026-08-26'],
  );
  assert.deepEqual(
    buildDateWindow({ now: new Date('2026-08-25T01:30:00.000Z'), days: 2, timeZone: 'America/Los_Angeles' }).map((day) => day.key),
    ['2026-08-23', '2026-08-24'],
  );
});

test('operations timestamps accept GraphQL numeric strings as well as ISO values', () => {
  const completedAt = String(Date.parse('2026-08-25T17:00:00.000Z'));
  const model = buildOperationsOverviewModel({
    projects,
    runs: [{ ...runs[0], completedAt }],
    now: new Date('2026-08-25T20:00:00.000Z'),
    timeZone: 'UTC',
  });

  assert.equal(operationTimestamp(completedAt), Date.parse('2026-08-25T17:00:00.000Z'));
  assert.deepEqual(model.filteredRuns.map((run) => run.id), ['alpha-failed']);
  assert.equal(model.activityRows[0].cells.at(-1).counts.failed, 1);
  assert.equal(model.summary.failed, 1);
});

test('operations filters compose search, publication status, date, project, and page bounds', () => {
  assert.deepEqual(filterOperationRuns(runs, { search: 'feature/search' }).map((run) => run.id), ['alpha-passed']);
  assert.deepEqual(filterOperationRuns(runs, { search: '104', status: 'failed' }).map((run) => run.id), ['alpha-failed']);
  assert.deepEqual(filterOperationRuns(runs, { status: 'benchmark', day: '2026-08-24' }).map((run) => run.id), ['beta-benchmark']);

  const selected = buildOperationsOverviewModel({
    projects,
    runs,
    selectedProjectSlug: 'alpha',
    search: 'main',
    status: 'failed',
    now: new Date('2026-08-25T20:00:00.000Z'),
  });
  assert.deepEqual(selected.filteredRuns.map((run) => run.id), ['alpha-failed']);
  assert.equal(selected.activityRows.length, 1);
  assert.equal(resolveNextPage(-4, 120), 1);
  assert.equal(resolveNextPage(9, 120), 3);
  assert.equal(resolveNextPage(2, 0), 1);
});

test('summary leaves ratios and coverage explicitly unavailable when evidence is absent', () => {
  assert.deepEqual(buildOperationsSummary([{ status: 'unknown', publicationKinds: [] }]), {
    total: 1,
    passed: 0,
    failed: 0,
    terminal: 0,
    passRate: null,
    benchmarks: 0,
    coveragePublications: 0,
    latestCoverage: null,
    medianDurationMs: null,
  });
});
