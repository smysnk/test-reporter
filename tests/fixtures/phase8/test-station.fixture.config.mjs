export default {
  schemaVersion: '1',
  project: {
    name: 'phase8-project',
    rootDir: import.meta.dirname,
    outputDir: 'artifacts/report',
    rawDir: 'artifacts/report/raw',
  },
  workspaceDiscovery: {
    provider: 'explicit',
    packages: ['app', 'empty'],
  },
  render: {
    html: true,
    console: true,
    defaultView: 'module',
    includeDetailedAnalysisToggle: true,
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  suites: [
    {
      id: 'app-unit',
      label: 'App Unit',
      adapter: 'custom',
      package: 'app',
      handler: '../phase2/static-suite-adapter.mjs',
      command: ['node', 'fixtures/app-unit.js'],
      fixture: {
        status: 'passed',
        tests: [
          {
            name: 'loads runtime state',
            fullName: 'app loads runtime state',
            status: 'passed',
            durationMs: 4,
            assertions: ['assert.equal(1, 1)'],
            module: 'runtime',
            theme: 'hydration',
            classificationSource: 'fixture',
          },
        ],
        coverage: {
          files: [
            {
              path: '/virtual/app/runtime.js',
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 2, total: 4, pct: 50 },
              functions: { covered: 3, total: 4, pct: 75 },
              statements: { covered: 8, total: 10, pct: 80 },
            },
          ],
        },
      },
    },
  ],
  adapters: [],
};
