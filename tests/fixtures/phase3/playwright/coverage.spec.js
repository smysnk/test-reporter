import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('writes browser coverage payloads when enabled', async () => {
  expect(process.env.PLAYWRIGHT_BROWSER_COVERAGE).toBe('1');
  expect(process.env.PLAYWRIGHT_BROWSER_COVERAGE_DIR).toBeTruthy();

  const coverageDir = process.env.PLAYWRIGHT_BROWSER_COVERAGE_DIR;
  const includedPath = path.join(import.meta.dirname, 'coverage-target.js');
  const excludedPath = path.join(import.meta.dirname, '..', 'node-test', 'math.test.js');

  fs.mkdirSync(coverageDir, { recursive: true });
  fs.writeFileSync(
    path.join(coverageDir, 'fixture-browser-coverage.json'),
    `${JSON.stringify({
      pages: [
        {
          url: 'https://example.test/landing',
          coverage: {
            [includedPath]: createFileCoverage(includedPath),
            [excludedPath]: createFileCoverage(excludedPath),
          },
        },
      ],
    }, null, 2)}\n`
  );

  expect(true).toBe(true);
});

function createFileCoverage(filePath) {
  return {
    path: filePath,
    statementMap: {
      0: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 28 },
      },
    },
    fnMap: {
      0: {
        name: 'renderHero',
        decl: {
          start: { line: 1, column: 7 },
          end: { line: 1, column: 17 },
        },
        loc: {
          start: { line: 1, column: 0 },
          end: { line: 3, column: 1 },
        },
        line: 1,
      },
    },
    branchMap: {},
    s: { 0: 1 },
    f: { 0: 1 },
    b: {},
  };
}
