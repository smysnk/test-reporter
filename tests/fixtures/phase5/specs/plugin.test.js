import test, { beforeAll } from 'node:test';

jest.mock('../src/custom.js');

beforeAll(() => {
  prepareRepositorySync();
});

test('syncs custom repo', () => {
  expect(syncRepository()).toBeTruthy();
});
