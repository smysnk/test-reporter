const rootDir = import.meta.dirname;

export default {
  schemaVersion: '1',
  project: {
    name: 'mixed-framework-monorepo',
    rootDir,
    outputDir: 'artifacts/workspace-tests',
    rawDir: 'artifacts/workspace-tests/raw',
  },
  workspaceDiscovery: {
    provider: 'yarn-workspaces',
    packages: ['api', 'web', 'vr', 'admin'],
  },
  execution: {
    continueOnError: true,
    defaultCoverage: false,
  },
  suites: [
    {
      id: 'api-jest',
      label: 'API Jest Tests',
      adapter: 'jest',
      package: 'api',
      cwd: rootDir,
      command: ['yarn', 'workspace', 'api', 'test'],
      coverage: {
        enabled: true,
      },
    },
    {
      id: 'web-node',
      label: 'Web Node Tests',
      adapter: 'node-test',
      package: 'web',
      cwd: rootDir,
      command: ['yarn', 'workspace', 'web', 'test:node'],
      coverage: {
        enabled: true,
        mode: 'same-run',
      },
    },
    {
      id: 'vr-node',
      label: 'VR Node Tests',
      adapter: 'node-test',
      package: 'vr',
      cwd: rootDir,
      command: ['yarn', 'workspace', 'vr', 'test:node'],
      env: {
        NODE_ENV: 'test',
      },
      coverage: {
        enabled: false,
      },
    },
  ],
};
