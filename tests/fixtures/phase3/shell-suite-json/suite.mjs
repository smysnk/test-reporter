process.stdout.write(`${JSON.stringify({
  status: 'passed',
  durationMs: 321,
  summary: {
    total: 2,
    passed: 2,
    failed: 0,
    skipped: 0,
  },
  warnings: [
    'benchmark sample count is below the long-run target',
  ],
  tests: [
    {
      name: 'engine benchmark payload emitted',
      fullName: 'benchmarks engine benchmark payload emitted',
      status: 'passed',
      durationMs: 10,
      assertions: ['benchmark harness produced structured JSON output'],
      module: 'runtime',
      theme: 'benchmarking',
      classificationSource: 'fixture',
    },
    {
      name: 'benchmark namespace is stable',
      fullName: 'benchmarks benchmark namespace is stable',
      status: 'passed',
      durationMs: 11,
      assertions: ['statGroup uses benchmark.node.engine.* namespace'],
      module: 'runtime',
      theme: 'benchmarking',
      classificationSource: 'fixture',
    },
  ],
  rawArtifacts: [
    {
      relativePath: 'benchmarks/engine-battery.json',
      label: 'Engine battery artifact',
      content: JSON.stringify({
        generatedAt: '2026-03-19T14:00:00.000Z',
        scenarios: ['tight-arithmetic-loop'],
      }, null, 2),
      mediaType: 'application/json',
    },
  ],
  performanceStats: [
    {
      statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
      statName: 'elapsed_ms',
      unit: 'ms',
      numericValue: 12.34,
      metadata: {
        seriesId: 'interpreter',
        engineId: 'interpreter',
        statistic: 'median',
      },
    },
    {
      statGroup: 'benchmark.node.engine.shared.tight_arithmetic_loop',
      statName: 'steps_per_second',
      unit: 'ops_per_sec',
      numericValue: 45678,
      metadata: {
        seriesId: 'interpreter',
        engineId: 'interpreter',
        statistic: 'median',
      },
    },
  ],
}, null, 2)}\n`);
