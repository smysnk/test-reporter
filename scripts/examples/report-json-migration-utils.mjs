import fs from 'node:fs';
import path from 'node:path';

export function readReport(reportPath) {
  const resolved = path.resolve(reportPath);
  return {
    path: resolved,
    report: JSON.parse(fs.readFileSync(resolved, 'utf8')),
  };
}

export function createLegacySummary(report, options = {}) {
  const status = deriveOverallStatus(report);
  const packages = Array.isArray(report?.packages) ? report.packages.map((entry) => summarizePackage(entry)) : [];
  const failedTests = packages.flatMap((pkg) => pkg.suites.flatMap((suite) => suite.failedTests.map((test) => ({
    packageName: pkg.name,
    suiteId: suite.id,
    suiteLabel: suite.label,
    runtime: suite.runtime,
    name: test.name,
    fullName: test.fullName,
    file: test.file,
    line: test.line,
    failureMessages: test.failureMessages,
  }))));

  return {
    schemaVersion: 'legacy-summary-v1',
    transformedAt: new Date().toISOString(),
    source: {
      reportSchemaVersion: String(report?.schemaVersion || ''),
      reportGeneratedAt: report?.generatedAt || null,
      reportPath: options.reportPath || null,
    },
    project: {
      name: report?.meta?.projectName || null,
      outputDir: report?.meta?.outputDir || null,
    },
    git: {
      sha: options.git?.sha || null,
      ref: options.git?.ref || null,
    },
    status,
    totals: {
      packages: numberOrZero(report?.summary?.totalPackages),
      packagesPassed: numberOrZero(report?.summary?.passedPackages),
      packagesFailed: numberOrZero(report?.summary?.failedPackages),
      packagesSkipped: numberOrZero(report?.summary?.skippedPackages),
      suites: numberOrZero(report?.summary?.totalSuites),
      suitesFailed: numberOrZero(report?.summary?.failedSuites),
      tests: numberOrZero(report?.summary?.totalTests),
      testsPassed: numberOrZero(report?.summary?.passedTests),
      testsFailed: numberOrZero(report?.summary?.failedTests),
      testsSkipped: numberOrZero(report?.summary?.skippedTests),
      durationMs: numberOrZero(report?.durationMs),
    },
    packages,
    failures: {
      packageNames: packages.filter((entry) => entry.status === 'failed').map((entry) => entry.name),
      suiteKeys: packages.flatMap((pkg) => pkg.suites.filter((suite) => suite.status === 'failed').map((suite) => `${pkg.name}:${suite.id}`)),
      tests: failedTests.slice(0, 20),
    },
  };
}

export function createDiscordPayload(report, options = {}) {
  const summary = createLegacySummary(report, options);
  const ref = summary.git.ref ? ` on ${summary.git.ref}` : '';
  const sha = summary.git.sha ? ` (${String(summary.git.sha).slice(0, 8)})` : '';
  const failedPackages = summary.failures.packageNames.length > 0
    ? summary.failures.packageNames.join(', ')
    : 'none';
  const content = [
    `${summary.project.name || 'workspace-tests'} ${summary.status}${ref}${sha}`,
    `packages ${summary.totals.packages} | suites ${summary.totals.suites} | tests ${summary.totals.tests}`,
    `failed packages: ${failedPackages}`,
  ].join('\n');

  return {
    content,
    metadata: {
      project: summary.project,
      git: summary.git,
      status: summary.status,
      totals: summary.totals,
    },
  };
}

export function resolveGitContext(options = {}, env = process.env) {
  return {
    sha: firstNonEmpty([
      options.sha,
      env.GITHUB_SHA,
      env.CI_COMMIT_SHA,
      env.BUILD_VCS_NUMBER,
      env.VERCEL_GIT_COMMIT_SHA,
    ]),
    ref: firstNonEmpty([
      options.ref,
      env.GITHUB_REF_NAME,
      env.GITHUB_REF,
      env.CI_COMMIT_REF_NAME,
      env.BRANCH_NAME,
      env.VERCEL_GIT_COMMIT_REF,
    ]),
  };
}

export function writeJson(filePath, payload) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`);
  return resolved;
}

function summarizePackage(pkg) {
  const suites = Array.isArray(pkg?.suites) ? pkg.suites.map((suite) => summarizeSuite(suite)) : [];
  return {
    name: pkg?.name || 'default',
    location: pkg?.location || null,
    status: pkg?.status || 'skipped',
    durationMs: numberOrZero(pkg?.durationMs),
    frameworks: Array.isArray(pkg?.frameworks) ? [...pkg.frameworks] : [],
    totals: {
      tests: numberOrZero(pkg?.summary?.total),
      passed: numberOrZero(pkg?.summary?.passed),
      failed: numberOrZero(pkg?.summary?.failed),
      skipped: numberOrZero(pkg?.summary?.skipped),
      suites: suites.length,
    },
    suites,
  };
}

function summarizeSuite(suite) {
  const failedTests = Array.isArray(suite?.tests)
    ? suite.tests
      .filter((test) => test?.status === 'failed')
      .map((test) => ({
        name: test?.name || null,
        fullName: test?.fullName || test?.name || null,
        file: test?.file || null,
        line: Number.isFinite(test?.line) ? test.line : null,
        failureMessages: Array.isArray(test?.failureMessages) ? test.failureMessages.slice(0, 3) : [],
      }))
    : [];

  return {
    id: suite?.id || 'suite',
    label: suite?.label || suite?.id || 'Suite',
    runtime: suite?.runtime || null,
    status: suite?.status || 'skipped',
    durationMs: numberOrZero(suite?.durationMs),
    totals: {
      tests: numberOrZero(suite?.summary?.total),
      passed: numberOrZero(suite?.summary?.passed),
      failed: numberOrZero(suite?.summary?.failed),
      skipped: numberOrZero(suite?.summary?.skipped),
    },
    failedTests,
  };
}

function deriveOverallStatus(report) {
  if (numberOrZero(report?.summary?.failedPackages) > 0 || numberOrZero(report?.summary?.failedTests) > 0) {
    return 'failed';
  }
  if (numberOrZero(report?.summary?.totalTests) === 0 || numberOrZero(report?.summary?.skippedTests) === numberOrZero(report?.summary?.totalTests)) {
    return 'skipped';
  }
  return 'passed';
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
