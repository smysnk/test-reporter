import { createGraphqlAdminService } from './admin-service.js';
import { createIngestionService } from '../ingest/index.js';
import { createProjectAccessService } from './access-service.js';
import { createGraphqlContext } from './context.js';
import { mutationResolvers, mutationTypeDefs } from './mutations.js';
import { queryResolvers, queryTypeDefs } from './queries.js';
import { createGraphqlQueryService } from './query-service.js';
import { jsonScalarResolvers, jsonScalarTypeDefs } from './scalars.js';

export const schemaVersion = '1';

const commonTypeDefs = `#graphql
  ${jsonScalarTypeDefs}
`;

export const typeDefs = [commonTypeDefs, queryTypeDefs, mutationTypeDefs].join('\n');

export const resolvers = mergeResolvers(
  jsonScalarResolvers,
  queryResolvers,
  mutationResolvers,
);

export function createGraphqlServices(options = {}) {
  const accessService = options.accessService || createProjectAccessService(options);

  return {
    accessService,
    adminService: options.adminService || createGraphqlAdminService(options),
    queryService: options.queryService || createGraphqlQueryService({
      ...options,
      accessService,
    }),
    ingestionService: options.ingestionService || createIngestionService(options),
  };
}

export async function buildGraphqlContext({ req, options = {} }) {
  const services = createGraphqlServices(options);
  return createGraphqlContext({
    req,
    options,
    ...services,
  });
}

function mergeResolvers(...maps) {
  const merged = {};

  for (const map of maps) {
    for (const [typeName, resolverMap] of Object.entries(map || {})) {
      merged[typeName] = {
        ...(merged[typeName] || {}),
        ...resolverMap,
      };
    }
  }

  return merged;
}
