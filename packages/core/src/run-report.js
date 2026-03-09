import path from 'node:path';
import { loadConfig, applyConfigOverrides, resolveProjectContext } from './config.js';
import { preparePolicyContext, applyPolicyPipeline } from './policy.js';
import { resolveAdapterForSuite } from './adapters.js';
import { normalizeSuiteResult, buildReportFromSuiteResults, createSummary, normalizeStatus } from './report.js';
import { writeReportArtifacts } from './artifacts.js';

export async function runReport(options = {}) {
  const loaded = await loadConfig(options.configPath || './test-reporter.config.mjs', {
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
