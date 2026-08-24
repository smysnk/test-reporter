import { renderWebPrometheusMetrics } from '../../lib/runtimeMetrics.js';

export default function metrics(_req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(renderWebPrometheusMetrics());
}
