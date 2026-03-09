import {
  Artifact,
  CoverageFile,
  CoverageSnapshot,
  CoverageTrendPoint,
  Project,
  ProjectFile,
  ProjectModule,
  ProjectPackage,
  ProjectVersion,
  ReleaseNote,
  Run,
  SuiteRun,
  TestExecution,
} from '../models/index.js';
import { hasProjectAccess, isAdminActor } from './guards.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function createGraphqlQueryService(options = {}) {
  const models = options.models || {
    Artifact,
    CoverageFile,
    CoverageSnapshot,
    CoverageTrendPoint,
    Project,
    ProjectFile,
    ProjectModule,
    ProjectPackage,
    ProjectVersion,
    ReleaseNote,
    Run,
    SuiteRun,
    TestExecution,
  };

  return {
    async listProjects({ actor }) {
      const projects = await loadAll(models.Project);
      return filterProjectsForActor(projects, actor).sort(compareByName);
    },

    async findProject({ id, key, slug, actor }) {
      const projects = await this.listProjects({ actor });
      return projects.find((project) => (
        (id && project.id === id)
        || (key && project.key === key)
        || (slug && project.slug === slug)
      )) || null;
    },

    async listRuns({ actor, projectId = null, projectKey = null, status = null, limit = DEFAULT_LIMIT }) {
      const projects = await this.listProjects({ actor });
      const projectMap = mapBy(projects, 'id');
      let runs = await loadAll(models.Run);

      runs = runs.filter((run) => projectMap.has(run.projectId));
      if (projectId) {
        runs = runs.filter((run) => run.projectId === projectId);
      }
      if (projectKey) {
        runs = runs.filter((run) => projectMap.get(run.projectId)?.key === projectKey);
      }
      if (status) {
        runs = runs.filter((run) => run.status === status);
      }

      const versionMap = mapBy(await loadAll(models.ProjectVersion), 'id');
      const coverageSnapshotMap = mapBy(await loadAll(models.CoverageSnapshot), 'runId');

      return runs
        .map((run) => decorateRun(run, {
          project: projectMap.get(run.projectId) || null,
          projectVersion: versionMap.get(run.projectVersionId) || null,
          coverageSnapshot: coverageSnapshotMap.get(run.id) || null,
        }))
        .sort(compareRunsNewestFirst)
        .slice(0, normalizeLimit(limit));
    },

    async findRun({ id = null, externalKey = null, actor }) {
      const projects = await this.listProjects({ actor });
      const projectMap = mapBy(projects, 'id');
      const runs = await loadAll(models.Run);
      const run = runs.find((candidate) => (
        projectMap.has(candidate.projectId)
        && ((id && candidate.id === id) || (externalKey && candidate.externalKey === externalKey))
      )) || null;

      if (!run) {
        return null;
      }

      const versionMap = mapBy(await loadAll(models.ProjectVersion), 'id');
      const coverageSnapshotMap = mapBy(await loadAll(models.CoverageSnapshot), 'runId');

      return decorateRun(run, {
        project: projectMap.get(run.projectId) || null,
        projectVersion: versionMap.get(run.projectVersionId) || null,
        coverageSnapshot: coverageSnapshotMap.get(run.id) || null,
      });
    },

    async listSuitesForRun({ runId, actor }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      const suites = await loadAll(models.SuiteRun);
      return suites
        .filter((suite) => suite.runId === runId)
        .sort(compareSuites)
        .map((suite) => ({
          ...suite,
          artifacts: [],
        }));
    },

    async getCoverageSnapshotForRun({ runId, actor }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return null;
      }

      const snapshots = await loadAll(models.CoverageSnapshot);
      return snapshots.find((snapshot) => snapshot.runId === runId) || null;
    },

    async listTestsForRun({ runId, actor, status = null, packageName = null, moduleName = null, filePath = null }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      const suites = await this.listSuitesForRun({ runId, actor });
      const suiteMap = mapBy(suites, 'id');
      const tests = await loadAll(models.TestExecution);

      return tests
        .filter((test) => suiteMap.has(test.suiteRunId))
        .map((test) => decorateTestExecution(test, suiteMap.get(test.suiteRunId)))
        .filter((test) => filterDecoratedTest(test, { status, packageName, moduleName, filePath }))
        .sort(compareTests);
    },

    async listTestsForSuiteRun({ suiteRunId, actor }) {
      const suites = await loadAll(models.SuiteRun);
      const suite = suites.find((candidate) => candidate.id === suiteRunId) || null;
      if (!suite) {
        return [];
      }

      const run = await this.findRun({ id: suite.runId, actor });
      if (!run) {
        return [];
      }

      const tests = await loadAll(models.TestExecution);
      return tests
        .filter((test) => test.suiteRunId === suiteRunId)
        .map((test) => decorateTestExecution(test, suite))
        .sort(compareTests);
    },

    async listArtifacts({ actor, runId = null, suiteRunId = null, testExecutionId = null }) {
      if (!runId && !suiteRunId && !testExecutionId) {
        return [];
      }

      const artifacts = await loadAll(models.Artifact);
      let filtered = artifacts.filter((artifact) => (
        (runId ? artifact.runId === runId : true)
        && (suiteRunId ? artifact.suiteRunId === suiteRunId : true)
        && (testExecutionId ? artifact.testExecutionId === testExecutionId : true)
      ));

      const projects = await this.listProjects({ actor });
      const projectIds = new Set(projects.map((project) => project.id));
      const runs = await loadAll(models.Run);
      const runMap = mapBy(runs.filter((run) => projectIds.has(run.projectId)), 'id');

      filtered = filtered.filter((artifact) => runMap.has(artifact.runId));
      return filtered.sort(compareArtifacts);
    },

    async listReleaseNotes({ actor, projectId = null, projectKey = null, versionId = null, versionKey = null }) {
      const projects = await this.listProjects({ actor });
      const projectMap = mapBy(projects, 'id');
      const versions = await loadAll(models.ProjectVersion);
      const versionMap = mapBy(versions, 'id');
      const notes = await loadAll(models.ReleaseNote);

      return notes
        .filter((note) => projectMap.has(note.projectId))
        .filter((note) => (projectId ? note.projectId === projectId : true))
        .filter((note) => (projectKey ? projectMap.get(note.projectId)?.key === projectKey : true))
        .filter((note) => (versionId ? note.projectVersionId === versionId : true))
        .filter((note) => (versionKey ? versionMap.get(note.projectVersionId)?.versionKey === versionKey : true))
        .map((note) => ({
          ...note,
          project: projectMap.get(note.projectId) || null,
          projectVersion: versionMap.get(note.projectVersionId) || null,
        }))
        .sort(compareReleaseNotesNewestFirst);
    },

    async listRunPackages({ runId, actor }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      return (Array.isArray(run.rawReport?.packages) ? run.rawReport.packages : []).map((entry) => ({
        name: entry.name,
        location: entry.location || null,
        status: entry.status || 'unknown',
        durationMs: toInteger(entry.durationMs),
        summary: entry.summary || {},
        coverage: entry.coverage || null,
        modules: Array.isArray(entry.modules) ? entry.modules : [],
        frameworks: Array.isArray(entry.frameworks) ? entry.frameworks : [],
        suiteCount: Array.isArray(entry.suites) ? entry.suites.length : 0,
      }));
    },

    async listRunModules({ runId, actor }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      return (Array.isArray(run.rawReport?.modules) ? run.rawReport.modules : []).map((entry) => ({
        module: entry.module,
        owner: entry.owner || null,
        summary: entry.summary || {},
        durationMs: toInteger(entry.durationMs),
        packageCount: toInteger(entry.packageCount) ?? 0,
        packages: Array.isArray(entry.packages) ? entry.packages : [],
        frameworks: Array.isArray(entry.frameworks) ? entry.frameworks : [],
        dominantPackages: Array.isArray(entry.dominantPackages) ? entry.dominantPackages : [],
        coverage: entry.coverage || null,
        themes: Array.isArray(entry.themes) ? entry.themes : [],
      }));
    },

    async listRunFiles({ runId, actor, packageName = null, moduleName = null, status = null }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      const suites = await this.listSuitesForRun({ runId, actor });
      const suiteMap = mapBy(suites, 'id');
      const tests = await loadAll(models.TestExecution);
      const coverageSnapshot = await this.getCoverageSnapshotForRun({ runId, actor });
      const coverageFiles = await loadAll(models.CoverageFile);
      const packages = mapBy(await loadAll(models.ProjectPackage), 'id');
      const modules = mapBy(await loadAll(models.ProjectModule), 'id');
      const projectFiles = mapBy(await loadAll(models.ProjectFile), 'id');

      const files = new Map();

      for (const test of tests.filter((entry) => suiteMap.has(entry.suiteRunId) && entry.filePath)) {
        const suite = suiteMap.get(test.suiteRunId);
        const file = ensureRunFile(files, test.filePath);
        file.packageName ||= suite.packageName || null;
        file.moduleName ||= test.moduleName || null;
        file.language ||= detectLanguage(test.filePath);
        file.tests.push(decorateTestExecution(test, suite));
      }

      for (const coverageFile of coverageFiles.filter((entry) => entry.coverageSnapshotId === coverageSnapshot?.id)) {
        const projectFile = projectFiles.get(coverageFile.projectFileId) || null;
        const packageRecord = packages.get(coverageFile.projectPackageId) || null;
        const moduleRecord = modules.get(coverageFile.projectModuleId) || null;
        const filePath = coverageFile.path || projectFile?.path;
        if (!filePath) {
          continue;
        }

        const file = ensureRunFile(files, filePath);
        file.packageName ||= packageRecord?.name || null;
        file.moduleName ||= moduleRecord?.name || null;
        file.language ||= projectFile?.language || detectLanguage(filePath);
        file.coverage = normalizeCoverageFile(coverageFile);
      }

      return Array.from(files.values())
        .map((file) => finalizeRunFile(file))
        .filter((file) => (packageName ? file.packageName === packageName : true))
        .filter((file) => (moduleName ? file.moduleName === moduleName : true))
        .filter((file) => (status ? file.status === status : true))
        .sort((left, right) => left.path.localeCompare(right.path));
    },

    async listCoverageTrend({ actor, projectId = null, projectKey = null, packageName = null, moduleName = null, filePath = null, limit = DEFAULT_LIMIT }) {
      const projects = await this.listProjects({ actor });
      const projectMap = mapBy(projects, 'id');
      const runs = mapBy(await loadAll(models.Run), 'id');
      const versions = mapBy(await loadAll(models.ProjectVersion), 'id');
      const scopeType = resolveCoverageTrendScope({ packageName, moduleName, filePath });
      const points = await loadAll(models.CoverageTrendPoint);

      return points
        .filter((point) => projectMap.has(point.projectId))
        .filter((point) => (projectId ? point.projectId === projectId : true))
        .filter((point) => (projectKey ? projectMap.get(point.projectId)?.key === projectKey : true))
        .filter((point) => point.scopeType === scopeType)
        .filter((point) => (packageName ? point.packageName === packageName : true))
        .filter((point) => (moduleName ? point.moduleName === moduleName : true))
        .filter((point) => (filePath ? point.filePath === filePath : true))
        .map((point) => decorateCoverageTrendPoint(point, {
          run: runs.get(point.runId) || null,
          projectVersion: versions.get(point.projectVersionId) || versions.get(runs.get(point.runId)?.projectVersionId) || null,
        }))
        .sort(compareCoveragePointsNewestFirst)
        .slice(0, normalizeLimit(limit));
    },

    async getRunCoverageComparison({ actor, runId }) {
      const currentRun = await this.findRun({ id: runId, actor });
      if (!currentRun) {
        return null;
      }

      const projectRuns = await this.listRuns({
        actor,
        projectId: currentRun.projectId,
        limit: MAX_LIMIT,
      });
      const currentIndex = projectRuns.findIndex((run) => run.id === currentRun.id);
      const previousRun = currentIndex >= 0 ? projectRuns[currentIndex + 1] || null : null;
      const points = await loadAll(models.CoverageTrendPoint);
      const currentPoints = points.filter((point) => point.runId === currentRun.id);
      const previousPoints = previousRun ? points.filter((point) => point.runId === previousRun.id) : [];
      const currentProjectPoint = currentPoints.find((point) => point.scopeType === 'project') || null;
      const previousProjectPoint = previousPoints.find((point) => point.scopeType === 'project') || null;

      return {
        runId: currentRun.id,
        previousRunId: previousRun?.id || null,
        currentExternalKey: currentRun.externalKey,
        previousExternalKey: previousRun?.externalKey || null,
        currentVersionKey: currentRun.projectVersion?.versionKey || null,
        previousVersionKey: previousRun?.projectVersion?.versionKey || null,
        currentLinesPct: currentProjectPoint?.linesPct ?? null,
        previousLinesPct: previousProjectPoint?.linesPct ?? null,
        deltaLinesPct: diffMetric(currentProjectPoint?.linesPct, previousProjectPoint?.linesPct),
        packageChanges: buildCoverageChanges(currentPoints, previousPoints, 'package'),
        moduleChanges: buildCoverageChanges(currentPoints, previousPoints, 'module'),
        fileChanges: buildCoverageChanges(currentPoints, previousPoints, 'file'),
      };
    },
  };
}

function filterProjectsForActor(projects, actor) {
  if (isAdminActor(actor)) {
    return [...projects];
  }

  return projects.filter((project) => hasProjectAccess(actor, project.key));
}

function decorateRun(run, related) {
  return {
    ...run,
    project: related.project,
    projectVersion: related.projectVersion,
    coverageSnapshot: related.coverageSnapshot,
  };
}

function decorateTestExecution(test, suite) {
  return {
    ...test,
    suiteIdentifier: suite?.suiteIdentifier || null,
    suiteLabel: suite?.label || null,
    packageName: suite?.packageName || null,
  };
}

function decorateCoverageTrendPoint(point, related) {
  return {
    ...point,
    externalKey: related.run?.externalKey || null,
    completedAt: related.run?.completedAt || point.recordedAt || null,
    startedAt: related.run?.startedAt || null,
    branch: related.run?.branch || null,
    versionKey: related.projectVersion?.versionKey || null,
  };
}

function filterDecoratedTest(test, filters) {
  return (!filters.status || test.status === filters.status)
    && (!filters.packageName || test.packageName === filters.packageName)
    && (!filters.moduleName || test.moduleName === filters.moduleName)
    && (!filters.filePath || test.filePath === filters.filePath);
}

function ensureRunFile(files, filePath) {
  if (!files.has(filePath)) {
    files.set(filePath, {
      path: filePath,
      packageName: null,
      moduleName: null,
      language: null,
      tests: [],
      coverage: null,
    });
  }

  return files.get(filePath);
}

function finalizeRunFile(file) {
  const failedTestCount = file.tests.filter((test) => test.status === 'failed').length;
  const status = failedTestCount > 0
    ? 'failed'
    : file.tests.length > 0
      ? 'passed'
      : file.coverage
        ? 'covered'
        : 'unknown';

  return {
    ...file,
    status,
    testCount: file.tests.length,
    failedTestCount,
    tests: file.tests.sort(compareTests),
  };
}

function normalizeCoverageFile(coverageFile) {
  return {
    linesCovered: toInteger(coverageFile.linesCovered),
    linesTotal: toInteger(coverageFile.linesTotal),
    linesPct: toNumber(coverageFile.linesPct),
    branchesCovered: toInteger(coverageFile.branchesCovered),
    branchesTotal: toInteger(coverageFile.branchesTotal),
    branchesPct: toNumber(coverageFile.branchesPct),
    functionsCovered: toInteger(coverageFile.functionsCovered),
    functionsTotal: toInteger(coverageFile.functionsTotal),
    functionsPct: toNumber(coverageFile.functionsPct),
    statementsCovered: toInteger(coverageFile.statementsCovered),
    statementsTotal: toInteger(coverageFile.statementsTotal),
    statementsPct: toNumber(coverageFile.statementsPct),
    shared: Boolean(coverageFile.shared),
    attributionSource: coverageFile.attributionSource || null,
    attributionReason: coverageFile.attributionReason || null,
    attributionWeight: toNumber(coverageFile.attributionWeight),
    metadata: coverageFile.metadata || {},
  };
}

async function loadAll(model) {
  if (!model || typeof model.findAll !== 'function') {
    return [];
  }

  const rows = await model.findAll();
  return rows.map((row) => toPlainRecord(row));
}

function toPlainRecord(row) {
  if (!row) {
    return null;
  }
  if (typeof row.toJSON === 'function') {
    return row.toJSON();
  }

  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => typeof value !== 'function'),
  );
}

function mapBy(values, key) {
  const map = new Map();
  for (const value of values || []) {
    if (value && value[key] != null) {
      map.set(value[key], value);
    }
  }
  return map;
}

function normalizeLimit(value) {
  const parsed = toInteger(value);
  if (!parsed || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function resolveCoverageTrendScope({ packageName, moduleName, filePath }) {
  if (filePath) {
    return 'file';
  }
  if (moduleName) {
    return 'module';
  }
  if (packageName) {
    return 'package';
  }
  return 'project';
}

function buildCoverageChanges(currentPoints, previousPoints, scopeType) {
  const currentScopePoints = currentPoints.filter((point) => point.scopeType === scopeType);
  const previousScopeMap = new Map(
    previousPoints
      .filter((point) => point.scopeType === scopeType)
      .map((point) => [point.scopeKey, point]),
  );

  return currentScopePoints
    .map((point) => {
      const previous = previousScopeMap.get(point.scopeKey) || null;
      return {
        scopeType,
        label: point.label,
        packageName: point.packageName || null,
        moduleName: point.moduleName || null,
        filePath: point.filePath || null,
        currentLinesPct: point.linesPct ?? null,
        previousLinesPct: previous?.linesPct ?? null,
        deltaLinesPct: diffMetric(point.linesPct, previous?.linesPct),
      };
    })
    .sort(compareCoverageChanges)
    .slice(0, 6);
}

function diffMetric(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  return Number((current - previous).toFixed(2));
}

function toInteger(value) {
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function toNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function detectLanguage(filePath) {
  const match = /\.([a-z0-9]+)$/i.exec(filePath || '');
  return match ? match[1].toLowerCase() : null;
}

function compareByName(left, right) {
  return left.name.localeCompare(right.name);
}

function compareRunsNewestFirst(left, right) {
  return compareIsoDates(right.completedAt || right.startedAt, left.completedAt || left.startedAt)
    || left.externalKey.localeCompare(right.externalKey);
}

function compareCoveragePointsNewestFirst(left, right) {
  return compareIsoDates(right.completedAt || right.recordedAt || right.startedAt, left.completedAt || left.recordedAt || left.startedAt)
    || String(left.externalKey || left.runId).localeCompare(String(right.externalKey || right.runId));
}

function compareCoverageChanges(left, right) {
  const leftDelta = Math.abs(toNumber(left.deltaLinesPct) ?? -1);
  const rightDelta = Math.abs(toNumber(right.deltaLinesPct) ?? -1);
  if (leftDelta !== rightDelta) {
    return rightDelta - leftDelta;
  }
  return left.label.localeCompare(right.label);
}

function compareSuites(left, right) {
  return left.label.localeCompare(right.label);
}

function compareTests(left, right) {
  if (left.status !== right.status) {
    return left.status === 'failed' ? -1 : 1;
  }
  return left.fullName.localeCompare(right.fullName);
}

function compareArtifacts(left, right) {
  return (left.label || left.relativePath || '').localeCompare(right.label || right.relativePath || '');
}

function compareReleaseNotesNewestFirst(left, right) {
  return compareIsoDates(right.publishedAt, left.publishedAt) || left.title.localeCompare(right.title);
}

function compareIsoDates(left, right) {
  const leftValue = left ? new Date(left).valueOf() : 0;
  const rightValue = right ? new Date(right).valueOf() : 0;
  return leftValue - rightValue;
}
