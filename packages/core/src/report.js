import path from 'node:path';
import { mergeCoverageSummaries, normalizeCoverageSummary } from './coverage.js';
import { collectCoverageAttribution, lookupOwner, evaluateCoverageThresholds } from './policy.js';

export function createSummary(values = {}) {
  return {
    total: Number.isFinite(values.total) ? values.total : 0,
    passed: Number.isFinite(values.passed) ? values.passed : 0,
    failed: Number.isFinite(values.failed) ? values.failed : 0,
    skipped: Number.isFinite(values.skipped) ? values.skipped : 0,
  };
}

export function createPhase1ScaffoldReport(config) {
  return {
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    durationMs: 0,
    summary: {
      totalPackages: 0,
      totalModules: 0,
      totalSuites: Array.isArray(config?.suites) ? config.suites.length : 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      filterOptions: {
        modules: [],
        packages: [],
        frameworks: [],
      },
    },
    packages: [],
    modules: [],
    meta: {
      phase: 1,
      message: 'Phase 1 scaffold only. Execution engine arrives in later phases.',
    },
  };
}

export function normalizeTestResult(test, suite) {
  const status = normalizeStatus(test?.status || 'passed');
  const name = test?.name || test?.fullName || `${suite.label} result`;
  return {
    name,
    fullName: test?.fullName || name,
    status,
    durationMs: Number.isFinite(test?.durationMs) ? test.durationMs : 0,
    file: test?.file || null,
    line: Number.isFinite(test?.line) ? test.line : null,
    column: Number.isFinite(test?.column) ? test.column : null,
    failureMessages: Array.isArray(test?.failureMessages) ? test.failureMessages : [],
    assertions: Array.isArray(test?.assertions) ? test.assertions : [],
    setup: Array.isArray(test?.setup) ? test.setup : [],
    mocks: Array.isArray(test?.mocks) ? test.mocks : [],
    rawDetails: test?.rawDetails && typeof test.rawDetails === 'object' ? test.rawDetails : {},
    sourceSnippet: typeof test?.sourceSnippet === 'string' ? test.sourceSnippet : null,
    module: test?.module || 'uncategorized',
    theme: test?.theme || 'uncategorized',
    classificationSource: test?.classificationSource || 'default',
  };
}

export function normalizeSuiteResult(rawResult, suite, packageName) {
  const tests = Array.isArray(rawResult?.tests)
    ? rawResult.tests.map((test) => normalizeTestResult(test, suite))
    : [];
  const summary = rawResult?.summary || summarizeTests(tests);
  const coverage = normalizeCoverageSummary(rawResult?.coverage, packageName);
  const rawArtifacts = normalizeRawArtifacts(rawResult?.rawArtifacts, suite);
  return {
    id: suite.id,
    label: suite.label,
    runtime: suite.adapter,
    command: formatCommand(suite.command),
    cwd: suite.cwd,
    status: normalizeStatus(rawResult?.status || deriveStatusFromSummary(summary)),
    durationMs: Number.isFinite(rawResult?.durationMs) ? rawResult.durationMs : 0,
    summary,
    coverage,
    tests,
    warnings: Array.isArray(rawResult?.warnings) ? rawResult.warnings : [],
    output: {
      stdout: typeof rawResult?.output?.stdout === 'string' ? rawResult.output.stdout : '',
      stderr: typeof rawResult?.output?.stderr === 'string' ? rawResult.output.stderr : '',
    },
    rawArtifacts,
    packageName,
  };
}

export function buildReportFromSuiteResults(context, suiteResults, durationMs) {
  const packageMap = new Map();
  const packageCatalog = Array.isArray(context?.packageCatalog) ? context.packageCatalog : [];

  for (const packageEntry of packageCatalog) {
    if (!packageMap.has(packageEntry.name)) {
      packageMap.set(packageEntry.name, {
        name: packageEntry.name,
        location: packageEntry.location || packageEntry.name,
        sortIndex: Number.isFinite(packageEntry.index) ? packageEntry.index : packageMap.size,
        status: 'skipped',
        durationMs: 0,
        summary: createSummary(),
        suites: [],
        coverage: null,
        modules: [],
        frameworks: [],
      });
    }
  }

  for (const suite of suiteResults) {
    const packageName = suite.packageName || 'default';
    if (!packageMap.has(packageName)) {
      packageMap.set(packageName, {
        name: packageName,
        location: packageName,
        sortIndex: Number.MAX_SAFE_INTEGER,
        status: 'skipped',
        durationMs: 0,
        summary: createSummary(),
        suites: [],
        coverage: null,
        modules: [],
        frameworks: [],
      });
    }
    const pkg = packageMap.get(packageName);
    pkg.suites.push(stripSuitePackageName(suite));
    pkg.durationMs += suite.durationMs;
  }

  const packages = Array.from(packageMap.values())
    .map((pkg) => finalizePackageResult(pkg))
    .sort((left, right) => {
      const leftIndex = Number.isFinite(left.sortIndex) ? left.sortIndex : Number.MAX_SAFE_INTEGER;
      const rightIndex = Number.isFinite(right.sortIndex) ? right.sortIndex : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.name.localeCompare(right.name);
    });

  const allTests = packages.flatMap((pkg) => pkg.suites.flatMap((suite) => suite.tests));
  const coverageAttribution = collectCoverageAttribution(context.policy, packages, context.project);
  const moduleResults = buildModulesFromPackages(packages, coverageAttribution.files, context.policy);
  const thresholdEvaluation = evaluateCoverageThresholds(context.policy, moduleResults, {
    coverageEnabled: !context.execution?.coverageExplicitlyDisabled,
  });
  const modules = thresholdEvaluation.modules;
  const overallCoverage = mergeCoverageSummaries(packages.map((pkg) => pkg.coverage).filter(Boolean));
  const diagnosticsSummary = summarizeDiagnostics(packages);

  return {
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    durationMs,
    summary: {
      generatedAt: new Date().toISOString(),
      durationMs,
      totalPackages: packages.length,
      totalModules: modules.length,
      passedPackages: packages.filter((pkg) => pkg.status === 'passed').length,
      failedPackages: packages.filter((pkg) => pkg.status === 'failed').length,
      skippedPackages: packages.filter((pkg) => pkg.status === 'skipped').length,
      totalSuites: packages.reduce((sum, pkg) => sum + pkg.suites.length, 0),
      failedSuites: packages.reduce((sum, pkg) => sum + pkg.suites.filter((suite) => suite.status === 'failed').length, 0),
      totalTests: allTests.length,
      passedTests: allTests.filter((test) => test.status === 'passed').length,
      failedTests: allTests.filter((test) => test.status === 'failed').length,
      skippedTests: allTests.filter((test) => test.status === 'skipped').length,
      coverage: overallCoverage,
      classification: summarizeClassification(allTests),
      coverageAttribution: coverageAttribution.summary,
      policy: {
        failedThresholds: thresholdEvaluation.summary.failedRules,
        warningThresholds: thresholdEvaluation.summary.warningRules,
        diagnosticsSuites: diagnosticsSummary.totalSuites,
        failedDiagnostics: diagnosticsSummary.failedSuites,
      },
      filterOptions: {
        modules: dedupe(modules.map((moduleEntry) => moduleEntry.module)).sort(),
        packages: packages.map((pkg) => pkg.name).sort(),
        frameworks: dedupe(packages.flatMap((pkg) => pkg.frameworks)).sort(),
      },
    },
    packages,
    modules,
    policy: {
      thresholds: thresholdEvaluation.summary,
      diagnostics: diagnosticsSummary,
    },
    meta: {
      phase: 8,
      projectName: context.project.name,
      projectRootDir: context.project.rootDir,
      outputDir: context.project.outputDir,
      render: {
        defaultView: context.config?.render?.defaultView || 'module',
        includeDetailedAnalysisToggle: context.config?.render?.includeDetailedAnalysisToggle !== false,
      },
    },
  };
}

function buildModulesFromPackages(packages, coverageFiles, policy) {
  const moduleMap = new Map();

  for (const pkg of packages) {
    for (const suite of pkg.suites) {
      for (const test of suite.tests) {
        const moduleEntry = ensureModuleEntry(moduleMap, test.module || 'uncategorized', policy);
        moduleEntry.tests.push(test);
        moduleEntry.packageNames.add(pkg.name);
        moduleEntry.frameworks.add(suite.runtime);

        const themeEntry = ensureThemeEntry(moduleEntry, test.theme || 'uncategorized', policy);
        themeEntry.tests.push(test);
        themeEntry.packageNames.add(pkg.name);
        themeEntry.frameworks.add(suite.runtime);

        const packageEntry = ensurePackageEntry(themeEntry, pkg.name);
        packageEntry.tests.push(test);
        packageEntry.frameworks.add(suite.runtime);

        const suiteKey = `${suite.id}:${suite.label}`;
        if (!packageEntry.suites.has(suiteKey)) {
          packageEntry.suites.set(suiteKey, {
            id: suite.id,
            label: suite.label,
            runtime: suite.runtime,
            command: suite.command,
            warnings: suite.warnings,
            coverage: null,
            diagnostics: suite.diagnostics || null,
            rawArtifacts: suite.rawArtifacts,
            tests: [],
            summary: createSummary(),
            durationMs: suite.durationMs,
            status: suite.status,
          });
        }
        packageEntry.suites.get(suiteKey).tests.push(test);
      }
    }
  }

  for (const file of coverageFiles || []) {
    const moduleEntry = ensureModuleEntry(moduleMap, file.module || 'uncategorized', policy);
    moduleEntry.coverageFiles.push(file);
    if (file.packageName) {
      moduleEntry.packageNames.add(file.packageName);
      moduleEntry.coveragePackageNames.add(file.packageName);
    }

    const themeName = file.theme || 'uncategorized';
    const themeEntry = ensureThemeEntry(moduleEntry, themeName, policy);
    themeEntry.coverageFiles.push(file);
    if (file.packageName) {
      themeEntry.packageNames.add(file.packageName);
      themeEntry.coveragePackageNames.add(file.packageName);
      ensurePackageEntry(themeEntry, file.packageName);
    }
  }

  return Array.from(moduleMap.values())
    .map((moduleEntry) => {
      const packageNames = Array.from(new Set([...moduleEntry.packageNames, ...moduleEntry.coveragePackageNames])).sort();
      return {
        module: moduleEntry.module,
        summary: summarizeTests(moduleEntry.tests),
        durationMs: summarizeDuration(moduleEntry.tests),
        packageCount: packageNames.length,
        packages: packageNames,
        frameworks: Array.from(moduleEntry.frameworks).sort(),
        owner: moduleEntry.owner,
        dominantPackages: packageNames.slice(0, 3),
        coverage: coverageSummaryFromFiles(moduleEntry.coverageFiles),
        themes: Array.from(moduleEntry.themes.values())
          .map((themeEntry) => {
            const themePackageNames = Array.from(new Set([...themeEntry.packageNames, ...themeEntry.coveragePackageNames])).sort();
            return {
              theme: themeEntry.theme,
              summary: summarizeTests(themeEntry.tests),
              durationMs: summarizeDuration(themeEntry.tests),
              packageCount: themePackageNames.length,
              packageNames: themePackageNames,
              frameworks: Array.from(themeEntry.frameworks).sort(),
              owner: themeEntry.owner,
              coverage: coverageSummaryFromFiles(themeEntry.coverageFiles),
              packages: Array.from(themeEntry.packageMap.values())
                .map((packageEntry) => ({
                  name: packageEntry.name,
                  summary: summarizeTests(packageEntry.tests),
                  durationMs: summarizeDuration(packageEntry.tests),
                  frameworks: Array.from(packageEntry.frameworks).sort(),
                  suites: Array.from(packageEntry.suites.values()).map((suiteEntry) => {
                    const suiteSummary = summarizeTests(suiteEntry.tests);
                    return {
                      ...suiteEntry,
                      summary: suiteSummary,
                      status: deriveStatusFromSummary(suiteSummary),
                    };
                  }),
                }))
                .sort((left, right) => left.name.localeCompare(right.name)),
            };
          })
          .sort((left, right) => left.theme.localeCompare(right.theme)),
      };
    })
    .sort((left, right) => left.module.localeCompare(right.module));
}

function ensureModuleEntry(moduleMap, moduleName, policy) {
  if (!moduleMap.has(moduleName)) {
    moduleMap.set(moduleName, {
      module: moduleName,
      tests: [],
      packageNames: new Set(),
      coveragePackageNames: new Set(),
      frameworks: new Set(),
      coverageFiles: [],
      owner: lookupOwner(policy, moduleName),
      themes: new Map(),
    });
  }
  return moduleMap.get(moduleName);
}

function ensureThemeEntry(moduleEntry, themeName, policy) {
  if (!moduleEntry.themes.has(themeName)) {
    moduleEntry.themes.set(themeName, {
      theme: themeName,
      tests: [],
      packageNames: new Set(),
      coveragePackageNames: new Set(),
      frameworks: new Set(),
      coverageFiles: [],
      owner: lookupOwner(policy, moduleEntry.module, themeName),
      packageMap: new Map(),
    });
  }
  return moduleEntry.themes.get(themeName);
}

function ensurePackageEntry(themeEntry, packageName) {
  if (!themeEntry.packageMap.has(packageName)) {
    themeEntry.packageMap.set(packageName, {
      name: packageName,
      tests: [],
      frameworks: new Set(),
      suites: new Map(),
    });
  }
  return themeEntry.packageMap.get(packageName);
}

function coverageSummaryFromFiles(files) {
  if (!files || files.length === 0) {
    return null;
  }
  return normalizeCoverageSummary({ files });
}

function finalizePackageResult(pkg) {
  const summary = summarizeSuites(pkg.suites);
  return {
    ...pkg,
    status: deriveStatusFromSummary(summary),
    summary,
    coverage: mergeCoverageSummaries(pkg.suites.map((suite) => suite.coverage).filter(Boolean)),
    modules: dedupe(pkg.suites.flatMap((suite) => suite.tests.map((test) => test.module || 'uncategorized'))).sort(),
    frameworks: dedupe(pkg.suites.map((suite) => suite.runtime)).sort(),
  };
}

function stripSuitePackageName(suite) {
  const { packageName, ...rest } = suite;
  return rest;
}

function summarizeDiagnostics(packages) {
  const diagnostics = (packages || []).flatMap((pkg) => pkg.suites.map((suite) => suite.diagnostics).filter(Boolean));
  return {
    totalSuites: diagnostics.length,
    passedSuites: diagnostics.filter((entry) => entry.status === 'passed').length,
    failedSuites: diagnostics.filter((entry) => entry.status === 'failed').length,
    skippedSuites: diagnostics.filter((entry) => entry.status === 'skipped').length,
  };
}

function normalizeRawArtifacts(rawArtifacts, suite) {
  return (Array.isArray(rawArtifacts) ? rawArtifacts : [])
    .map((artifact) => normalizeRawArtifact(artifact, suite))
    .filter(Boolean);
}

function normalizeRawArtifact(artifact, suite) {
  if (!artifact || typeof artifact !== 'object') {
    return null;
  }

  const relativePath = normalizeRelativeArtifactPath(artifact.relativePath);
  if (!relativePath) {
    return null;
  }

  const kind = artifact.kind === 'directory' ? 'directory' : 'file';
  const normalized = {
    relativePath,
    href: toArtifactHref(relativePath),
    label: typeof artifact.label === 'string' && artifact.label.trim().length > 0
      ? artifact.label.trim()
      : pathBaseName(relativePath),
    kind,
    mediaType: typeof artifact.mediaType === 'string' && artifact.mediaType.trim().length > 0
      ? artifact.mediaType.trim()
      : null,
    sourcePath: resolveArtifactSourcePath(artifact.sourcePath, suite?.cwd),
    encoding: typeof artifact.encoding === 'string' && artifact.encoding.length > 0 ? artifact.encoding : null,
    content: typeof artifact.content === 'string' || Buffer.isBuffer(artifact.content) ? artifact.content : null,
  };

  if (!normalized.content && !normalized.sourcePath) {
    return {
      ...normalized,
      sourcePath: null,
    };
  }

  return normalized;
}

function normalizeRelativeArtifactPath(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

function resolveArtifactSourcePath(sourcePath, suiteCwd) {
  if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
    return null;
  }
  if (path.isAbsolute(sourcePath)) {
    return sourcePath;
  }
  const baseDir = suiteCwd || process.cwd();
  return path.resolve(baseDir, sourcePath);
}

function toArtifactHref(relativePath) {
  return ['raw', ...relativePath.split('/').filter(Boolean)].join('/');
}

function pathBaseName(relativePath) {
  const parts = String(relativePath || '').split('/');
  return parts[parts.length - 1] || relativePath;
}

export function summarizeSuites(suites) {
  return suites.reduce((acc, suite) => ({
    total: acc.total + suite.summary.total,
    passed: acc.passed + suite.summary.passed,
    failed: acc.failed + suite.summary.failed,
    skipped: acc.skipped + suite.summary.skipped,
  }), createSummary());
}

export function summarizeTests(tests) {
  return tests.reduce((acc, test) => {
    acc.total += 1;
    if (test.status === 'failed') acc.failed += 1;
    else if (test.status === 'skipped') acc.skipped += 1;
    else acc.passed += 1;
    return acc;
  }, createSummary());
}

export function summarizeDuration(tests) {
  return tests.reduce((sum, test) => sum + (Number.isFinite(test.durationMs) ? test.durationMs : 0), 0);
}

export function deriveStatusFromSummary(summary) {
  if (!summary || summary.total === 0) return 'skipped';
  if (summary.failed > 0) return 'failed';
  if (summary.skipped === summary.total) return 'skipped';
  return 'passed';
}

export function normalizeStatus(status) {
  if (status === 'failed') return 'failed';
  if (status === 'skipped') return 'skipped';
  return 'passed';
}

export function formatCommand(command) {
  if (Array.isArray(command)) {
    return command.join(' ');
  }
  return String(command || '');
}

function summarizeClassification(tests) {
  const modules = new Map();
  let uncategorized = 0;
  for (const test of tests) {
    const moduleName = test.module || 'uncategorized';
    const themeName = test.theme || 'uncategorized';
    if (moduleName === 'uncategorized') {
      uncategorized += 1;
    }
    if (!modules.has(moduleName)) {
      modules.set(moduleName, { module: moduleName, total: 0, themes: new Map() });
    }
    const entry = modules.get(moduleName);
    entry.total += 1;
    if (!entry.themes.has(themeName)) {
      entry.themes.set(themeName, 0);
    }
    entry.themes.set(themeName, entry.themes.get(themeName) + 1);
  }
  return {
    uncategorized,
    modules: Array.from(modules.values()).map((entry) => ({
      module: entry.module,
      total: entry.total,
      themes: Array.from(entry.themes.entries()).map(([theme, total]) => ({ theme, total })),
    })),
  };
}

function dedupe(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}
