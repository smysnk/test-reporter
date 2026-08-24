# Test Station observability

The server exposes low-cardinality Prometheus metrics at `/metrics`; the web process exposes report-delivery metrics at `/api/metrics`. Scrape the internal read and ingest services directly so metrics do not traverse the public ingress. Import `grafana-dashboard.json` and load `prometheus-rules.yaml` into the cluster monitoring stack.

Operational rollout checks are: exact `/api/healthz` revision, web `/api/readyz`, server `/readyz`, migration/backfill Job completion, no projection parity mismatches, under 1% 5xx, bounded database pool wait, no query timeouts, and no sustained legacy report fallback. Roll back the selected read path or image tag without deleting submission, projection, or checkpoint data.
