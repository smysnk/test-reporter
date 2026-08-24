function toTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareProjectsByActivity(left, right) {
  const activityDelta = toTimestamp(right.latestRun?.completedAt) - toTimestamp(left.latestRun?.completedAt);
  if (activityDelta !== 0) {
    return activityDelta;
  }

  return left.name.localeCompare(right.name);
}

export const HOME_RUNS_INITIAL_BATCH = 30;
export const HOME_RUNS_BATCH_SIZE = 30;

export function resolveInitialVisibleRunCount(totalRuns, initialBatch = HOME_RUNS_INITIAL_BATCH) {
  const safeTotal = Number.isFinite(totalRuns) ? Math.max(0, Math.trunc(totalRuns)) : 0;
  const safeInitialBatch = Number.isFinite(initialBatch) ? Math.max(1, Math.trunc(initialBatch)) : HOME_RUNS_INITIAL_BATCH;
  return Math.min(safeTotal, safeInitialBatch);
}

export function resolveNextVisibleRunCount(currentVisibleRuns, totalRuns, batchSize = HOME_RUNS_BATCH_SIZE) {
  const safeCurrent = Number.isFinite(currentVisibleRuns) ? Math.max(0, Math.trunc(currentVisibleRuns)) : 0;
  const safeTotal = Number.isFinite(totalRuns) ? Math.max(0, Math.trunc(totalRuns)) : 0;
  const safeBatchSize = Number.isFinite(batchSize) ? Math.max(1, Math.trunc(batchSize)) : HOME_RUNS_BATCH_SIZE;

  if (safeTotal === 0) {
    return 0;
  }

  return Math.min(safeTotal, safeCurrent + safeBatchSize);
}

export function buildHomeExplorerModel({ projects, runs, selectedProjectSlug = null }) {
  const projectList = Array.isArray(projects) ? projects : [];
  const runList = Array.isArray(runs) ? runs : [];

  const sidebarProjects = projectList
    .map((project) => {
      const projectRuns = runList.filter((run) => run?.project?.slug === project.slug);
      const latestRunFromWindow = projectRuns.reduce((latest, run) => {
        if (!latest) {
          return run;
        }

        return toTimestamp(run?.completedAt) > toTimestamp(latest?.completedAt) ? run : latest;
      }, null);
      const latestRun = project.latestRunId
        ? {
          id: project.latestRunId,
          status: project.latestStatus || 'unknown',
          completedAt: project.latestCompletedAt || null,
          coverageSnapshot: Number.isFinite(project.latestLinesPct) ? { linesPct: project.latestLinesPct } : null,
        }
        : latestRunFromWindow;

      return {
        ...project,
        latestRun,
        latestCoverage: latestRun?.coverageSnapshot?.linesPct ?? null,
        recentRunCount: Number.isFinite(project.runCount) ? project.runCount : projectRuns.length,
      };
    })
    .sort(compareProjectsByActivity);

  const selectedProject = sidebarProjects.find((project) => project.slug === selectedProjectSlug) || null;
  const visibleRuns = selectedProject
    ? runList.filter((run) => run?.project?.slug === selectedProject.slug)
    : runList;
  const latestCoverage = runList.find((run) => Number.isFinite(run?.coverageSnapshot?.linesPct))?.coverageSnapshot?.linesPct ?? null;

  return {
    latestCoverage,
    projects: sidebarProjects,
    selectedProject,
    totalProjects: projectList.length,
    totalRuns: runList.length,
    visibleRuns,
  };
}
