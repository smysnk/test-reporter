import { resolveWebServerUrl } from '../../lib/serverGraphql.js';

export default async function readyz(_req, res) {
  res.setHeader('cache-control', 'no-store');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(`${resolveWebServerUrl().replace(/\/$/, '')}/readyz`, { signal: controller.signal });
    const upstream = await response.json();
    return res.status(response.ok ? 200 : 503).json({
      status: response.ok ? 'ready' : 'not-ready',
      service: 'test-station-web',
      revision: process.env.TEST_STATION_APP_REVISION || 'unknown',
      dependency: upstream,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'not-ready',
      service: 'test-station-web',
      revision: process.env.TEST_STATION_APP_REVISION || 'unknown',
      dependency: { status: 'unavailable', error: error?.name || 'DependencyError' },
    });
  } finally {
    clearTimeout(timeout);
  }
}
