import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig, applyConfigOverrides, resolveProjectContext } from './config.js';
import { preparePolicyContext, applyPolicyPipeline } from './policy.js';
import { resolveAdapterForSuite } from './adapters.js';
import { normalizeSuiteResult, buildReportFromSuiteResults, createSummary, normalizeStatus } from './report.js';
import { writeReportArtifacts } from './artifacts.js';

export async function runReport(options = {}) {
  const loaded = await loadConfig(options.configPath || './test-station.config.mjs', {
    cwd: options.cwd,
  });
  const effectiveConfig = applyConfigOverrides(loaded.config, loaded.configDir, {
    cwd: options.cwd,
    outputDir: options.outputDir,
    workspaceFilters: options.workspaceFilters,
  });
  const effectiveLoaded = {
    ...loaded,
    config: effectiveConfig,
  };
  const context = {
    config: effectiveConfig,
    loadedConfig: effectiveLoaded,
    project: resolveProjectContext(effectiveConfig, loaded.configDir),
    execution: {
      dryRun: options.dryRun ?? Boolean(effectiveConfig?.execution?.dryRun),
      coverage: options.coverage ?? Boolean(effectiveConfig?.execution?.defaultCoverage),
      coverageExplicitlyDisabled: options.coverage === false,
    },
  };
  context.policy = await preparePolicyContext(effectiveLoaded, context.project);

  const suiteDefinitions = Array.isArray(effectiveConfig?.suites) ? effectiveConfig.suites : [];
  const normalizedSuites = suiteDefinitions.map((suiteDefinition) => normalizeSuiteDefinition(suiteDefinition, context));
  const packageCatalog = resolvePackageCatalog(effectiveConfig, normalizedSuites, context.project);
  context.packageCatalog = packageCatalog;
  const startedAt = Date.now();
  const suiteResults = [];
  emitEvent(options, {
    type: 'run-start',
    totalPackages: packageCatalog.length,
    projectName: context.project.name,
  });

  for (const packageEntry of packageCatalog) {
    const packageSuites = normalizedSuites.filter((suite) => suite.packageName === packageEntry.name);
    emitEvent(options, {
      type: 'package-start',
      packageName: packageEntry.name,
      packageLocation: packageEntry.location,
      packageIndex: packageEntry.index + 1,
      totalPackages: packageCatalog.length,
    });

    if (packageSuites.length === 0) {
      emitEvent(options, {
        type: 'package-complete',
        packageName: packageEntry.name,
        packageLocation: packageEntry.location,
        packageIndex: packageEntry.index + 1,
        totalPackages: packageCatalog.length,
        status: 'skipped',
        durationMs: 0,
        summary: createSummary(),
      });
      continue;
    }

    const packageSuiteResults = [];

    for (const suite of packageSuites) {
      emitEvent(options, {
        type: 'suite-start',
        packageName: packageEntry.name,
        packageLocation: packageEntry.location,
        suiteId: suite.id,
        suiteLabel: suite.label,
        runtime: suite.adapter,
      });

      let normalized;
      if (context.execution.dryRun) {
        normalized = createDryRunSuiteResult(suite);
      } else {
        const adapter = await resolveAdapterForSuite(suite, effectiveLoaded);
        const suiteStartedAt = Date.now();
        try {
          const result = await adapter.run({
            config: effectiveConfig,
            project: context.project,
            suite,
            execution: context.execution,
          });
          normalized = normalizeSuiteResult({
            ...result,
            durationMs: Number.isFinite(result?.durationMs) ? result.durationMs : (Date.now() - suiteStartedAt),
          }, suite, suite.packageName);
        } catch (error) {
          normalized = normalizeSuiteResult({
            status: 'failed',
            durationMs: Date.now() - suiteStartedAt,
            summary: createSummary({ total: 1, failed: 1 }),
            tests: [
              {
                name: `${suite.label} failed`,
                fullName: `${suite.label} failed`,
                status: 'failed',
                durationMs: Date.now() - suiteStartedAt,
                failureMessages: [error instanceof Error ? error.message : String(error)],
                assertions: [],
                setup: [],
                mocks: [],
                rawDetails: {
                  stack: error instanceof Error ? error.stack || null : null,
                },
                module: 'uncategorized',
                theme: 'uncategorized',
                classificationSource: 'default',
              },
            ],
            warnings: [],
            output: {
              stdout: '',
              stderr: error instanceof Error ? error.stack || error.message : String(error),
            },
          }, suite, suite.packageName);
        }
      }

      if (!context.execution.dryRun && normalized.status === 'failed') {
        const diagnostics = await runSuiteDiagnostics(suite, context, options);
        if (diagnostics) {
          normalized = attachDiagnostics(normalized, diagnostics);
        }
      }

      suiteResults.push(normalized);
      packageSuiteResults.push(normalized);
      emitEvent(options, {
        type: 'suite-complete',
        packageName: packageEntry.name,
        packageLocation: packageEntry.location,
        suiteId: suite.id,
        suiteLabel: suite.label,
        runtime: normalized.runtime,
        result: normalized,
      });
    }

    emitEvent(options, {
      type: 'package-complete',
      packageName: packageEntry.name,
      packageLocation: packageEntry.location,
      packageIndex: packageEntry.index + 1,
      totalPackages: packageCatalog.length,
      status: derivePackageStatus(packageSuiteResults),
      durationMs: summarizeSuiteDurations(packageSuiteResults),
      summary: summarizeSuiteCollection(packageSuiteResults),
    });
  }

  const policyAdjustedSuites = await applyPolicyPipeline(context, suiteResults);
  const report = buildReportFromSuiteResults(context, policyAdjustedSuites, Date.now() - startedAt);
  const artifactPaths = options.writeArtifacts === false
    ? { reportJsonPath: null, rawSuitePaths: [] }
    : writeReportArtifacts(context, report, policyAdjustedSuites);

  return {
    context,
    report,
    suiteResults: policyAdjustedSuites,
    artifactPaths,
  };
}

function normalizeSuiteDefinition(suiteDefinition, context) {
  const packageName = suiteDefinition.package || suiteDefinition.project || 'default';
  return {
    ...suiteDefinition,
    id: suiteDefinition.id,
    label: suiteDefinition.label || suiteDefinition.id,
    adapter: suiteDefinition.adapter || 'custom',
    packageName,
    cwd: suiteDefinition.cwd || context.project.rootDir,
    command: suiteDefinition.command || [],
  };
}

function resolvePackageCatalog(config, suites, project) {
  const configuredPackages = Array.isArray(config?.workspaceDiscovery?.packages)
    ? config.workspaceDiscovery.packages
    : [];
  const catalog = [];
  const seen = new Set();

  for (const packageName of configuredPackages) {
    const normalizedName = String(packageName || '').trim();
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }
    seen.add(normalizedName);
    catalog.push({
      name: normalizedName,
      location: `packages/${normalizedName}`,
      index: catalog.length,
    });
  }

  for (const suite of suites) {
    if (seen.has(suite.packageName)) {
      continue;
    }
    seen.add(suite.packageName);
    catalog.push({
      name: suite.packageName,
      location: derivePackageLocation(suite, project),
      index: catalog.length,
    });
  }

  return catalog;
}

function createDryRunSuiteResult(suite) {
  return {
    id: suite.id,
    label: suite.label,
    runtime: suite.adapter,
    command: Array.isArray(suite.command) ? suite.command.join(' ') : String(suite.command || ''),
    cwd: suite.cwd,
    status: normalizeStatus('skipped'),
    durationMs: 0,
    summary: createSummary(),
    coverage: null,
    tests: [],
    warnings: ['Dry run: suite was not executed.'],
    output: { stdout: '', stderr: '' },
    rawArtifacts: [],
    packageName: suite.packageName,
  };
}

function emitEvent(options, event) {
  if (typeof options.onEvent === 'function') {
    options.onEvent(event);
  }
}

function summarizeSuiteCollection(suites) {
  return suites.reduce((summary, suite) => ({
    total: summary.total + (suite.summary?.total || 0),
    passed: summary.passed + (suite.summary?.passed || 0),
    failed: summary.failed + (suite.summary?.failed || 0),
    skipped: summary.skipped + (suite.summary?.skipped || 0),
  }), createSummary());
}

function summarizeSuiteDurations(suites) {
  return suites.reduce((total, suite) => total + (suite.durationMs || 0), 0);
}

function derivePackageStatus(suites) {
  const summary = summarizeSuiteCollection(suites);
  if (summary.failed > 0) {
    return 'failed';
  }
  if (summary.passed > 0) {
    return 'passed';
  }
  return 'skipped';
}

function derivePackageLocation(suite, project) {
  if (!suite?.cwd) {
    return suite?.packageName ? `packages/${suite.packageName}` : null;
  }

  const relativePath = project?.rootDir
    ? relativePathSafe(project.rootDir, suite.cwd)
    : null;

  return relativePath || (suite?.packageName ? `packages/${suite.packageName}` : null);
}

function relativePathSafe(fromPath, toPath) {
  try {
    const relativePath = path.relative(fromPath, toPath);
    return relativePath && !relativePath.startsWith('..') ? relativePath : null;
  } catch {
    return null;
  }
}

async function runSuiteDiagnostics(suite, context, options) {
  const config = normalizeDiagnosticsConfig(suite);
  if (!config) {
    return null;
  }

  const label = config.label || 'Diagnostics rerun';
  emitEvent(options, {
    type: 'suite-diagnostics-start',
    packageName: suite.packageName,
    packageLocation: derivePackageLocation(suite, context.project),
    suiteId: suite.id,
    suiteLabel: suite.label,
    diagnosticsLabel: label,
  });

  const startedAt = Date.now();
  const command = config.command || suite.command;
  const commandText = formatCommand(command);
  const result = await executeDiagnosticCommand(command, {
    cwd: config.cwd || suite.cwd || context.project.rootDir,
    env: {
      ...(suite.env || {}),
      ...(config.env || {}),
    },
    timeoutMs: config.timeoutMs,
  });

  const durationMs = Date.now() - startedAt;
  const artifactBase = `diagnostics/${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-rerun`;
  const rawArtifacts = [
    {
      relativePath: `${artifactBase}.log`,
      label: `${label} log`,
      content: buildDiagnosticsLog(result),
    },
    {
      relativePath: `${artifactBase}.json`,
      label: `${label} metadata`,
      content: `${JSON.stringify({
        label,
        command: commandText,
        cwd: config.cwd || suite.cwd || context.project.rootDir,
        status: result.status,
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        durationMs,
      }, null, 2)}\n`,
    },
  ];

  const diagnostics = {
    label,
    status: result.status,
    command: commandText,
    cwd: config.cwd || suite.cwd || context.project.rootDir,
    durationMs,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    output: {
      stdout: result.stdout,
      stderr: result.stderr,
    },
    rawArtifacts,
  };

  emitEvent(options, {
    type: 'suite-diagnostics-complete',
    packageName: suite.packageName,
    packageLocation: derivePackageLocation(suite, context.project),
    suiteId: suite.id,
    suiteLabel: suite.label,
    diagnosticsLabel: label,
    result: diagnostics,
  });

  return diagnostics;
}

function normalizeDiagnosticsConfig(suite) {
  if (!suite?.diagnostics || typeof suite.diagnostics !== 'object') {
    return null;
  }
  return {
    label: typeof suite.diagnostics.label === 'string' && suite.diagnostics.label.trim().length > 0
      ? suite.diagnostics.label.trim()
      : 'Diagnostics rerun',
    command: suite.diagnostics.command || suite.command,
    cwd: suite.diagnostics.cwd || null,
    env: suite.diagnostics.env && typeof suite.diagnostics.env === 'object'
      ? suite.diagnostics.env
      : {},
    timeoutMs: Number.isFinite(suite.diagnostics.timeoutMs) ? suite.diagnostics.timeoutMs : null,
  };
}

async function executeDiagnosticCommand(command, options) {
  const spec = normalizeCommand(command);
  if (!spec) {
    return {
      status: 'skipped',
      exitCode: null,
      signal: null,
      timedOut: false,
      stdout: '',
      stderr: 'No diagnostic command configured.',
    };
  }

  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      shell: spec.shell,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let timeoutId = null;

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
    }

    if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, options.timeoutMs);
    }

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(payload);
    };

    child.on('error', (error) => {
      finish({
        status: 'failed',
        exitCode: null,
        signal: null,
        timedOut,
        stdout,
        stderr: `${stderr}${error instanceof Error ? error.stack || error.message : String(error)}\n`,
      });
    });

    child.on('close', (code, signal) => {
      finish({
        status: timedOut
          ? 'failed'
          : (code === 0 ? 'passed' : 'failed'),
        exitCode: Number.isFinite(code) ? code : null,
        signal: signal || null,
        timedOut,
        stdout,
        stderr,
      });
    });
  });
}

function normalizeCommand(command) {
  if (Array.isArray(command)) {
    const parts = command.map((value) => String(value || '')).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    return {
      command: parts[0],
      args: parts.slice(1),
      shell: false,
    };
  }

  if (typeof command === 'string' && command.trim().length > 0) {
    return {
      command,
      args: [],
      shell: true,
    };
  }

  return null;
}

function attachDiagnostics(suiteResult, diagnostics) {
  const warnings = [...(suiteResult.warnings || [])];
  warnings.push(`Diagnostics rerun ${diagnostics.status} (${diagnostics.label}).`);
  return {
    ...suiteResult,
    warnings,
    diagnostics,
    rawArtifacts: [
      ...(suiteResult.rawArtifacts || []),
      ...(diagnostics.rawArtifacts || []),
    ],
  };
}

function buildDiagnosticsLog(result) {
  const sections = [
    '# stdout',
    result.stdout || '',
    '',
    '# stderr',
    result.stderr || '',
  ];
  return `${sections.join('\n')}\n`;
}

function formatCommand(command) {
  if (Array.isArray(command)) {
    return command.map((entry) => shellEscape(entry)).join(' ');
  }
  return typeof command === 'string' ? command : '';
}

function shellEscape(value) {
  const normalized = String(value || '');
  if (/^[A-Za-z0-9_./:=+-]+$/.test(normalized)) {
    return normalized;
  }
  return JSON.stringify(normalized);
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
