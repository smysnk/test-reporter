import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRunPresentation,
  compactRunPresentation,
  normalizePublicationKinds,
} from '../packages/web/lib/runPresentation.js';
import {
  compactWorkspaceQuery,
  parseProjectWorkspaceState,
  parseRunWorkspaceState,
} from '../packages/web/lib/workspaceRouting.js';
import { isApiResourceEnvelope } from '../packages/web/lib/apiResponse.js';

const cohorts = {
  passed: { status: 'passed', publicationKinds: ['tests'], summary: { failedTests: 0 } },
  failed: { status: 'failed', publicationKinds: ['tests'], summary: { failedTests: 2 }, artifactCount: 3, hasReportArtifact: true },
  coverage: { status: 'unknown', publicationKinds: ['coverage'], coverageSnapshot: { linesPct: 81.2 } },
  performance: { status: 'unknown', publicationKinds: ['performance'], performanceAvailable: true },
  combined: { status: 'passed', publicationKinds: ['combined'], summary: { totalTests: 12, failedTests: 0 } },
  missing: { status: null, publicationKinds: null, summary: { failedTests: null } },
};

test('run presentation selects useful real-data modes for every fixture cohort', () => {
  assert.deepEqual(buildRunPresentation(cohorts.passed).availableViews, ['summary', 'tests']);
  assert.equal(buildRunPresentation(cohorts.passed).defaultView, 'tests');

  const failed = buildRunPresentation(cohorts.failed);
  assert.equal(failed.defaultView, 'failures');
  assert.deepEqual(failed.availableViews, ['summary', 'tests', 'failures', 'artifacts', 'report']);

  assert.equal(buildRunPresentation(cohorts.coverage).defaultView, 'coverage');
  assert.equal(buildRunPresentation(cohorts.performance).defaultView, 'performance');
  assert.equal(buildRunPresentation(cohorts.combined).defaultView, 'tests');
  assert.deepEqual(buildRunPresentation(cohorts.combined).availableViews, ['summary', 'tests']);
  assert.deepEqual(buildRunPresentation(cohorts.missing), {
    overallStatus: 'unknown',
    testStatus: 'missing',
    coverageStatus: 'missing',
    performanceStatus: 'missing',
    publicationKinds: [],
    availableViews: ['summary'],
    defaultView: 'summary',
    freshness: 'current',
  });
});

test('publication and status compatibility semantics stay stable for overview consumers', () => {
  assert.deepEqual(normalizePublicationKinds(['TESTS', 'combined', 'tests', 'invalid']), ['tests', 'combined']);
  assert.deepEqual(compactRunPresentation(cohorts.coverage), { kind: 'coverage', label: 'Coverage', status: 'coverage', symbol: 'C' });
  assert.deepEqual(compactRunPresentation(cohorts.performance), { kind: 'performance', label: 'Benchmark', status: 'benchmark', symbol: 'B' });
});

test('run URL state rejects unavailable modes without losing selection state', () => {
  const presentation = buildRunPresentation(cohorts.coverage);
  const state = parseRunWorkspaceState({ view: 'failures', file: 'coverage-1', search: 'router' }, presentation);
  assert.equal(state.view, 'coverage');
  assert.equal(state.redirected, true);
  assert.equal(state.file, 'coverage-1');
  assert.equal(state.search, 'router');
  assert.deepEqual(compactWorkspaceQuery(state), {
    view: 'coverage',
    file: 'coverage-1',
    search: 'router',
    group: 'suite',
    scopeType: 'run',
  });
});

test('project URL state is bounded to supported modes and preserves drill-down state', () => {
  assert.deepEqual(parseProjectWorkspaceState({
    view: 'releases', branch: 'main', inspectRun: ['run-2', 'ignored'], after: '',
  }), {
    view: 'runs', branch: 'main', search: null, status: null, after: null, inspectRun: 'run-2',
  });
});

test('resource envelope validation distinguishes data from safe response metadata', () => {
  assert.equal(isApiResourceEnvelope({ data: [], meta: { generatedAt: '2026-08-25T00:00:00.000Z', requestId: 'r1' } }), true);
  assert.equal(isApiResourceEnvelope({ data: [] }), false);
  assert.equal(isApiResourceEnvelope({ error: { code: 'NOT_FOUND' } }), false);
});
