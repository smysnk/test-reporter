import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { add } from '../src/index.js';

beforeEach(() => {
  globalThis.__exampleRun = 0;
});

test('adds positive integers', () => {
  assert.equal(add(2, 3), 5);
});
