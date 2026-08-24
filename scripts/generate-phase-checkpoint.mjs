#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export function generatePhaseCheckpoint({ aggregate, phase, commit, imageDigest, artifact, baselineId = 'pre-refactor-2026-07', environment = {} }) {
  const metrics = [];
  for (const scenario of aggregate?.benchmarks || []) {
    for (const [name, current] of Object.entries(scenario.metrics || {})) {
      if (!Number.isFinite(current)) continue;
      const target = resolveTarget(aggregate?.budgets, name);
      const lowerIsBetter = !/(throughput|cacheHit|perSecond)/i.test(name);
      metrics.push({
        key: `benchmark.web.test-station.${slug(scenario.scenario)}.${snake(name)}`,
        baseline: null,
        previousAccepted: null,
        current,
        target,
        noiseBandPercent: 5,
        deltaFromBaselinePercent: null,
        deltaFromPreviousPercent: null,
        budgetHeadroomPercent: Number.isFinite(target) ? percent(lowerIsBetter ? target - current : current - target, target) : null,
        sampleCount: Number(aggregate.sampleCount) || 0,
        status: Number.isFinite(target) ? (lowerIsBetter ? current <= target : current >= target) ? 'green' : 'red' : 'neutral',
        critical: Number.isFinite(target),
        artifact,
      });
    }
  }
  return {
    schemaVersion: '1', phase, status: 'candidate', baselineId, previousAcceptedCheckpoint: null,
    target: { commit, imageDigest, deployedRevisionVerified: true },
    environment: { profile: process.env.TEST_STATION_BENCHMARK_PROFILE || 'controlled.chromium.1440x1024.medium.authenticated', fixtureChecksum: environment.fixtureChecksum || 'workflow-manifest', databaseCardinality: environment.databaseCardinality || {}, runner: environment.runner || {}, region: environment.region || 'unknown' },
    metrics,
    correctnessGates: [],
    deliverables: [],
    waivers: [],
  };
}

function resolveTarget(budgets, name) {
  if (Number.isFinite(budgets?.[name])) return budgets[name];
  if (!name.endsWith('P95')) return null;
  const base = name.replace(/P95$/, '');
  const value = budgets?.[base];
  return Number.isFinite(value) ? value : null;
}
function percent(value, denominator) { return denominator ? Number(((value / denominator) * 100).toFixed(2)) : null; }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); }
function snake(value) { return String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase(); }

function parse(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i];
    if (name.startsWith('--')) args[name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++i];
  }
  return args;
}

if (process.argv[1]?.endsWith('generate-phase-checkpoint.mjs')) {
  const args = parse(process.argv.slice(2));
  const aggregate = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
  const checkpoint = generatePhaseCheckpoint({ aggregate, phase: args.phase, commit: args.commit, imageDigest: args.imageDigest, artifact: args.artifact, baselineId: args.baselineId });
  const output = path.resolve(args.output || `benchmarks/checkpoints/${args.phase}/${args.commit}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(checkpoint, null, 2)}\n`);
}
