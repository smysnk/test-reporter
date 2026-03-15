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
    }
    runFeed(limit: 24) {
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
    }
  }
`;

export const PROJECT_ACTIVITY_QUERY = `
  query WebProjectActivity($projectKey: String!) {
    runs(projectKey: $projectKey, limit: 12) {
      id
      externalKey
      status
      branch
      commitSha
      sourceRunId
      sourceUrl
      completedAt
      durationMs
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

export const RUN_SCOPE_TREND_CATALOG_QUERY = `
  query WebRunScopeTrendCatalog($runId: ID!) {
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
      roleKeys
      groupKeys
    }
    adminRoles {
      id
      key
      name
      description
      userCount
      projectCount
    }
    adminGroups {
      id
      key
      name
      description
      userCount
      projectCount
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
      roleKeys
      groupKeys
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
      roleKeys
      groupKeys
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
      roleKeys
      groupKeys
      roles {
        id
        key
        name
        description
        userCount
        projectCount
      }
      groups {
        id
        key
        name
        description
        userCount
        projectCount
      }
    }
    adminRoles {
      id
      key
      name
      description
      userCount
      projectCount
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
      roleKeys
      groupKeys
    }
    adminRoles {
      id
      key
      name
      description
      userCount
      projectCount
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

export const ADMIN_CREATE_ROLE_MUTATION = `
  mutation AdminCreateRole($input: AdminRoleCreateInput!) {
    adminCreateRole(input: $input) {
      id
    }
  }
`;

export const ADMIN_UPDATE_ROLE_MUTATION = `
  mutation AdminUpdateRole($id: ID!, $input: AdminRoleUpdateInput!) {
    adminUpdateRole(id: $id, input: $input) {
      id
    }
  }
`;

export const ADMIN_DELETE_ROLE_MUTATION = `
  mutation AdminDeleteRole($id: ID!) {
    adminDeleteRole(id: $id) {
      id
    }
  }
`;

export const ADMIN_CREATE_GROUP_MUTATION = `
  mutation AdminCreateGroup($input: AdminGroupCreateInput!) {
    adminCreateGroup(input: $input) {
      id
    }
  }
`;

export const ADMIN_UPDATE_GROUP_MUTATION = `
  mutation AdminUpdateGroup($id: ID!, $input: AdminGroupUpdateInput!) {
    adminUpdateGroup(id: $id, input: $input) {
      id
    }
  }
`;

export const ADMIN_DELETE_GROUP_MUTATION = `
  mutation AdminDeleteGroup($id: ID!) {
    adminDeleteGroup(id: $id) {
      id
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

export const ADMIN_ADD_PROJECT_ROLE_ACCESS_MUTATION = `
  mutation AdminAddProjectRoleAccess($projectId: ID!, $roleId: ID!) {
    adminAddProjectRoleAccess(projectId: $projectId, roleId: $roleId) {
      project {
        id
      }
    }
  }
`;

export const ADMIN_REMOVE_PROJECT_ROLE_ACCESS_MUTATION = `
  mutation AdminRemoveProjectRoleAccess($projectId: ID!, $roleId: ID!) {
    adminRemoveProjectRoleAccess(projectId: $projectId, roleId: $roleId) {
      project {
        id
      }
    }
  }
`;

export const ADMIN_ADD_PROJECT_GROUP_ACCESS_MUTATION = `
  mutation AdminAddProjectGroupAccess($projectId: ID!, $groupId: ID!) {
    adminAddProjectGroupAccess(projectId: $projectId, groupId: $groupId) {
      project {
        id
      }
    }
  }
`;

export const ADMIN_REMOVE_PROJECT_GROUP_ACCESS_MUTATION = `
  mutation AdminRemoveProjectGroupAccess($projectId: ID!, $groupId: ID!) {
    adminRemoveProjectGroupAccess(projectId: $projectId, groupId: $groupId) {
      project {
        id
      }
    }
  }
`;
