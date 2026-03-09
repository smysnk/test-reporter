import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '@test-station/core';

const defaultInputDir = path.resolve(import.meta.dirname, '..', '..', '.test-results', 'self-test-report');
const defaultOutputDir = path.resolve(import.meta.dirname, '..', '..', '.test-results', 'github-pages');

export function buildSelfTestPagesSite(options = {}) {
  const inputDir = path.resolve(options.inputDir || defaultInputDir);
  const outputDir = path.resolve(options.outputDir || defaultOutputDir);
  const reportPath = path.join(inputDir, 'report.json');
  const report = readJson(reportPath);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
  fs.cpSync(inputDir, outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

  const badgesDir = path.join(outputDir, 'badges');
  fs.mkdirSync(badgesDir, { recursive: true });

  const testsBadge = createTestsBadgePayload(report.summary);
  const coverageBadge = createCoverageBadgePayload(report.summary);
  const summaryPayload = createPagesSummary(report);

  writeJson(path.join(badgesDir, 'tests.json'), testsBadge);
  writeJson(path.join(badgesDir, 'coverage.json'), coverageBadge);
  writeJson(path.join(outputDir, 'summary.json'), summaryPayload);

  return {
    inputDir,
    outputDir,
    reportPath: path.join(outputDir, 'report.json'),
    htmlPath: path.join(outputDir, 'index.html'),
    testsBadgePath: path.join(badgesDir, 'tests.json'),
    coverageBadgePath: path.join(badgesDir, 'coverage.json'),
    summaryPath: path.join(outputDir, 'summary.json'),
  };
}

export function createTestsBadgePayload(summary = {}) {
  const total = Number(summary.totalTests || 0);
  const passed = Number(summary.passedTests || 0);
  const failed = Number(summary.failedTests || 0);
  const skipped = Number(summary.skippedTests || 0);

  if (total === 0) {
    return createBadge('tests', 'no tests', 'lightgrey');
  }
  if (failed > 0) {
    return createBadge('tests', `${passed} passed / ${failed} failed`, 'red');
  }
  if (skipped > 0) {
    return createBadge('tests', `${passed} passed / ${skipped} skipped`, 'yellow');
  }
  return createBadge('tests', `${passed} passed`, 'brightgreen');
}

export function createCoverageBadgePayload(summary = {}) {
  const linesPct = summary?.coverage?.lines?.pct;
  if (!Number.isFinite(linesPct)) {
    return createBadge('coverage', 'n/a', 'lightgrey');
  }
  return createBadge('coverage', `${Number(linesPct).toFixed(2)}% lines`, coverageColor(linesPct));
}

function createPagesSummary(report) {
  return {
    generatedAt: report?.generatedAt || null,
    projectName: report?.meta?.projectName || null,
    summary: report?.summary || {},
    artifacts: {
      html: 'index.html',
      reportJson: 'report.json',
      rawDir: 'raw',
      testsBadge: 'badges/tests.json',
      coverageBadge: 'badges/coverage.json',
    },
  };
}

function createBadge(label, message, color) {
  return {
    schemaVersion: 1,
    label,
    message,
    color,
  };
}

function coverageColor(pct) {
  if (pct >= 90) {
    return 'brightgreen';
  }
  if (pct >= 75) {
    return 'yellowgreen';
  }
  if (pct >= 60) {
    return 'yellow';
  }
  return 'red';
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildSelfTestPagesSite();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
