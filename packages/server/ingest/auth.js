import crypto from 'node:crypto';
import env from '../../../config/env.mjs';
import { AuthenticationError, ConfigurationError } from './errors.js';

export function createSharedKeyAuth(options = {}) {
  return function sharedKeyAuth(req, _res, next) {
    try {
      req.ingestAuth = authenticateSharedKeyRequest(req, options, {
        allowMissing: false,
        ignoreMissingConfig: false,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authenticateSharedKeyRequest(req, options = {}, behavior = {}) {
  const sharedKeys = resolveIngestSharedKeys(options);
  const candidate = readSharedKeyFromRequest(req);

  if (sharedKeys.length === 0) {
    if (behavior.ignoreMissingConfig !== false) {
      return null;
    }
    throw new ConfigurationError('Shared-key ingest auth is not configured. Set INGEST_SHARED_KEY.');
  }

  if (!candidate) {
    if (behavior.allowMissing !== false) {
      return null;
    }
    throw new AuthenticationError('Missing shared key. Use Authorization: Bearer <key> or x-api-key.');
  }

  if (!sharedKeys.some((sharedKey) => timingSafeEqual(sharedKey, candidate))) {
    if (behavior.allowInvalid === true) {
      return null;
    }
    throw new AuthenticationError('Invalid shared key.');
  }

  return {
    method: req.headers.authorization ? 'bearer' : 'x-api-key',
    subject: 'shared-key',
  };
}

export function resolveIngestSharedKeys(options = {}) {
  if (Array.isArray(options.ingestSharedKeys)) {
    return normalizeKeys(options.ingestSharedKeys);
  }

  return normalizeKeys([
    env.get('INGEST_SHARED_KEY').default('').asString(),
  ]);
}

export function readSharedKeyFromRequest(req) {
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  const apiKeyHeader = req.headers['x-api-key'];
  if (Array.isArray(apiKeyHeader)) {
    return apiKeyHeader[0]?.trim() || '';
  }

  return typeof apiKeyHeader === 'string' ? apiKeyHeader.trim() : '';
}

function normalizeKeys(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean),
  ));
}

function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
