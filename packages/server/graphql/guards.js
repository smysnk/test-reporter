import { GraphQLError } from 'graphql';

export function requireActor(context) {
  if (context?.actor) {
    return context.actor;
  }

  throw createGraphqlAuthError(401, 'UNAUTHORIZED', 'Authentication is required for this GraphQL operation.');
}

export function requireAdminActor(context) {
  const actor = requireActor(context);
  if (isAdminActor(actor)) {
    return actor;
  }

  throw createGraphqlAuthError(403, 'FORBIDDEN', 'Admin access is required for this GraphQL operation.');
}

export function requireServiceOrAdminActor(context) {
  if (context?.auth?.subject === 'shared-key') {
    return {
      type: 'service',
      subject: 'shared-key',
    };
  }

  return requireAdminActor(context);
}

export function requireProjectAccess(context, projectKey) {
  const actor = requireActor(context);
  if (hasProjectAccess(actor, projectKey)) {
    return actor;
  }

  throw createGraphqlAuthError(403, 'FORBIDDEN', `Actor does not have access to project ${projectKey}.`);
}

export function hasProjectAccess(actor, projectKey) {
  if (!actor || !projectKey) {
    return false;
  }
  if (isAdminActor(actor)) {
    return true;
  }
  return Array.isArray(actor.projectKeys)
    && (actor.projectKeys.includes('*') || actor.projectKeys.includes(projectKey));
}

export function isAdminActor(actor) {
  return actor?.role === 'admin';
}

export function createGraphqlAuthError(status, code, message) {
  return new GraphQLError(message, {
    extensions: {
      code,
      http: {
        status,
      },
    },
  });
}
