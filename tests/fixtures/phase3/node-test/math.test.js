import test from 'node:test';
import assert from 'node:assert/strict';
import { add, subtract } from './math.js';

test('adds numbers', () => {
  assert.equal(add(2, 3), 5);
});

test('subtracts numbers', () => {
  assert.equal(subtract(5, 3), 1);
});

test.skip('skips work', () => {
  assert.equal(true, false);
});
