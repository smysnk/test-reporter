#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createPerformanceFixture({ testCount = 100, seed = 'test-station-performance-v1' } = {}) {
  const count = normalizePositiveInteger(testCount, 'testCount');
  const suiteCount = Math.max(1, Math.min(20, Math.ceil(count / 500)));
  const testsPerSuite = Math.ceil(count / suiteCount);
  const generatedAt = '2026-07-22T00:00:00.000Z';
  const suites = [];
  let created = 0;

  for (let suiteIndex = 0; suiteIndex < suiteCount; suiteIndex += 1) {
    const tests = [];
    while (tests.length < testsPerSuite && created < count) {
      const index = created;
      const failed = index > 0 && index % 97 === 0;
      const skipped = !failed && index > 0 && index % 53 === 0;
      const status = failed ? 'failed' : skipped ? 'skipped' : 'passed';
      const fileIndex = index % 64;
      tests.push({
        name: `fixture test ${index + 1}`,
        fullName: `performance fixture suite ${suiteIndex + 1} fixture test ${index + 1}`,
        status,
        durationMs: 1 + (stableNumber(`${seed}:${index}`) % 25),
        file: `/fixtures/performance/file-${fileIndex}.test.js`,
        line: 1 + (index % 200),
        column: 1,
        module: `module-${fileIndex % 8}`,
        theme: 'performance-fixture',
        failureMessages: failed ? [`Deterministic fixture failure ${index + 1}`] : [],
        assertions: [],
        setup: [],
        mocks: [],
        metadata: { fixtureSeed: seed, fixtureIndex: index },
      });
      created += 1;
    }

    const summary = summarizeTests(tests);
    suites.push({
      id: `performance-fixture-${suiteIndex + 1}`,
      label: `Performance Fixture ${suiteIndex + 1}`,
      runtime: 'fixture',
      command: 'generated',
      cwd: '/fixtures/performance',
      status: summary.failed > 0 ? 'failed' : 'passed',
      durationMs: tests.reduce((total, test) => total + test.durationMs, 0),
      summary,
      tests,
      warnings: [],
      rawArtifacts: [],
      performanceStats: [],
      metadata: { fixtureSeed: seed, fixtureTier: resolveTier(count) },
    });
  }

  const tests = suites.flatMap((suite) => suite.tests);
  const summary = summarizeTests(tests);
  const files = createCoverageFiles(seed);
  const coverage = aggregateCoverage(files);
  const durationMs = suites.reduce((total, suite) => total + suite.durationMs, 0);

  return {
    schemaVersion: '1',
    generatedAt,
    durationMs,
    summary: {
      generatedAt,
      durationMs,
      totalPackages: 1,
      totalModules: 8,
      passedPackages: summary.failed === 0 ? 1 : 0,
      failedPackages: summary.failed > 0 ? 1 : 0,
      skippedPackages: 0,
      totalSuites: suites.length,
      failedSuites: suites.filter((suite) => suite.status === 'failed').length,
      totalTests: summary.total,
      passedTests: summary.passed,
      failedTests: summary.failed,
      skippedTests: summary.skipped,
      coverage,
      classification: { uncategorized: 0, modules: [] },
      coverageAttribution: {},
      filterOptions: { modules: [], packages: ['performance-fixtures'], frameworks: ['fixture'] },
    },
    packages: [{
      name: 'performance-fixtures',
      location: 'fixtures/performance',
      sortIndex: 0,
      status: summary.failed > 0 ? 'failed' : 'passed',
      durationMs,
      summary,
      suites,
      coverage,
      modules: [],
      frameworks: ['fixture'],
    }],
    modules: [],
    performanceStats: [{
      scope: 'run',
      statGroup: 'benchmark.fixture.test-station.dataset',
      statName: 'test_count',
      unit: 'count',
      numericValue: count,
      metadata: {
        seriesId: resolveTier(count),
        fixtureSeed: seed,
        lowerIsBetter: false,
        comparisonMode: 'neutral',
      },
    }, ...Array.from({ length: 139 }, (_, index) => ({
      scope: 'run',
      statGroup: `benchmark.fixture.test-station.namespace-${String(index % 4).padStart(2, '0')}`,
      statName: `metric_${String(index).padStart(3, '0')}`,
      unit: 'ms',
      numericValue: 10 + (stableNumber(`${seed}:metric:${index}:${count}`) % 5_000) / 10,
      metadata: {
        seriesId: resolveTier(count),
        runnerKey: 'deterministic-fixture',
        lowerIsBetter: true,
        comparisonMode: 'previous',
      },
    }))],
    metadata: {
      fixtureSeed: seed,
      fixtureTier: resolveTier(count),
      fixtureChecksum: createFixtureChecksum({ seed, count, suiteCount }),
    },
  };
}

function summarizeTests(tests) {
  return {
    total: tests.length,
    passed: tests.filter((test) => test.status === 'passed').length,
    failed: tests.filter((test) => test.status === 'failed').length,
    skipped: tests.filter((test) => test.status === 'skipped').length,
  };
}

function createCoverageFiles(seed) {
  return Array.from({ length: 64 }, (_, index) => {
    const total = 100;
    const covered = 55 + (stableNumber(`${seed}:coverage:${index}`) % 46);
    const metric = { covered, total, pct: Number(((covered / total) * 100).toFixed(2)) };
    return {
      path: `/fixtures/performance/file-${index}.js`,
      lines: metric,
      statements: metric,
      functions: metric,
      branches: metric,
      packageName: 'performance-fixtures',
      module: `module-${index % 8}`,
      theme: 'performance-fixture',
      shared: false,
      attributionSource: 'fixture',
      attributionReason: 'deterministic performance dataset',
      attributionWeight: 1,
    };
  });
}

function aggregateCoverage(files) {
  const total = files.reduce((sum, file) => sum + file.lines.total, 0);
  const covered = files.reduce((sum, file) => sum + file.lines.covered, 0);
  const metric = { covered, total, pct: Number(((covered / total) * 100).toFixed(2)) };
  return { lines: metric, statements: metric, functions: metric, branches: metric, files };
}

function stableNumber(value) {
  return Number.parseInt(crypto.createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
}

function createFixtureChecksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function resolveTier(count) {
  if (count >= 10_000) return 'large';
  if (count >= 1_000) return 'medium';
  return 'small';
}

function normalizePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const result = { testCount: 100, seed: 'test-station-performance-v1', output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--count') result.testCount = argv[++index];
    else if (token === '--seed') result.seed = argv[++index];
    else if (token === '--output') result.output = argv[++index];
    else throw new Error(`Unknown argument: ${token}`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = parseArgs(process.argv.slice(2));
  const report = createPerformanceFixture(args);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    const outputPath = path.resolve(args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json);
  } else {
    process.stdout.write(json);
  }
}
