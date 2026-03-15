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

export function buildHomeExplorerModel({ projects, runs, selectedProjectSlug = null }) {
  const projectList = Array.isArray(projects) ? projects : [];
  const runList = Array.isArray(runs) ? runs : [];

  const sidebarProjects = projectList
    .map((project) => {
      const projectRuns = runList.filter((run) => run?.project?.slug === project.slug);
      const latestRun = projectRuns.reduce((latest, run) => {
        if (!latest) {
          return run;
        }

        return toTimestamp(run?.completedAt) > toTimestamp(latest?.completedAt) ? run : latest;
      }, null);

      return {
        ...project,
        latestRun,
        latestCoverage: latestRun?.coverageSnapshot?.linesPct ?? null,
        recentRunCount: projectRuns.length,
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
