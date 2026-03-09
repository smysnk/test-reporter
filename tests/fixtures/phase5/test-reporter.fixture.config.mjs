import path from 'node:path';

const fixtureDir = import.meta.dirname;

export default {
  schemaVersion: '1',
  project: {
    name: 'phase5-project',
    rootDir: fixtureDir,
    outputDir: 'artifacts/report',
    rawDir: 'artifacts/report/raw',
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  manifests: {
    classification: './test-modules.json',
    coverageAttribution: './test-modules.json',
    ownership: './test-modules.json',
  },
  plugins: [
    {
      handler: './policy-plugin.mjs',
      options: {
        owner: 'repository-team',
      },
    },
  ],
  enrichers: {
    sourceAnalysis: {
      enabled: true,
    },
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
      command: ['node', 'specs/runtime.test.js'],
      fixture: {
        status: 'passed',
        tests: [
          {
            name: 'loads runtime state',
            fullName: 'loads runtime state',
            status: 'passed',
            durationMs: 4,
            file: path.join(fixtureDir, 'specs', 'runtime.test.js')
          }
        ],
        coverage: {
          files: [
            {
              path: path.join(fixtureDir, 'src', 'runtime.js'),
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
      command: ['node', 'specs/plugin.test.js'],
      fixture: {
        status: 'passed',
        tests: [
          {
            name: 'syncs custom repo',
            fullName: 'syncs custom repo',
            status: 'passed',
            durationMs: 6,
            file: path.join(fixtureDir, 'specs', 'plugin.test.js')
          }
        ],
        coverage: {
          files: [
            {
              path: path.join(fixtureDir, 'src', 'custom.js'),
              lines: { covered: 5, total: 10, pct: 50 },
              branches: { covered: 1, total: 4, pct: 25 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 5, total: 10, pct: 50 }
            }
          ]
        }
      }
    }
  ],
  adapters: [],
};
