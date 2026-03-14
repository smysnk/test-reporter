import { requireAdminActor, requireServiceOrAdminActor } from './guards.js';

export const mutationTypeDefs = `#graphql
  input AdminRoleCreateInput {
    key: String!
    name: String!
    description: String
    metadata: JSON
  }

  input AdminRoleUpdateInput {
    key: String
    name: String
    description: String
    metadata: JSON
  }

  input AdminGroupCreateInput {
    key: String!
    name: String!
    description: String
    metadata: JSON
  }

  input AdminGroupUpdateInput {
    key: String
    name: String
    description: String
    metadata: JSON
  }

  type IngestCounts {
    packages: Int!
    modules: Int!
    files: Int!
    suites: Int!
    tests: Int!
    coverageFiles: Int!
    artifacts: Int!
    errors: Int!
  }

  type IngestRunResult {
    projectId: ID!
    projectVersionId: ID
    runId: ID!
    externalKey: String!
    created: Boolean!
    counts: IngestCounts!
  }

  type Mutation {
    ingestRun(projectKey: String!, report: JSON!, source: JSON, artifacts: JSON): IngestRunResult!
    adminCreateRole(input: AdminRoleCreateInput!): AdminRole!
    adminUpdateRole(id: ID!, input: AdminRoleUpdateInput!): AdminRole!
    adminDeleteRole(id: ID!): AdminRole!
    adminCreateGroup(input: AdminGroupCreateInput!): AdminGroup!
    adminUpdateGroup(id: ID!, input: AdminGroupUpdateInput!): AdminGroup!
    adminDeleteGroup(id: ID!): AdminGroup!
    adminSetUserAdmin(userId: ID!, isAdmin: Boolean!): AdminUser!
    adminAddUserRole(userId: ID!, roleId: ID!): AdminUser!
    adminRemoveUserRole(userId: ID!, roleId: ID!): AdminUser!
    adminAddUserGroup(userId: ID!, groupId: ID!): AdminUser!
    adminRemoveUserGroup(userId: ID!, groupId: ID!): AdminUser!
    adminSetProjectPublic(projectId: ID!, isPublic: Boolean!): AdminProjectAccess!
    adminAddProjectRoleAccess(projectId: ID!, roleId: ID!): AdminProjectAccess!
    adminRemoveProjectRoleAccess(projectId: ID!, roleId: ID!): AdminProjectAccess!
    adminAddProjectGroupAccess(projectId: ID!, groupId: ID!): AdminProjectAccess!
    adminRemoveProjectGroupAccess(projectId: ID!, groupId: ID!): AdminProjectAccess!
  }
`;

export const mutationResolvers = {
  Mutation: {
    ingestRun: async (_root, args, context) => {
      requireServiceOrAdminActor(context);
      const artifacts = Array.isArray(args.artifacts) ? args.artifacts : [];
      const source = args.source && typeof args.source === 'object' ? args.source : {};

      return context.ingestionService.ingest({
        projectKey: args.projectKey,
        report: args.report,
        source,
        artifacts,
      }, {
        requestId: context.requestId,
      });
    },
    adminCreateRole: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.createRole({ input: args.input });
    },
    adminUpdateRole: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.updateRole({ id: args.id, input: args.input });
    },
    adminDeleteRole: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.deleteRole({ id: args.id });
    },
    adminCreateGroup: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.createGroup({ input: args.input });
    },
    adminUpdateGroup: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.updateGroup({ id: args.id, input: args.input });
    },
    adminDeleteGroup: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.deleteGroup({ id: args.id });
    },
    adminSetUserAdmin: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.setUserAdmin({ userId: args.userId, isAdmin: args.isAdmin });
    },
    adminAddUserRole: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.addUserRole({ userId: args.userId, roleId: args.roleId });
    },
    adminRemoveUserRole: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.removeUserRole({ userId: args.userId, roleId: args.roleId });
    },
    adminAddUserGroup: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.addUserGroup({ userId: args.userId, groupId: args.groupId });
    },
    adminRemoveUserGroup: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.removeUserGroup({ userId: args.userId, groupId: args.groupId });
    },
    adminSetProjectPublic: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.setProjectPublic({ projectId: args.projectId, isPublic: args.isPublic });
    },
    adminAddProjectRoleAccess: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.addProjectRoleAccess({ projectId: args.projectId, roleId: args.roleId });
    },
    adminRemoveProjectRoleAccess: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.removeProjectRoleAccess({ projectId: args.projectId, roleId: args.roleId });
    },
    adminAddProjectGroupAccess: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.addProjectGroupAccess({ projectId: args.projectId, groupId: args.groupId });
    },
    adminRemoveProjectGroupAccess: (_root, args, context) => {
      requireAdminActor(context);
      return context.adminService.removeProjectGroupAccess({ projectId: args.projectId, groupId: args.groupId });
    },
  },
};
