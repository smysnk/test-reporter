export const WEB_HOME_QUERY = `
  query WebHomePage {
    viewer {
      id
      name
      email
      role
    }
    projects {
      id
      key
      slug
      name
      defaultBranch
      repositoryUrl
      runCount
      latestRunId
      latestStatus
      latestCompletedAt
      latestLinesPct
      totalTests
      passedTests
      failedTests
    }
    runFeed(limit: 11) {
      id
      externalKey
      status
      branch
      commitSha
      sourceRunId
      sourceUrl
      completedAt
      durationMs
      projectId
      projectKey
      projectSlug
      projectName
      projectRepositoryUrl
      versionKey
      buildNumber
      linesPct
      totalTests
      passedTests
      failedTests
      cursor
    }
  }
`;

export const WEB_RUN_FEED_PAGE_QUERY = `
  query WebRunFeedPage($after: String, $projectKey: String) {
    runFeed(limit: 31, after: $after, projectKey: $projectKey) {
      id
      externalKey
      status
      branch
      commitSha
      sourceRunId
      sourceUrl
      completedAt
      durationMs
      projectId
      projectKey
      projectSlug
      projectName
      projectRepositoryUrl
      versionKey
      buildNumber
      linesPct
      totalTests
      passedTests
      failedTests
      cursor
    }
  }
`;

export const PROJECT_BY_SLUG_QUERY = `
  query WebProjectBySlug($slug: String!) {
    project(slug: $slug) {
      id
      key
      slug
      name
      defaultBranch
      repositoryUrl
      metadata
      runCount
      latestRunId
      latestStatus
      latestCompletedAt
      latestLinesPct
      totalTests
      passedTests
      failedTests
    }
  }
`;

export const PROJECT_ACTIVITY_QUERY = `
  query WebProjectActivity($projectKey: String!) {
    runs(projectKey: $projectKey, limit: 30) {
      id
      externalKey
      status
      branch
      commitSha
      sourceRunId
      sourceUrl
      completedAt
      durationMs
      summary
      projectVersion {
        versionKey
        buildNumber
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
        buildNumber
      }
    }
  }
`;

export const PROJECT_BENCHMARK_OVERVIEW_QUERY = `
  query WebProjectBenchmarkOverview($projectKey: String!) {
    benchmarkCatalog(projectKey: $projectKey) {
      projectKey
      statGroup
      statNames
      units
      seriesIds
      runnerKeys
      latestCompletedAt
      pointCount
    }
    benchmarkSummary(projectKey: $projectKey) {
      projectId
      projectKey
      latestRunId
      latestExternalKey
      latestVersionKey
      latestCompletedAt
      namespaceCount
      metricCount
      seriesCount
      latestRunRegressionCount
      topChanges(limit: 8) {
        statGroup
        statName
        unit
        metricCount
        status
        directionStatus
        budgetStatus
        lowerIsBetter
        warningThresholdPct
        severeThresholdPct
        semanticsSource
        latestRunId
        latestExternalKey
        latestVersionKey
        latestCompletedAt
        latestBranch
        latestRunnerKey
        latestSeriesId
        latestValue
        previousRunId
        previousExternalKey
        previousVersionKey
        previousCompletedAt
        previousValue
        deltaValue
        deltaPercent
        baselineId
        baselineRunId
        baselineValue
        baselineDeltaValue
        baselineDeltaPercent
        baselineStatus
      }
      topRegressions(limit: 1) {
        statGroup
        statName
        deltaPercent
      }
      topImprovements(limit: 1) {
        statGroup
        statName
        deltaPercent
      }
      namespaces {
        statGroup
        primaryMetricName
        status
        latestCompletedAt
        metricCount
        seriesCount
        pointCount
        regressionCount
        warningCount
        severeRegressionCount
      }
    }
  }
`;

export const BADGE_SUMMARY_QUERY = `
  query WebBadgeSummary($projectKey: String!) {
    badgeSummary(projectKey: $projectKey) {
      totalTests
      passedTests
      failedTests
      skippedTests
      linesPct
    }
  }
`;

export const PERFORMANCE_TREND_QUERY = `
  query WebPerformanceTrend($projectKey: String!, $statGroup: String!, $statName: String!, $limit: Int) {
    performanceTrend(projectKey: $projectKey, statGroup: $statGroup, statName: $statName, limit: $limit) {
      id
      runId
      suiteRunId
      testExecutionId
      projectId
      projectKey
      externalKey
      versionKey
      completedAt
      branch
      commitSha
      buildNumber
      statGroup
      statName
      numericValue
      textValue
      unit
      seriesId
      runnerKey
      metadata
    }
  }
`;

export const PERFORMANCE_TRENDS_QUERY = `
  query WebPerformanceTrends($projectKey: String!, $metrics: [PerformanceMetricSelectionInput!]!, $limit: Int!) {
    performanceTrends(projectKey: $projectKey, metrics: $metrics, limit: $limit) {
      statGroup
      statName
      points {
        runId
        externalKey
        versionKey
        completedAt
        branch
        commitSha
        buildNumber
        statGroup
        statName
        numericValue
        textValue
        unit
        seriesId
        runnerKey
        metadata
      }
    }
  }
`;

export const RUN_PROJECT_HISTORY_QUERY = `
  query WebRunProjectHistory($projectKey: String!) {
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
        buildNumber
      }
    }
    benchmarkCatalog(projectKey: $projectKey) {
      projectKey
      statGroup
      statNames
      units
      seriesIds
      runnerKeys
      latestCompletedAt
      pointCount
    }
  }
`;

export const RUN_SCOPE_TREND_CATALOG_QUERY = `
  query WebRunScopeTrendCatalog($runId: ID!) {
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
  query WebRunDetail($runId: ID!) {
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
      project {
        key
        slug
        name
        repositoryUrl
      }
      projectVersion {
        versionKey
        buildNumber
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
      frameworks
    }
    runModules(runId: $runId) {
      module
      owner
      packageCount
      packages
      coverage
    }
    runFiles(runId: $runId) {
      path
      moduleName
      status
      testCount
      failedTestCount
      coverage
    }
    tests(runId: $runId, status: "failed", limit: 20) {
      id
      fullName
      status
      moduleName
      filePath
      failureMessages
    }
    runPerformanceStats(runId: $runId, statGroupPrefix: "benchmark.") {
      id
      runId
      suiteRunId
      testExecutionId
      projectKey
      completedAt
      branch
      commitSha
      statGroup
      statName
      numericValue
      unit
      seriesId
      runnerKey
      metadata
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

export const SUITE_TESTS_QUERY = `
  query WebSuiteTests($runId: ID!, $suiteRunId: ID!, $limit: Int!, $after: ID, $status: String, $search: String) {
    testsForSuite(runId: $runId, suiteRunId: $suiteRunId, limit: $limit, after: $after, status: $status, search: $search) {
      id
      fullName
      status
      durationMs
      filePath
    }
  }
`;

export const RUN_HEADER_QUERY = `
  query WebRunHeader($runId: ID!) {
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
        repositoryUrl
      }
      projectVersion {
        versionKey
        buildNumber
      }
      coverageSnapshot {
        linesPct
        branchesPct
        functionsPct
        statementsPct
      }
      suites {
        id
      }
    }
  }
`;

export const RUN_REPORT_QUERY = `
  query WebRunReport($runId: ID!) {
    run(id: $runId) {
      id
      externalKey
      project {
        name
      }
      rawReport
      artifacts {
        relativePath
        sourceUrl
        storageKey
        mediaType
        metadata
      }
    }
  }
`;

export const VIEWER_ACCESS_QUERY = `
  query WebViewerAccess {
    viewer {
      id
      userId
      email
      name
      role
      isAdmin
      isGuest
      roleKeys
      groupKeys
    }
  }
`;

export const ADMIN_OVERVIEW_QUERY = `
  query AdminOverviewPage {
    viewer {
      id
      email
      name
      role
      isAdmin
    }
    adminUsers {
      id
      email
      name
      isAdmin
    }
    adminProjects {
      project {
        id
        key
        slug
        name
        repositoryUrl
        defaultBranch
      }
      isPublic
    }
  }
`;

export const ADMIN_PROJECTS_QUERY = `
  query AdminProjectsPage {
    viewer {
      id
      email
      name
      role
      isAdmin
    }
    adminProjects {
      project {
        id
        key
        slug
        name
        repositoryUrl
        defaultBranch
      }
      isPublic
    }
  }
`;

export const ADMIN_PROJECT_ACCESS_QUERY = `
  query AdminProjectAccessPage($slug: String!) {
    viewer {
      id
      email
      name
      role
      isAdmin
    }
    adminProjectAccess(slug: $slug) {
      project {
        id
        key
        slug
        name
        repositoryUrl
        defaultBranch
      }
      isPublic
    }
  }
`;

export const ADMIN_ROLES_QUERY = `
  query AdminRolesPage {
    viewer {
      id
      email
      name
      role
      isAdmin
    }
    adminRoles {
      id
      key
      name
      description
      userCount
      projectCount
    }
  }
`;

export const ADMIN_GROUPS_QUERY = `
  query AdminGroupsPage {
    viewer {
      id
      email
      name
      role
      isAdmin
    }
    adminGroups {
      id
      key
      name
      description
      userCount
      projectCount
    }
  }
`;

export const ADMIN_USERS_QUERY = `
  query AdminUsersPage {
    viewer {
      id
      email
      name
      role
      isAdmin
    }
    adminUsers {
      id
      email
      normalizedEmail
      name
      avatarUrl
      isAdmin
    }
  }
`;

export const ADMIN_SET_USER_ADMIN_MUTATION = `
  mutation AdminSetUserAdmin($userId: ID!, $isAdmin: Boolean!) {
    adminSetUserAdmin(userId: $userId, isAdmin: $isAdmin) {
      id
    }
  }
`;

export const ADMIN_ADD_USER_ROLE_MUTATION = `
  mutation AdminAddUserRole($userId: ID!, $roleId: ID!) {
    adminAddUserRole(userId: $userId, roleId: $roleId) {
      id
    }
  }
`;

export const ADMIN_REMOVE_USER_ROLE_MUTATION = `
  mutation AdminRemoveUserRole($userId: ID!, $roleId: ID!) {
    adminRemoveUserRole(userId: $userId, roleId: $roleId) {
      id
    }
  }
`;

export const ADMIN_ADD_USER_GROUP_MUTATION = `
  mutation AdminAddUserGroup($userId: ID!, $groupId: ID!) {
    adminAddUserGroup(userId: $userId, groupId: $groupId) {
      id
    }
  }
`;

export const ADMIN_REMOVE_USER_GROUP_MUTATION = `
  mutation AdminRemoveUserGroup($userId: ID!, $groupId: ID!) {
    adminRemoveUserGroup(userId: $userId, groupId: $groupId) {
      id
    }
  }
`;

export const ADMIN_SET_PROJECT_PUBLIC_MUTATION = `
  mutation AdminSetProjectPublic($projectId: ID!, $isPublic: Boolean!) {
    adminSetProjectPublic(projectId: $projectId, isPublic: $isPublic) {
      project {
        id
      }
    }
  }
`;
