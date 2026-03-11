import path from 'node:path';

const rootDir = import.meta.dirname;

export default {
  schemaVersion: '1',
  project: {
    name: 'phase7-diagnostics',
    rootDir,
    outputDir: path.join(rootDir, 'artifacts'),
    rawDir: path.join(rootDir, 'artifacts', 'raw'),
  },
  workspaceDiscovery: {
    provider: 'explicit',
    packages: ['app'],
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
      diagnostics: {
        label: 'Verbose rerun',
        command: [
          process.execPath,
          '-e',
          "console.log('rerun stdout'); console.error('rerun stderr'); process.exit(1);",
        ],
      },
      fixture: {
        status: 'failed',
        summary: { total: 1, passed: 0, failed: 1, skipped: 0 },
        tests: [
          {
            name: 'fails loudly',
            fullName: 'fails loudly',
            status: 'failed',
            durationMs: 21,
            file: path.join(rootDir, 'tests', 'runtime', 'runtime.test.js'),
            failureMessages: ['expected true to equal false'],
          },
        ],
      },
    },
  ],
};
