import crypto from 'node:crypto';
import path from 'node:path';
import { ValidationError } from './errors.js';

export const SUPPORTED_REPORT_SCHEMA_VERSION = '1';

export function normalizeIngestPayload(payload, options = {}) {
  const now = resolveTimestamp(options.now) || new Date().toISOString();

  if (!isPlainObject(payload)) {
    throw new ValidationError('Ingest payload must be a JSON object.');
  }

  const projectKey = requireNonEmptyString(payload.projectKey, 'projectKey');
  const report = normalizeReport(payload.report);
  const source = normalizeSource(payload.source);
  const runArtifacts = normalizeExternalArtifacts(payload.artifacts);
  const generatedAt = normalizeTimestamp(report.generatedAt) || now;

  const packageCatalog = new Map();
  const moduleCatalog = new Map();
  const fileCatalog = new Map();
  const suites = [];
  const tests = [];
  const errors = [];
  const performanceStats = [];
  const artifacts = [];

  const reportModuleIndex = buildReportModuleIndex(report.modules);
  const reportPackages = Array.isArray(report.packages) ? report.packages : [];
  for (const packageEntry of reportPackages) {
    if (!isPlainObject(packageEntry) || !packageEntry.name) {
      continue;
    }

    const packageName = String(packageEntry.name);
    ensurePackageEntry(packageCatalog, packageName, {
      path: normalizeOptionalString(packageEntry.location),
      metadata: {
        frameworks: asStringArray(packageEntry.frameworks),
        modules: asStringArray(packageEntry.modules),
      },
    });
  }

  for (const moduleEntry of Array.isArray(report.modules) ? report.modules : []) {
    if (!isPlainObject(moduleEntry) || !moduleEntry.module) {
      continue;
    }

    const moduleName = String(moduleEntry.module);
    const packageNames = extractModulePackageNames(moduleEntry);
    const resolvedPackageNames = packageNames.length > 0 ? packageNames : [null];

    for (const packageName of resolvedPackageNames) {
      if (packageName) {
        ensurePackageEntry(packageCatalog, packageName, {});
      }
      ensureModuleEntry(moduleCatalog, packageName, moduleName, {
        owner: normalizeOptionalString(moduleEntry.owner),
        metadata: {
          dominantPackages: asStringArray(moduleEntry.dominantPackages),
          frameworks: asStringArray(moduleEntry.frameworks),
        },
      });
    }
  }

  for (const packageEntry of reportPackages) {
    if (!isPlainObject(packageEntry) || !packageEntry.name) {
      continue;
    }

    const packageName = String(packageEntry.name);
    ensurePackageEntry(packageCatalog, packageName, {
      path: normalizeOptionalString(packageEntry.location),
      metadata: {
        frameworks: asStringArray(packageEntry.frameworks),
        modules: asStringArray(packageEntry.modules),
      },
    });

    const packageSuites = Array.isArray(packageEntry.suites) ? packageEntry.suites : [];
    for (const [suiteIndex, suite] of packageSuites.entries()) {
      if (!isPlainObject(suite)) {
        continue;
      }

      const suiteIdentifier = normalizeOptionalString(suite.id) || `${packageName}:${suiteIndex + 1}:${normalizeOptionalString(suite.label) || 'suite'}`;
      const suiteStatus = normalizeStatus(suite.status);
      const suiteDurationMs = normalizeInteger(suite.durationMs);
      const normalizedArtifacts = normalizeArtifactList(suite.rawArtifacts);
      const warnings = asStringArray(suite.warnings);
      const suiteEntry = {
        suiteIdentifier,
        packageName,
        label: normalizeOptionalString(suite.label) || suiteIdentifier,
        runtime: normalizeOptionalString(suite.runtime) || 'unknown',
        command: normalizeCommand(suite.command),
        cwd: normalizeOptionalString(suite.cwd),
        status: suiteStatus,
        durationMs: suiteDurationMs,
        summary: normalizeJsonObject(suite.summary),
        warnings,
        rawArtifacts: normalizedArtifacts,
        output: normalizeOutput(suite.output),
        metadata: {},
      };
      suites.push(suiteEntry);

      if (suiteDurationMs !== null) {
        performanceStats.push({
          scope: 'suite',
          suiteIdentifier,
          statGroup: 'timing',
          statName: 'duration',
          unit: 'ms',
          numericValue: suiteDurationMs,
          textValue: null,
          metadata: {
            runtime: suiteEntry.runtime,
            status: suiteEntry.status,
          },
        });
      }

      for (const [warningIndex, warning] of warnings.entries()) {
        errors.push({
          scope: 'suite',
          suiteIdentifier,
          testIdentifier: null,
          level: 'warning',
          code: 'SUITE_WARNING',
          message: warning,
          fingerprint: createFingerprint([projectKey, suiteIdentifier, 'warning', warningIndex, warning]),
          stack: null,
          details: {
            suiteLabel: suiteEntry.label,
            warningIndex,
          },
          firstSeenAt: generatedAt,
        });
      }

      for (const artifact of normalizedArtifacts) {
        artifacts.push({
          scope: 'suite',
          suiteIdentifier,
          testIdentifier: null,
          label: artifact.label,
          relativePath: artifact.relativePath,
          href: artifact.href,
          kind: artifact.kind,
          mediaType: artifact.mediaType,
          storageKey: artifact.storageKey,
          sourceUrl: artifact.sourceUrl,
          metadata: {
            packageName,
          },
        });
      }

      const suiteTests = Array.isArray(suite.tests) ? suite.tests : [];
      for (const [testIndex, test] of suiteTests.entries()) {
        if (!isPlainObject(test)) {
          continue;
        }

        const moduleName = normalizeOptionalString(test.module) || 'uncategorized';
        const themeName = normalizeOptionalString(test.theme) || 'uncategorized';
        const filePath = normalizeOptionalString(test.file);
        const classificationSource = normalizeOptionalString(test.classificationSource);
        const testIdentifier = `${suiteIdentifier}::${testIndex}::${normalizeOptionalString(test.fullName) || normalizeOptionalString(test.name) || 'test'}`;

        ensureModuleFromCatalog(moduleCatalog, packageCatalog, reportModuleIndex, packageName, moduleName);
        if (filePath) {
          ensureFileEntry(fileCatalog, filePath, {
            packageName,
            moduleName,
          });
        }

        const testDurationMs = normalizeInteger(test.durationMs);
        tests.push({
          testIdentifier,
          suiteIdentifier,
          packageName,
          name: normalizeOptionalString(test.name) || normalizeOptionalString(test.fullName) || `test-${testIndex + 1}`,
          fullName: normalizeOptionalString(test.fullName) || normalizeOptionalString(test.name) || `test-${testIndex + 1}`,
          status: normalizeStatus(test.status),
          durationMs: testDurationMs,
          filePath,
          line: normalizeInteger(test.line),
          column: normalizeInteger(test.column),
          classificationSource,
          moduleName,
          themeName,
          assertions: asStringArray(test.assertions),
          setup: asStringArray(test.setup),
          mocks: asStringArray(test.mocks),
          failureMessages: asStringArray(test.failureMessages),
          rawDetails: normalizeJsonObject(test.rawDetails),
          sourceSnippet: normalizeOptionalString(test.sourceSnippet),
          metadata: {},
        });

        if (testDurationMs !== null) {
          performanceStats.push({
            scope: 'test',
            suiteIdentifier,
            testIdentifier,
            statGroup: 'timing',
            statName: 'duration',
            unit: 'ms',
            numericValue: testDurationMs,
            textValue: null,
            metadata: {
              status: normalizeStatus(test.status),
            },
          });
        }

        const failureMessages = asStringArray(test.failureMessages);
        for (const [messageIndex, message] of failureMessages.entries()) {
          errors.push({
            scope: 'test',
            suiteIdentifier,
            testIdentifier,
            level: 'error',
            code: 'TEST_FAILURE',
            message,
            fingerprint: createFingerprint([projectKey, suiteIdentifier, testIdentifier, 'failure', messageIndex, message]),
            stack: extractFailureStack(message),
            details: {
              fullName: normalizeOptionalString(test.fullName) || normalizeOptionalString(test.name),
              filePath,
              line: normalizeInteger(test.line),
              column: normalizeInteger(test.column),
              messageIndex,
            },
            firstSeenAt: generatedAt,
          });
        }
      }
    }
  }

  const summaryCoverage = isPlainObject(report.summary) && isPlainObject(report.summary.coverage)
    ? report.summary.coverage
    : null;

  const coverageSnapshot = summaryCoverage
    ? {
      linesCovered: normalizeMetricCount(summaryCoverage.lines, 'covered'),
      linesTotal: normalizeMetricCount(summaryCoverage.lines, 'total'),
      linesPct: normalizeMetricPct(summaryCoverage.lines),
      branchesCovered: normalizeMetricCount(summaryCoverage.branches, 'covered'),
      branchesTotal: normalizeMetricCount(summaryCoverage.branches, 'total'),
      branchesPct: normalizeMetricPct(summaryCoverage.branches),
      functionsCovered: normalizeMetricCount(summaryCoverage.functions, 'covered'),
      functionsTotal: normalizeMetricCount(summaryCoverage.functions, 'total'),
      functionsPct: normalizeMetricPct(summaryCoverage.functions),
      statementsCovered: normalizeMetricCount(summaryCoverage.statements, 'covered'),
      statementsTotal: normalizeMetricCount(summaryCoverage.statements, 'total'),
      statementsPct: normalizeMetricPct(summaryCoverage.statements),
      metadata: {
        coverageAttribution: normalizeJsonObject(report.summary.coverageAttribution),
      },
    }
    : null;

  const coverageFiles = [];
  for (const coverageFile of Array.isArray(summaryCoverage?.files) ? summaryCoverage.files : []) {
    if (!isPlainObject(coverageFile) || !coverageFile.path) {
      continue;
    }

    const filePath = String(coverageFile.path);
    const packageName = normalizeOptionalString(coverageFile.packageName);
    const moduleName = normalizeOptionalString(coverageFile.module);
    if (packageName) {
      ensurePackageEntry(packageCatalog, packageName, {});
    }
    if (moduleName) {
      ensureModuleFromCatalog(moduleCatalog, packageCatalog, reportModuleIndex, packageName, moduleName, {
        owner: normalizeOptionalString(coverageFile.owner),
      });
    }
    ensureFileEntry(fileCatalog, filePath, {
      packageName,
      moduleName,
    });

    coverageFiles.push({
      packageName,
      moduleName,
      path: filePath,
      linesCovered: normalizeMetricCount(coverageFile.lines, 'covered'),
      linesTotal: normalizeMetricCount(coverageFile.lines, 'total'),
      linesPct: normalizeMetricPct(coverageFile.lines),
      branchesCovered: normalizeMetricCount(coverageFile.branches, 'covered'),
      branchesTotal: normalizeMetricCount(coverageFile.branches, 'total'),
      branchesPct: normalizeMetricPct(coverageFile.branches),
      functionsCovered: normalizeMetricCount(coverageFile.functions, 'covered'),
      functionsTotal: normalizeMetricCount(coverageFile.functions, 'total'),
      functionsPct: normalizeMetricPct(coverageFile.functions),
      statementsCovered: normalizeMetricCount(coverageFile.statements, 'covered'),
      statementsTotal: normalizeMetricCount(coverageFile.statements, 'total'),
      statementsPct: normalizeMetricPct(coverageFile.statements),
      shared: Boolean(coverageFile.shared),
      attributionSource: normalizeOptionalString(coverageFile.attributionSource),
      attributionReason: normalizeOptionalString(coverageFile.attributionReason),
      attributionWeight: normalizeNumber(coverageFile.attributionWeight) ?? 1,
      metadata: {},
    });
  }

  for (const artifact of runArtifacts) {
    artifacts.push({
      scope: 'run',
      suiteIdentifier: null,
      testIdentifier: null,
      label: artifact.label,
      relativePath: artifact.relativePath,
      href: artifact.href,
      kind: artifact.kind,
      mediaType: artifact.mediaType,
      storageKey: artifact.storageKey,
      sourceUrl: artifact.sourceUrl,
      metadata: {},
    });
  }

  const runStatus = deriveRunStatus(report);
  const runDurationMs = normalizeInteger(report.durationMs);
  if (runDurationMs !== null) {
    performanceStats.unshift({
      scope: 'run',
      suiteIdentifier: null,
      testIdentifier: null,
      statGroup: 'timing',
      statName: 'duration',
      unit: 'ms',
      numericValue: runDurationMs,
      textValue: null,
      metadata: {
        status: runStatus,
      },
    });
  }

  const normalizedPackages = Array.from(packageCatalog.values());
  const normalizedModules = Array.from(moduleCatalog.values());
  const normalizedFiles = Array.from(fileCatalog.values());
  const project = buildProject(projectKey, report, source);
  const projectVersion = buildProjectVersion(source);
  const externalKey = deriveExternalKey(projectKey, source, report);

  return {
    project,
    projectVersion,
    run: {
      externalKey,
      sourceProvider: normalizeOptionalString(source.provider),
      sourceRunId: normalizeOptionalString(source.runId),
      sourceUrl: normalizeOptionalString(source.runUrl),
      triggeredBy: normalizeOptionalString(source.actor),
      branch: normalizeOptionalString(source.branch),
      commitSha: normalizeOptionalString(source.commitSha),
      startedAt: normalizeTimestamp(source.startedAt),
      completedAt: normalizeTimestamp(source.completedAt) || generatedAt,
      durationMs: runDurationMs,
      status: runStatus,
      reportSchemaVersion: normalizeOptionalString(report.schemaVersion) || SUPPORTED_REPORT_SCHEMA_VERSION,
      rawReport: report,
      summary: normalizeJsonObject(report.summary),
      metadata: {
        artifactsProvided: runArtifacts.length,
        ingestedAt: now,
        source,
      },
    },
    packages: normalizedPackages,
    modules: normalizedModules,
    files: normalizedFiles,
    suites,
    tests,
    coverageSnapshot,
    coverageFiles,
    errors,
    performanceStats,
    artifacts,
    counts: {
      packages: normalizedPackages.length,
      modules: normalizedModules.length,
      files: normalizedFiles.length,
      suites: suites.length,
      tests: tests.length,
      coverageFiles: coverageFiles.length,
      artifacts: artifacts.length,
      errors: errors.length,
    },
  };
}

export function deriveExternalKey(projectKey, source, report) {
  if (normalizeOptionalString(source.provider) && normalizeOptionalString(source.runId)) {
    return `${projectKey}:${source.provider}:${source.runId}`;
  }

  const summary = isPlainObject(report.summary) ? report.summary : {};
  const startedAt = normalizeTimestamp(source.startedAt) || normalizeTimestamp(report.generatedAt) || 'unknown';
  const commitSha = normalizeOptionalString(source.commitSha) || 'unknown';
  const totalTests = normalizeInteger(summary.totalTests) ?? 0;
  return `${projectKey}:${commitSha}:${startedAt}:${totalTests}`;
}

function normalizeReport(report) {
  if (!isPlainObject(report)) {
    throw new ValidationError('`report` must be a JSON object that matches the test-station report contract.', {
      field: 'report',
    });
  }

  const schemaVersion = normalizeOptionalString(report.schemaVersion);
  if (!schemaVersion) {
    throw new ValidationError('`report.schemaVersion` is required.', {
      field: 'report.schemaVersion',
    });
  }
  if (schemaVersion !== SUPPORTED_REPORT_SCHEMA_VERSION) {
    throw new ValidationError(`Unsupported report schema version: ${schemaVersion}. Expected ${SUPPORTED_REPORT_SCHEMA_VERSION}.`, {
      field: 'report.schemaVersion',
    });
  }

  if (!Array.isArray(report.packages)) {
    throw new ValidationError('`report.packages` must be an array.', {
      field: 'report.packages',
    });
  }

  return report;
}

function normalizeSource(source) {
  if (source == null) {
    return {};
  }
  if (!isPlainObject(source)) {
    throw new ValidationError('`source` must be an object when provided.', {
      field: 'source',
    });
  }
  return source;
}

function buildProject(projectKey, report, source) {
  const projectName = normalizeOptionalString(report?.meta?.projectName)
    || normalizeOptionalString(source.projectName)
    || normalizeOptionalString(source.repository)
    || projectKey;

  return {
    key: projectKey,
    slug: slugify(projectKey),
    name: projectName,
    repositoryUrl: normalizeOptionalString(source.repositoryUrl),
    defaultBranch: normalizeOptionalString(source.defaultBranch) || normalizeOptionalString(source.branch),
    metadata: {
      reportMeta: normalizeJsonObject(report.meta),
    },
  };
}

function buildProjectVersion(source) {
  const branch = normalizeOptionalString(source.branch);
  const tag = normalizeOptionalString(source.tag);
  const commitSha = normalizeOptionalString(source.commitSha);
  const semanticVersion = normalizeOptionalString(source.semanticVersion);
  const buildNumber = normalizeInteger(source.buildNumber);
  const releaseName = normalizeOptionalString(source.releaseName);
  const versionKey = normalizeOptionalString(source.versionKey)
    || (tag ? `tag:${tag}` : null)
    || (semanticVersion ? `semver:${semanticVersion}` : null)
    || (commitSha ? `commit:${commitSha}` : null)
    || (branch ? `branch:${branch}` : null);

  if (!versionKey) {
    return null;
  }

  return {
    versionKey,
    versionKind: tag ? 'tag' : semanticVersion ? 'release' : commitSha ? 'commit' : 'branch',
    branch,
    tag,
    commitSha,
    semanticVersion,
    buildNumber,
    releaseName,
    releasedAt: normalizeTimestamp(source.releasedAt),
    metadata: {},
  };
}

function buildReportModuleIndex(modules) {
  const index = new Map();

  for (const moduleEntry of Array.isArray(modules) ? modules : []) {
    if (!isPlainObject(moduleEntry) || !moduleEntry.module) {
      continue;
    }

    const moduleName = String(moduleEntry.module);
    const packageNames = extractModulePackageNames(moduleEntry);
    const resolvedPackageNames = packageNames.length > 0 ? packageNames : [null];
    for (const packageName of resolvedPackageNames) {
      index.set(createModuleKey(packageName, moduleName), {
        owner: normalizeOptionalString(moduleEntry.owner),
      });
    }
  }

  return index;
}

function extractModulePackageNames(moduleEntry) {
  const names = new Set();
  for (const value of asStringArray(moduleEntry.packages)) {
    names.add(value);
  }
  for (const value of asStringArray(moduleEntry.packageNames)) {
    names.add(value);
  }
  for (const themeEntry of Array.isArray(moduleEntry.themes) ? moduleEntry.themes : []) {
    for (const value of asStringArray(themeEntry?.packageNames)) {
      names.add(value);
    }
    for (const packageEntry of Array.isArray(themeEntry?.packages) ? themeEntry.packages : []) {
      if (packageEntry?.name) {
        names.add(String(packageEntry.name));
      }
    }
  }
  return Array.from(names);
}

function ensurePackageEntry(packageCatalog, packageName, input) {
  const key = String(packageName);
  if (!packageCatalog.has(key)) {
    packageCatalog.set(key, {
      name: key,
      slug: slugify(key),
      path: normalizeOptionalString(input?.path),
      metadata: normalizeJsonObject(input?.metadata),
    });
    return packageCatalog.get(key);
  }

  const existing = packageCatalog.get(key);
  if (!existing.path && input?.path) {
    existing.path = normalizeOptionalString(input.path);
  }
  existing.metadata = mergeJson(existing.metadata, normalizeJsonObject(input?.metadata));
  return existing;
}

function ensureModuleFromCatalog(moduleCatalog, packageCatalog, reportModuleIndex, packageName, moduleName, input = {}) {
  if (packageName) {
    ensurePackageEntry(packageCatalog, packageName, {});
  }
  const indexed = reportModuleIndex.get(createModuleKey(packageName, moduleName));
  return ensureModuleEntry(moduleCatalog, packageName, moduleName, {
    owner: normalizeOptionalString(input.owner) || normalizeOptionalString(indexed?.owner),
    metadata: normalizeJsonObject(input.metadata),
  });
}

function ensureModuleEntry(moduleCatalog, packageName, moduleName, input = {}) {
  const key = createModuleKey(packageName, moduleName);
  if (!moduleCatalog.has(key)) {
    moduleCatalog.set(key, {
      packageName: packageName || null,
      name: moduleName,
      slug: slugify(moduleName),
      owner: normalizeOptionalString(input.owner),
      metadata: normalizeJsonObject(input.metadata),
    });
    return moduleCatalog.get(key);
  }

  const existing = moduleCatalog.get(key);
  if (!existing.owner && input.owner) {
    existing.owner = normalizeOptionalString(input.owner);
  }
  existing.metadata = mergeJson(existing.metadata, normalizeJsonObject(input.metadata));
  return existing;
}

function ensureFileEntry(fileCatalog, filePath, input = {}) {
  const normalizedPath = String(filePath);
  if (!fileCatalog.has(normalizedPath)) {
    fileCatalog.set(normalizedPath, {
      path: normalizedPath,
      packageName: input.packageName || null,
      moduleName: input.moduleName || null,
      language: detectLanguage(normalizedPath),
      metadata: {},
    });
    return fileCatalog.get(normalizedPath);
  }

  const existing = fileCatalog.get(normalizedPath);
  if (!existing.packageName && input.packageName) {
    existing.packageName = input.packageName;
  }
  if (!existing.moduleName && input.moduleName) {
    existing.moduleName = input.moduleName;
  }
  if (!existing.language) {
    existing.language = detectLanguage(normalizedPath);
  }
  return existing;
}

function normalizeArtifactList(artifacts) {
  return (Array.isArray(artifacts) ? artifacts : [])
    .filter((artifact) => isPlainObject(artifact))
    .map((artifact, index) => ({
      label: normalizeOptionalString(artifact.label),
      relativePath: normalizeOptionalString(artifact.relativePath),
      href: normalizeOptionalString(artifact.href),
      kind: normalizeOptionalString(artifact.kind) || 'file',
      mediaType: normalizeOptionalString(artifact.mediaType),
      storageKey: normalizeOptionalString(artifact.storageKey),
      sourceUrl: normalizeOptionalString(artifact.sourceUrl),
      metadata: {
        index,
      },
    }))
    .filter((artifact) => artifact.relativePath || artifact.href || artifact.sourceUrl);
}

function normalizeExternalArtifacts(artifacts) {
  return normalizeArtifactList(artifacts);
}

function normalizeOutput(output) {
  if (!isPlainObject(output)) {
    return {
      stdout: '',
      stderr: '',
    };
  }

  return {
    stdout: normalizeOptionalString(output.stdout) || '',
    stderr: normalizeOptionalString(output.stderr) || '',
  };
}

function normalizeStatus(value) {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (normalized === 'passed' || normalized === 'failed' || normalized === 'skipped') {
    return normalized;
  }
  return normalized || 'unknown';
}

function deriveRunStatus(report) {
  const summary = isPlainObject(report.summary) ? report.summary : null;
  if (summary) {
    if ((normalizeInteger(summary.failedTests) ?? 0) > 0 || (normalizeInteger(summary.failedSuites) ?? 0) > 0) {
      return 'failed';
    }
    if ((normalizeInteger(summary.totalTests) ?? 0) === 0 || (normalizeInteger(summary.skippedTests) ?? 0) === (normalizeInteger(summary.totalTests) ?? 0)) {
      return 'skipped';
    }
    if ((normalizeInteger(summary.passedTests) ?? 0) > 0) {
      return 'passed';
    }
  }

  if (Array.isArray(report.packages) && report.packages.some((pkg) => normalizeStatus(pkg?.status) === 'failed')) {
    return 'failed';
  }
  if (Array.isArray(report.packages) && report.packages.some((pkg) => normalizeStatus(pkg?.status) === 'passed')) {
    return 'passed';
  }
  return 'unknown';
}

function normalizeCommand(command) {
  if (Array.isArray(command)) {
    return command.map((entry) => String(entry)).join(' ');
  }
  return normalizeOptionalString(command);
}

function requireNonEmptyString(value, field) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new ValidationError(`\`${field}\` is required.`, {
      field,
    });
  }
  return normalized;
}

function normalizeJsonObject(value) {
  return isPlainObject(value) ? value : {};
}

function mergeJson(left, right) {
  const merged = {
    ...normalizeJsonObject(left),
    ...normalizeJsonObject(right),
  };
  return merged;
}

function resolveTimestamp(value) {
  return normalizeTimestamp(value);
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) {
    return null;
  }
  return timestamp.toISOString();
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}

function normalizeInteger(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function normalizeNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function normalizeMetricCount(metric, field) {
  if (!isPlainObject(metric)) {
    return null;
  }
  return normalizeInteger(metric[field]);
}

function normalizeMetricPct(metric) {
  if (!isPlainObject(metric)) {
    return null;
  }
  return normalizeNumber(metric.pct);
}

function asStringArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeOptionalString(value))
    .filter(Boolean);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'item';
}

function detectLanguage(filePath) {
  const extension = path.extname(filePath || '').replace(/^\./, '');
  return extension || null;
}

function createModuleKey(packageName, moduleName) {
  return `${packageName || ''}::${moduleName}`;
}

function createFingerprint(parts) {
  const hash = crypto.createHash('sha1');
  for (const part of parts) {
    hash.update(String(part ?? ''));
    hash.update('\u0000');
  }
  return hash.digest('hex');
}

function extractFailureStack(message) {
  if (typeof message !== 'string' || !message.includes('\n')) {
    return null;
  }
  return message;
}
