import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, summarizeConfig, createPhase1ScaffoldReport } from '@test-station/core';
import { renderHtmlReport } from '@test-station/render-html';
import { createNodeTestAdapter } from '@test-station/adapter-node-test';
import { createVitestAdapter } from '@test-station/adapter-vitest';
import { createPlaywrightAdapter } from '@test-station/adapter-playwright';
import { createShellAdapter } from '@test-station/adapter-shell';
import { createJestAdapter } from '@test-station/adapter-jest';
import { createSourceAnalysisPlugin } from '@test-station/plugin-source-analysis';

const repoRoot = path.resolve(import.meta.dirname, '..');
const exampleConfigPath = path.join(repoRoot, 'examples', 'varcad', 'test-station.config.mjs');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.js');
const rootCliPath = path.join(repoRoot, 'bin', 'test-station.mjs');
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

function createZeroTestSuiteFailureReport() {
  const report = JSON.parse(JSON.stringify(createSampleReport()));
  report.summary.failedTests = 0;
  report.summary.passedTests = 0;
  report.summary.totalTests = 0;
  report.summary.failedSuites = 1;
  report.packages[0].status = 'skipped';
  report.packages[0].summary = { total: 0, passed: 0, failed: 0, skipped: 0 };
  report.packages[0].suites = [
    {
      id: 'prompt-terminal-e2e',
      label: 'Prompt terminal e2e',
      runtime: 'playwright',
      command: 'yarn test:e2e e2e/prompt-terminal.spec.ts',
      status: 'failed',
      durationMs: 1446,
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      warnings: ['Error: Failed to launch: Error: spawn /bin/sh ENOENT'],
      rawArtifacts: [
        {
          relativePath: 'web/prompt-terminal-e2e-playwright.json',
          href: 'raw/web/prompt-terminal-e2e-playwright.json',
          label: 'web-prompt-terminal-e2e-playwright.json',
          kind: 'file',
          mediaType: 'application/json',
        },
      ],
      tests: [],
    },
  ];
  report.modules = [];
  return report;
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
  assert.match(html, /coverage-table__metricBar/);
  assert.match(html, /coverage-table__statementIcon/);
  assert.match(html, /80\.0%/);
});

test('renderer shows owner as thin header text above the module card title', () => {
  const html = renderHtmlReport(createSampleReport(), { title: 'example' });
  const moduleCard = html.match(/<button type="button" class="module-card status-failed"[\s\S]*?<\/button>/)?.[0] || '';

  assert.match(moduleCard, /module-card__owner">core-team<\/span>\s*<span class="module-card__name">runtime<\/span>/);
  assert.doesNotMatch(moduleCard, /Owner: core-team/);
  assert.doesNotMatch(moduleCard, /owner-pill/);
});

test('renderer wraps detailed test evidence without forcing horizontal overflow', () => {
  const html = renderHtmlReport(createSampleReport(), { title: 'example' });

  assert.match(html, /class="test-row__aside"/);
  assert.match(html, /\.test-row__summary\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/);
  assert.match(html, /\.test-row__title\s*\{[\s\S]*white-space:\s*normal;/);
  assert.match(html, /\.detail-grid\s*\{[\s\S]*minmax\(min\(100%, 360px\), 1fr\)/);
  assert.match(html, /\.detail-card\s*\{[\s\S]*overflow:\s*visible;/);
  assert.match(html, /\.detail-card code\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.match(html, /\.detail-card pre\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.doesNotMatch(html, /overflow:\s*(auto|scroll)/);
});

test('renderer keeps focused package cards compact and legible', () => {
  const html = renderHtmlReport(createSampleReport(), { title: 'example' });
  const moduleCard = html.match(/<button type="button" class="module-card status-failed"[\s\S]*?<\/button>/)?.[0] || '';

  assert.match(html, /\.module-card__meta\s*\{[\s\S]*font-size:\s*0\.75rem;/);
  assert.match(moduleCard, /2 total • 1 passed • 1 failed • 0 skipped/);
  assert.match(moduleCard, /27ms • 1 package/);
});

test('renderer shows statement tooltip state and fixed-width file coverage metrics', () => {
  const report = createSampleReport();
  const files = [
    {
      path: path.join(repoRoot, 'packages', 'core', 'src', 'missing-statements.js'),
      lines: { covered: 10, total: 27, pct: 37.04 },
      branches: { covered: 3, total: 8, pct: 37.5 },
      functions: { covered: 2, total: 5, pct: 40 },
      statements: null,
    },
    {
      path: path.join(repoRoot, 'packages', 'core', 'src', 'with-statements.js'),
      lines: { covered: 32, total: 40, pct: 80.2 },
      branches: { covered: 8, total: 10, pct: 80 },
      functions: { covered: 4, total: 5, pct: 80 },
      statements: { covered: 8, total: 10, pct: 80 },
    },
  ];

  report.summary.coverage.files = files;
  report.packages[0].coverage.files = files;
  report.packages[0].suites[0].coverage.files = files;
  report.modules[0].coverage.files = files;
  report.modules[0].themes[0].coverage.files = files;

  const html = renderHtmlReport(report, { title: 'example' });
  assert.match(html, /coverage-table__metricCol/);
  assert.match(html, /coverage-table__statementIcon--disabled/);
  assert.match(html, /coverage-table__statementIcon--active/);
  assert.match(html, /title="Statements: 80\.0% \(8\/10\)"/);
  assert.match(html, /37\.0%/);
  assert.match(html, /80\.2%/);
});

test('renderer keeps zero-test failed suites visibly failed', () => {
  const html = renderHtmlReport(createZeroTestSuiteFailureReport(), { title: 'example' });
  assert.match(html, /class="module-card status-failed" data-open-target="package-core"/);
  assert.match(html, /Suite failed before emitting test results/);
  assert.match(html, /Error: Failed to launch: Error: spawn \/bin\/sh ENOENT/);
});

test('adapter and plugin scaffolds expose stable ids', () => {
  assert.equal(createNodeTestAdapter().id, 'node-test');
  assert.equal(createVitestAdapter().id, 'vitest');
  assert.equal(createPlaywrightAdapter().id, 'playwright');
  assert.equal(createShellAdapter().id, 'shell');
  assert.equal(createJestAdapter().id, 'jest');
  assert.equal(createNodeTestAdapter().phase, 3);
  assert.equal(createVitestAdapter().phase, 3);
  assert.equal(createPlaywrightAdapter().phase, 8);
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
