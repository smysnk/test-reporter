#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import sequelize, { dbReady } from '../packages/server/db.js';
import { createIngestionService } from '../packages/server/ingest/index.js';
import { Artifact, Project, ProjectVersion, Run } from '../packages/server/models/index.js';

export function parseRegenerateStoredReportsArgs(argv) {
  const parsed = {
    projectKey: null,
    runId: null,
    limit: null,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    switch (token) {
      case '--project-key':
        parsed.projectKey = value || null;
        index += 1;
        break;
      case '--run-id':
        parsed.runId = value || null;
        index += 1;
        break;
      case '--limit':
        parsed.limit = Number.parseInt(value, 10);
        index += 1;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (parsed.limit !== null && (!Number.isInteger(parsed.limit) || parsed.limit <= 0)) {
    throw new Error('--limit must be a positive integer.');
  }

  return parsed;
}

export function hasReplayableRawReport(run) {
  return Boolean(run?.rawReport && typeof run.rawReport === 'object' && Object.keys(run.rawReport).length > 0);
}

export function buildReplayPayload({ project, run, artifacts = [] }) {
  const projectKey = typeof project?.key === 'string' ? project.key.trim() : '';
  if (!projectKey) {
    throw new Error(`Run ${run?.id || 'unknown'} is missing a project key.`);
  }

  if (!hasReplayableRawReport(run)) {
    throw new Error(`Run ${run?.id || 'unknown'} does not have a replayable raw report.`);
  }

  const sourceMetadata = sanitizeReplaySource(run?.metadata?.source);
  const replayEnvironment = resolveReplayEnvironment({ sourceMetadata, rawReport: run?.rawReport });
  const replayCi = buildReplayCi({ sourceMetadata, rawReport: run?.rawReport, environment: replayEnvironment });

  return {
    projectKey,
    report: run.rawReport,
    source: {
      provider: sourceMetadata.provider || normalizeString(run?.sourceProvider),
      runId: sourceMetadata.runId || normalizeString(run?.sourceRunId),
      runUrl: sourceMetadata.runUrl || normalizeString(run?.sourceUrl),
      actor: sourceMetadata.actor || normalizeString(replayEnvironment.GITHUB_ACTOR),
      repository: sourceMetadata.repository || normalizeString(replayEnvironment.GITHUB_REPOSITORY),
      repositoryUrl: sourceMetadata.repositoryUrl || normalizeString(project?.repositoryUrl) || deriveRepositoryUrlFromEnvironment(replayEnvironment),
      defaultBranch: sourceMetadata.defaultBranch || normalizeString(project?.defaultBranch),
      projectName: sourceMetadata.projectName || normalizeString(project?.name),
      branch: sourceMetadata.branch || normalizeString(run?.branch),
      tag: sourceMetadata.tag,
      commitSha: sourceMetadata.commitSha || normalizeString(run?.commitSha),
      startedAt: sourceMetadata.startedAt || normalizeDate(run?.startedAt) || normalizeString(run?.rawReport?.generatedAt),
      completedAt: sourceMetadata.completedAt || normalizeDate(run?.completedAt) || normalizeString(run?.rawReport?.generatedAt),
      buildNumber: sourceMetadata.buildNumber ?? normalizeInteger(run?.projectVersion?.buildNumber) ?? deriveBuildNumberFromEnvironment(replayEnvironment),
      semanticVersion: sourceMetadata.semanticVersion,
      releaseName: sourceMetadata.releaseName,
      versionKey: sourceMetadata.versionKey,
      releasedAt: sourceMetadata.releasedAt,
      ci: replayCi,
      metadata: sourceMetadata.metadata || {},
    },
    artifacts: buildRunArtifactReplayPayloads(artifacts),
  };
}

export function buildRunArtifactReplayPayloads(artifacts = []) {
  return (Array.isArray(artifacts) ? artifacts : [])
    .filter((artifact) => artifact && !artifact.suiteRunId && !artifact.testExecutionId)
    .map((artifact) => ({
      label: normalizeString(artifact.label),
      relativePath: normalizeString(artifact.relativePath),
      href: normalizeString(artifact.href),
      kind: normalizeString(artifact.kind) || 'file',
      mediaType: normalizeString(artifact.mediaType),
      storageKey: normalizeString(artifact.storageKey),
      sourceUrl: normalizeString(artifact.sourceUrl),
    }));
}

async function main() {
  const args = parseRegenerateStoredReportsArgs(process.argv.slice(2));
  const startedAt = Date.now();
  process.stdout.write(`[reports:regenerate] starting ${args.dryRun ? 'dry-run' : 'replay'} (${formatFilterSummary(args)})\n`);
  process.stdout.write('[reports:regenerate] preparing database connection\n');
  await dbReady();
  process.stdout.write('[reports:regenerate] database ready\n');

  const ingestionService = createIngestionService({ sequelize });
  process.stdout.write('[reports:regenerate] loading stored run references...\n');
  const loadStartedAt = Date.now();
  const targetRefs = await loadReplayTargetRefs(args);
  process.stdout.write(`[reports:regenerate] loaded ${targetRefs.length} run reference(s) in ${formatElapsedMs(Date.now() - loadStartedAt)}\n`);

  if (targetRefs.length === 0) {
    process.stdout.write('[reports:regenerate] no matching runs found\n');
  }

  let replayed = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, targetRef] of targetRefs.entries()) {
    const progressPrefix = `[reports:regenerate] [${index + 1}/${targetRefs.length}]`;

    process.stdout.write(`${progressPrefix} loading ${targetRef.id}\n`);
    const runLoadStartedAt = Date.now();
    const run = await loadReplayTargetById(targetRef.id, args);
    process.stdout.write(`${progressPrefix} loaded ${targetRef.id} in ${formatElapsedMs(Date.now() - runLoadStartedAt)}\n`);

    if (!run) {
      skipped += 1;
      process.stdout.write(`${progressPrefix} skip ${targetRef.id}: run no longer exists\n`);
      continue;
    }

    const project = run.project || null;

    if (!hasReplayableRawReport(run)) {
      skipped += 1;
      process.stdout.write(`${progressPrefix} skip ${run.id} (${project?.key || 'unknown project'}): no raw report stored\n`);
      continue;
    }

    try {
      const payload = buildReplayPayload({
        project,
        run,
        artifacts: run.artifacts || [],
      });

      if (args.dryRun) {
        replayed += 1;
        process.stdout.write(`${progressPrefix} dry-run ${run.id} (${payload.projectKey})\n`);
        continue;
      }

      const result = await ingestionService.ingest(payload, {
        requestId: `reports-regenerate:${run.id}`,
      });
      replayed += 1;
      process.stdout.write(`${progressPrefix} replayed ${run.id} -> ${result.runId} (${payload.projectKey})\n`);
    } catch (error) {
      failed += 1;
      process.stderr.write(`${progressPrefix} failed ${run.id}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  process.stdout.write(`[reports:regenerate] summary replayed=${replayed} skipped=${skipped} failed=${failed} total=${targetRefs.length} elapsed=${formatElapsedMs(Date.now() - startedAt)}\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  await sequelize.close();
}

async function loadReplayTargetRefs({ projectKey = null, runId = null, limit = null } = {}) {
  const runs = await Run.findAll({
    where: {
      ...(runId ? { id: runId } : {}),
    },
    attributes: ['id', 'completedAt', 'startedAt', 'createdAt'],
    include: [
      {
        model: Project,
        as: 'project',
        required: true,
        ...(projectKey ? { where: { key: projectKey } } : {}),
      },
      {
        model: Artifact,
        as: 'artifacts',
        required: false,
      },
    ],
    order: [
      ['completedAt', 'ASC'],
      ['startedAt', 'ASC'],
      ['createdAt', 'ASC'],
    ],
    ...(limit ? { limit } : {}),
  });

  return runs.map((run) => ({
    id: run.id,
  }));
}

async function loadReplayTargetById(runId, { projectKey = null } = {}) {
  return Run.findOne({
    where: {
      id: runId,
    },
    include: [
      {
        model: Project,
        as: 'project',
        required: true,
        ...(projectKey ? { where: { key: projectKey } } : {}),
      },
      {
        model: ProjectVersion,
        as: 'projectVersion',
        required: false,
      },
      {
        model: Artifact,
        as: 'artifacts',
        required: false,
      },
    ],
  });
}

function sanitizeReplaySource(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return {
    provider: normalizeString(value.provider),
    runId: normalizeString(value.runId),
    runUrl: normalizeString(value.runUrl),
    actor: normalizeString(value.actor),
    repository: normalizeString(value.repository),
    repositoryUrl: normalizeString(value.repositoryUrl),
    defaultBranch: normalizeString(value.defaultBranch),
    projectName: normalizeString(value.projectName),
    branch: normalizeString(value.branch),
    tag: normalizeString(value.tag),
    commitSha: normalizeString(value.commitSha),
    startedAt: normalizeString(value.startedAt),
    completedAt: normalizeString(value.completedAt),
    buildNumber: normalizeInteger(value.buildNumber),
    semanticVersion: normalizeString(value.semanticVersion),
    releaseName: normalizeString(value.releaseName),
    versionKey: normalizeString(value.versionKey),
    releasedAt: normalizeString(value.releasedAt),
    ci: value?.ci && typeof value.ci === 'object' ? value.ci : {},
    environment: value?.ci?.environment && typeof value.ci.environment === 'object'
      ? value.ci.environment
      : {},
    metadata: value.metadata && typeof value.metadata === 'object' ? value.metadata : {},
  };
}

function resolveReplayEnvironment({ sourceMetadata = {}, rawReport = null } = {}) {
  if (hasObjectKeys(sourceMetadata?.ci?.environment)) {
    return sourceMetadata.ci.environment;
  }

  if (hasObjectKeys(sourceMetadata?.environment)) {
    return sourceMetadata.environment;
  }

  if (hasObjectKeys(rawReport?.meta?.ci?.environment)) {
    return rawReport.meta.ci.environment;
  }

  return {};
}

function buildReplayCi({ sourceMetadata = {}, rawReport = null, environment = {} } = {}) {
  const sourceCi = sourceMetadata?.ci && typeof sourceMetadata.ci === 'object'
    ? sourceMetadata.ci
    : {};
  const rawReportCi = rawReport?.meta?.ci && typeof rawReport.meta.ci === 'object'
    ? rawReport.meta.ci
    : {};

  return {
    ...rawReportCi,
    ...sourceCi,
    environment,
  };
}

function deriveBuildNumberFromEnvironment(environment = {}) {
  if (!environment || typeof environment !== 'object') {
    return null;
  }

  return normalizeInteger(environment.GITHUB_RUN_NUMBER);
}

function deriveRepositoryUrlFromEnvironment(environment = {}) {
  if (!environment || typeof environment !== 'object') {
    return null;
  }

  const repository = normalizeString(environment.GITHUB_REPOSITORY);
  const serverUrl = normalizeString(environment.GITHUB_SERVER_URL) || 'https://github.com';
  return repository ? `${serverUrl}/${repository}` : null;
}

function hasObjectKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function printUsage() {
  process.stdout.write([
    'Usage: regenerate-stored-reports [options]',
    '',
    'Options:',
    '  --project-key <project-key>  Only replay runs for one project',
    '  --run-id <run-id>            Only replay one stored run',
    '  --limit <count>              Only process the oldest <count> matching runs',
    '  --dry-run                    Show what would be replayed without writing',
  ].join('\n'));
  process.stdout.write('\n');
}

function formatFilterSummary({ projectKey = null, runId = null, limit = null } = {}) {
  const parts = [];
  if (projectKey) {
    parts.push(`project=${projectKey}`);
  }
  if (runId) {
    parts.push(`run=${runId}`);
  }
  if (limit) {
    parts.push(`limit=${limit}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'all runs';
}

function formatElapsedMs(value) {
  if (!Number.isFinite(value) || value < 1000) {
    return `${Math.max(0, Math.round(value || 0))}ms`;
  }

  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
