import path from 'node:path';
import { defineConfig } from '../../config.mjs';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');

export default defineConfig({
  schemaVersion: '1',
  project: {
    name: 'varcad.io',
    rootDir,
    outputDir: path.join(rootDir, 'artifacts', 'workspace-tests'),
    rawDir: path.join(rootDir, 'artifacts', 'workspace-tests', 'raw'),
  },
  workspaceDiscovery: {
    provider: 'explicit',
    packages: ['admin', 'env', 'git-executor', 'module-interpreter', 'server', 'transpiler', 'web'],
  },
  execution: {
    dryRun: false,
    continueOnError: true,
    defaultCoverage: false,
  },
  manifests: {
    classification: './config/test-modules.json',
    coverageAttribution: './config/test-modules.json',
    ownership: './config/test-modules.json',
  },
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
      id: 'web-unit',
      label: 'Unit Tests',
      adapter: 'vitest',
      package: 'web',
      cwd: path.join(packagesDir, 'web'),
      command: ['yarn', 'test'],
      coverage: {
        enabled: true,
        mode: 'second-pass',
      },
    },
    {
      id: 'web-e2e',
      label: 'E2E',
      adapter: 'playwright',
      package: 'web',
      cwd: path.join(packagesDir, 'web'),
      command: ['yarn', 'test:e2e:reporter'],
      coverage: {
        enabled: false,
      },
    },
    {
      id: 'module-interpreter-tests',
      label: 'Tests',
      adapter: 'node-test',
      package: 'module-interpreter',
      cwd: path.join(packagesDir, 'module-interpreter'),
      command: ['node', '--test', './tests/**/*.test.js'],
      coverage: {
        enabled: true,
        mode: 'same-run',
      },
    },
    {
      id: 'transpiler-node-tests',
      label: 'Node Tests',
      adapter: 'node-test',
      package: 'transpiler',
      cwd: path.join(packagesDir, 'transpiler'),
      command: ['node', '--test', './tests/**/*.test.js'],
      coverage: {
        enabled: true,
        mode: 'same-run',
      },
    },
    {
      id: 'transpiler-mapping-parity',
      label: 'Mapping Parity',
      adapter: 'shell',
      package: 'transpiler',
      cwd: path.join(packagesDir, 'transpiler'),
      command: ['node', './scripts/check-upstream-mappings.mjs', '--json'],
      resultFormat: 'single-check-json-v1',
      resultFormatOptions: {
        name: 'OpenJSCAD mapping parity',
        file: path.join(packagesDir, 'transpiler', 'scripts', 'check-upstream-mappings.mjs'),
        line: 1,
        column: 1,
        assertions: [
          'Compare local OpenSCAD mapping table against the upstream reference list.',
          'Report missing local mappings and local-only mappings.',
        ],
        module: 'transpiler',
        theme: 'analysis',
        classificationSource: 'config',
        warningFields: [
          { field: 'missingFromLocal', label: 'mappings missing locally', mode: 'count-array' },
          { field: 'localOnly', label: 'local-only mappings', mode: 'count-array' },
        ],
        rawDetailsFields: ['strictMode', 'referenceCount', 'localCount', 'missingFromLocal', 'localOnly'],
      },
      coverage: {
        enabled: false,
      },
    },
  ],
  adapters: [],
});
