import express from 'express';
import { createSharedKeyAuth } from './auth.js';
import { toErrorResponse } from './errors.js';
import { createIngestionService, createSequelizeIngestionPersistence } from './service.js';
import { normalizeIngestPayload } from './normalize.js';

export {
  createIngestionService,
  createSequelizeIngestionPersistence,
  normalizeIngestPayload,
};

export function createIngestRouter(options = {}) {
  const router = express.Router();
  const ingestionService = options.ingestionService || createIngestionService(options);
  const authenticate = createSharedKeyAuth(options);

  router.post('/', authenticate, async (req, res, next) => {
    try {
      const result = await ingestionService.ingest(req.body, {
        now: options.now,
        requestId: req.headers['x-request-id'] || null,
        auth: req.ingestAuth || null,
      });

      res.status(200).json({
        status: 'ok',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  });

  router.use((error, _req, res, _next) => {
    const response = toErrorResponse(error);
    if (response.statusCode >= 500) {
      const requestId = _req?.testStationTrace?.requestId || _req?.headers?.['x-request-id'] || 'unknown';
      const message = error instanceof Error ? error.stack || error.message : String(error);
      process.stderr.write(`[ingest] requestId=${requestId} ${message}\n`);
    }
    res.status(response.statusCode).json(response.body);
  });

  return router;
}
