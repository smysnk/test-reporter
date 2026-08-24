import {
  Artifact,
  CoverageFile,
  CoverageSnapshot,
  CoverageTrendPoint,
  Group,
  PerformanceStat,
  Project,
  ProjectFile,
  ProjectGroupAccess,
  ProjectModule,
  ProjectOverview,
  ProjectPackage,
  ProjectRoleAccess,
  ProjectVersion,
  ReleaseNote,
  ReportSubmission,
  Role,
  Run,
  RunActiveSubmission,
  RunOverview,
  SuiteRun,
  TestExecution,
} from '../models/index.js';
import { Op } from 'sequelize';
import { createProjectAccessService } from './access-service.js';
import {
  classifyBenchmarkComparison,
  compareBenchmarkStatusRank,
  isBenchmarkRegressionStatus,
} from '../../core/src/benchmark-semantics.js';
import { getDefaultBenchmarkQueryCache } from '../benchmark-query-cache.js';
import {
  canUsePostgresBenchmarkRepository,
  listBoundedBenchmarkCatalog,
  listBoundedPerformanceTrends,
} from './repositories/benchmarkRepository.js';
import { recordCacheOutcome } from '../profiling/requestProfile.js';

const DEFAULT_LIMIT = 125;
const MAX_LIMIT = 1000;
const RUN_LIST_ATTRIBUTES = [
  'id',
  'projectId',
  'projectVersionId',
  'externalKey',
  'sourceProvider',
  'sourceRunId',
  'sourceUrl',
  'triggeredBy',
  'branch',
  'commitSha',
  'startedAt',
  'completedAt',
  'durationMs',
  'status',
  'reportSchemaVersion',
  'summary',
];
const BENCHMARK_RUN_ATTRIBUTES = [
  'id',
  'projectId',
  'projectVersionId',
  'externalKey',
  'branch',
  'startedAt',
  'completedAt',
];
const BENCHMARK_STAT_ATTRIBUTES = [
  'id',
  'runId',
  'statGroup',
  'statName',
  'unit',
  'numericValue',
  'metadata',
];

const BADGE_SUMMARY_DEFAULT = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  linesPct: null,
};

export function createGraphqlQueryService(options = {}) {
  const models = options.models || {
    Artifact,
    CoverageFile,
    CoverageSnapshot,
    CoverageTrendPoint,
    Group,
    PerformanceStat,
    Project,
    ProjectFile,
    ProjectGroupAccess,
    ProjectModule,
    ProjectOverview,
    ProjectPackage,
    ProjectRoleAccess,
    ProjectVersion,
    ReleaseNote,
    ReportSubmission,
    Role,
    Run,
    RunActiveSubmission,
    RunOverview,
    SuiteRun,
    TestExecution,
  };
  const accessService = options.accessService || createProjectAccessService({ models });
  const cacheEnabled = options.benchmarkQueryCache !== undefined
    ? options.benchmarkQueryCache !== false
    : process.env.NODE_ENV !== 'production' || process.env.BENCHMARK_QUERY_CACHE_ENABLED === 'true';
  const benchmarkQueryCache = !cacheEnabled
    ? null
    : options.benchmarkQueryCache || getDefaultBenchmarkQueryCache();
  // The service is created once per GraphQL request. Sibling resolvers often
  // need the same authorization scope, run, suites, coverage snapshot, and raw
  // report, so keep those promises request-local instead of repeating large
  // reads while a single operation is in flight.
  const requestMemo = new Map();

  return {
    async listProjects({ actor }) {
      return memoizeRequestValue(requestMemo, `projects:${actorCacheKey(actor)}`, async () => {
        const projects = await loadAll(models.Project);
        const visibleProjects = await accessService.filterProjects({ actor, projects });
        const overviews = models.ProjectOverview && visibleProjects.length > 0
          ? await loadAll(models.ProjectOverview, {
            where: { projectId: visibleProjects.map((project) => project.id) },
          })
          : [];
        const overviewMap = mapBy(overviews, 'projectId');
        return visibleProjects.map((project) => ({
          ...project,
          overview: overviewMap.get(project.id) || null,
          runCount: toInteger(overviewMap.get(project.id)?.runCount) ?? 0,
          latestRunId: overviewMap.get(project.id)?.latestRunId || null,
          latestStatus: overviewMap.get(project.id)?.latestStatus || null,
          latestCompletedAt: overviewMap.get(project.id)?.latestCompletedAt || null,
          latestLinesPct: toNumber(overviewMap.get(project.id)?.latestLinesPct),
          totalTests: toInteger(overviewMap.get(project.id)?.totalTests) ?? 0,
          passedTests: toInteger(overviewMap.get(project.id)?.passedTests) ?? 0,
          failedTests: toInteger(overviewMap.get(project.id)?.failedTests) ?? 0,
        })).sort(compareByName);
      });
    },

    async findProject({ id, key, slug, actor }) {
      const projects = await this.listProjects({ actor });
      return projects.find((project) => (
        (id && project.id === id)
        || (key && project.key === key)
        || (slug && project.slug === slug)
      )) || null;
    },

    async listRuns({ actor, projectId = null, projectKey = null, status = null, limit = null, after = null }) {
      const projects = await this.listProjects({ actor });
      const scopedProjects = projects.filter((project) => (
        (projectId ? project.id === projectId : true)
        && (projectKey ? project.key === projectKey : true)
      ));
      if (scopedProjects.length === 0) {
        return [];
      }

      const projectMap = mapBy(scopedProjects, 'id');
      const requestedLimit = normalizeRunLimit(limit);
      const cursor = decodeRunCursor(after);
      const cursorWhere = cursor ? {
        [Op.or]: [
          { completedAt: { [Op.lt]: cursor.completedAt } },
          { completedAt: cursor.completedAt, id: { [Op.lt]: cursor.id } },
        ],
      } : {};
      if (models.RunOverview) {
        const projectionCursorWhere = cursor ? {
          [Op.or]: [
            { completedAt: { [Op.lt]: cursor.completedAt } },
            { completedAt: cursor.completedAt, runId: { [Op.lt]: cursor.id } },
          ],
        } : {};
        const overviews = await loadAll(models.RunOverview, {
          where: {
            projectId: Array.from(projectMap.keys()),
            completedAt: { [Op.ne]: null },
            ...(status ? { status } : {}),
            ...projectionCursorWhere,
          },
          order: [['completedAt', 'DESC'], ['runId', 'DESC']],
          ...(requestedLimit ? { limit: requestedLimit } : {}),
        });
        const versionIds = Array.from(new Set(overviews.map((entry) => entry.projectVersionId).filter(Boolean)));
        const versions = mapBy(versionIds.length > 0
          ? await loadAll(models.ProjectVersion, { where: { id: versionIds } })
          : [], 'id');
        return overviews.map((entry) => decorateProjectedRun(entry, {
          project: projectMap.get(entry.projectId) || null,
          projectVersion: versions.get(entry.projectVersionId) || null,
        }));
      }
      let runs = await loadAll(models.Run, {
        where: {
          projectId: Array.from(projectMap.keys()),
          ...(status ? { status } : {}),
          ...cursorWhere,
        },
        order: [
          ['completedAt', 'DESC'],
          ['id', 'DESC'],
        ],
        ...(requestedLimit ? { limit: requestedLimit } : {}),
        attributes: RUN_LIST_ATTRIBUTES,
      });
      runs = runs.filter((run) => (
        projectMap.has(run.projectId)
        && (status ? run.status === status : true)
      ));

      const runIds = runs.map((run) => run.id).filter(Boolean);
      const versionIds = Array.from(new Set(runs.map((run) => run.projectVersionId).filter(Boolean)));
      const activeCoverageSubmissionIds = await loadActiveSubmissionIds(models, runIds, ['coverage', 'combined']);

      const [projectVersions, coverageSnapshots] = await Promise.all([
        versionIds.length > 0
          ? loadAll(models.ProjectVersion, {
            where: { id: versionIds },
          })
          : [],
        runIds.length > 0
          ? loadAll(models.CoverageSnapshot, {
            where: {
              runId: runIds,
              ...(activeCoverageSubmissionIds.length > 0 ? { reportSubmissionId: activeCoverageSubmissionIds } : {}),
            },
            order: [['createdAt', 'DESC']],
          })
          : [],
      ]);
      const versionMap = mapBy(projectVersions, 'id');
      const coverageSnapshotMap = mapNewestBy(coverageSnapshots, 'runId');

      return runs
        .map((run) => decorateRun(run, {
          project: projectMap.get(run.projectId) || null,
          projectVersion: versionMap.get(run.projectVersionId) || null,
          coverageSnapshot: coverageSnapshotMap.get(run.id) || null,
        }))
        .sort(compareRunsNewestFirst)
        .slice(0, requestedLimit || runs.length);
    },

    async listRunFeed({ actor, limit = null, after = null, projectKey = null, status = null }) {
      const runs = await this.listRuns({ actor, limit, after, projectKey, status });

      return runs.map((run) => ({
        buildNumber: resolveRunBuildNumber(run, run.projectVersion),
        id: run.id,
        externalKey: run.externalKey,
        status: run.status,
        branch: run.branch || null,
        commitSha: run.commitSha || null,
        sourceRunId: run.sourceRunId || null,
        sourceUrl: run.sourceUrl || null,
        completedAt: run.completedAt || null,
        durationMs: toInteger(run.durationMs),
        projectId: run.projectId,
        projectKey: run.project?.key || '',
        projectSlug: run.project?.slug || '',
        projectName: run.project?.name || run.externalKey,
        projectRepositoryUrl: run.project?.repositoryUrl || null,
        versionKey: run.projectVersion?.versionKey || null,
        linesPct: run.coverageSnapshot?.linesPct ?? null,
        totalTests: toInteger(run.summary?.totalTests),
        passedTests: toInteger(run.summary?.passedTests),
        failedTests: toInteger(run.summary?.failedTests),
        cursor: encodeRunCursor(run),
      }));
    },

    async getPublicBadgeSummary({ projectKey }) {
      if (typeof projectKey !== 'string' || projectKey.trim().length === 0) {
        return { ...BADGE_SUMMARY_DEFAULT };
      }

      const project = await loadOne(models.Project, {
        where: { key: projectKey.trim() },
        attributes: ['id'],
      });

      if (!project) {
        return { ...BADGE_SUMMARY_DEFAULT };
      }

      const runs = await loadAll(models.Run, {
        where: { projectId: project.id },
        order: [
          ['completedAt', 'DESC'],
          ['startedAt', 'DESC'],
          ['createdAt', 'DESC'],
        ],
        limit: 100,
        attributes: ['id', 'summary'],
      });

      if (runs.length === 0) {
        return { ...BADGE_SUMMARY_DEFAULT };
      }

      let testRun = runs[0];
      let coverageWhere = { runId: runs[0].id };
      if (models.ReportSubmission) {
        const submissions = await loadAll(models.ReportSubmission, {
          where: {
            runId: runs.map((run) => run.id),
            status: 'active',
            kind: ['tests', 'coverage', 'combined'],
          },
          attributes: ['id', 'runId', 'kind'],
        });
        if (submissions.length > 0) {
          const testRunIds = new Set(
            submissions
              .filter((submission) => submission.kind === 'tests' || submission.kind === 'combined')
              .map((submission) => submission.runId),
          );
          const coverageSubmissionIdsByRun = new Map();
          for (const submission of submissions) {
            if (submission.kind !== 'coverage' && submission.kind !== 'combined') continue;
            if (!coverageSubmissionIdsByRun.has(submission.runId)) {
              coverageSubmissionIdsByRun.set(submission.runId, []);
            }
            coverageSubmissionIdsByRun.get(submission.runId).push(submission.id);
          }
          testRun = runs.find((run) => testRunIds.has(run.id)) || null;
          const coverageRun = runs.find((run) => coverageSubmissionIdsByRun.has(run.id)) || null;
          coverageWhere = coverageRun
            ? {
              runId: coverageRun.id,
              reportSubmissionId: coverageSubmissionIdsByRun.get(coverageRun.id),
            }
            : null;
        }
      }

      const coverageSnapshot = await loadOne(models.CoverageSnapshot, {
        where: coverageWhere || { id: '__no_active_coverage_submission__' },
        attributes: ['linesPct'],
      });

      return {
        totalTests: toInteger(testRun?.summary?.totalTests) ?? 0,
        passedTests: toInteger(testRun?.summary?.passedTests) ?? 0,
        failedTests: toInteger(testRun?.summary?.failedTests) ?? 0,
        skippedTests: toInteger(testRun?.summary?.skippedTests) ?? 0,
        linesPct: Number.isFinite(coverageSnapshot?.linesPct) ? coverageSnapshot.linesPct : null,
      };
    },

    async findRun({ id = null, externalKey = null, actor }) {
      const cacheKey = `run:${actorCacheKey(actor)}:${id || ''}:${externalKey || ''}`;
      return memoizeRequestValue(requestMemo, cacheKey, async () => {
        const projects = await this.listProjects({ actor });
        const projectMap = mapBy(projects, 'id');
        const visibleProjectIds = Array.from(projectMap.keys());
        if (visibleProjectIds.length === 0 || (!id && !externalKey)) {
          return null;
        }

        const run = await loadOne(models.Run, {
          where: {
            projectId: visibleProjectIds,
            ...(id ? { id } : {}),
            ...(externalKey ? { externalKey } : {}),
          },
          attributes: RUN_LIST_ATTRIBUTES,
        });

        if (!run) {
          return null;
        }

        const activeCoverageSubmissionIds = await loadActiveSubmissionIds(models, [run.id], ['coverage', 'combined']);
        return decorateRun(run, {
          project: projectMap.get(run.projectId) || null,
          projectVersion: run.projectVersionId
            ? await loadOne(models.ProjectVersion, {
              where: { id: run.projectVersionId },
            })
            : null,
          coverageSnapshot: await loadOne(models.CoverageSnapshot, {
            where: {
              runId: run.id,
              ...(activeCoverageSubmissionIds.length > 0 ? { reportSubmissionId: activeCoverageSubmissionIds } : {}),
            },
            order: [['createdAt', 'DESC']],
          }),
        });
      });
    },

    async listSuitesForRun({ runId, actor }) {
      return memoizeRequestValue(requestMemo, `suites:${actorCacheKey(actor)}:${runId}`, async () => {
        const run = await this.findRun({ id: runId, actor });
        if (!run) {
          return [];
        }

        const activeSubmissionIds = await loadActiveSubmissionIds(models, [runId], ['tests']);
        const suites = await loadAll(models.SuiteRun, {
          where: {
            runId,
            ...(activeSubmissionIds.length > 0 ? { reportSubmissionId: activeSubmissionIds } : {}),
          },
        });
        return suites
          .filter((suite) => suite.runId === runId)
          .sort(compareSuites)
          .map((suite) => ({
            ...suite,
            artifacts: [],
          }));
      });
    },

    async getCoverageSnapshotForRun({ runId, actor }) {
      return memoizeRequestValue(requestMemo, `coverage-snapshot:${actorCacheKey(actor)}:${runId}`, async () => {
        const run = await this.findRun({ id: runId, actor });
        if (!run) {
          return null;
        }

        const activeSubmissionIds = await loadActiveSubmissionIds(models, [runId], ['coverage', 'combined']);
        return loadOne(models.CoverageSnapshot, {
          where: {
            runId,
            ...(activeSubmissionIds.length > 0 ? { reportSubmissionId: activeSubmissionIds } : {}),
          },
          order: [['createdAt', 'DESC']],
        });
      });
    },

    async listTestsForRun({ runId, actor, status = null, packageName = null, moduleName = null, filePath = null, limit = null }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      const suites = await this.listSuitesForRun({ runId, actor });
      const suiteMap = mapBy(suites, 'id');
      const suiteIds = Array.from(suiteMap.keys());
      const tests = suiteIds.length > 0 ? await loadAll(models.TestExecution, {
        where: {
          suiteRunId: suiteIds,
          ...(status ? { status } : {}),
          ...(moduleName ? { moduleName } : {}),
          ...(filePath ? { filePath } : {}),
        },
        ...(normalizeRunLimit(limit) ? { limit: normalizeRunLimit(limit) } : {}),
      }) : [];

      return tests
        .filter((test) => suiteMap.has(test.suiteRunId))
        .map((test) => decorateTestExecution(test, suiteMap.get(test.suiteRunId)))
        .filter((test) => filterDecoratedTest(test, { status, packageName, moduleName, filePath }))
        .sort(compareTests)
        .slice(0, normalizeRunLimit(limit) || tests.length);
    },

    async listTestsForSuiteRun({ runId = null, suiteRunId, actor, limit = null, after = null, status = null, search = null }) {
      const suite = await loadOne(models.SuiteRun, { where: { id: suiteRunId } });
      if (!suite) {
        return [];
      }

      if (runId && suite.runId !== runId) {
        return [];
      }

      const run = await this.findRun({ id: suite.runId, actor });
      if (!run) {
        return [];
      }

      const tests = await loadAll(models.TestExecution, {
        where: {
          suiteRunId,
          ...(after ? { id: { [Op.gt]: after } } : {}),
          ...(status ? { status } : {}),
          ...(search ? { fullName: { [Op.iLike]: `%${search}%` } } : {}),
        },
        order: [['id', 'ASC']],
        ...(normalizeRunLimit(limit) ? { limit: normalizeRunLimit(limit) } : {}),
      });
      return tests
        .filter((test) => test.suiteRunId === suiteRunId)
        .filter((test) => !after || String(test.id).localeCompare(String(after)) > 0)
        .filter((test) => !status || test.status === status)
        .filter((test) => !search || String(test.fullName || test.name || '').toLowerCase().includes(String(search).toLowerCase()))
        .map((test) => decorateTestExecution(test, suite))
        .slice(0, normalizeRunLimit(limit) || tests.length);
    },

    async listArtifacts({ actor, runId = null, suiteRunId = null, testExecutionId = null }) {
      if (!runId && !suiteRunId && !testExecutionId) {
        return [];
      }

      let authorizedRunId = runId;
      if (!authorizedRunId && suiteRunId) {
        authorizedRunId = (await loadOne(models.SuiteRun, { where: { id: suiteRunId } }))?.runId || null;
      }
      if (!authorizedRunId && testExecutionId) {
        const testExecution = await loadOne(models.TestExecution, { where: { id: testExecutionId } });
        authorizedRunId = testExecution
          ? (await loadOne(models.SuiteRun, { where: { id: testExecution.suiteRunId } }))?.runId || null
          : null;
      }
      if (!authorizedRunId || !await this.findRun({ id: authorizedRunId, actor })) {
        return [];
      }
      const activeSubmissionIds = await loadActiveSubmissionIds(models, [authorizedRunId]);
      return (await loadAll(models.Artifact, {
        where: {
          runId: authorizedRunId,
          ...(suiteRunId ? { suiteRunId } : {}),
          ...(testExecutionId ? { testExecutionId } : {}),
          ...(activeSubmissionIds.length > 0 ? { reportSubmissionId: activeSubmissionIds } : {}),
        },
        order: [['createdAt', 'DESC']],
      }))
        .filter((artifact) => artifact.runId === authorizedRunId)
        .filter((artifact) => (suiteRunId ? artifact.suiteRunId === suiteRunId : true))
        .filter((artifact) => (testExecutionId ? artifact.testExecutionId === testExecutionId : true))
        .filter((artifact) => activeSubmissionIds.length === 0 || activeSubmissionIds.includes(artifact.reportSubmissionId))
        .sort(compareArtifacts);
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
      const rawReport = await this.getActiveRunReport({ runId, actor, kind: 'tests' });
      if (!rawReport) {
        return [];
      }

      return (Array.isArray(rawReport.packages) ? rawReport.packages : []).map((entry) => {
        const suites = Array.isArray(entry.suites) ? entry.suites : [];
        return {
          name: entry.name,
          location: entry.location || null,
          status: deriveReportedCollectionStatus({
            summary: entry.summary || {},
            reportedStatus: entry.status,
            suites,
          }),
          durationMs: toInteger(entry.durationMs),
          summary: entry.summary || {},
          coverage: entry.coverage || null,
          modules: Array.isArray(entry.modules) ? entry.modules : [],
          frameworks: Array.isArray(entry.frameworks) ? entry.frameworks : [],
          suiteCount: suites.length,
        };
      });
    },

    async listRunModules({ runId, actor }) {
      const rawReport = await this.getActiveRunReport({ runId, actor, kind: 'tests' });
      if (!rawReport) {
        return [];
      }

      return (Array.isArray(rawReport.modules) ? rawReport.modules : []).map((entry) => ({
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

    async listRunFiles({ runId, actor, packageName = null, moduleName = null, status = null, includeTests = true }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      const suites = await this.listSuitesForRun({ runId, actor });
      const suiteMap = mapBy(suites, 'id');
      const suiteIds = Array.from(suiteMap.keys());
      const tests = suiteIds.length > 0
        ? await loadAll(models.TestExecution, {
          where: { suiteRunId: suiteIds },
          ...(includeTests ? {} : { attributes: ['id', 'suiteRunId', 'status', 'filePath', 'moduleName'] }),
        })
        : [];
      const coverageSnapshot = await this.getCoverageSnapshotForRun({ runId, actor });
      const coverageFiles = coverageSnapshot
        ? await loadAll(models.CoverageFile, { where: { coverageSnapshotId: coverageSnapshot.id } })
        : [];
      const coveragePackageIds = Array.from(new Set(coverageFiles.map((entry) => entry.projectPackageId).filter(Boolean)));
      const coverageModuleIds = Array.from(new Set(coverageFiles.map((entry) => entry.projectModuleId).filter(Boolean)));
      const coverageProjectFileIds = Array.from(new Set(coverageFiles.map((entry) => entry.projectFileId).filter(Boolean)));
      const packages = mapBy(coveragePackageIds.length > 0
        ? await loadAll(models.ProjectPackage, { where: { id: coveragePackageIds } }) : [], 'id');
      const modules = mapBy(coverageModuleIds.length > 0
        ? await loadAll(models.ProjectModule, { where: { id: coverageModuleIds } }) : [], 'id');
      const projectFiles = mapBy(coverageProjectFileIds.length > 0
        ? await loadAll(models.ProjectFile, { where: { id: coverageProjectFileIds } }) : [], 'id');

      const files = new Map();

      for (const test of tests.filter((entry) => suiteMap.has(entry.suiteRunId) && entry.filePath)) {
        const suite = suiteMap.get(test.suiteRunId);
        const file = ensureRunFile(files, test.filePath);
        file.packageName ||= suite.packageName || null;
        file.moduleName ||= test.moduleName || null;
        file.language ||= detectLanguage(test.filePath);
        file.tests.push(includeTests ? decorateTestExecution(test, suite) : { status: test.status });
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
      const visibleProjectIds = Array.from(projectMap.keys());
      if (visibleProjectIds.length === 0) {
        return [];
      }

      const scopeType = resolveCoverageTrendScope({ packageName, moduleName, filePath });
      let points = await loadAll(models.CoverageTrendPoint, {
        where: {
          projectId: visibleProjectIds,
          scopeType,
          ...(packageName ? { packageName } : {}),
          ...(moduleName ? { moduleName } : {}),
          ...(filePath ? { filePath } : {}),
        },
        order: [
          ['recordedAt', 'DESC'],
          ['createdAt', 'DESC'],
        ],
        limit: normalizeLimit(limit),
      });

      points = points
        .filter((point) => projectMap.has(point.projectId))
        .filter((point) => (projectId ? point.projectId === projectId : true))
        .filter((point) => (projectKey ? projectMap.get(point.projectId)?.key === projectKey : true))
        .filter((point) => point.scopeType === scopeType)
        .filter((point) => (packageName ? point.packageName === packageName : true))
        .filter((point) => (moduleName ? point.moduleName === moduleName : true))
        .filter((point) => (filePath ? point.filePath === filePath : true));

      if (points.length === 0) {
        return [];
      }

      const runIds = Array.from(new Set(points.map((point) => point.runId).filter(Boolean)));
      const initialVersionIds = Array.from(new Set(points.map((point) => point.projectVersionId).filter(Boolean)));
      const runs = mapBy(runIds.length > 0
        ? await loadAll(models.Run, {
          where: { id: runIds },
        })
        : [], 'id');
      const versionIds = Array.from(new Set([
        ...initialVersionIds,
        ...runIds.map((runId) => runs.get(runId)?.projectVersionId).filter(Boolean),
      ]));
      const versions = mapBy(versionIds.length > 0
        ? await loadAll(models.ProjectVersion, {
          where: { id: versionIds },
        })
        : [], 'id');

      return points
        .map((point) => decorateCoverageTrendPoint(point, {
          run: runs.get(point.runId) || null,
          projectVersion: versions.get(point.projectVersionId) || versions.get(runs.get(point.runId)?.projectVersionId) || null,
        }))
        .sort(compareCoveragePointsNewestFirst)
        .slice(0, normalizeLimit(limit));
    },

    async listRunPerformanceStats({ runId, actor, statGroupPrefix = null, statNames = null, seriesIds = null }) {
      const run = await this.findRun({ id: runId, actor });
      if (!run) {
        return [];
      }

      const activeSubmissionIds = await loadActiveSubmissionIds(models, [runId], ['performance', 'combined']);
      const stats = await loadAll(models.PerformanceStat, {
        where: {
          runId,
          ...(activeSubmissionIds.length > 0 ? { reportSubmissionId: activeSubmissionIds } : {}),
          ...(statGroupPrefix ? { statGroup: { [Op.like]: `${escapeLikePrefix(statGroupPrefix)}%` } } : {}),
          ...(Array.isArray(statNames) && statNames.length > 0 ? { statName: { [Op.in]: statNames } } : {}),
        },
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
      });

      return stats
        .filter((stat) => stat.runId === runId)
        .filter((stat) => filterPerformanceStat(stat, { statGroupPrefix, statNames, seriesIds }))
        .map((stat) => decoratePerformanceStat(stat, {
          project: run.project || null,
          run,
          projectVersion: run.projectVersion || null,
        }))
        .sort(comparePerformanceStatsNewestFirst);
    },

    async getActiveRunReport({ runId, actor, kind = 'tests' }) {
      return memoizeRequestValue(requestMemo, `active-report:${actorCacheKey(actor)}:${runId}:${kind}`, async () => {
        const run = await this.findRun({ id: runId, actor });
        if (!run) return null;
        if (!models.ReportSubmission) {
          const legacyRun = await loadOne(models.Run, { where: { id: runId }, attributes: ['rawReport'] });
          return legacyRun?.rawReport || null;
        }
        const activeSubmissionIds = await loadActiveSubmissionIds(models, [runId], [kind]);
        if (activeSubmissionIds.length === 0) {
          if (!models.Run?.sequelize) {
            const legacyRun = await loadOne(models.Run, { where: { id: runId }, attributes: ['rawReport'] });
            return legacyRun?.rawReport || null;
          }
          return null;
        }
        const submission = await loadOne(models.ReportSubmission, {
          where: { id: activeSubmissionIds[0] },
          attributes: ['id', 'schemaVersion', 'rawReport'],
        });
        return submission?.rawReport || null;
      });
    },

    async listPerformanceTrend({ actor, projectId = null, projectKey = null, statGroup, statName, seriesIds = null, runnerKey = null, limit = DEFAULT_LIMIT }) {
      const projects = await this.listProjects({ actor });
      const scopedProjects = projects.filter((project) => (
        (projectId ? project.id === projectId : true)
        && (projectKey ? project.key === projectKey : true)
      ));
      if (scopedProjects.length === 0) {
        return [];
      }

      const projectMap = mapBy(scopedProjects, 'id');
      if (canUsePostgresBenchmarkRepository(models)) {
        const points = await listBoundedPerformanceTrends(models, {
          projectIds: Array.from(projectMap.keys()),
          metrics: [{ statGroup, statName }],
          runnerKey,
          limit,
        });
        const allowedSeries = Array.isArray(seriesIds) && seriesIds.length > 0 ? new Set(seriesIds) : null;
        return points.filter((point) => !allowedSeries || allowedSeries.has(point.seriesId));
      }
      const runs = (await loadAll(models.Run, {
        where: {
          projectId: Array.from(projectMap.keys()),
        },
      })).filter((run) => projectMap.has(run.projectId));
      if (runs.length === 0) {
        return [];
      }

      const runMap = mapBy(runs, 'id');
      const activePerformanceSubmissionIds = await loadActiveSubmissionIds(models, Array.from(runMap.keys()), ['performance', 'combined']);
      const versionIds = Array.from(new Set(runs.map((run) => run.projectVersionId).filter(Boolean)));
      const versionMap = mapBy(versionIds.length > 0
        ? await loadAll(models.ProjectVersion, {
          where: { id: versionIds },
        })
        : [], 'id');
      const stats = await loadAll(models.PerformanceStat, {
        where: {
          runId: Array.from(runMap.keys()),
          statGroup,
          statName,
          ...(activePerformanceSubmissionIds.length > 0 ? { reportSubmissionId: activePerformanceSubmissionIds } : {}),
        },
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
      });

      return stats
        .filter((stat) => runMap.has(stat.runId))
        .filter((stat) => filterPerformanceStat(stat, { statGroup, statName, seriesIds, runnerKey }))
        .map((stat) => {
          const run = runMap.get(stat.runId) || null;
          return decoratePerformanceStat(stat, {
            project: projectMap.get(run?.projectId) || null,
            run,
            projectVersion: versionMap.get(run?.projectVersionId) || null,
          });
        })
        .sort(comparePerformanceStatsNewestFirst)
        .slice(0, normalizeLimit(limit));
    },

    async listPerformanceTrends({ actor, projectId = null, projectKey = null, metrics = [], limit = DEFAULT_LIMIT }) {
      const selections = (Array.isArray(metrics) ? metrics : [])
        .filter((entry) => entry?.statGroup && entry?.statName);
      if (selections.length === 0) return [];
      const projects = await this.listProjects({ actor });
      const scopedProjects = projects.filter((project) => (
        (projectId ? project.id === projectId : true)
        && (projectKey ? project.key === projectKey : true)
      ));
      const projectMap = mapBy(scopedProjects, 'id');
      if (projectMap.size === 0) return [];
      if (canUsePostgresBenchmarkRepository(models)) {
        const points = await listBoundedPerformanceTrends(models, {
          projectIds: Array.from(projectMap.keys()),
          metrics: selections,
          limit,
        });
        const groups = new Map(selections.map((entry) => [`${entry.statGroup}\0${entry.statName}`, []]));
        for (const point of points) {
          groups.get(`${point.statGroup}\0${point.statName}`)?.push(point);
        }
        return selections.map((entry) => ({
          statGroup: entry.statGroup,
          statName: entry.statName,
          points: groups.get(`${entry.statGroup}\0${entry.statName}`) || [],
        }));
      }
      const runs = await loadAll(models.Run, {
        where: { projectId: Array.from(projectMap.keys()) },
        attributes: BENCHMARK_RUN_ATTRIBUTES,
      });
      const runMap = mapBy(runs, 'id');
      if (runMap.size === 0) return [];
      const activePerformanceSubmissionIds = await loadActiveSubmissionIds(models, Array.from(runMap.keys()), ['performance', 'combined']);
      const stats = await loadAll(models.PerformanceStat, {
        where: {
          runId: Array.from(runMap.keys()),
          [Op.or]: selections.map((entry) => ({ statGroup: entry.statGroup, statName: entry.statName })),
          ...(activePerformanceSubmissionIds.length > 0 ? { reportSubmissionId: activePerformanceSubmissionIds } : {}),
        },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      });
      const groups = new Map(selections.map((entry) => [`${entry.statGroup}\0${entry.statName}`, []]));
      for (const stat of stats) {
        const key = `${stat.statGroup}\0${stat.statName}`;
        const points = groups.get(key);
        const run = runMap.get(stat.runId);
        if (!points || !run || points.length >= normalizeLimit(limit)) continue;
        points.push(decoratePerformanceStat(stat, {
          project: projectMap.get(run.projectId) || null,
          run,
          projectVersion: null,
        }));
      }
      return selections.map((entry) => ({
        statGroup: entry.statGroup,
        statName: entry.statName,
        points: groups.get(`${entry.statGroup}\0${entry.statName}`) || [],
      }));
    },

    async listBenchmarkCatalog({ actor, projectId = null, projectKey = null }) {
      const projects = await this.listProjects({ actor });
      const scopedProjects = projects.filter((project) => (
        (projectId ? project.id === projectId : true)
        && (projectKey ? project.key === projectKey : true)
      ));
      if (scopedProjects.length === 0) {
        return [];
      }
      const singleProject = scopedProjects.length === 1 ? scopedProjects[0] : null;
      const cachedCatalog = singleProject
        ? benchmarkQueryCache?.readCatalog({
          projectId: singleProject.id,
          projectKey: singleProject.key,
        }) || null
        : null;
      if (cachedCatalog) {
        recordCacheOutcome('benchmark_catalog', 'hit');
        return cachedCatalog;
      }
      if (singleProject && benchmarkQueryCache) recordCacheOutcome('benchmark_catalog', 'miss');

      const projectMap = mapBy(scopedProjects, 'id');
      if (canUsePostgresBenchmarkRepository(models)) {
        const catalog = await listBoundedBenchmarkCatalog(models, {
          projectIds: Array.from(projectMap.keys()),
        });
        if (singleProject) {
          benchmarkQueryCache?.writeCatalog({
            projectId: singleProject.id,
            projectKey: singleProject.key,
          }, catalog);
        }
        return catalog;
      }
      const runs = (await loadAll(models.Run, {
        where: {
          projectId: Array.from(projectMap.keys()),
        },
        attributes: BENCHMARK_RUN_ATTRIBUTES,
      })).filter((run) => projectMap.has(run.projectId));
      if (runs.length === 0) {
        const emptyCatalog = [];
        if (singleProject) {
          benchmarkQueryCache?.writeCatalog({
            projectId: singleProject.id,
            projectKey: singleProject.key,
          }, emptyCatalog);
        }
        return emptyCatalog;
      }

      const runMap = mapBy(runs, 'id');
      const activeCatalogSubmissionIds = await loadActiveSubmissionIds(models, Array.from(runMap.keys()), ['performance', 'combined']);
      const stats = await loadAll(models.PerformanceStat, {
        where: {
          runId: Array.from(runMap.keys()),
          ...(activeCatalogSubmissionIds.length > 0 ? { reportSubmissionId: activeCatalogSubmissionIds } : {}),
        },
        attributes: BENCHMARK_STAT_ATTRIBUTES,
      });
      const entries = new Map();

      for (const stat of stats) {
        const run = runMap.get(stat.runId) || null;
        if (!run) {
          continue;
        }

        const project = projectMap.get(run.projectId) || null;
        if (!project) {
          continue;
        }

        const metadata = normalizeMetadata(stat.metadata);
        const entryKey = `${project.id}:${stat.statGroup}`;
        if (!entries.has(entryKey)) {
          entries.set(entryKey, {
            projectId: project.id,
            projectKey: project.key,
            statGroup: stat.statGroup,
            statNames: new Set(),
            units: new Set(),
            seriesIds: new Set(),
            runnerKeys: new Set(),
            latestCompletedAt: run.completedAt || null,
            pointCount: 0,
          });
        }

        const entry = entries.get(entryKey);
        entry.statNames.add(stat.statName);
        if (stat.unit) {
          entry.units.add(stat.unit);
        }
        if (metadata.seriesId) {
          entry.seriesIds.add(metadata.seriesId);
        }
        if (metadata.runnerKey) {
          entry.runnerKeys.add(metadata.runnerKey);
        }
        entry.pointCount += 1;
        if (compareIsoDates(run.completedAt, entry.latestCompletedAt) > 0) {
          entry.latestCompletedAt = run.completedAt || null;
        }
      }

      const catalog = Array.from(entries.values())
        .map((entry) => ({
          projectId: entry.projectId,
          projectKey: entry.projectKey,
          statGroup: entry.statGroup,
          statNames: Array.from(entry.statNames).sort(),
          units: Array.from(entry.units).sort(),
          seriesIds: Array.from(entry.seriesIds).sort(),
          runnerKeys: Array.from(entry.runnerKeys).sort(),
          latestCompletedAt: entry.latestCompletedAt,
          pointCount: entry.pointCount,
        }))
        .sort(compareBenchmarkCatalogEntries);

      if (singleProject) {
        benchmarkQueryCache?.writeCatalog({
          projectId: singleProject.id,
          projectKey: singleProject.key,
        }, catalog);
      }

      return catalog;
    },

    async getBenchmarkSummary({ actor, projectId = null, projectKey = null }) {
      const projects = await this.listProjects({ actor });
      const scopedProjects = projects.filter((project) => (
        (projectId ? project.id === projectId : true)
        && (projectKey ? project.key === projectKey : true)
      ));

      if (scopedProjects.length === 0) {
        return createEmptyBenchmarkSummary({
          projectId,
          projectKey,
        });
      }
      const singleProject = scopedProjects.length === 1 ? scopedProjects[0] : null;
      const cachedSummary = singleProject
        ? benchmarkQueryCache?.readSummary({
          projectId: singleProject.id,
          projectKey: singleProject.key,
        }) || null
        : null;
      if (cachedSummary) {
        recordCacheOutcome('benchmark_summary', 'hit');
        return cachedSummary;
      }
      if (singleProject && benchmarkQueryCache) recordCacheOutcome('benchmark_summary', 'miss');

      const projectMap = mapBy(scopedProjects, 'id');
      if (canUsePostgresBenchmarkRepository(models) && models.RunOverview) {
        const catalog = await this.listBenchmarkCatalog({ actor, projectId, projectKey });
        const selections = catalog.flatMap((entry) => (
          (entry.statNames || []).map((statName) => ({ statGroup: entry.statGroup, statName }))
        ));
        const trendGroups = selections.length > 0
          ? await this.listPerformanceTrends({ actor, projectId, projectKey, metrics: selections, limit: 2 })
          : [];
        const latestOverviews = await loadAll(models.RunOverview, {
          where: { projectId: Array.from(projectMap.keys()), completedAt: { [Op.ne]: null } },
          order: [['completedAt', 'DESC'], ['runId', 'DESC']],
          limit: Math.max(1, scopedProjects.length),
        });
        const versionIds = Array.from(new Set(latestOverviews.map((entry) => entry.projectVersionId).filter(Boolean)));
        const versionMap = mapBy(versionIds.length > 0
          ? await loadAll(models.ProjectVersion, { where: { id: versionIds } })
          : [], 'id');
        const runs = latestOverviews.map((entry) => decorateProjectedRun(entry, {
          project: projectMap.get(entry.projectId) || null,
          projectVersion: versionMap.get(entry.projectVersionId) || null,
        }));
        const summary = buildBenchmarkSummary({
          projects: scopedProjects,
          runs,
          projectVersions: versionMap,
          stats: trendGroups.flatMap((entry) => entry.points || []),
        });
        if (singleProject) {
          benchmarkQueryCache?.writeSummary({
            projectId: singleProject.id,
            projectKey: singleProject.key,
          }, summary);
        }
        return summary;
      }
      const runs = (await loadAll(models.Run, {
        where: {
          projectId: Array.from(projectMap.keys()),
        },
        attributes: BENCHMARK_RUN_ATTRIBUTES,
      }))
        .filter((run) => projectMap.has(run.projectId))
        .sort(compareRunsNewestFirst);

      if (runs.length === 0) {
        const emptySummary = createEmptyBenchmarkSummary({
          projectId: scopedProjects.length === 1 ? scopedProjects[0].id : null,
          projectKey: scopedProjects.length === 1 ? scopedProjects[0].key : projectKey,
        });
        if (singleProject) {
          benchmarkQueryCache?.writeSummary({
            projectId: singleProject.id,
            projectKey: singleProject.key,
          }, emptySummary);
        }
        return emptySummary;
      }

      const runMap = mapBy(runs, 'id');
      const activeSummarySubmissionIds = await loadActiveSubmissionIds(models, Array.from(runMap.keys()), ['performance', 'combined']);
      const versionIds = Array.from(new Set(runs.map((run) => run.projectVersionId).filter(Boolean)));
      const versionMap = mapBy(versionIds.length > 0
        ? await loadAll(models.ProjectVersion, {
          where: { id: versionIds },
        })
        : [], 'id');
      const stats = await loadAll(models.PerformanceStat, {
        where: {
          runId: Array.from(runMap.keys()),
          ...(activeSummarySubmissionIds.length > 0 ? { reportSubmissionId: activeSummarySubmissionIds } : {}),
        },
        attributes: BENCHMARK_STAT_ATTRIBUTES,
      });

      const decoratedStats = stats
        .filter((stat) => runMap.has(stat.runId))
        .map((stat) => {
          const run = runMap.get(stat.runId) || null;
          return decoratePerformanceStat(stat, {
            project: projectMap.get(run?.projectId) || null,
            run,
            projectVersion: versionMap.get(run?.projectVersionId) || null,
          });
        })
        .sort(comparePerformanceStatsNewestFirst);

      const summary = buildBenchmarkSummary({
        projects: scopedProjects,
        runs,
        projectVersions: versionMap,
        stats: decoratedStats,
      });

      if (singleProject) {
        benchmarkQueryCache?.writeSummary({
          projectId: singleProject.id,
          projectKey: singleProject.key,
        }, summary);
      }

      return summary;
    },

    async getRunCoverageComparison({ actor, runId }) {
      const currentRun = await this.findRun({ id: runId, actor });
      if (!currentRun) {
        return null;
      }

      let previousCandidates = await loadAll(models.Run, {
        where: {
          projectId: currentRun.projectId,
          ...(currentRun.completedAt ? { completedAt: { [Op.lt]: new Date(currentRun.completedAt) } } : {}),
        },
        order: [['completedAt', 'DESC'], ['id', 'DESC']],
        limit: 1,
      });
      if (previousCandidates.length === 0 && !models.Run?.sequelize) {
        previousCandidates = await loadAll(models.Run, { where: { projectId: currentRun.projectId } });
      }
      let previousRun = previousCandidates
        .filter((run) => run.projectId === currentRun.projectId)
        .filter((run) => run.id !== currentRun.id)
        .filter((run) => !currentRun.completedAt || compareIsoDates(run.completedAt, currentRun.completedAt) < 0)
        .sort(compareRunsNewestFirst)[0] || null;
      if (previousRun?.projectVersionId) {
        previousRun = {
          ...previousRun,
          projectVersion: await loadOne(models.ProjectVersion, { where: { id: previousRun.projectVersionId } }),
        };
      }
      const comparisonRunIds = [currentRun.id, previousRun?.id].filter(Boolean);
      const activeCoverageSubmissionIds = await loadActiveSubmissionIds(models, comparisonRunIds, ['coverage', 'combined']);
      const points = await loadAll(models.CoverageTrendPoint, {
        where: {
          runId: comparisonRunIds,
          ...(activeCoverageSubmissionIds.length > 0 ? { reportSubmissionId: activeCoverageSubmissionIds } : {}),
        },
      });
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

function decorateRun(run, related) {
  const resolvedBuildNumber = resolveRunBuildNumber(run, related.projectVersion);
  const projectVersion = withResolvedProjectVersionBuildNumber(related.projectVersion, resolvedBuildNumber);

  return {
    ...run,
    project: related.project,
    projectVersion,
    coverageSnapshot: related.coverageSnapshot,
    buildNumber: resolvedBuildNumber,
  };
}

function decorateProjectedRun(overview, related) {
  const projectVersion = withResolvedProjectVersionBuildNumber(related.projectVersion, toInteger(overview.buildNumber));
  return {
    id: overview.runId,
    projectId: overview.projectId,
    projectVersionId: overview.projectVersionId || null,
    externalKey: overview.externalKey,
    status: overview.status,
    branch: overview.branch || null,
    commitSha: overview.commitSha || null,
    sourceRunId: overview.sourceRunId || null,
    sourceUrl: overview.sourceUrl || null,
    completedAt: overview.completedAt || null,
    durationMs: toInteger(overview.durationMs),
    buildNumber: toInteger(overview.buildNumber),
    summary: {
      totalTests: toInteger(overview.totalTests) ?? 0,
      passedTests: toInteger(overview.passedTests) ?? 0,
      failedTests: toInteger(overview.failedTests) ?? 0,
      skippedTests: toInteger(overview.skippedTests) ?? 0,
    },
    project: related.project || null,
    projectVersion,
    coverageSnapshot: Number.isFinite(overview.linesPct) ? { linesPct: overview.linesPct } : null,
    hasReportArtifact: Boolean(overview.hasReportArtifact),
  };
}

export function resolveRunBuildNumber(run, projectVersion = run?.projectVersion || null) {
  return parseInteger(projectVersion?.buildNumber)
    ?? parseInteger(run?.buildNumber)
    ?? parseInteger(run?.metadata?.source?.buildNumber)
    ?? parseInteger(run?.metadata?.source?.environment?.GITHUB_RUN_NUMBER)
    ?? parseInteger(run?.metadata?.source?.ci?.environment?.GITHUB_RUN_NUMBER)
    ?? parseInteger(run?.rawReport?.meta?.ci?.environment?.GITHUB_RUN_NUMBER);
}

function withResolvedProjectVersionBuildNumber(projectVersion, buildNumber) {
  if (!projectVersion || !Number.isFinite(buildNumber) || Number.isFinite(toInteger(projectVersion?.buildNumber))) {
    return projectVersion;
  }

  const serialized = typeof projectVersion.toJSON === 'function'
    ? projectVersion.toJSON()
    : projectVersion;

  return {
    ...serialized,
    buildNumber,
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

function decoratePerformanceStat(stat, related) {
  const metadata = normalizeMetadata(stat.metadata);

  return {
    ...stat,
    metadata,
    projectId: related.project?.id || related.run?.projectId || null,
    projectKey: related.project?.key || null,
    externalKey: related.run?.externalKey || null,
    versionKey: related.projectVersion?.versionKey || null,
    completedAt: related.run?.completedAt || null,
    branch: related.run?.branch || null,
    commitSha: related.run?.commitSha || null,
    buildNumber: toInteger(related.projectVersion?.buildNumber),
    seriesId: metadata.seriesId || null,
    runnerKey: metadata.runnerKey || null,
  };
}

function createEmptyBenchmarkSummary({ projectId = null, projectKey = null } = {}) {
  return {
    projectId: projectId || null,
    projectKey: projectKey || null,
    latestRunId: null,
    latestExternalKey: null,
    latestVersionKey: null,
    latestCompletedAt: null,
    namespaceCount: 0,
    metricCount: 0,
    seriesCount: 0,
    latestRunRegressionCount: 0,
    topChanges: [],
    topRegressions: [],
    topImprovements: [],
    namespaces: [],
  };
}

function buildBenchmarkSummary({ projects = [], runs = [], projectVersions = new Map(), stats = [] }) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return createEmptyBenchmarkSummary({
      projectId: projects.length === 1 ? projects[0].id : null,
      projectKey: projects.length === 1 ? projects[0].key : null,
    });
  }

  const latestRun = [...runs].sort(compareRunsNewestFirst)[0] || null;
  const namespaces = new Map();

  for (const stat of Array.isArray(stats) ? stats : []) {
    if (!stat?.statGroup || !stat?.statName || !Number.isFinite(stat?.numericValue)) {
      continue;
    }

    if (!namespaces.has(stat.statGroup)) {
      namespaces.set(stat.statGroup, {
        statGroup: stat.statGroup,
        metrics: new Map(),
      });
    }

    const namespace = namespaces.get(stat.statGroup);
    if (!namespace.metrics.has(stat.statName)) {
      namespace.metrics.set(stat.statName, {
        statName: stat.statName,
        unit: stat.unit || null,
        points: [],
        seriesIds: new Set(),
      });
    }

    const metric = namespace.metrics.get(stat.statName);
    metric.points.push(stat);
    if (!metric.unit && stat.unit) {
      metric.unit = stat.unit;
    }
    if (normalizeString(stat.seriesId)) {
      metric.seriesIds.add(normalizeString(stat.seriesId));
    }
  }

  if (namespaces.size === 0) {
    return createEmptyBenchmarkSummary({
      projectId: projects.length === 1 ? projects[0].id : null,
      projectKey: projects.length === 1 ? projects[0].key : null,
    });
  }

  const namespaceStates = Array.from(namespaces.values()).map((namespace) => ({
    statGroup: namespace.statGroup,
    metrics: Array.from(namespace.metrics.values()).map((metric) => ({
      statName: metric.statName,
      unit: metric.unit,
      points: [...metric.points].sort(comparePerformanceStatsNewestFirst),
      seriesIds: Array.from(metric.seriesIds).sort(),
    })).sort((left, right) => right.points.length - left.points.length || left.statName.localeCompare(right.statName)),
  }));

  const benchmarkChanges = buildBenchmarkSummaryChangeEntries(namespaceStates);
  const namespaceSummaries = namespaceStates
    .map((namespace) => buildBenchmarkNamespaceSummary(namespace, benchmarkChanges))
    .sort(compareBenchmarkNamespaceSummaries);

  return {
    projectId: projects.length === 1 ? projects[0].id : null,
    projectKey: projects.length === 1 ? projects[0].key : null,
    latestRunId: latestRun?.id || null,
    latestExternalKey: latestRun?.externalKey || null,
    latestVersionKey: projectVersions.get(latestRun?.projectVersionId)?.versionKey || null,
    latestCompletedAt: latestRun?.completedAt || null,
    namespaceCount: namespaceStates.length,
    metricCount: namespaceStates.reduce((total, namespace) => total + namespace.metrics.length, 0),
    seriesCount: uniqueStrings(namespaceStates.flatMap((namespace) => namespace.metrics.flatMap((metric) => metric.seriesIds || []))).length,
    latestRunRegressionCount: benchmarkChanges.filter((entry) => isBenchmarkRegressionStatus(entry.status) && entry.latestRunId === latestRun?.id).length,
    topChanges: benchmarkChanges.filter((entry) => Number.isFinite(entry.deltaPercent)),
    topRegressions: benchmarkChanges.filter((entry) => isBenchmarkRegressionStatus(entry.status)),
    topImprovements: benchmarkChanges.filter((entry) => entry.status === 'improved'),
    namespaces: namespaceSummaries,
  };
}

function buildBenchmarkSummaryChangeEntries(namespaces) {
  const changes = [];

  for (const namespace of Array.isArray(namespaces) ? namespaces : []) {
    const metricCount = Array.isArray(namespace.metrics) ? namespace.metrics.length : 0;

    for (const metric of Array.isArray(namespace.metrics) ? namespace.metrics : []) {
      const groups = new Map();

      for (const point of Array.isArray(metric.points) ? metric.points : []) {
        if (!Number.isFinite(point?.numericValue)) {
          continue;
        }

        const groupKey = [
          point.seriesId || 'default',
          point.runnerKey || 'runner unavailable',
          point.branch || 'no branch',
        ].join('::');

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(point);
      }

      for (const points of groups.values()) {
        const orderedPoints = [...points].sort(comparePerformanceStatsNewestFirst);
        const latestPoint = orderedPoints[0] || null;
        const previousPoint = orderedPoints.find((point) => point !== latestPoint) || null;
        const baselineId = normalizeString(latestPoint?.metadata?.baselineId);
        const baselinePoint = baselineId
          ? [...orderedPoints].reverse().find((point) => (
            normalizeString(point?.metadata?.baselineId) === baselineId
            && normalizeString(point?.metadata?.refactorPhase) === 'phase-0'
          )) || null
          : null;
        const classification = classifyBenchmarkComparison({
          projectKey: latestPoint?.projectKey || previousPoint?.projectKey || null,
          latestPoint,
          previousPoint,
          statGroup: namespace.statGroup,
          statName: metric.statName,
          unit: metric.unit || latestPoint?.unit || null,
        });
        const baselineClassification = baselinePoint && baselinePoint !== latestPoint
          ? classifyBenchmarkComparison({
            projectKey: latestPoint?.projectKey || baselinePoint?.projectKey || null,
            latestPoint,
            previousPoint: baselinePoint,
            statGroup: namespace.statGroup,
            statName: metric.statName,
            unit: metric.unit || latestPoint?.unit || null,
          })
          : null;

        changes.push({
          statGroup: namespace.statGroup,
          statName: metric.statName,
          unit: metric.unit || latestPoint?.unit || null,
          metricCount,
          status: classification.status,
          directionStatus: classification.directionStatus,
          budgetStatus: classification.budgetStatus,
          lowerIsBetter: classification.lowerIsBetter,
          warningThresholdPct: classification.warningDeltaPct,
          severeThresholdPct: classification.severeDeltaPct,
          semanticsSource: classification.semanticsSource,
          latestRunId: latestPoint?.runId || null,
          latestExternalKey: latestPoint?.externalKey || null,
          latestVersionKey: latestPoint?.versionKey || null,
          latestCompletedAt: latestPoint?.completedAt || null,
          latestBranch: latestPoint?.branch || null,
          latestRunnerKey: latestPoint?.runnerKey || null,
          latestSeriesId: latestPoint?.seriesId || null,
          latestValue: Number.isFinite(latestPoint?.numericValue) ? latestPoint.numericValue : null,
          previousRunId: previousPoint?.runId || null,
          previousExternalKey: previousPoint?.externalKey || null,
          previousVersionKey: previousPoint?.versionKey || null,
          previousCompletedAt: previousPoint?.completedAt || null,
          previousValue: Number.isFinite(previousPoint?.numericValue) ? previousPoint.numericValue : null,
          deltaValue: classification.deltaValue,
          deltaPercent: classification.deltaPercent,
          baselineId,
          baselineRunId: baselinePoint?.runId || null,
          baselineValue: Number.isFinite(baselinePoint?.numericValue) ? baselinePoint.numericValue : null,
          baselineDeltaValue: baselineClassification?.deltaValue ?? null,
          baselineDeltaPercent: baselineClassification?.deltaPercent ?? null,
          baselineStatus: baselineClassification?.status || (baselinePoint === latestPoint ? 'baseline' : null),
        });
      }
    }
  }

  return changes.sort(compareBenchmarkSummaryChanges);
}

function buildBenchmarkNamespaceSummary(namespace, benchmarkChanges) {
  const metrics = Array.isArray(namespace?.metrics) ? namespace.metrics : [];
  const primaryMetric = metrics[0] || null;
  const latestCompletedAt = metrics
    .flatMap((metric) => metric.points || [])
    .map((point) => point.completedAt || null)
    .sort(compareIsoDatesDescending)[0] || null;
  const namespaceChanges = benchmarkChanges.filter((entry) => entry.statGroup === namespace.statGroup);
  const regressionCount = namespaceChanges.filter((entry) => isBenchmarkRegressionStatus(entry.status)).length;
  const warningCount = namespaceChanges.filter((entry) => entry.status === 'warning').length;
  const severeRegressionCount = namespaceChanges.filter((entry) => entry.status === 'severe-regression').length;
  const status = namespaceChanges.find((entry) => entry.status)?.status || 'insufficient-baseline';

  return {
    statGroup: namespace.statGroup,
    primaryMetricName: primaryMetric?.statName || null,
    status,
    latestCompletedAt,
    metricCount: metrics.length,
    seriesCount: uniqueStrings(metrics.flatMap((metric) => metric.seriesIds || [])).length,
    pointCount: metrics.reduce((total, metric) => total + ((metric.points || []).length), 0),
    regressionCount,
    warningCount,
    severeRegressionCount,
  };
}

function filterDecoratedTest(test, filters) {
  return (!filters.status || test.status === filters.status)
    && (!filters.packageName || test.packageName === filters.packageName)
    && (!filters.moduleName || test.moduleName === filters.moduleName)
    && (!filters.filePath || test.filePath === filters.filePath);
}

function filterPerformanceStat(stat, filters) {
  const metadata = normalizeMetadata(stat.metadata);
  const statNames = Array.isArray(filters.statNames) && filters.statNames.length > 0
    ? new Set(filters.statNames)
    : null;
  const seriesIds = Array.isArray(filters.seriesIds) && filters.seriesIds.length > 0
    ? new Set(filters.seriesIds)
    : null;

  return (!filters.statGroup || stat.statGroup === filters.statGroup)
    && (!filters.statName || stat.statName === filters.statName)
    && (!filters.statGroupPrefix || String(stat.statGroup || '').startsWith(filters.statGroupPrefix))
    && (!statNames || statNames.has(stat.statName))
    && (!seriesIds || seriesIds.has(metadata.seriesId))
    && (!filters.runnerKey || metadata.runnerKey === filters.runnerKey);
}

function escapeLikePrefix(value) {
  return String(value).replace(/[%_\\]/g, (character) => `\\${character}`);
}

function normalizeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function deriveReportedCollectionStatus({ summary, reportedStatus = null, suites = [] } = {}) {
  const normalizedReportedStatus = normalizeReportedStatus(reportedStatus);
  const suiteStatuses = (Array.isArray(suites) ? suites : []).map((suite) => normalizeReportedStatus(suite?.status));

  if (suiteStatuses.includes('failed') || normalizedReportedStatus === 'failed') {
    return 'failed';
  }

  if (summary && Number.isFinite(summary.total) && summary.total > 0) {
    if (summary.failed > 0) {
      return 'failed';
    }
    if (summary.skipped === summary.total) {
      return 'skipped';
    }
    return 'passed';
  }

  if (suiteStatuses.includes('passed') || normalizedReportedStatus === 'passed') {
    return 'passed';
  }

  return 'skipped';
}

function normalizeReportedStatus(status) {
  if (status === 'failed' || status === 'passed' || status === 'skipped') {
    return status;
  }
  return null;
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

async function loadActiveSubmissionIds(models, runIds, kinds = null) {
  if (!Array.isArray(runIds) || runIds.length === 0) {
    return [];
  }
  if (models.RunActiveSubmission) {
    const selections = await loadAll(models.RunActiveSubmission, {
      where: {
        runId: runIds,
        ...(Array.isArray(kinds) && kinds.length > 0 ? { kind: kinds } : {}),
      },
      order: [['selectedAt', 'DESC']],
      attributes: ['runId', 'kind', 'reportSubmissionId', 'selectedAt'],
    });
    if (selections.length > 0) {
      return selections.map((selection) => selection.reportSubmissionId).filter(Boolean);
    }
  }
  if (!models.ReportSubmission) return [];
  const fallbackKinds = Array.isArray(kinds) && kinds.length > 0
    ? Array.from(new Set([...kinds, 'combined']))
    : null;
  const submissions = await loadAll(models.ReportSubmission, {
    where: {
      runId: runIds,
      status: 'active',
      ...(fallbackKinds ? { kind: fallbackKinds } : {}),
    },
    order: [['receivedAt', 'DESC']],
  });
  return submissions.map((submission) => submission.id).filter(Boolean);
}

function actorCacheKey(actor) {
  if (!actor || actor.isGuest === true) return 'guest';
  const roles = Array.isArray(actor.roleKeys) ? [...actor.roleKeys].sort().join(',') : '';
  const groups = Array.isArray(actor.groupKeys) ? [...actor.groupKeys].sort().join(',') : '';
  return [actor.id || actor.userId || actor.email || 'member', actor.isAdmin === true ? 'admin' : 'member', roles, groups].join(':');
}

function memoizeRequestValue(cache, key, loader) {
  if (!cache.has(key)) {
    cache.set(key, Promise.resolve().then(loader));
  }
  return cache.get(key);
}

async function loadAll(model, options = undefined) {
  if (!model || typeof model.findAll !== 'function') {
    return [];
  }

  const rows = await model.findAll(options);
  return rows.map((row) => toPlainRecord(row));
}

async function loadOne(model, options = undefined) {
  if (!model) {
    return null;
  }

  if (typeof model.findOne === 'function') {
    const row = await model.findOne(options);
    return toPlainRecord(row);
  }

  if (typeof model.findAll === 'function') {
    const rows = await model.findAll();
    const match = rows
      .map((row) => toPlainRecord(row))
      .find((row) => matchesWhere(row, options?.where || {})) || null;

    if (!match) {
      return null;
    }

    if (Array.isArray(options?.attributes) && options.attributes.length > 0) {
      return Object.fromEntries(
        options.attributes
          .filter((attribute) => Object.hasOwn(match, attribute))
          .map((attribute) => [attribute, match[attribute]]),
      );
    }

    return match;
  }

  return null;
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

function mapNewestBy(values, key) {
  const map = new Map();
  for (const value of values || []) {
    if (value && value[key] != null && !map.has(value[key])) {
      map.set(value[key], value);
    }
  }
  return map;
}

function matchesWhere(row, where) {
  return Object.entries(where || {}).every(([key, value]) => {
    if (Array.isArray(value)) {
      return value.includes(row?.[key]);
    }

    return row?.[key] === value;
  });
}

function normalizeLimit(value) {
  const parsed = toInteger(value);
  if (!parsed || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeRunLimit(value) {
  const parsed = toInteger(value);
  if (!parsed || parsed < 1) {
    return null;
  }
  return parsed;
}

function encodeRunCursor(run) {
  if (!run?.id || !run?.completedAt) return null;
  return Buffer.from(JSON.stringify({
    completedAt: new Date(run.completedAt).toISOString(),
    id: run.id,
  })).toString('base64url');
}

function decodeRunCursor(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const completedAt = new Date(parsed.completedAt);
    if (!parsed.id || Number.isNaN(completedAt.getTime())) return null;
    return { id: String(parsed.id), completedAt };
  } catch {
    return null;
  }
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

function parseInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean)));
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

function comparePerformanceStatsNewestFirst(left, right) {
  return compareIsoDates(right.completedAt, left.completedAt)
    || String(left.statGroup || '').localeCompare(String(right.statGroup || ''))
    || String(left.statName || '').localeCompare(String(right.statName || ''))
    || String(left.seriesId || '').localeCompare(String(right.seriesId || ''))
    || String(left.id || '').localeCompare(String(right.id || ''));
}

function compareBenchmarkCatalogEntries(left, right) {
  return String(left.projectKey || '').localeCompare(String(right.projectKey || ''))
    || String(left.statGroup || '').localeCompare(String(right.statGroup || ''));
}

function compareBenchmarkSummaryChanges(left, right) {
  return compareBenchmarkStatusRank(left.status, right.status)
    || compareNullableNumbersDesc(Math.abs(left.deltaPercent || 0), Math.abs(right.deltaPercent || 0))
    || compareIsoDatesDescending(left.latestCompletedAt, right.latestCompletedAt)
    || String(left.statGroup || '').localeCompare(String(right.statGroup || ''))
    || String(left.statName || '').localeCompare(String(right.statName || ''));
}

function compareBenchmarkNamespaceSummaries(left, right) {
  return compareIsoDatesDescending(left.latestCompletedAt, right.latestCompletedAt)
    || String(left.statGroup || '').localeCompare(String(right.statGroup || ''));
}

function compareNullableNumbersDesc(left, right) {
  const leftValue = Number.isFinite(left) ? left : -Infinity;
  const rightValue = Number.isFinite(right) ? right : -Infinity;
  return rightValue - leftValue;
}

function compareIsoDatesDescending(left, right) {
  return compareIsoDates(right, left);
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
