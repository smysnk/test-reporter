import crypto from 'node:crypto';
import sequelize from '../db.js';
import {
  Artifact,
  CoverageFile,
  CoverageSnapshot,
  CoverageTrendPoint,
  ErrorOccurrence,
  PerformanceStat,
  Project,
  ProjectFile,
  ProjectModule,
  ProjectPackage,
  ProjectVersion,
  Run,
  SuiteRun,
  TestExecution,
} from '../models/index.js';
import { normalizeIngestPayload } from './normalize.js';

export function createIngestionService(options = {}) {
  const persistence = options.persistence || createSequelizeIngestionPersistence(options);

  return {
    async ingest(payload, context = {}) {
      const normalized = normalizeIngestPayload(payload, context);
      return persistence.persistRun(normalized, context);
    },
  };
}

export function createSequelizeIngestionPersistence(options = {}) {
  const database = options.sequelize || sequelize;
  const models = options.models || {
    Artifact,
    CoverageFile,
    CoverageSnapshot,
    CoverageTrendPoint,
    ErrorOccurrence,
    PerformanceStat,
    Project,
    ProjectFile,
    ProjectModule,
    ProjectPackage,
    ProjectVersion,
    Run,
    SuiteRun,
    TestExecution,
  };

  return {
    async persistRun(normalized, context = {}) {
      return database.transaction(async (transaction) => {
        const projectRecord = await upsertRecord(
          models.Project,
          { key: normalized.project.key },
          normalized.project,
          { transaction },
        );

        const packageRecords = new Map();
        for (const packageEntry of normalized.packages) {
          const record = await upsertRecord(
            models.ProjectPackage,
            {
              projectId: projectRecord.id,
              name: packageEntry.name,
            },
            {
              projectId: projectRecord.id,
              name: packageEntry.name,
              slug: packageEntry.slug,
              path: packageEntry.path,
              metadata: packageEntry.metadata,
            },
            { transaction },
          );
          packageRecords.set(packageEntry.name, record);
        }

        const moduleRecords = new Map();
        for (const moduleEntry of normalized.modules) {
          const packageRecord = moduleEntry.packageName ? packageRecords.get(moduleEntry.packageName) || null : null;
          const record = await upsertRecord(
            models.ProjectModule,
            {
              projectId: projectRecord.id,
              projectPackageId: packageRecord?.id || null,
              name: moduleEntry.name,
            },
            {
              projectId: projectRecord.id,
              projectPackageId: packageRecord?.id || null,
              name: moduleEntry.name,
              slug: moduleEntry.slug,
              owner: moduleEntry.owner,
              metadata: moduleEntry.metadata,
            },
            { transaction },
          );
          moduleRecords.set(createModuleRecordKey(moduleEntry.packageName, moduleEntry.name), record);
        }

        const fileRecords = new Map();
        for (const fileEntry of normalized.files) {
          const packageRecord = fileEntry.packageName ? packageRecords.get(fileEntry.packageName) || null : null;
          const moduleRecord = fileEntry.moduleName
            ? moduleRecords.get(createModuleRecordKey(fileEntry.packageName, fileEntry.moduleName))
              || moduleRecords.get(createModuleRecordKey(null, fileEntry.moduleName))
              || null
            : null;
          const record = await upsertRecord(
            models.ProjectFile,
            {
              projectId: projectRecord.id,
              path: fileEntry.path,
            },
            {
              projectId: projectRecord.id,
              projectPackageId: packageRecord?.id || null,
              projectModuleId: moduleRecord?.id || null,
              path: fileEntry.path,
              language: fileEntry.language,
              metadata: fileEntry.metadata,
            },
            { transaction },
          );
          fileRecords.set(fileEntry.path, record);
        }

        let projectVersionRecord = null;
        if (normalized.projectVersion) {
          projectVersionRecord = await upsertRecord(
            models.ProjectVersion,
            {
              projectId: projectRecord.id,
              versionKey: normalized.projectVersion.versionKey,
            },
            {
              projectId: projectRecord.id,
              ...normalized.projectVersion,
            },
            { transaction },
          );
        }

        const { record: runRecord, created } = await upsertRecordWithState(
          models.Run,
          {
            projectId: projectRecord.id,
            externalKey: normalized.run.externalKey,
          },
          {
            projectId: projectRecord.id,
            projectVersionId: projectVersionRecord?.id || null,
            ...normalized.run,
          },
          { transaction },
        );

        await clearExistingRunFacts(models, runRecord.id, { transaction });

        const suiteRecords = new Map();
        for (const suiteEntry of normalized.suites) {
          const packageRecord = suiteEntry.packageName ? packageRecords.get(suiteEntry.packageName) || null : null;
          const suiteRecord = await models.SuiteRun.create({
            runId: runRecord.id,
            projectPackageId: packageRecord?.id || null,
            packageName: suiteEntry.packageName,
            suiteIdentifier: suiteEntry.suiteIdentifier,
            label: suiteEntry.label,
            runtime: suiteEntry.runtime,
            command: suiteEntry.command,
            cwd: suiteEntry.cwd,
            status: suiteEntry.status,
            durationMs: suiteEntry.durationMs,
            summary: suiteEntry.summary,
            warnings: suiteEntry.warnings,
            rawArtifacts: suiteEntry.rawArtifacts,
            output: suiteEntry.output,
            metadata: suiteEntry.metadata,
          }, { transaction });
          suiteRecords.set(suiteEntry.suiteIdentifier, suiteRecord);
        }

        const testRecords = new Map();
        for (const testEntry of normalized.tests) {
          const moduleRecord = testEntry.moduleName
            ? moduleRecords.get(createModuleRecordKey(testEntry.packageName, testEntry.moduleName))
              || moduleRecords.get(createModuleRecordKey(null, testEntry.moduleName))
              || null
            : null;
          const fileRecord = testEntry.filePath ? fileRecords.get(testEntry.filePath) || null : null;
          const suiteRecord = suiteRecords.get(testEntry.suiteIdentifier);
          const testRecord = await models.TestExecution.create({
            suiteRunId: suiteRecord.id,
            projectModuleId: moduleRecord?.id || null,
            projectFileId: fileRecord?.id || null,
            name: testEntry.name,
            fullName: testEntry.fullName,
            status: testEntry.status,
            durationMs: testEntry.durationMs,
            filePath: testEntry.filePath,
            line: testEntry.line,
            column: testEntry.column,
            classificationSource: testEntry.classificationSource,
            moduleName: testEntry.moduleName,
            themeName: testEntry.themeName,
            assertions: testEntry.assertions,
            setup: testEntry.setup,
            mocks: testEntry.mocks,
            failureMessages: testEntry.failureMessages,
            rawDetails: testEntry.rawDetails,
            sourceSnippet: testEntry.sourceSnippet,
            metadata: testEntry.metadata,
          }, { transaction });
          testRecords.set(testEntry.testIdentifier, testRecord);
        }

        if (normalized.coverageSnapshot) {
          const coverageSnapshotRecord = await models.CoverageSnapshot.create({
            runId: runRecord.id,
            ...normalized.coverageSnapshot,
          }, { transaction });

          for (const coverageFile of normalized.coverageFiles) {
            const packageRecord = coverageFile.packageName ? packageRecords.get(coverageFile.packageName) || null : null;
            const moduleRecord = coverageFile.moduleName
              ? moduleRecords.get(createModuleRecordKey(coverageFile.packageName, coverageFile.moduleName))
                || moduleRecords.get(createModuleRecordKey(null, coverageFile.moduleName))
                || null
              : null;
            const fileRecord = fileRecords.get(coverageFile.path) || null;

            await models.CoverageFile.create({
              coverageSnapshotId: coverageSnapshotRecord.id,
              projectFileId: fileRecord?.id || null,
              projectPackageId: packageRecord?.id || null,
              projectModuleId: moduleRecord?.id || null,
              ...coverageFile,
            }, { transaction });
          }
        }

        for (const trendPoint of buildCoverageTrendPoints({
          normalized,
          projectRecord,
          projectVersionRecord,
          runRecord,
          packageRecords,
          moduleRecords,
          fileRecords,
        })) {
          await models.CoverageTrendPoint.create(trendPoint, { transaction });
        }

        for (const errorEntry of normalized.errors) {
          await models.ErrorOccurrence.create({
            runId: runRecord.id,
            suiteRunId: errorEntry.suiteIdentifier ? suiteRecords.get(errorEntry.suiteIdentifier)?.id || null : null,
            testExecutionId: errorEntry.testIdentifier ? testRecords.get(errorEntry.testIdentifier)?.id || null : null,
            level: errorEntry.level,
            code: errorEntry.code,
            message: errorEntry.message,
            fingerprint: errorEntry.fingerprint,
            stack: errorEntry.stack,
            details: errorEntry.details,
            firstSeenAt: errorEntry.firstSeenAt || context.now || new Date().toISOString(),
          }, { transaction });
        }

        for (const performanceEntry of normalized.performanceStats) {
          await models.PerformanceStat.create({
            runId: runRecord.id,
            suiteRunId: performanceEntry.suiteIdentifier ? suiteRecords.get(performanceEntry.suiteIdentifier)?.id || null : null,
            testExecutionId: performanceEntry.testIdentifier ? testRecords.get(performanceEntry.testIdentifier)?.id || null : null,
            statGroup: performanceEntry.statGroup,
            statName: performanceEntry.statName,
            unit: performanceEntry.unit,
            numericValue: performanceEntry.numericValue,
            textValue: performanceEntry.textValue,
            metadata: performanceEntry.metadata,
          }, { transaction });
        }

        for (const artifactEntry of normalized.artifacts) {
          await models.Artifact.create({
            runId: runRecord.id,
            suiteRunId: artifactEntry.suiteIdentifier ? suiteRecords.get(artifactEntry.suiteIdentifier)?.id || null : null,
            testExecutionId: artifactEntry.testIdentifier ? testRecords.get(artifactEntry.testIdentifier)?.id || null : null,
            label: artifactEntry.label,
            relativePath: artifactEntry.relativePath,
            href: artifactEntry.href,
            kind: artifactEntry.kind,
            mediaType: artifactEntry.mediaType,
            storageKey: artifactEntry.storageKey,
            sourceUrl: artifactEntry.sourceUrl,
            metadata: artifactEntry.metadata,
          }, { transaction });
        }

        return {
          projectId: projectRecord.id,
          projectVersionId: projectVersionRecord?.id || null,
          runId: runRecord.id,
          externalKey: normalized.run.externalKey,
          created,
          counts: normalized.counts,
        };
      });
    },
  };
}

async function clearExistingRunFacts(models, runId, options = {}) {
  await models.Artifact.destroy({ where: { runId }, transaction: options.transaction });
  await models.CoverageTrendPoint.destroy({ where: { runId }, transaction: options.transaction });
  await models.ErrorOccurrence.destroy({ where: { runId }, transaction: options.transaction });
  await models.PerformanceStat.destroy({ where: { runId }, transaction: options.transaction });

  const existingSuites = await models.SuiteRun.findAll({ where: { runId }, transaction: options.transaction });
  for (const suiteRecord of existingSuites) {
    await models.TestExecution.destroy({ where: { suiteRunId: suiteRecord.id }, transaction: options.transaction });
  }

  const existingCoverageSnapshot = await models.CoverageSnapshot.findOne({ where: { runId }, transaction: options.transaction });
  if (existingCoverageSnapshot) {
    await models.CoverageFile.destroy({
      where: { coverageSnapshotId: existingCoverageSnapshot.id },
      transaction: options.transaction,
    });
  }

  await models.SuiteRun.destroy({ where: { runId }, transaction: options.transaction });
  await models.CoverageSnapshot.destroy({ where: { runId }, transaction: options.transaction });
}

async function upsertRecord(model, where, values, options = {}) {
  const { record } = await upsertRecordWithState(model, where, values, options);
  return record;
}

async function upsertRecordWithState(model, where, values, options = {}) {
  const existing = await model.findOne({ where, transaction: options.transaction });
  if (existing) {
    await existing.update(values, { transaction: options.transaction });
    return {
      record: existing,
      created: false,
    };
  }

  const record = await model.create(values, { transaction: options.transaction });
  return {
    record,
    created: true,
  };
}

function createModuleRecordKey(packageName, moduleName) {
  return `${packageName || ''}::${moduleName}`;
}

function buildCoverageTrendPoints({
  normalized,
  projectRecord,
  projectVersionRecord,
  runRecord,
  packageRecords,
  moduleRecords,
  fileRecords,
}) {
  const recordedAt = runRecord.completedAt || runRecord.startedAt || new Date().toISOString();
  const points = [];

  if (normalized.coverageSnapshot) {
    points.push(createTrendPoint({
      projectRecord,
      projectVersionRecord,
      runRecord,
      recordedAt,
      scopeType: 'project',
      scopeKey: `project:${projectRecord.key}`,
      label: projectRecord.name,
      metrics: normalized.coverageSnapshot,
      metadata: {
        source: 'coverage_snapshot',
      },
    }));
  }

  const packageGroups = groupCoverageFiles(normalized.coverageFiles, (file) => file.packageName || null);
  for (const [packageName, files] of packageGroups.entries()) {
    if (!packageName) {
      continue;
    }
    const packageRecord = packageRecords.get(packageName) || null;
    points.push(createTrendPoint({
      projectRecord,
      projectVersionRecord,
      runRecord,
      recordedAt,
      projectPackageId: packageRecord?.id || null,
      scopeType: 'package',
      scopeKey: `package:${packageName}`,
      label: packageName,
      packageName,
      metrics: aggregateCoverageMetrics(files),
      metadata: {
        fileCount: files.length,
      },
    }));
  }

  const moduleGroups = groupCoverageFiles(normalized.coverageFiles, (file) => (
    file.moduleName ? `${file.packageName || ''}::${file.moduleName}` : null
  ));
  for (const [groupKey, files] of moduleGroups.entries()) {
    if (!groupKey) {
      continue;
    }
    const [packageName, moduleName] = groupKey.split('::');
    if (!moduleName) {
      continue;
    }
    const moduleRecord = moduleRecords.get(createModuleRecordKey(packageName || null, moduleName))
      || moduleRecords.get(createModuleRecordKey(null, moduleName))
      || null;
    const packageRecord = packageName ? packageRecords.get(packageName) || null : null;
    points.push(createTrendPoint({
      projectRecord,
      projectVersionRecord,
      runRecord,
      recordedAt,
      projectPackageId: packageRecord?.id || null,
      projectModuleId: moduleRecord?.id || null,
      scopeType: 'module',
      scopeKey: `module:${packageName || 'shared'}:${moduleName}`,
      label: moduleName,
      packageName: packageName || null,
      moduleName,
      metrics: aggregateCoverageMetrics(files),
      metadata: {
        fileCount: files.length,
      },
    }));
  }

  for (const coverageFile of normalized.coverageFiles) {
    const packageRecord = coverageFile.packageName ? packageRecords.get(coverageFile.packageName) || null : null;
    const moduleRecord = coverageFile.moduleName
      ? moduleRecords.get(createModuleRecordKey(coverageFile.packageName || null, coverageFile.moduleName))
        || moduleRecords.get(createModuleRecordKey(null, coverageFile.moduleName))
        || null
      : null;
    const fileRecord = fileRecords.get(coverageFile.path) || null;

    points.push(createTrendPoint({
      projectRecord,
      projectVersionRecord,
      runRecord,
      recordedAt,
      projectPackageId: packageRecord?.id || null,
      projectModuleId: moduleRecord?.id || null,
      projectFileId: fileRecord?.id || null,
      scopeType: 'file',
      scopeKey: `file:${coverageFile.path}`,
      label: coverageFile.path,
      packageName: coverageFile.packageName || null,
      moduleName: coverageFile.moduleName || null,
      filePath: coverageFile.path,
      metrics: coverageFile,
      metadata: {
        shared: Boolean(coverageFile.shared),
        attributionSource: coverageFile.attributionSource || null,
      },
    }));
  }

  return points;
}

function createTrendPoint({
  projectRecord,
  projectVersionRecord,
  runRecord,
  recordedAt,
  projectPackageId = null,
  projectModuleId = null,
  projectFileId = null,
  scopeType,
  scopeKey,
  label,
  packageName = null,
  moduleName = null,
  filePath = null,
  metrics,
  metadata = {},
}) {
  return {
    projectId: projectRecord.id,
    projectVersionId: projectVersionRecord?.id || null,
    runId: runRecord.id,
    projectPackageId,
    projectModuleId,
    projectFileId,
    scopeType,
    scopeHash: hashScopeKey(scopeType, scopeKey),
    scopeKey,
    label,
    packageName,
    moduleName,
    filePath,
    recordedAt,
    linesCovered: metrics.linesCovered ?? null,
    linesTotal: metrics.linesTotal ?? null,
    linesPct: metrics.linesPct ?? null,
    branchesCovered: metrics.branchesCovered ?? null,
    branchesTotal: metrics.branchesTotal ?? null,
    branchesPct: metrics.branchesPct ?? null,
    functionsCovered: metrics.functionsCovered ?? null,
    functionsTotal: metrics.functionsTotal ?? null,
    functionsPct: metrics.functionsPct ?? null,
    statementsCovered: metrics.statementsCovered ?? null,
    statementsTotal: metrics.statementsTotal ?? null,
    statementsPct: metrics.statementsPct ?? null,
    metadata,
  };
}

function groupCoverageFiles(files, getKey) {
  const groups = new Map();
  for (const file of files || []) {
    const key = getKey(file);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(file);
  }
  return groups;
}

function aggregateCoverageMetrics(files) {
  return {
    linesCovered: sumMetric(files, 'linesCovered'),
    linesTotal: sumMetric(files, 'linesTotal'),
    linesPct: percent(sumMetric(files, 'linesCovered'), sumMetric(files, 'linesTotal')),
    branchesCovered: sumMetric(files, 'branchesCovered'),
    branchesTotal: sumMetric(files, 'branchesTotal'),
    branchesPct: percent(sumMetric(files, 'branchesCovered'), sumMetric(files, 'branchesTotal')),
    functionsCovered: sumMetric(files, 'functionsCovered'),
    functionsTotal: sumMetric(files, 'functionsTotal'),
    functionsPct: percent(sumMetric(files, 'functionsCovered'), sumMetric(files, 'functionsTotal')),
    statementsCovered: sumMetric(files, 'statementsCovered'),
    statementsTotal: sumMetric(files, 'statementsTotal'),
    statementsPct: percent(sumMetric(files, 'statementsCovered'), sumMetric(files, 'statementsTotal')),
  };
}

function sumMetric(files, field) {
  return (files || []).reduce((sum, file) => sum + (Number.isFinite(file?.[field]) ? Number(file[field]) : 0), 0);
}

function percent(covered, total) {
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Number(((covered / total) * 100).toFixed(2));
}

function hashScopeKey(scopeType, scopeKey) {
  return crypto.createHash('sha1').update(`${scopeType}:${scopeKey}`).digest('hex');
}
