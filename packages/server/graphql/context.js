import { authenticateSharedKeyRequest } from '../ingest/auth.js';

export async function createGraphqlContext({ req, options = {}, queryService, ingestionService }) {
  const actor = await resolveActorFromRequest(req, options);
  const auth = authenticateSharedKeyRequest(req, options, {
    allowMissing: true,
    allowInvalid: true,
    ignoreMissingConfig: true,
  });

  return {
    requestId: req.headers['x-request-id'] || null,
    actor,
    auth,
    queryService,
    ingestionService,
  };
}

export async function resolveActorFromRequest(req, options = {}) {
  if (typeof options.resolveActor === 'function') {
    const resolved = await options.resolveActor(req);
    return normalizeActor(resolved);
  }

  const id = readHeader(req, 'x-test-station-actor-id');
  const email = readHeader(req, 'x-test-station-actor-email');
  const name = readHeader(req, 'x-test-station-actor-name');

  if (!id && !email) {
    return null;
  }

  return normalizeActor({
    id: id || email,
    email,
    name: name || email || id,
    role: readHeader(req, 'x-test-station-actor-role') || 'member',
    projectKeys: splitHeaderValues(readHeader(req, 'x-test-station-actor-project-keys')),
  });
}

function normalizeActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return null;
  }

  const id = typeof actor.id === 'string' && actor.id.trim() ? actor.id.trim() : null;
  const email = typeof actor.email === 'string' && actor.email.trim() ? actor.email.trim() : null;
  if (!id && !email) {
    return null;
  }

  return {
    id: id || email,
    email,
    name: typeof actor.name === 'string' && actor.name.trim() ? actor.name.trim() : (email || id),
    role: typeof actor.role === 'string' && actor.role.trim() ? actor.role.trim() : 'member',
    projectKeys: Array.from(new Set(
      (Array.isArray(actor.projectKeys) ? actor.projectKeys : [])
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean),
    )),
  };
}

function readHeader(req, headerName) {
  const value = req.headers[headerName];
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return typeof value === 'string' ? value : '';
}

function splitHeaderValues(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
