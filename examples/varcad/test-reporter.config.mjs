export default {
  schemaVersion: "1",
  project: {
    name: "varcad.io",
    rootDir: process.cwd(),
    outputDir: "artifacts/workspace-tests",
    rawDir: "artifacts/workspace-tests/raw",
  },
  workspaceDiscovery: {
    provider: "yarn-workspaces",
    include: ["packages/*"],
    exclude: [],
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  manifests: {
    classification: "./config/test-modules.json",
    coverageAttribution: "./config/test-modules.json",
    ownership: "./config/test-modules.json",
  },
  enrichers: {
    sourceAnalysis: {
      enabled: true,
    },
  },
  render: {
    html: true,
    console: true,
    defaultView: "module",
    includeDetailedAnalysisToggle: true,
  },
  suites: [
    {
      id: "web-unit",
      label: "Unit Tests",
      adapter: "vitest",
      package: "web",
      command: ["yarn", "workspace", "web", "test", "--reporter=json"],
      coverage: {
        enabled: true,
        mode: "second-pass",
      },
    },
    {
      id: "web-e2e",
      label: "E2E",
      adapter: "playwright",
      package: "web",
      command: ["yarn", "workspace", "web", "test:e2e", "--reporter=json"],
      coverage: {
        enabled: false,
      },
    },
    {
      id: "module-interpreter-tests",
      label: "Tests",
      adapter: "node-test",
      package: "module-interpreter",
      command: ["node", "--test", "./tests/**/*.test.js"],
      coverage: {
        enabled: true,
        mode: "same-run",
      },
    },
    {
      id: "transpiler-node-tests",
      label: "Node Tests",
      adapter: "node-test",
      package: "transpiler",
      command: ["yarn", "workspace", "transpiler", "test:node"],
      coverage: {
        enabled: true,
        mode: "same-run",
      },
    },
    {
      id: "transpiler-mapping-parity",
      label: "Mapping Parity",
      adapter: "custom",
      package: "transpiler",
      handler: "./scripts/test-reporter/transpilerMappingParityAdapter.mjs",
      coverage: {
        enabled: false,
      },
    },
  ],
  adapters: [],
};
