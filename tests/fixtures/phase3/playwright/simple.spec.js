import { expect, test } from '@playwright/test';

test('passes a pure assertion', async () => {
  expect(2 + 2).toBe(4);
});

test('fails a pure assertion', async () => {
  expect(2 + 2).toBe(5);
});

test.skip('skips pending browser work', async () => {});
