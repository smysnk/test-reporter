export default {
  schemaVersion: '1',
  project: {
    name: 'fixture-project',
    rootDir: import.meta.dirname,
    outputDir: 'artifacts/report',
    rawDir: 'artifacts/report/raw',
  },
  workspaceDiscovery: {
    provider: 'explicit',
    packages: ['app', 'lib'],
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  render: {
    html: true,
    console: true,
    defaultView: 'module',
    includeDetailedAnalysisToggle: true,
  },
  suites: [
    {
      id: 'app-unit',
      label: 'App Unit',
      adapter: 'custom',
      package: 'app',
      handler: './static-suite-adapter.mjs',
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
          {
            name: 'renders editor shell',
            fullName: 'app renders editor shell',
            status: 'passed',
            durationMs: 5,
            assertions: ['expect(shell).toBeDefined()'],
            module: 'editor',
            theme: 'code',
            classificationSource: 'fixture',
          }
        ],
        coverage: {
          files: [
            {
              path: '/virtual/app/runtime.js',
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 2, total: 4, pct: 50 },
              functions: { covered: 3, total: 4, pct: 75 },
              statements: { covered: 8, total: 10, pct: 80 }
            }
          ]
        }
      }
    },
    {
      id: 'lib-unit',
      label: 'Lib Unit',
      adapter: 'custom',
      package: 'lib',
      handler: './static-suite-adapter.mjs',
      command: ['node', 'fixtures/lib-unit.js'],
      fixture: {
        status: 'failed',
        tests: [
          {
            name: 'rejects invalid input',
            fullName: 'lib rejects invalid input',
            status: 'failed',
            durationMs: 6,
            failureMessages: ['expected validation error'],
            module: 'filesystem',
            theme: 'content',
            classificationSource: 'fixture'
          }
        ],
        coverage: {
          files: [
            {
              path: '/virtual/lib/file-content.js',
              lines: { covered: 3, total: 10, pct: 30 },
              branches: { covered: 1, total: 4, pct: 25 },
              functions: { covered: 1, total: 3, pct: 33.33 },
              statements: { covered: 3, total: 10, pct: 30 }
            }
          ]
        },
        rawText: 'failure fixture\n'
      }
    }
  ],
  adapters: [],
};
