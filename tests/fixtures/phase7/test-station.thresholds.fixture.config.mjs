import path from 'node:path';

const rootDir = import.meta.dirname;

export default {
  schemaVersion: '1',
  project: {
    name: 'phase7-thresholds',
    rootDir,
    outputDir: path.join(rootDir, 'artifacts'),
    rawDir: path.join(rootDir, 'artifacts', 'raw'),
  },
  workspaceDiscovery: {
    provider: 'explicit',
    packages: ['app'],
  },
  manifests: {
    classification: './test-modules.json',
    coverageAttribution: './test-modules.json',
    ownership: './test-modules.json',
    thresholds: './test-modules.json',
  },
  enrichers: {
    sourceAnalysis: {
      enabled: false,
    },
  },
  suites: [
    {
      id: 'app-unit',
      label: 'App Unit',
      package: 'app',
      handler: '../phase2/static-suite-adapter.mjs',
      fixture: {
        status: 'passed',
        summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
        tests: [
          {
            name: 'loads runtime state',
            fullName: 'loads runtime state',
            status: 'passed',
            durationMs: 14,
            file: path.join(rootDir, 'tests', 'runtime', 'runtime.test.js'),
          },
        ],
        coverage: {
          files: [
            {
              path: path.join(rootDir, 'src', 'runtime.js'),
              lines: { covered: 4, total: 10, pct: 40 },
              branches: { covered: 2, total: 10, pct: 20 },
              functions: { covered: 1, total: 2, pct: 50 },
              statements: { covered: 4, total: 10, pct: 40 },
            },
          ],
        },
      },
    },
  ],
};
