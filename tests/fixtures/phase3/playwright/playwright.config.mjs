import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: import.meta.dirname,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'line',
});
