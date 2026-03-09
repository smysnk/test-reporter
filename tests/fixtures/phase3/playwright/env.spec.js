import { expect, test } from '@playwright/test';

test('inherits suite env', async () => {
  expect(process.env.TEST_STATION_PHASE3_ENV).toBe('enabled');
});
