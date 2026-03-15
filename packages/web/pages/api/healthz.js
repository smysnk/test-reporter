export default function healthz(_req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'test-station-web',
  });
}
