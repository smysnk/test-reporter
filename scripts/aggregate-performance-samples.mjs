#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export function aggregatePerformanceSamples(payloads) {
  const valid = (Array.isArray(payloads) ? payloads : []).filter((payload) => Array.isArray(payload?.benchmarks));
  if (valid.length === 0) throw new Error('At least one benchmark payload is required');
  const scenarios = new Map();
  for (const payload of valid) {
    for (const record of payload.benchmarks) {
      const entry = scenarios.get(record.scenario) || {
        scenario: record.scenario,
        route: record.route,
        metricSamples: new Map(),
        context: record.context || {},
        profiling: [],
      };
      for (const [name, value] of Object.entries(record.metrics || {})) {
        if (!Number.isFinite(value)) continue;
        const samples = entry.metricSamples.get(name) || [];
        samples.push(value);
        entry.metricSamples.set(name, samples);
      }
      if (record.profiling) entry.profiling.push(record.profiling);
      scenarios.set(record.scenario, entry);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    baseURL: valid[0].baseURL,
    viewport: valid[0].viewport,
    budgets: valid[0].budgets || {},
    sampleCount: valid.length,
    benchmarks: Array.from(scenarios.values()).map((entry) => ({
      scenario: entry.scenario,
      route: entry.route,
      metrics: Object.fromEntries(Array.from(entry.metricSamples.entries()).flatMap(([name, samples]) => [
        [`${name}Median`, percentile(samples, 0.5)],
        [`${name}P95`, percentile(samples, 0.95)],
      ])),
      context: { ...entry.context, sampleCount: valid.length },
      profiling: { samples: entry.profiling },
    })),
  };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
}

function parseArgs(argv) {
  const result = { inputs: [], output: 'artifacts/e2e-performance/latest.json' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--input') result.inputs.push(argv[++index]);
    else if (argv[index] === '--output') result.output = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = parseArgs(process.argv.slice(2));
  const aggregate = aggregatePerformanceSamples(args.inputs.map((input) => JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'))));
  const output = path.resolve(args.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(aggregate, null, 2)}\n`);
}
