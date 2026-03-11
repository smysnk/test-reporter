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

      if (event.type === 'suite-diagnostics-start') {
        writeLine(stream, `    diagnostics: running ${event.diagnosticsLabel || 'diagnostics rerun'}`);
        return;
      }

      if (event.type === 'suite-diagnostics-complete') {
        const result = event.result || {};
        writeLine(stream, `    diagnostics: ${formatStatus(result.status)} ${formatDuration(result.durationMs || 0)} ${result.command || ''}`.trimEnd());
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

  const policyLine = formatPolicyLine(report?.summary?.policy);
  if (policyLine) {
    lines.push(policyLine);
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

  const modules = Array.isArray(report?.modules) ? report.modules : [];
  if (modules.length > 0) {
    lines.push('-'.repeat(SECTION_WIDTH));
    lines.push('Modules');
    for (const moduleEntry of modules) {
      lines.push(formatModuleLine(moduleEntry));
    }
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

function formatPolicyLine(policy) {
  const metrics = [];
  if (Number.isFinite(policy?.failedThresholds) && policy.failedThresholds > 0) {
    metrics.push(`threshold failures ${policy.failedThresholds}`);
  }
  if (Number.isFinite(policy?.warningThresholds) && policy.warningThresholds > 0) {
    metrics.push(`threshold warnings ${policy.warningThresholds}`);
  }
  if (Number.isFinite(policy?.diagnosticsSuites) && policy.diagnosticsSuites > 0) {
    metrics.push(`diagnostic reruns ${policy.diagnosticsSuites}`);
  }
  if (Number.isFinite(policy?.failedDiagnostics) && policy.failedDiagnostics > 0) {
    metrics.push(`failed diagnostics ${policy.failedDiagnostics}`);
  }
  if (metrics.length === 0) {
    return null;
  }
  return `Policy: ${metrics.join(' | ')}`;
}

function formatSummaryInline(summary) {
  return `tests ${summary.total || 0} | pass ${summary.passed || 0} | fail ${summary.failed || 0} | skip ${summary.skipped || 0}`;
}

function formatStatus(status) {
  if (status === 'failed') return 'FAIL';
  if (status === 'warn') return 'WARN';
  if (status === 'skipped') return 'SKIP';
  return 'PASS';
}

function formatModuleLine(moduleEntry) {
  const status = resolveModuleStatus(moduleEntry);
  const base = [
    formatStatus(status).padEnd(5),
    String(moduleEntry?.module || 'uncategorized').padEnd(20),
    formatDuration(moduleEntry?.durationMs || 0),
    formatSummaryInline(moduleEntry?.summary || zeroSummary()),
  ].join('  ');
  const details = [];

  const lineCoverage = moduleEntry?.coverage?.lines?.pct;
  if (Number.isFinite(lineCoverage)) {
    details.push(`L ${lineCoverage.toFixed(2)}%`);
  }
  if (moduleEntry?.owner) {
    details.push(`owner ${moduleEntry.owner}`);
  }
  if (moduleEntry?.threshold?.configured) {
    details.push(`threshold ${moduleEntry.threshold.status}`);
  }

  return details.length > 0 ? `${base}  ${details.join(' | ')}` : base;
}

function resolveModuleStatus(moduleEntry) {
  if (moduleEntry?.threshold?.status === 'failed') {
    return 'failed';
  }
  if (moduleEntry?.threshold?.status === 'warn') {
    return 'warn';
  }
  if ((moduleEntry?.summary?.failed || 0) > 0) {
    return 'failed';
  }
  if ((moduleEntry?.summary?.total || 0) === 0 && !moduleEntry?.coverage) {
    return 'skipped';
  }
  return 'passed';
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
