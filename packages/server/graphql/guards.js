import { GraphQLError } from 'graphql';

export function requireActor(context) {
  if (context?.actor && context.actor.isGuest !== true) {
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

export async function requireProjectAccess(context, projectOrKey) {
  const actor = requireActor(context);
  if (await hasProjectAccess(actor, projectOrKey, context?.accessService)) {
    return actor;
  }

  throw createGraphqlAuthError(403, 'FORBIDDEN', `Actor does not have access to project ${String(projectOrKey)}.`);
}

export async function hasProjectAccess(actor, projectOrKey, accessService) {
  if (!actor || !projectOrKey) {
    return false;
  }

  if (accessService) {
    if (typeof projectOrKey === 'string') {
      return accessService.canViewProjectByKey({ actor, projectKey: projectOrKey });
    }

    return accessService.canViewProject({ actor, project: projectOrKey });
  }

  if (actor.isGuest === true) {
    return Boolean(projectOrKey?.isPublic === true);
  }

  if (isAdminActor(actor)) {
    return true;
  }

  return false;
}

export function isAdminActor(actor) {
  return actor?.isAdmin === true || actor?.role === 'admin';
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
