# Fleet Bundle

This directory is the Rancher Fleet bundle for deploying `test-station` with:

- `web` (Next.js)
- `server` (GraphQL API)

## Defaults

- Namespace: `test-station` (`fleet.yaml`)
- Release name: `test-station` (`fleet.yaml`)
- GitRepo manifest: `fleet/gitrepo.yml`
- Fleet namespace: `fleet-local`
- Public domain: `test-station.smysnk.com`
- Shared runtime secret: `test-station-runtime-secret`
- Ingress class: `traefik`
- TLS secret: `tls-test-station-smysnk-com`
- Image tag: `main`

By default:

- `web.ingress.enabled` is `true` via `fleet.yaml`
- `server.existingSecret` and `web.existingSecret` both point at `test-station-runtime-secret` via `fleet.yaml`
- `https://test-station.smysnk.com/api/ingest` is routed through the shared ingress to the `server` service
- `web.ingress.annotations.cert-manager.io/cluster-issuer` is `letsencrypt-prod`
- `web.ingress.tls.enabled` is `true`
- `/api/ingest` is configured for a `50 MB` request-body limit in both the server app config and the Traefik ingress middleware
- generated ConfigMaps stay enabled unless you explicitly switch to `existingConfigMap`

This Fleet cluster rejects `GitRepo.spec.helm`, so repo-specific Helm overrides live in `fleet.yaml` instead of `fleet/gitrepo.yml`.

## Apply GitRepo SSH Secret

This secret is referenced by `fleet/gitrepo.yml` as `clientSecretName: smysnk-com-github-ssh`.

```bash
./scripts/apply-fleet-gitrepo-ssh-secret.sh --create-namespace
```

## Apply Runtime Secret

```bash
cp .env.fleet.example .env.fleet
```

```bash
./scripts/apply-fleet-env-secret.sh --env-file ./.env.fleet --create-namespace
```

The shared secret is consumed by both the `server` and `web` deployments.

For CI ingest publishing, set `INGEST_SHARED_KEY` in this secret and use the same value for the GitHub Actions secret `TEST_STATION_INGEST_SHARED_KEY`.

The main release workflow also needs a GitHub Actions secret named `FLEET_KUBECONFIG` that contains the kubeconfig used for `kubectl apply` and rollout restarts.

Optional web OAuth providers are configured through the same runtime secret:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`

The demo credentials login is controlled separately through config with `WEB_DEMO_AUTH_ENABLED=false` by default. If Google OAuth is configured, the web sign-in page redirects straight into Google and does not show the demo login form.

Optional CI artifact archiving can upload the generated report directory to S3 before ingest publishing. The server stores the resulting `storageKey` and `sourceUrl` metadata, but it does not upload artifact binaries itself.

## Optional External ConfigMap

If you want runtime config outside Git instead of the generated chart ConfigMaps:

1. Copy `.env.fleet.config.example` to `.env.fleet.config`.
2. Set `server.existingConfigMap` and `web.existingConfigMap` in `fleet.yaml`.
3. Apply it with:

```bash
./scripts/apply-fleet-env-configmap.sh --env-file ./.env.fleet.config --create-namespace
```

## Deploy And Verify

```bash
./scripts/deploy-fleet.sh
```

```bash
kubectl -n fleet-local get gitrepo test-station -o wide
kubectl -n fleet-local get bundle
kubectl -n fleet-local get bundledeployment -o wide
```

```bash
kubectl -n test-station get deploy,svc,ingress,configmap,secret
kubectl -n test-station get certificate || true
kubectl -n test-station rollout status deploy/test-station-web
kubectl -n test-station rollout status deploy/test-station-server
```

## Monitor And Recycle

```bash
./scripts/monitor-deployment-output.sh
```

```bash
./scripts/recycle-and-monitor.sh
```
