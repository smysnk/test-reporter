import http from 'node:http';

const port = Number.parseInt(process.env.PORT || '3411', 10);
const now = new Date();
const projects = [
  { id: 'project-1', key: 'test-station', slug: 'test-station', name: 'Test Station', repositoryUrl: 'https://github.com/smysnk/test-station' },
  { id: 'project-2', key: 'm68k-nibbles', slug: 'm68k-nibbles', name: 'M68K Nibbles', repositoryUrl: 'https://github.com/smysnk/m68k-interpreter' },
  { id: 'project-3', key: 'reporter-sdk', slug: 'reporter-sdk', name: 'Reporter SDK', repositoryUrl: 'https://github.com/smysnk/test-station-reporter' },
];

const statuses = ['passed', 'passed', 'passed', 'failed', 'unknown', 'passed', 'failed'];
const runs = Array.from({ length: 84 }, (_, index) => {
  const project = projects[index % projects.length];
  const completedAt = new Date(now.getTime() - index * 3.75 * 60 * 60 * 1000);
  const status = statuses[index % statuses.length];
  const publicationKinds = status === 'unknown'
    ? index % 2 === 0 ? ['performance'] : ['coverage']
    : ['tests'];
  const buildNumber = 920 - index;
  return {
    id: `run-${String(index + 1).padStart(3, '0')}`,
    externalKey: `${project.key}-${buildNumber}`,
    status,
    branch: index % 5 === 0 ? 'feature/operations-console' : 'main',
    commitSha: `${(index + 17).toString(16).padStart(12, '0')}abcdef`,
    sourceRunId: String(30000 + index),
    sourceUrl: `https://github.com/smysnk/test-station/actions/runs/${30000 + index}`,
    completedAt: completedAt.toISOString(),
    durationMs: 18000 + index * 317,
    cursor: `cursor-${String(index + 1).padStart(3, '0')}`,
    projectId: project.id,
    projectKey: project.key,
    projectSlug: project.slug,
    projectName: project.name,
    projectRepositoryUrl: project.repositoryUrl,
    versionKey: `build-${buildNumber}`,
    buildNumber,
    linesPct: index % 6 === 0 ? null : Number((88.4 - (index % 9) * 0.7).toFixed(1)),
    totalTests: publicationKinds.includes('tests') ? 221 : null,
    passedTests: publicationKinds.includes('tests') ? (status === 'failed' ? 218 : 221) : null,
    failedTests: publicationKinds.includes('tests') ? (status === 'failed' ? 3 : 0) : null,
    publicationKinds,
  };
});

const projectedProjects = projects.map((project) => {
  const projectRuns = runs.filter((run) => run.projectId === project.id);
  const latest = projectRuns[0];
  return {
    ...project,
    isPublic: true,
    runCount: projectRuns.length,
    latestRunId: latest.id,
    latestStatus: latest.status,
    latestPublicationKinds: latest.publicationKinds,
    latestCompletedAt: latest.completedAt,
    latestLinesPct: latest.linesPct,
    totalTests: latest.totalTests || 0,
    passedTests: latest.passedTests || 0,
    failedTests: latest.failedTests || 0,
  };
});

function pageRuns({ after = null, projectKey = null } = {}) {
  const scoped = projectKey ? runs.filter((run) => run.projectKey === projectKey) : runs;
  const index = after ? scoped.findIndex((run) => run.cursor === after) + 1 : 0;
  return scoped.slice(Math.max(0, index), Math.max(0, index) + 51);
}

function failureEvidence(runId) {
  const run = runs.find((entry) => entry.id === runId);
  if (!run) return null;
  const failed = run.status === 'failed';
  return {
    runId: run.id,
    externalKey: run.externalKey,
    status: run.status,
    projectKey: run.projectKey,
    projectSlug: run.projectSlug,
    projectName: run.projectName,
    branch: run.branch,
    commitSha: run.commitSha,
    buildNumber: run.buildNumber,
    triggeredBy: 'github-actions',
    completedAt: run.completedAt,
    sourceUrl: run.sourceUrl,
    reportUrl: failed ? `/api/runs/${run.id}/report` : null,
    failedTest: failed ? {
      id: `test-${run.id}`,
      fullName: 'operations overview preserves the selected failed publication',
      status: 'failed',
      moduleName: 'web',
      filePath: 'tests/e2e/live-navigation-interaction.spec.js',
      line: 18,
      column: 3,
      failureMessages: ['Expected the selected run to remain visible after refresh.'],
    } : null,
    error: failed ? {
      level: 'error',
      code: 'ERR_ASSERTION',
      message: 'Expected the selected run to remain visible after refresh.',
      stack: 'AssertionError: Expected the selected run to remain visible after refresh.\n    at operations overview interaction test:18:3',
    } : null,
  };
}

const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/graphql') {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const query = String(payload.query || '');
      const variables = payload.variables || {};
      let data;
      if (query.includes('WebRunFailureEvidence')) {
        data = { runFailureEvidence: failureEvidence(variables.runId) };
      } else if (query.includes('WebRunFeedPage')) {
        data = { runFeed: pageRuns(variables) };
      } else if (query.includes('WebHome')) {
        data = {
          viewer: null,
          me: null,
          projects: projectedProjects,
          runFeed: pageRuns(),
        };
      } else {
        data = {};
      }
      const encoded = JSON.stringify({ data });
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(encoded),
        'server-timing': 'graphql;dur=4.2',
      });
      response.end(encoded);
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ errors: [{ message: error.message }] }));
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Operations overview GraphQL fixture listening on http://127.0.0.1:${port}/graphql\n`);
});
