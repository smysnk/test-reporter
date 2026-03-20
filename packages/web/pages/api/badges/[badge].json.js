import {
  createCoverageBadgePayload,
  createHealthBadgePayload,
  createTestsBadgePayload,
} from '@test-station/render-html';
import { applyTraceHeadersToNextResponse, resolveWebRequestTrace } from '../../../lib/requestTrace.js';
import { loadProjectBadgeSummary } from '../../../lib/serverGraphql.js';

const DEFAULT_PROJECT_KEY = 'test-station';
const BADGE_BUILDERS = {
  tests: createTestsBadgePayload,
  coverage: createCoverageBadgePayload,
  health: createHealthBadgePayload,
};

export function resolveRequestedBadgeType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveProjectKey(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : DEFAULT_PROJECT_KEY;
}

export function createBadgeHandler({ fetchImpl = fetch } = {}) {
  return async function badgeHandler(req, res) {
    applyTraceHeadersToNextResponse(res, resolveWebRequestTrace(req));

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method Not Allowed',
        },
      });
      return;
    }

    const badgeType = resolveRequestedBadgeType(req?.query?.badge);
    const buildBadge = BADGE_BUILDERS[badgeType];

    if (!buildBadge) {
      res.status(404).json({
        error: {
          code: 'BADGE_NOT_FOUND',
          message: 'Badge type not found',
        },
      });
      return;
    }

    const summary = await loadProjectBadgeSummary({
      session: null,
      projectKey: resolveProjectKey(req?.query?.projectKey),
      fetchImpl,
      requestTrace: req?.testStationTrace || null,
    });

    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(buildBadge(summary));
  };
}

export default createBadgeHandler();
