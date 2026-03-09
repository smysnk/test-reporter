import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

vi.mock('../src/runtime.js');

beforeEach(() => {
  resetRuntimeState();
});

test('loads runtime state', () => {
  assert.equal(loadRuntimeState(), 'ok');
});
