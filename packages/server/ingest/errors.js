export class HttpError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class AuthenticationError extends HttpError {
  constructor(message = 'Unauthorized ingest request.', details = null) {
    super(401, 'INGEST_UNAUTHORIZED', message, details);
  }
}

export class ConfigurationError extends HttpError {
  constructor(message = 'Server ingest auth is not configured.', details = null) {
    super(503, 'INGEST_NOT_CONFIGURED', message, details);
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Invalid ingest payload.', details = null) {
    super(400, 'INGEST_VALIDATION_ERROR', message, details);
  }
}

export class InvalidJsonError extends HttpError {
  constructor(message = 'Invalid ingest JSON payload.', details = null) {
    super(400, 'INGEST_INVALID_JSON', message, details);
  }
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details || undefined,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    },
  };
}
