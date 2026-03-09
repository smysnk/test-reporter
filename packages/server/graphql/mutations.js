import { requireServiceOrAdminActor } from './guards.js';

export const mutationTypeDefs = `#graphql
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
  },
};
