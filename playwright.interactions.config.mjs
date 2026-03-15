import path from 'node:path';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.TEST_STATION_E2E_BASE_URL || 'https://test-station.smysnk.com';
const outputRoot = path.resolve(process.cwd(), process.env.TEST_STATION_E2E_INTERACTIONS_OUTPUT_DIR || 'artifacts/e2e-interactions');
const storageState = process.env.TEST_STATION_E2E_STORAGE_STATE || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*interaction.spec.js'],
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: path.join(outputRoot, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(outputRoot, 'playwright-results.json') }],
  ],
  metadata: {
    interactionsBaseURL: baseURL,
    interactionsOutputDir: outputRoot,
  },
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    storageState,
  },
});
