import { requireAdminActor } from './guards.js';

export const queryTypeDefs = `#graphql
  type Actor {
    id: ID!
    userId: ID
    email: String
    name: String
    role: String!
    isAdmin: Boolean!
    isGuest: Boolean!
    roleKeys: [String!]!
    groupKeys: [String!]!
  }

  type Project {
    id: ID!
    key: String!
    slug: String!
    name: String!
    repositoryUrl: String
    defaultBranch: String
    metadata: JSON
  }

  type ProjectVersion {
    id: ID!
    versionKey: String!
    versionKind: String!
    branch: String
    tag: String
    commitSha: String
    semanticVersion: String
    buildNumber: Int
    releaseName: String
    releasedAt: String
    metadata: JSON
  }

  type CoverageSnapshot {
    id: ID!
    runId: ID!
    linesCovered: Int
    linesTotal: Int
    linesPct: Float
    branchesCovered: Int
    branchesTotal: Int
    branchesPct: Float
    functionsCovered: Int
    functionsTotal: Int
    functionsPct: Float
    statementsCovered: Int
    statementsTotal: Int
    statementsPct: Float
    metadata: JSON
  }

  type SuiteRun {
    id: ID!
    runId: ID!
    projectPackageId: ID
    packageName: String
    suiteIdentifier: String!
    label: String!
    runtime: String!
    command: String
    cwd: String
    status: String!
    durationMs: Int
    summary: JSON
    warnings: [String!]!
    rawArtifacts: JSON
    output: JSON
    metadata: JSON
    tests: [TestExecution!]!
  }

  type TestExecution {
    id: ID!
    suiteRunId: ID!
    projectModuleId: ID
    projectFileId: ID
    suiteIdentifier: String
    suiteLabel: String
    packageName: String
    name: String!
    fullName: String!
    status: String!
    durationMs: Int
    filePath: String
    line: Int
    column: Int
    classificationSource: String
    moduleName: String
    themeName: String
    assertions: [String!]!
    setup: [String!]!
    mocks: [String!]!
    failureMessages: [String!]!
    rawDetails: JSON
    sourceSnippet: String
    metadata: JSON
  }

  type Artifact {
    id: ID!
    runId: ID
    suiteRunId: ID
    testExecutionId: ID
    label: String
    relativePath: String
    href: String
    kind: String!
    mediaType: String
    storageKey: String
    sourceUrl: String
    metadata: JSON
  }

  type ReleaseNote {
    id: ID!
    projectId: ID!
    projectVersionId: ID
    title: String!
    body: String!
    sourceUrl: String
    publishedAt: String
    metadata: JSON
    projectVersion: ProjectVersion
  }

  type Run {
    id: ID!
    projectId: ID!
    projectVersionId: ID
    externalKey: String!
    sourceProvider: String
    sourceRunId: String
    sourceUrl: String
    triggeredBy: String
    branch: String
    commitSha: String
    startedAt: String
    completedAt: String
    durationMs: Int
    status: String!
    reportSchemaVersion: String
    rawReport: JSON
    summary: JSON
    metadata: JSON
    project: Project
    projectVersion: ProjectVersion
    coverageSnapshot: CoverageSnapshot
    suites: [SuiteRun!]!
    artifacts: [Artifact!]!
  }

  type RunFeedEntry {
    id: ID!
    externalKey: String!
    status: String!
    branch: String
    commitSha: String
    sourceRunId: String
    sourceUrl: String
    completedAt: String
    durationMs: Int
    projectId: ID!
    projectKey: String!
    projectSlug: String!
    projectName: String!
    projectRepositoryUrl: String
    versionKey: String
    buildNumber: Int
    linesPct: Float
    totalTests: Int
    passedTests: Int
    failedTests: Int
  }

  type RunPackageSummary {
    name: String!
    location: String
    status: String
    durationMs: Int
    summary: JSON
    coverage: JSON
    modules: [String!]!
    frameworks: [String!]!
    suiteCount: Int!
  }

  type RunModuleSummary {
    module: String!
    owner: String
    summary: JSON
    durationMs: Int
    packageCount: Int!
    packages: [String!]!
    frameworks: [String!]!
    dominantPackages: [String!]!
    coverage: JSON
    themes: JSON
  }

  type RunFile {
    path: String!
    packageName: String
    moduleName: String
    language: String
    status: String!
    testCount: Int!
    failedTestCount: Int!
    coverage: JSON
    tests: [TestExecution!]!
  }

  type CoverageTrendPoint {
    id: ID!
    runId: ID!
    externalKey: String!
    scopeType: String!
    scopeKey: String!
    label: String!
    recordedAt: String!
    completedAt: String
    startedAt: String
    branch: String
    versionKey: String
    packageName: String
    moduleName: String
    filePath: String
    linesPct: Float
    branchesPct: Float
    functionsPct: Float
    statementsPct: Float
  }

  type CoverageChange {
    scopeType: String!
    label: String!
    packageName: String
    moduleName: String
    filePath: String
    currentLinesPct: Float
    previousLinesPct: Float
    deltaLinesPct: Float
  }

  type RunCoverageComparison {
    runId: ID!
    previousRunId: ID
    currentExternalKey: String!
    previousExternalKey: String
    currentVersionKey: String
    previousVersionKey: String
    currentLinesPct: Float
    previousLinesPct: Float
    deltaLinesPct: Float
    packageChanges: [CoverageChange!]!
    moduleChanges: [CoverageChange!]!
    fileChanges: [CoverageChange!]!
  }

  type AdminUser {
    id: ID!
    email: String!
    normalizedEmail: String!
    name: String
    avatarUrl: String
    isAdmin: Boolean!
    roleKeys: [String!]!
    groupKeys: [String!]!
  }

  type AdminRole {
    id: ID!
    key: String!
    name: String!
    description: String
    userCount: Int!
    projectCount: Int!
  }

  type AdminGroup {
    id: ID!
    key: String!
    name: String!
    description: String
    userCount: Int!
    projectCount: Int!
  }

  type AdminProjectAccess {
    project: Project!
    isPublic: Boolean!
    roleKeys: [String!]!
    groupKeys: [String!]!
    roles: [AdminRole!]!
    groups: [AdminGroup!]!
  }

  type Query {
    schemaVersion: String!
    serviceStatus: String!
    viewer: Actor
    me: Actor
    projects: [Project!]!
    project(id: ID, key: String, slug: String): Project
    runFeed(limit: Int): [RunFeedEntry!]!
    runs(projectId: ID, projectKey: String, status: String, limit: Int): [Run!]!
    run(id: ID, externalKey: String): Run
    runPackages(runId: ID!): [RunPackageSummary!]!
    runModules(runId: ID!): [RunModuleSummary!]!
    runFiles(runId: ID!, packageName: String, moduleName: String, status: String): [RunFile!]!
    tests(runId: ID!, status: String, packageName: String, moduleName: String, filePath: String): [TestExecution!]!
    coverageTrend(projectId: ID, projectKey: String, packageName: String, moduleName: String, filePath: String, limit: Int): [CoverageTrendPoint!]!
    runCoverageComparison(runId: ID!): RunCoverageComparison
    artifacts(runId: ID, suiteRunId: ID, testExecutionId: ID): [Artifact!]!
    releaseNotes(projectId: ID, projectKey: String, versionId: ID, versionKey: String): [ReleaseNote!]!
    adminUsers: [AdminUser!]!
    adminUser(id: ID, email: String): AdminUser
    adminRoles: [AdminRole!]!
    adminGroups: [AdminGroup!]!
    adminProjects: [AdminProjectAccess!]!
    adminProjectAccess(projectId: ID, key: String, slug: String): AdminProjectAccess
  }
`;

export const queryResolvers = {
  Query: {
    schemaVersion: () => '1',
    serviceStatus: () => 'phase-8-access-control',
    viewer: (_root, _args, context) => resolveViewer(context),
    me: (_root, _args, context) => resolveViewer(context),
    projects: (_root, _args, context) => context.queryService.listProjects({ actor: context.actor }),
    project: (_root, args, context) => context.queryService.findProject({ ...args, actor: context.actor }),
    runFeed: (_root, args, context) => context.queryService.listRunFeed({ ...args, actor: context.actor }),
    runs: (_root, args, context) => context.queryService.listRuns({ ...args, actor: context.actor }),
    run: (_root, args, context) => context.queryService.findRun({ ...args, actor: context.actor }),
    runPackages: (_root, args, context) => context.queryService.listRunPackages({ ...args, actor: context.actor }),
    runModules: (_root, args, context) => context.queryService.listRunModules({ ...args, actor: context.actor }),
    runFiles: (_root, args, context) => context.queryService.listRunFiles({ ...args, actor: context.actor }),
    tests: (_root, args, context) => context.queryService.listTestsForRun({ ...args, actor: context.actor }),
    coverageTrend: (_root, args, context) => context.queryService.listCoverageTrend({ ...args, actor: context.actor }),
    runCoverageComparison: (_root, args, context) => context.queryService.getRunCoverageComparison({ ...args, actor: context.actor }),
    artifacts: (_root, args, context) => context.queryService.listArtifacts({ ...args, actor: context.actor }),
    releaseNotes: (_root, args, context) => context.queryService.listReleaseNotes({ ...args, actor: context.actor }),
    adminUsers: (_root, _args, context) => {
      requireAdminActor(context);
      return context.adminService.listUsers();
    },
    adminUser: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.findUser(args);
    },
    adminRoles: (_root, _args, context) => {
      requireAdminActor(context);
      return context.adminService.listRoles();
    },
    adminGroups: (_root, _args, context) => {
      requireAdminActor(context);
      return context.adminService.listGroups();
    },
    adminProjects: (_root, _args, context) => {
      requireAdminActor(context);
      return context.adminService.listProjectAccesses();
    },
    adminProjectAccess: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.getProjectAccess(args);
    },
  },
  Run: {
    suites: (run, _args, context) => context.queryService.listSuitesForRun({ runId: run.id, actor: context.actor }),
    coverageSnapshot: (run, _args, context) => (
      run.coverageSnapshot
      || context.queryService.getCoverageSnapshotForRun({ runId: run.id, actor: context.actor })
    ),
    artifacts: (run, _args, context) => context.queryService.listArtifacts({ runId: run.id, actor: context.actor }),
  },
  SuiteRun: {
    tests: (suite, _args, context) => context.queryService.listTestsForSuiteRun({ suiteRunId: suite.id, actor: context.actor }),
  },
};

function resolveViewer(context) {
  return context?.actor && context.actor.isGuest !== true
    ? context.actor
    : null;
}
