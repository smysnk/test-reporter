import { expect, it } from 'vitest';

it('inherits suite env', () => {
  expect(process.env.TEST_STATION_PHASE3_ENV).toBe('enabled');
});
