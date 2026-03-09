export const PORTAL_HOME_QUERY = `
  query PortalHomePage {
    me {
      id
      name
      email
      role
      projectKeys
    }
    projects {
      id
      key
      slug
      name
      defaultBranch
      repositoryUrl
    }
    runs(limit: 8) {
      id
      externalKey
      status
      branch
      completedAt
      durationMs
      project {
        key
        slug
        name
      }
      projectVersion {
        versionKey
      }
      coverageSnapshot {
        linesPct
      }
    }
  }
`;

export const PROJECT_BY_SLUG_QUERY = `
  query PortalProjectBySlug($slug: String!) {
    project(slug: $slug) {
      id
      key
      slug
      name
      defaultBranch
      repositoryUrl
      metadata
    }
  }
`;

export const PROJECT_ACTIVITY_QUERY = `
  query PortalProjectActivity($projectKey: String!) {
    runs(projectKey: $projectKey, limit: 12) {
      id
      externalKey
      status
      branch
      completedAt
      durationMs
      projectVersion {
        versionKey
      }
      coverageSnapshot {
        linesPct
      }
    }
    coverageTrend(projectKey: $projectKey, limit: 12) {
      runId
      externalKey
      completedAt
      versionKey
      linesPct
      branchesPct
      functionsPct
      statementsPct
    }
    releaseNotes(projectKey: $projectKey) {
      id
      title
      sourceUrl
      publishedAt
      body
      projectVersion {
        versionKey
      }
    }
  }
`;

export const RUN_SCOPE_TREND_CATALOG_QUERY = `
  query PortalRunScopeTrendCatalog($runId: ID!) {
    runPackages(runId: $runId) {
      name
      durationMs
      suiteCount
      coverage
    }
    runModules(runId: $runId) {
      module
      owner
      coverage
    }
    runFiles(runId: $runId) {
      path
      packageName
      moduleName
      failedTestCount
      testCount
      coverage
    }
  }
`;

export const SCOPED_COVERAGE_TREND_QUERY = `
  query ScopedCoverageTrend($projectKey: String!, $packageName: String, $moduleName: String, $filePath: String, $limit: Int) {
    coverageTrend(projectKey: $projectKey, packageName: $packageName, moduleName: $moduleName, filePath: $filePath, limit: $limit) {
      id
      runId
      externalKey
      scopeType
      scopeKey
      label
      recordedAt
      completedAt
      startedAt
      branch
      versionKey
      packageName
      moduleName
      filePath
      linesPct
      branchesPct
      functionsPct
      statementsPct
    }
  }
`;

export const RUN_DETAIL_QUERY = `
  query PortalRunDetail($runId: ID!) {
    run(id: $runId) {
      id
      externalKey
      status
      branch
      commitSha
      sourceProvider
      sourceRunId
      sourceUrl
      triggeredBy
      startedAt
      completedAt
      durationMs
      summary
      project {
        key
        slug
        name
      }
      projectVersion {
        versionKey
      }
      coverageSnapshot {
        linesPct
        branchesPct
        functionsPct
        statementsPct
      }
      suites {
        id
        suiteIdentifier
        label
        runtime
        status
        durationMs
        warnings
        summary
        tests {
          id
          fullName
          status
          durationMs
          moduleName
          themeName
          filePath
          line
          failureMessages
        }
      }
      artifacts {
        id
        label
        href
        kind
        mediaType
      }
    }
    runPackages(runId: $runId) {
      name
      status
      durationMs
      suiteCount
      summary
      frameworks
    }
    runModules(runId: $runId) {
      module
      owner
      durationMs
      packageCount
      packages
      frameworks
      coverage
    }
    runFiles(runId: $runId) {
      path
      packageName
      moduleName
      language
      status
      testCount
      failedTestCount
      coverage
    }
    tests(runId: $runId, status: "failed") {
      id
      fullName
      status
      moduleName
      themeName
      filePath
      line
      failureMessages
    }
    runCoverageComparison(runId: $runId) {
      runId
      previousRunId
      currentExternalKey
      previousExternalKey
      currentVersionKey
      previousVersionKey
      currentLinesPct
      previousLinesPct
      deltaLinesPct
      packageChanges {
        scopeType
        label
        packageName
        moduleName
        filePath
        currentLinesPct
        previousLinesPct
        deltaLinesPct
      }
      moduleChanges {
        scopeType
        label
        packageName
        moduleName
        filePath
        currentLinesPct
        previousLinesPct
        deltaLinesPct
      }
      fileChanges {
        scopeType
        label
        packageName
        moduleName
        filePath
        currentLinesPct
        previousLinesPct
        deltaLinesPct
      }
    }
  }
`;
