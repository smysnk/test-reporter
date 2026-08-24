import path from 'node:path';
import { defineConfig } from './config.mjs';

const rootDir = import.meta.dirname;

export default defineConfig({
  schemaVersion: '1',
  project: {
    name: 'test-station self-performance',
    rootDir,
    outputDir: '.test-results/self-performance-report',
    rawDir: '.test-results/self-performance-report/raw',
  },
  execution: {
    continueOnError: true,
    defaultCoverage: false,
  },
  render: {
    html: true,
    console: true,
    defaultView: 'package',
  },
  suites: [{
    id: 'web-performance',
    label: 'Deployed Web Performance',
    adapter: 'shell',
    package: 'performance',
    cwd: rootDir,
    command: [
      process.execPath,
      path.join(rootDir, 'scripts/convert-performance-results.mjs'),
      '--input',
      process.env.TEST_STATION_PERFORMANCE_INPUT || 'artifacts/e2e-performance/latest.json',
    ],
    resultFormat: 'suite-json-v1',
  }, {
    id: 'end-to-end-ingest-performance',
    label: 'End-to-end Ingest Performance',
    adapter: 'shell',
    package: 'performance',
    cwd: rootDir,
    command: [process.execPath, path.join(rootDir, 'scripts/emit-suite-json.mjs'), 'artifacts/e2e-performance/ingest-suite.json'],
    resultFormat: 'suite-json-v1',
  }, {
    id: 'ingest-normalization-performance',
    label: 'Ingest Normalization Performance',
    adapter: 'shell',
    package: 'performance',
    cwd: rootDir,
    command: [process.execPath, path.join(rootDir, 'scripts/benchmark-ingest-normalization.mjs')],
    resultFormat: 'suite-json-v1',
  }],
});
