#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export function convertPerformanceResults(payload, options = {}) {
  const benchmarkProfile = options.benchmarkProfile || process.env.TEST_STATION_BENCHMARK_PROFILE || 'deployed.chromium.1440x1024.live';
  const baselineId = options.baselineId || process.env.TEST_STATION_BASELINE_ID || null;
  const refactorPhase = options.refactorPhase || process.env.TEST_STATION_REFACTOR_PHASE || 'phase-0';
  const targetCommit = options.targetCommit || process.env.TEST_STATION_TARGET_COMMIT || process.env.GITHUB_SHA || null;
  const records = Array.isArray(payload?.benchmarks) ? payload.benchmarks : [];
  const performanceStats = [];
  const tests = [];
  let suiteFailed = false;

  for (const record of records) {
    const scenario = normalizeKey(record?.scenario || 'unknown');
    let scenarioFailed = false;
    const promotedMetrics = {
      ...(record?.metrics || {}),
      ...promoteProfilingMetrics(record?.profiling),
    };
    for (const [metricName, rawValue] of Object.entries(promotedMetrics)) {
      if (!Number.isFinite(rawValue)) continue;
      const statName = toSnakeCase(metricName);
      const budget = resolveBudget(payload?.budgets, metricName);
      const lowerIsBetter = !/(throughput|per_second|cache_hit|fps)/i.test(statName);
      const budgetStatus = Number.isFinite(budget)
        ? (lowerIsBetter ? rawValue <= budget : rawValue >= budget) ? 'pass' : 'failed'
        : null;
      scenarioFailed ||= budgetStatus === 'failed';
      performanceStats.push({
        statGroup: `benchmark.web.test-station.${scenario}`,
        statName,
        unit: inferUnit(statName),
        numericValue: rawValue,
        metadata: {
          seriesId: benchmarkProfile,
          runnerKey: benchmarkProfile,
          lowerIsBetter,
          baselineId,
          refactorPhase,
          targetCommit,
          route: record?.route || null,
          statistic: 'sample',
          budget,
          budgetStatus,
          context: record?.context || {},
        },
      });
    }
    suiteFailed ||= scenarioFailed;
    tests.push({
      name: scenario,
      fullName: `Test Station web performance ${scenario}`,
      status: scenarioFailed ? 'failed' : 'passed',
      durationMs: resolveScenarioDuration(record?.metrics),
      failureMessages: scenarioFailed ? [`${scenario} exceeded one or more configured performance budgets`] : [],
      assertions: [],
      setup: [],
      mocks: [],
      rawDetails: { route: record?.route || null, context: record?.context || {} },
    });
  }

  const summary = {
    total: tests.length,
    passed: tests.filter((test) => test.status === 'passed').length,
    failed: tests.filter((test) => test.status === 'failed').length,
    skipped: 0,
  };

  return {
    status: suiteFailed ? 'failed' : 'passed',
    durationMs: tests.reduce((total, test) => total + (test.durationMs || 0), 0),
    summary,
    tests,
    warnings: records.length === 0 ? ['No benchmark records were present in the input artifact'] : [],
    performanceStats,
    rawArtifacts: [{
      relativePath: 'benchmarks/live-navigation-performance.json',
      label: 'Raw live navigation performance results',
      content: `${JSON.stringify(payload, null, 2)}\n`,
    }],
    metadata: {
      benchmarkProfile,
      baselineId,
      refactorPhase,
      targetCommit,
      generatedAt: payload?.generatedAt || null,
      baseURL: payload?.baseURL || null,
      viewport: payload?.viewport || null,
    },
  };
}

export function promoteProfilingMetrics(profiling) {
  const samples = Array.isArray(profiling?.samples) ? profiling.samples : profiling ? [profiling] : [];
  if (samples.length === 0) return {};
  const totals = samples.map(summarizeProfileSample);
  const fields = {
    profileDatabaseQueryCount: 'queryCount',
    profileDatabaseDurationMs: 'durationMs',
    profileDatabasePoolWaitMs: 'poolWaitMs',
    profileDatabaseTimeoutCount: 'timeoutCount',
    profileServerDurationMs: 'serverDurationMs',
  };
  return Object.fromEntries(Object.entries(fields).flatMap(([metric, field]) => {
    const values = totals.map((entry) => entry[field]).filter(Number.isFinite);
    return values.length ? [[`${metric}Median`, percentile(values, 0.5)], [`${metric}P95`, percentile(values, 0.95)]] : [];
  }));
}

function summarizeProfileSample(sample) {
  const seen = new Set();
  const total = { queryCount: 0, durationMs: 0, poolWaitMs: 0, timeoutCount: 0, serverDurationMs: 0 };
  walk(sample);
  return total;

  function walk(value) {
    if (!value || typeof value !== 'object') return;
    const profile = value.profile && typeof value.profile === 'object' ? value.profile : value;
    if (profile.database && typeof profile.database === 'object') {
      const identity = profile.traceId || profile.requestId || profile;
      if (!seen.has(identity)) {
        seen.add(identity);
        total.queryCount += Number(profile.database.queryCount) || 0;
        total.durationMs += Number(profile.database.durationMs) || 0;
        total.poolWaitMs += Number(profile.database.poolWaitMs) || 0;
        total.timeoutCount += Number(profile.database.timeoutCount) || 0;
        total.serverDurationMs += Number(profile.durationMs) || 0;
      }
    }
    if (Array.isArray(value)) value.forEach(walk);
    else Object.values(value).forEach(walk);
  }
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)].toFixed(2));
}

function resolveBudget(budgets, metricName) {
  const baseName = metricName.replace(/(?:Median|P95)$/, '');
  const direct = budgets?.[metricName] ?? budgets?.[baseName];
  return Number.isFinite(direct) ? direct : null;
}

function resolveScenarioDuration(metrics) {
  const candidates = Object.entries(metrics || {})
    .filter(([name, value]) => /(?:ready|navigation|switch|duration)ms$/i.test(name) && Number.isFinite(value))
    .map(([, value]) => value);
  return candidates.length > 0 ? Math.round(Math.max(...candidates)) : 0;
}

function inferUnit(statName) {
  if (statName.endsWith('_ms') || statName.includes('duration')) return 'ms';
  if (statName.includes('bytes') || statName.includes('heap')) return 'bytes';
  if (statName.includes('ratio') || statName === 'cls') return 'ratio';
  return 'count';
}

function normalizeKey(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'unknown';
}

function toSnakeCase(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
}

function parseArgs(argv) {
  const result = { input: process.env.TEST_STATION_PERFORMANCE_INPUT || 'artifacts/e2e-performance/latest.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--input') result.input = argv[++index];
    else if (token === '--profile') result.benchmarkProfile = argv[++index];
    else if (token === '--baseline-id') result.baselineId = argv[++index];
    else if (token === '--phase') result.refactorPhase = argv[++index];
    else throw new Error(`Unknown argument: ${token}`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
  process.stdout.write(`${JSON.stringify(convertPerformanceResults(payload, args))}\n`);
}
