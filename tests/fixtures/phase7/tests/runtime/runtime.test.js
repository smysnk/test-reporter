import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntimeState } from '../../src/runtime.js';

test('loads runtime state', () => {
  assert.equal(loadRuntimeState(), 'ok');
});
