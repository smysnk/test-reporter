import test from 'node:test';
import assert from 'node:assert/strict';

test('inherits suite env', () => {
  assert.equal(process.env.TEST_STATION_PHASE3_ENV, 'enabled');
});
