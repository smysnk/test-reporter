import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, summarizeConfig, createPhase1ScaffoldReport } from '@test-reporter/core';
import { renderHtmlReport } from '@test-reporter/render-html';
import { createNodeTestAdapter } from '@test-reporter/adapter-node-test';
import { createVitestAdapter } from '@test-reporter/adapter-vitest';
import { createPlaywrightAdapter } from '@test-reporter/adapter-playwright';
import { createShellAdapter } from '@test-reporter/adapter-shell';
import { createJestAdapter } from '@test-reporter/adapter-jest';
import { createSourceAnalysisPlugin } from '@test-reporter/plugin-source-analysis';

const repoRoot = path.resolve(import.meta.dirname, '..');
const exampleConfigPath = path.join(repoRoot, 'examples', 'varcad', 'test-reporter.config.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');
const rootCliPath = path.join(repoRoot, 'bin', 'test-reporter.mjs');
const configEntryPath = path.join(repoRoot, 'config.mjs');

function createSampleReport() {
  return {
    schemaVersion: '1',
    generatedAt: '2026-03-07T12:00:00.000Z',
    durationMs: 2345,
    summary: {
      totalPackages: 1,
      totalModules: 1,
      totalSuites: 1,
      totalTests: 2,
      passedTests: 1,
      failedTests: 1,
      skippedTests: 0,
      coverage: {
        lines: { covered: 8, total: 10, pct: 80 },
        branches: { covered: 3, total: 4, pct: 75 },
        functions: { covered: 2, total: 3, pct: 66.67 },
        statements: { covered: 8, total: 10, pct: 80 },
        files: [
          {
            path: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
            lines: { covered: 8, total: 10, pct: 80 },
            branches: { covered: 3, total: 4, pct: 75 },
            functions: { covered: 2, total: 3, pct: 66.67 },
            statements: { covered: 8, total: 10, pct: 80 },
            module: 'runtime',
            theme: 'core',
            packageName: 'core',
            shared: false,
            attributionSource: 'manifest',
            attributionReason: 'fixture',
            attributionWeight: 1,
          },
        ],
      },
      coverageAttribution: {
        totalFiles: 1,
        attributedFiles: 1,
        sharedFiles: 0,
        unattributedFiles: 0,
      },
      filterOptions: {
        modules: ['runtime'],
        packages: ['core'],
        frameworks: ['node-test'],
      },
    },
    packages: [
      {
        name: 'core',
        location: 'packages/core',
        status: 'failed',
        durationMs: 2345,
        summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
        coverage: {
          lines: { covered: 8, total: 10, pct: 80 },
          branches: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 2, total: 3, pct: 66.67 },
          statements: { covered: 8, total: 10, pct: 80 },
          files: [
            {
              path: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 3, total: 4, pct: 75 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 8, total: 10, pct: 80 },
            },
          ],
        },
        modules: ['runtime'],
        frameworks: ['node-test'],
        suites: [
          {
            id: 'core-node',
            label: 'Core Node Tests',
            runtime: 'node-test',
            command: 'node --test ./tests/*.test.js',
            status: 'failed',
            durationMs: 2345,
            summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
            coverage: {
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 3, total: 4, pct: 75 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 8, total: 10, pct: 80 },
              files: [
                {
                  path: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
                  lines: { covered: 8, total: 10, pct: 80 },
                  branches: { covered: 3, total: 4, pct: 75 },
                  functions: { covered: 2, total: 3, pct: 66.67 },
                  statements: { covered: 8, total: 10, pct: 80 },
                },
              ],
            },
            warnings: ['fixture warning'],
            rawArtifacts: [
              {
                relativePath: 'core/core-node.log',
                href: 'raw/core/core-node.log',
                label: 'Core node log',
                kind: 'file',
                mediaType: 'text/plain',
              },
            ],
            tests: [
              {
                name: 'passes',
                fullName: 'core passes',
                status: 'passed',
                durationMs: 12,
                file: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
                line: 10,
                column: 2,
                assertions: ['assert.equal(1, 1)'],
                setup: ['load core fixture'],
                mocks: ['mock fs'],
                failureMessages: [],
                rawDetails: { fixture: true },
                sourceSnippet: 'assert.equal(1, 1)',
                module: 'runtime',
                theme: 'core',
              },
              {
                name: 'fails',
                fullName: 'core fails',
                status: 'failed',
                durationMs: 15,
                file: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
                line: 24,
                column: 4,
                assertions: ['assert.equal(1, 2)'],
                setup: ['load core fixture'],
                mocks: [],
                failureMessages: ['expected 2 but received 1'],
                rawDetails: { fixture: false },
                module: 'runtime',
                theme: 'core',
              },
            ],
          },
        ],
      },
    ],
    modules: [
      {
        module: 'runtime',
        summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
        durationMs: 27,
        packageCount: 1,
        packages: ['core'],
        frameworks: ['node-test'],
        owner: 'core-team',
        dominantPackages: ['core'],
        coverage: {
          lines: { covered: 8, total: 10, pct: 80 },
          branches: { covered: 3, total: 4, pct: 75 },
          functions: { covered: 2, total: 3, pct: 66.67 },
          statements: { covered: 8, total: 10, pct: 80 },
          files: [
            {
              path: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 3, total: 4, pct: 75 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 8, total: 10, pct: 80 },
              module: 'runtime',
              theme: 'core',
              packageName: 'core',
              shared: false,
              attributionSource: 'manifest',
              attributionReason: 'fixture',
              attributionWeight: 1,
            },
          ],
        },
        themes: [
          {
            theme: 'core',
            summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
            durationMs: 27,
            packageCount: 1,
            packageNames: ['core'],
            frameworks: ['node-test'],
            owner: 'core-team',
            coverage: {
              lines: { covered: 8, total: 10, pct: 80 },
              branches: { covered: 3, total: 4, pct: 75 },
              functions: { covered: 2, total: 3, pct: 66.67 },
              statements: { covered: 8, total: 10, pct: 80 },
              files: [
                {
                  path: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
                  lines: { covered: 8, total: 10, pct: 80 },
                  branches: { covered: 3, total: 4, pct: 75 },
                  functions: { covered: 2, total: 3, pct: 66.67 },
                  statements: { covered: 8, total: 10, pct: 80 },
                  module: 'runtime',
                  theme: 'core',
                  packageName: 'core',
                  shared: false,
                  attributionSource: 'manifest',
                  attributionReason: 'fixture',
                  attributionWeight: 1,
                },
              ],
            },
            packages: [
              {
                name: 'core',
                summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
                durationMs: 27,
                frameworks: ['node-test'],
                suites: [
                  {
                    id: 'core-node',
                    label: 'Core Node Tests',
                    runtime: 'node-test',
                    command: 'node --test ./tests/*.test.js',
                    warnings: ['fixture warning'],
                    rawArtifacts: [
                      {
                        relativePath: 'core/core-node.log',
                        href: 'raw/core/core-node.log',
                        label: 'Core node log',
                        kind: 'file',
                        mediaType: 'text/plain',
                      },
                    ],
                    coverage: null,
                    durationMs: 27,
                    status: 'failed',
                    summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
                    tests: [
                      {
                        name: 'passes',
                        fullName: 'core passes',
                        status: 'passed',
                        durationMs: 12,
                        file: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
                        line: 10,
                        column: 2,
                        assertions: ['assert.equal(1, 1)'],
                        setup: ['load core fixture'],
                        mocks: ['mock fs'],
                        failureMessages: [],
                        rawDetails: { fixture: true },
                        sourceSnippet: 'assert.equal(1, 1)',
                        module: 'runtime',
                        theme: 'core',
                      },
                      {
                        name: 'fails',
                        fullName: 'core fails',
                        status: 'failed',
                        durationMs: 15,
                        file: path.join(repoRoot, 'packages', 'core', 'src', 'index.js'),
                        line: 24,
                        column: 4,
                        assertions: ['assert.equal(1, 2)'],
                        setup: ['load core fixture'],
                        mocks: [],
                        failureMessages: ['expected 2 but received 1'],
                        rawDetails: { fixture: false },
                        module: 'runtime',
                        theme: 'core',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    meta: {
      phase: 5,
      projectName: 'fixture-project',
      projectRootDir: repoRoot,
      outputDir: path.join(repoRoot, 'artifacts'),
      render: {
        defaultView: 'package',
        includeDetailedAnalysisToggle: true,
      },
    },
  };
}

test('core loads and summarizes the example config', async () => {
  const loaded = await loadConfig(exampleConfigPath);
  const summary = summarizeConfig(loaded.config);
  assert.equal(summary.projectName, 'varcad.io');
  assert.equal(summary.suiteCount, 5);
  const report = createPhase1ScaffoldReport(loaded.config);
  assert.equal(report.schemaVersion, '1');
});

test('renderer returns baseline html', () => {
  const html = renderHtmlReport(createSampleReport(), { title: 'example' });
  assert.match(html, /Group by Module/);
  assert.match(html, /Group by Package/);
  assert.match(html, /Show detailed analysis/);
  assert.match(html, /Coverage by file/);
  assert.match(html, /core-team/);
  assert.match(html, /data-view=\"package\"/);
  assert.match(html, /Raw Artifacts/);
  assert.match(html, /href="raw\/core\/core-node\.log"/);
});

test('adapter and plugin scaffolds expose stable ids', () => {
  assert.equal(createNodeTestAdapter().id, 'node-test');
  assert.equal(createVitestAdapter().id, 'vitest');
  assert.equal(createPlaywrightAdapter().id, 'playwright');
  assert.equal(createShellAdapter().id, 'shell');
  assert.equal(createJestAdapter().id, 'jest');
  assert.equal(createNodeTestAdapter().phase, 3);
  assert.equal(createVitestAdapter().phase, 3);
  assert.equal(createPlaywrightAdapter().phase, 3);
  assert.equal(createShellAdapter().phase, 3);
  assert.equal(createJestAdapter().phase, 3);
  const sourceAnalysisPlugin = createSourceAnalysisPlugin();
  assert.equal(sourceAnalysisPlugin.id, 'source-analysis');
  assert.equal(sourceAnalysisPlugin.phase, 5);
  assert.equal(typeof sourceAnalysisPlugin.enrichTest, 'function');
});

test('cli inspect command loads config successfully', () => {
  const result = spawnSync(process.execPath, [cliPath, 'inspect', '--config', exampleConfigPath], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.summary.projectName, 'varcad.io');
});

test('cli render command writes an html file', () => {
  const outputDir = path.join(repoRoot, 'artifacts', 'phase1-render-test');
  const inputPath = path.join(outputDir, 'report.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(inputPath, `${JSON.stringify(createSampleReport(), null, 2)}\n`);
  const result = spawnSync(process.execPath, [cliPath, 'render', '--input', inputPath, '--output', outputDir], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(outputDir, 'index.html')), true);
  const html = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
  assert.match(html, /Group by Module/);
  assert.match(html, /core fails/);
});

test('root-level consumer entrypoints stay stable', async () => {
  const configEntry = await import(configEntryPath);
  assert.equal(typeof configEntry.defineConfig, 'function');

  const inspectResult = spawnSync(process.execPath, [rootCliPath, 'inspect', '--config', exampleConfigPath], {
    encoding: 'utf8',
    cwd: repoRoot,
  });

  assert.equal(inspectResult.status, 0, inspectResult.stderr || inspectResult.stdout);
  const payload = JSON.parse(inspectResult.stdout);
  assert.equal(payload.summary.projectName, 'varcad.io');
});
