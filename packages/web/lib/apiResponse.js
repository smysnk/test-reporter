export function sendApiError(res, { status = 500, code = 'INTERNAL_ERROR', message = 'The request could not be completed.', requestId = null } = {}) {
  return res.status(status).json({
    error: {
      code,
      message,
      requestId: requestId || null,
    },
  });
}

export function sendApiResource(res, data, {
  status = 200,
  requestId = null,
  generatedAt = new Date().toISOString(),
  staleAt = null,
  cache = 'private, max-age=15, stale-while-revalidate=45',
  meta = {},
} = {}) {
  res.setHeader('Cache-Control', cache);
  return res.status(status).json({
    data,
    meta: {
      requestId: requestId || null,
      generatedAt,
      staleAt,
      ...meta,
    },
  });
}

export function isApiResourceEnvelope(value) {
  return Boolean(value && typeof value === 'object' && 'data' in value
    && value.meta && typeof value.meta === 'object'
    && typeof value.meta.generatedAt === 'string');
}

export function requireGet(req, res, requestId = null) {
  if (req.method === 'GET') return true;
  res.setHeader('Allow', 'GET');
  sendApiError(res, {
    status: 405,
    code: 'METHOD_NOT_ALLOWED',
    message: 'Only GET requests are supported.',
    requestId,
  });
  return false;
}

export function readRequiredQueryString(req, res, name, requestId = null) {
  const value = typeof req.query?.[name] === 'string' ? req.query[name].trim() : '';
  if (value) return value;
  sendApiError(res, {
    status: 400,
    code: 'INVALID_REQUEST',
    message: `${name} is required.`,
    requestId,
  });
  return null;
}

export function sendUnexpectedApiError(res, error, requestId = null, fallbackMessage = 'The request could not be completed.') {
  const status = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500
    ? error.statusCode
    : 500;
  return sendApiError(res, {
    status,
    code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
    message: status < 500 && typeof error?.publicMessage === 'string' ? error.publicMessage : fallbackMessage,
    requestId,
  });
}
