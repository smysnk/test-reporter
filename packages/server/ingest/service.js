import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Op } from 'sequelize';
import sequelize from '../db.js';
import { invalidateProjectBenchmarkQueryCache } from '../benchmark-query-cache.js';
import {
  measureProfileStage,
  recordIngestOutcome,
  recordProjectionLag,
  incrementRuntimeMetric,
} from '../profiling/requestProfile.js';
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
  ProjectOverview,
  ProjectPackage,
  ProjectVersion,
  ReportSubmission,
  Run,
  RunActiveSubmission,
  RunOverview,
  SuiteRun,
  TestExecution,
} from '../models/index.js';
import { normalizeIngestPayload } from './normalize.js';

export function createIngestionService(options = {}) {
  const persistence = options.persistence || createSequelizeIngestionPersistence(options);

  return {
    async ingest(payload, context = {}) {
      const startedAt = performance.now();
      const heapStartedAt = process.memoryUsage().heapUsed;
      const payloadBytes = Buffer.byteLength(JSON.stringify(payload || {}));
      try {
        const normalized = await measureProfileStage(
          'ingest_normalization',
          async () => normalizeIngestPayload(payload, context),
          (result) => ({
            tests: result?.counts?.tests || 0,
            suites: result?.counts?.suites || 0,
            artifacts: result?.counts?.artifacts || 0,
          }),
        );
        const persisted = await measureProfileStage(
          'ingest_persistence',
          () => persistence.persistRun(normalized, context),
          (result) => ({ submissionStatus: result?.submissionStatus || null }),
        );
        await measureProfileStage('ingest_cache_invalidation', async () => {
          invalidateProjectBenchmarkQueryCache({
            projectId: persisted?.projectId || null,
            projectKey: normalized?.project?.key || null,
          });
        });
        recordIngestOutcome('ok', {
          durationMs: performance.now() - startedAt,
          payloadBytes,
          heapDeltaBytes: process.memoryUsage().heapUsed - heapStartedAt,
        });
        return persisted;
      } catch (error) {
        recordIngestOutcome('error', {
          durationMs: performance.now() - startedAt,
          payloadBytes,
          heapDeltaBytes: process.memoryUsage().heapUsed - heapStartedAt,
        });
        throw error;
      }
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
    ProjectOverview,
    ProjectPackage,
    ProjectVersion,
    ReportSubmission,
    Run,
    RunActiveSubmission,
    RunOverview,
    SuiteRun,
    TestExecution,
  };

  return {
    async persistRun(normalized, context = {}) {
      return measureProfileStage('ingest_transaction', () => database.transaction(async (transaction) => {
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

        const runWhere = {
          projectId: projectRecord.id,
          externalKey: normalized.run.externalKey,
        };
        const existingRun = await models.Run.findOne({ where: runWhere, transaction });
        const { record: runRecord, created } = await upsertRecordWithState(
          models.Run,
          runWhere,
          buildRunValues({
            existingRun,
            normalized,
            projectId: projectRecord.id,
            projectVersionId: projectVersionRecord?.id || null,
          }),
          { transaction },
        );

        if (database?.getDialect?.() === 'postgres' && typeof database.query === 'function') {
          await database.query(
            'SELECT pg_advisory_xact_lock(hashtext(:projectIdentity)), pg_advisory_xact_lock(hashtext(:runIdentity))',
            {
              replacements: {
                projectIdentity: `project:${projectRecord.id}`,
                runIdentity: `run:${runRecord.id}`,
              },
              transaction,
            },
          );
        }

        const submissionState = models.ReportSubmission
          ? await createSubmissionRevision(models.ReportSubmission, runRecord, normalized.submission, { transaction, database })
          : null;
        if (submissionState?.deduplicated) {
          if (models.RunActiveSubmission) {
            await selectActiveSubmissions(models.RunActiveSubmission, {
              runId: runRecord.id,
              reportSubmissionId: submissionState.record.id,
              kinds: normalized.submission.metadata?.factKinds || [normalized.submission.kind],
              selectedAt: normalized.submission.receivedAt,
            }, { database, transaction });
          }
          return createIngestReceipt({
            projectRecord,
            projectVersionRecord,
            runRecord,
            normalized,
            created,
            submissionState,
          });
        }
        const reportSubmissionId = submissionState?.record?.id || null;
        if (!models.ReportSubmission) {
          await clearExistingRunFacts(models, runRecord.id, { transaction });
        }

        const suiteRecords = new Map();
        for (const suiteEntry of normalized.suites) {
          const packageRecord = suiteEntry.packageName ? packageRecords.get(suiteEntry.packageName) || null : null;
          const suiteRecord = await models.SuiteRun.create({
            runId: runRecord.id,
            reportSubmissionId,
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
            reportSubmissionId,
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
          await models.CoverageTrendPoint.create({ ...trendPoint, reportSubmissionId }, { transaction });
        }

        for (const errorEntry of normalized.errors) {
          await models.ErrorOccurrence.create({
            runId: runRecord.id,
            reportSubmissionId,
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
            reportSubmissionId,
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
            reportSubmissionId,
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

        if (submissionState?.record && models.RunActiveSubmission) {
          await selectActiveSubmissions(models.RunActiveSubmission, {
            runId: runRecord.id,
            reportSubmissionId: submissionState.record.id,
            kinds: normalized.submission.metadata?.factKinds || [normalized.submission.kind],
            selectedAt: normalized.submission.receivedAt,
          }, { database, transaction });
        }

        if (models.RunOverview && models.ProjectOverview) {
          await measureProfileStage('ingest_projection', () => updateReadProjections(models, {
            projectRecord,
            projectVersionRecord,
            runRecord,
            normalized,
            created,
          }, { transaction }));
        }

        return createIngestReceipt({
          projectRecord,
          projectVersionRecord,
          runRecord,
          normalized,
          created,
          submissionState,
        });
      }));
    },
  };
}

function buildRunValues({ existingRun, normalized, projectId, projectVersionId }) {
  const submissionKind = normalized.submission?.kind || 'combined';
  const preservePrimaryReport = existingRun && ['coverage', 'performance'].includes(submissionKind);
  const existingSummary = existingRun?.summary || {};
  const incomingSummary = normalized.run.summary || {};
  const summary = submissionKind === 'coverage' && existingRun
    ? { ...existingSummary, coverage: incomingSummary.coverage || existingSummary.coverage || null }
    : preservePrimaryReport
      ? existingSummary
      : incomingSummary;
  const runValues = { ...normalized.run };
  delete runValues.rawReport;
  delete runValues.reportSchemaVersion;

  return {
    projectId,
    projectVersionId,
    ...runValues,
    status: preservePrimaryReport ? existingRun.status : normalized.run.status,
    summary,
    metadata: {
      ...(existingRun?.metadata || {}),
      ...(normalized.run.metadata || {}),
    },
  };
}

async function createSubmissionRevision(model, runRecord, submission, options = {}) {
  const identity = {
    runId: runRecord.id,
    kind: submission.kind,
    producerKey: submission.producerKey,
    submissionKey: submission.submissionKey,
  };
  if (options.database?.getDialect?.() === 'postgres' && typeof options.database.query === 'function') {
    await options.database.query(
      'SELECT pg_advisory_xact_lock(hashtext(:submissionIdentity))',
      {
        replacements: { submissionIdentity: Object.values(identity).join(':') },
        transaction: options.transaction,
      },
    );
  }
  const duplicate = await model.findOne({
    where: { ...identity, contentHash: submission.contentHash, status: 'active' },
    transaction: options.transaction,
  });
  if (duplicate) {
    return { record: duplicate, deduplicated: true, revised: false };
  }

  const revisions = await model.findAll({
    where: identity,
    order: [['revision', 'DESC']],
    transaction: options.transaction,
  });
  const revision = Math.max(0, ...revisions.map((entry) => Number(entry.revision) || 0)) + 1;
  for (const previous of revisions.filter((entry) => entry.status === 'active')) {
    await previous.update({ status: 'superseded' }, { transaction: options.transaction });
  }
  const record = await model.create({
    runId: runRecord.id,
    ...submission,
    revision,
    status: 'active',
  }, { transaction: options.transaction });
  return { record, deduplicated: false, revised: revision > 1 };
}

function createIngestReceipt({ projectRecord, projectVersionRecord, runRecord, normalized, created, submissionState }) {
  return {
    projectId: projectRecord.id,
    projectVersionId: projectVersionRecord?.id || null,
    runId: runRecord.id,
    externalKey: normalized.run.externalKey,
    created,
    submissionId: submissionState?.record?.id || null,
    submissionKind: normalized.submission?.kind || 'combined',
    submissionStatus: submissionState?.deduplicated ? 'deduplicated' : submissionState?.revised ? 'revised' : 'created',
    contentHash: normalized.submission?.contentHash || null,
    revision: submissionState?.record?.revision || 1,
    counts: normalized.counts,
  };
}

async function selectActiveSubmissions(model, selection, options = {}) {
  const kinds = Array.from(new Set((selection.kinds || []).filter((kind) => ['tests', 'coverage', 'performance'].includes(kind))));
  for (const kind of kinds) {
    if (options.database?.getDialect?.() === 'postgres' && typeof options.database.query === 'function') {
      await options.database.query(`
        INSERT INTO run_active_submissions (
          id, run_id, kind, report_submission_id, selected_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), :runId, :kind, :reportSubmissionId, :selectedAt, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (run_id, kind) DO UPDATE SET
          report_submission_id = EXCLUDED.report_submission_id,
          selected_at = EXCLUDED.selected_at,
          updated_at = CURRENT_TIMESTAMP
      `, {
        replacements: {
          runId: selection.runId,
          kind,
          reportSubmissionId: selection.reportSubmissionId,
          selectedAt: selection.selectedAt,
        },
        transaction: options.transaction,
      });
      continue;
    }

    const existing = typeof model.findOne === 'function'
      ? await model.findOne({ where: { runId: selection.runId, kind }, transaction: options.transaction })
      : null;
    if (existing?.update) {
      await existing.update({
        reportSubmissionId: selection.reportSubmissionId,
        selectedAt: selection.selectedAt,
      }, { transaction: options.transaction });
    } else if (typeof model.create === 'function') {
      await model.create({
        runId: selection.runId,
        kind,
        reportSubmissionId: selection.reportSubmissionId,
        selectedAt: selection.selectedAt,
      }, { transaction: options.transaction });
    }
  }
}

async function updateReadProjections(models, input, options = {}) {
  const factKinds = new Set(input.normalized.submission?.metadata?.factKinds || []);
  const existing = await models.RunOverview.findOne({
    where: { runId: input.runRecord.id },
    transaction: options.transaction,
  });
  const current = existing?.toJSON ? existing.toJSON() : existing || {};
  const summary = input.normalized.run?.summary || {};
  const artifacts = Array.isArray(input.normalized.artifacts) ? input.normalized.artifacts : [];
  const values = {
    ...current,
    runId: input.runRecord.id,
    projectId: input.projectRecord.id,
    projectVersionId: input.projectVersionRecord?.id || input.runRecord.projectVersionId || null,
    externalKey: input.runRecord.externalKey,
    branch: input.runRecord.branch || null,
    commitSha: input.runRecord.commitSha || null,
    sourceRunId: input.runRecord.sourceRunId || null,
    sourceUrl: input.runRecord.sourceUrl || null,
    completedAt: input.runRecord.completedAt || null,
    durationMs: input.runRecord.durationMs || null,
    buildNumber: resolveProjectionBuildNumber(input.normalized, input.projectVersionRecord),
    projectedAt: new Date(),
    ...(factKinds.has('tests') ? {
      status: input.normalized.run.status,
      totalTests: integerOrZero(summary.totalTests ?? summary.total),
      passedTests: integerOrZero(summary.passedTests ?? summary.passed),
      failedTests: integerOrZero(summary.failedTests ?? summary.failed),
      skippedTests: integerOrZero(summary.skippedTests ?? summary.skipped),
    } : {}),
    ...(factKinds.has('coverage') ? {
      linesPct: finiteNumber(input.normalized.coverageSnapshot?.linesPct),
    } : {}),
    ...(artifacts.length > 0 ? {
      hasReportArtifact: Boolean(current.hasReportArtifact || artifacts.some((artifact) => (
        artifact.relativePath === 'index.html' || String(artifact.relativePath || '').endsWith('/index.html')
      ))),
    } : {}),
  };

  if (existing?.update) {
    await existing.update(values, { transaction: options.transaction });
  } else {
    await models.RunOverview.create(values, { transaction: options.transaction });
  }
  recordProjectionLag(Math.max(0, Date.now() - values.projectedAt.getTime()));
  const legacySummary = input.runRecord.summary || {};
  const parityMatches = !factKinds.has('tests') || (
    integerOrZero(legacySummary.totalTests ?? legacySummary.total) === integerOrZero(values.totalTests)
    && integerOrZero(legacySummary.passedTests ?? legacySummary.passed) === integerOrZero(values.passedTests)
    && integerOrZero(legacySummary.failedTests ?? legacySummary.failed) === integerOrZero(values.failedTests)
  );
  incrementRuntimeMetric('test_station_projection_parity_total', { outcome: parityMatches ? 'match' : 'mismatch' });

  const runCount = typeof models.RunOverview.count === 'function'
    ? await models.RunOverview.count({ where: { projectId: input.projectRecord.id }, transaction: options.transaction })
    : null;
  const latest = typeof models.RunOverview.findOne === 'function'
    ? await models.RunOverview.findOne({
      where: { projectId: input.projectRecord.id, completedAt: { [Op.ne]: null } },
      order: [['completedAt', 'DESC'], ['runId', 'DESC']],
      transaction: options.transaction,
    })
    : null;
  const latestValues = latest?.toJSON ? latest.toJSON() : latest || values;
  const projectOverview = await models.ProjectOverview.findOne({
    where: { projectId: input.projectRecord.id },
    transaction: options.transaction,
  });
  const projectValues = {
    projectId: input.projectRecord.id,
    runCount: Number.isFinite(runCount)
      ? runCount
      : Math.max(1, integerOrZero(projectOverview?.runCount) + (input.created ? 1 : 0)),
    latestRunId: latestValues.runId || input.runRecord.id,
    latestStatus: latestValues.status || null,
    latestCompletedAt: latestValues.completedAt || null,
    latestLinesPct: finiteNumber(latestValues.linesPct),
    totalTests: integerOrZero(latestValues.totalTests),
    passedTests: integerOrZero(latestValues.passedTests),
    failedTests: integerOrZero(latestValues.failedTests),
    projectedAt: new Date(),
  };
  if (projectOverview?.update) {
    await projectOverview.update(projectValues, { transaction: options.transaction });
  } else {
    await models.ProjectOverview.create(projectValues, { transaction: options.transaction });
  }
}

function resolveProjectionBuildNumber(normalized, projectVersionRecord) {
  const candidates = [
    projectVersionRecord?.buildNumber,
    normalized?.run?.metadata?.source?.buildNumber,
    normalized?.run?.metadata?.source?.environment?.GITHUB_RUN_NUMBER,
    normalized?.run?.metadata?.source?.ci?.environment?.GITHUB_RUN_NUMBER,
  ];
  for (const candidate of candidates) {
    const parsed = Number.parseInt(candidate, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function integerOrZero(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  if (typeof model.findOrCreate === 'function' && model.sequelize?.getDialect?.() === 'postgres') {
    const [record, created] = await model.findOrCreate({
      where,
      defaults: values,
      transaction: options.transaction,
    });
    if (!created) await record.update(values, { transaction: options.transaction });
    return { record, created };
  }
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
