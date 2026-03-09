const rootDir = import.meta.dirname;

export default {
  schemaVersion: '1',
  project: {
    name: 'generic-node-library',
    rootDir,
    outputDir: 'artifacts/test-report',
    rawDir: 'artifacts/test-report/raw',
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
  enrichers: {
    sourceAnalysis: {
      enabled: true,
    },
  },
  render: {
    html: true,
    console: false,
    defaultView: 'module',
    includeDetailedAnalysisToggle: true,
  },
  suites: [
    {
      id: 'unit',
      label: 'Unit Tests',
      adapter: 'node-test',
      package: 'library',
      cwd: rootDir,
      command: ['node', '--test', './test/**/*.test.js'],
      coverage: {
        enabled: true,
        mode: 'same-run'
      }
    }
  ],
  adapters: []
};
