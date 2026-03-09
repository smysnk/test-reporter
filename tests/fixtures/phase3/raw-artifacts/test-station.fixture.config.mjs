export default {
  schemaVersion: '1',
  project: {
    name: 'raw-artifact-fixture',
    rootDir: import.meta.dirname,
    outputDir: 'artifacts/report',
    rawDir: 'artifacts/report/raw',
  },
  workspaceDiscovery: {
    provider: 'explicit',
    packages: ['web'],
  },
  execution: {
    continueOnError: true,
    defaultCoverage: false,
  },
  render: {
    html: true,
    console: true,
  },
  suites: [
    {
      id: 'web-e2e',
      label: 'Web E2E',
      adapter: 'custom',
      package: 'web',
      cwd: import.meta.dirname,
      handler: './adapter.mjs',
      command: ['node', './fake-runner.mjs'],
    },
  ],
};
