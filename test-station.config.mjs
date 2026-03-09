import path from 'node:path';
import { defineConfig } from './config.mjs';

const rootDir = import.meta.dirname;
const packagesDir = path.join(rootDir, 'packages');

export default defineConfig({
  schemaVersion: '1',
  project: {
    name: 'test-station self-test',
    rootDir,
    outputDir: '.test-results/self-test-report',
    rawDir: '.test-results/self-test-report/raw',
  },
  execution: {
    continueOnError: true,
    defaultCoverage: false,
  },
  enrichers: {
    sourceAnalysis: {
      enabled: true,
    },
  },
  render: {
    html: true,
    console: true,
    defaultView: 'package',
    includeDetailedAnalysisToggle: true,
  },
  suites: [
    {
      id: 'repo-node',
      label: 'Repository Tests',
      adapter: 'node-test',
      package: 'workspace',
      cwd: packagesDir,
      command: ['node', '--test', '../tests/*.test.js'],
      coverage: {
        enabled: true,
        mode: 'same-run',
      },
    },
  ],
});
