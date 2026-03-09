const SECTION_WIDTH = 88;

export function createConsoleProgressReporter(options = {}) {
  const stream = options.stream || process.stdout;
  let hasPrintedHeader = false;
  let packageCountWidth = 2;
  let packageStarted = false;

  return {
    onEvent(event) {
      if (!event || typeof event !== 'object') {
        return;
      }

      if (event.type === 'run-start') {
        packageCountWidth = Math.max(2, String(event.totalPackages || 0).length);
        writeLine(stream, banner('Running Workspace Tests'));
        hasPrintedHeader = true;
        packageStarted = false;
        return;
      }

      if (event.type === 'package-start') {
        if (!hasPrintedHeader) {
          writeLine(stream, banner('Running Workspace Tests'));
          hasPrintedHeader = true;
        }
        if (packageStarted) {
          writeLine(stream, '');
        } else {
          writeLine(stream, '');
          packageStarted = true;
        }
        const label = `${padNumber(event.packageIndex || 0, packageCountWidth)}/${padNumber(event.totalPackages || 0, packageCountWidth)} PACKAGE ${event.packageName || 'default'}`;
        writeLine(stream, `${label}${event.packageLocation ? ` (${event.packageLocation})` : ''}`);
        return;
      }

      if (event.type === 'suite-start') {
        writeLine(stream, `  - ${event.suiteLabel || event.suiteId || 'Suite'}: running ${event.runtime || 'custom'}`);
        return;
      }

      if (event.type === 'suite-complete') {
        const result = event.result || {};
        writeLine(stream, `    ${formatStatus(result.status)} ${formatDuration(result.durationMs || 0)} ${formatSummaryInline(result.summary || zeroSummary())}`);
        return;
      }

      if (event.type === 'package-complete') {
        writeLine(
          stream,
          `${formatStatus(event.status)} ${event.packageName || 'default'} in ${formatDuration(event.durationMs || 0)} (${formatSummaryInline(event.summary || zeroSummary())})`
        );
      }
    },
  };
}

export function formatConsoleSummary(report, artifactPaths = {}, options = {}) {
  const lines = [
    banner('Workspace Test Report'),
    `Packages: ${report?.summary?.totalPackages || 0}`,
    `Suites: ${report?.summary?.totalSuites || 0}`,
    `Tests: ${report?.summary?.totalTests || 0}`,
    `Passed: ${report?.summary?.passedTests || 0}`,
    `Failed: ${report?.summary?.failedTests || 0}`,
    `Skipped: ${report?.summary?.skippedTests || 0}`,
  ];

  const coverageLine = formatCoverageLine(report?.summary?.coverage);
  if (coverageLine) {
    lines.push(coverageLine);
  }

  lines.push(`Duration: ${formatDuration(report?.durationMs || report?.summary?.durationMs || 0)}`);
  if (options.htmlPath) {
    lines.push(`HTML report: ${options.htmlPath}`);
  } else if (artifactPaths.reportJsonPath) {
    lines.push(`Report JSON: ${artifactPaths.reportJsonPath}`);
  }

  lines.push('-'.repeat(SECTION_WIDTH));

  const packages = Array.isArray(report?.packages) ? report.packages : [];
  const packageNameWidth = Math.max(
    20,
    ...packages.map((entry) => String(entry?.name || '').length + 2),
  );

  for (const pkg of packages) {
    const prefix = [
      formatStatus(pkg.status).padEnd(5),
      String(pkg.name || 'default').padEnd(packageNameWidth),
      formatDuration(pkg.durationMs || 0),
      formatSummaryInline(pkg.summary || zeroSummary()),
    ].join('  ');

    const lineCoverage = pkg?.coverage?.lines?.pct;
    lines.push(Number.isFinite(lineCoverage) ? `${prefix}  L ${lineCoverage.toFixed(2)}%` : prefix);
  }

  lines.push('='.repeat(SECTION_WIDTH));
  return `${lines.join('\n')}\n`;
}

function banner(title) {
  return `${'='.repeat(SECTION_WIDTH)}\n${title}\n${'='.repeat(SECTION_WIDTH)}`;
}

function formatCoverageLine(coverage) {
  const metrics = [
    ['lines', coverage?.lines?.pct],
    ['branches', coverage?.branches?.pct],
    ['functions', coverage?.functions?.pct],
    ['statements', coverage?.statements?.pct],
  ].filter(([, pct]) => Number.isFinite(pct));

  if (metrics.length === 0) {
    return null;
  }

  return `Coverage: ${metrics.map(([label, pct]) => `${label} ${pct.toFixed(2)}%`).join(' | ')}`;
}

function formatSummaryInline(summary) {
  return `tests ${summary.total || 0} | pass ${summary.passed || 0} | fail ${summary.failed || 0} | skip ${summary.skipped || 0}`;
}

function formatStatus(status) {
  if (status === 'failed') return 'FAIL';
  if (status === 'skipped') return 'SKIP';
  return 'PASS';
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round((durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${padNumber(hours, 2)}:${padNumber(minutes, 2)}:${padNumber(seconds, 2)}`;
  }
  return `${padNumber(minutes, 2)}:${padNumber(seconds, 2)}`;
}

function padNumber(value, width) {
  return String(Math.max(0, Number(value) || 0)).padStart(width, '0');
}

function zeroSummary() {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
}

function writeLine(stream, value) {
  stream.write(`${value}\n`);
}
