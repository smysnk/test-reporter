#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/fleet-defaults.sh
source "${script_dir}/lib/fleet-defaults.sh"

usage() {
  cat <<USAGE
Usage:
  deploy-fleet.sh [options]

Options:
  --gitrepo-file <path>      Fleet GitRepo manifest (default: fleet/gitrepo.yml)
  --fleet-namespace <name>   Fleet namespace for GitRepo (default: GitRepo metadata namespace)
  --name <name>              GitRepo resource name to watch (default: GitRepo metadata name)
  --app-namespace <name>     Application namespace to check (default: fleet.yaml defaultNamespace)
  --web <deployment>         Web deployment to check (default: <releaseName>-web)
  --server <deployment>      Server deployment to check (default: <releaseName>-server)
  --ingest <deployment>      Ingest deployment to check (default: <releaseName>-ingest)
  --kubeconfig <path>        Optional KUBECONFIG path
  --restart                  Restart workloads after syncing Fleet so mutable tags repull
  --wait-seconds <seconds>   Wait timeout for rollout status (default: 600)
  --help                     Show this help
USAGE
}

GITREPO_FILE="${GITREPO_FILE}"
FLEET_NAMESPACE="$(gitrepo_namespace)"
NAME="$(gitrepo_name)"
APP_NAMESPACE="$(fleet_default_namespace)"
WEB_DEPLOYMENT="$(deployment_name web)"
SERVER_DEPLOYMENT="$(deployment_name server)"
INGEST_DEPLOYMENT="$(deployment_name ingest)"
KUBECONFIG_PATH=""
RESTART_AFTER_SYNC="0"
WAIT_SECONDS="600"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gitrepo-file)
      GITREPO_FILE="${2:-}"
      shift 2
      ;;
    --fleet-namespace)
      FLEET_NAMESPACE="${2:-}"
      shift 2
      ;;
    --name)
      NAME="${2:-}"
      shift 2
      ;;
    --app-namespace)
      APP_NAMESPACE="${2:-}"
      shift 2
      ;;
    --web)
      WEB_DEPLOYMENT="${2:-}"
      shift 2
      ;;
    --server)
      SERVER_DEPLOYMENT="${2:-}"
      shift 2
      ;;
    --ingest)
      INGEST_DEPLOYMENT="${2:-}"
      shift 2
      ;;
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --restart)
      RESTART_AFTER_SYNC="1"
      shift
      ;;
    --wait-seconds)
      WAIT_SECONDS="${2:-600}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required" >&2
  exit 1
fi

if [[ -n "$KUBECONFIG_PATH" ]]; then
  export KUBECONFIG="$KUBECONFIG_PATH"
fi

if [[ ! -f "$GITREPO_FILE" ]]; then
  echo "Error: gitrepo manifest not found: $GITREPO_FILE" >&2
  exit 1
fi

echo "Applying Fleet GitRepo from: $GITREPO_FILE"
set +e
APPLY_OUTPUT="$(kubectl apply -f "$GITREPO_FILE" 2>&1)"
APPLY_STATUS=$?
set -e

if [[ $APPLY_STATUS -ne 0 ]]; then
  echo "$APPLY_OUTPUT"
  if echo "$APPLY_OUTPUT" | grep -q 'unknown field "spec.helm"'; then
    echo "Detected legacy GitRepo schema mismatch (spec.helm). Recreating GitRepo/${NAME}."
    kubectl -n "$FLEET_NAMESPACE" delete gitrepo "$NAME" --ignore-not-found=true
    kubectl create -f "$GITREPO_FILE"
  else
    exit $APPLY_STATUS
  fi
else
  echo "$APPLY_OUTPUT"
fi

echo "Current GitRepo status:"
kubectl -n "$FLEET_NAMESPACE" get gitrepo "$NAME" -o wide || true

echo "Current bundles in ${FLEET_NAMESPACE}:"
kubectl -n "$FLEET_NAMESPACE" get bundle || true
kubectl -n "$FLEET_NAMESPACE" get bundledeployment -o wide || true

echo "Waiting for Fleet GitRepo/${NAME} to become Ready"
if [[ -n "${TEST_STATION_TARGET_COMMIT:-}" ]]; then
  for attempt in $(seq 1 120); do
    observed_commit="$(kubectl -n "$FLEET_NAMESPACE" get "gitrepo/${NAME}" -o jsonpath='{.status.commit}' 2>/dev/null || true)"
    if [[ "$observed_commit" == "$TEST_STATION_TARGET_COMMIT" ]]; then break; fi
    if [[ "$attempt" == "120" ]]; then echo "Fleet did not observe commit ${TEST_STATION_TARGET_COMMIT}; last=${observed_commit}" >&2; exit 1; fi
    sleep 5
  done
fi
kubectl -n "$FLEET_NAMESPACE" wait --for=condition=Ready "gitrepo/${NAME}" --timeout="${WAIT_SECONDS}s"

for attempt in $(seq 1 60); do
  if kubectl -n "$APP_NAMESPACE" get deployment "$INGEST_DEPLOYMENT" >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == "60" ]]; then echo "Timed out waiting for deployment/${INGEST_DEPLOYMENT}" >&2; exit 1; fi
  sleep 5
done

if [[ "$RESTART_AFTER_SYNC" == "1" ]]; then
  echo "Restarting deployment/${WEB_DEPLOYMENT} in namespace/${APP_NAMESPACE}"
  kubectl -n "$APP_NAMESPACE" rollout restart deployment "$WEB_DEPLOYMENT"
  echo "Restarting deployment/${SERVER_DEPLOYMENT} in namespace/${APP_NAMESPACE}"
  kubectl -n "$APP_NAMESPACE" rollout restart deployment "$SERVER_DEPLOYMENT"
  echo "Restarting deployment/${INGEST_DEPLOYMENT} in namespace/${APP_NAMESPACE}"
  kubectl -n "$APP_NAMESPACE" rollout restart deployment "$INGEST_DEPLOYMENT"
fi

echo "Waiting for rollout of deployment/${WEB_DEPLOYMENT} in namespace/${APP_NAMESPACE}"
kubectl -n "$APP_NAMESPACE" rollout status deployment "$WEB_DEPLOYMENT" --timeout="${WAIT_SECONDS}s"

echo "Waiting for rollout of deployment/${SERVER_DEPLOYMENT} in namespace/${APP_NAMESPACE}"
kubectl -n "$APP_NAMESPACE" rollout status deployment "$SERVER_DEPLOYMENT" --timeout="${WAIT_SECONDS}s"

echo "Waiting for rollout of deployment/${INGEST_DEPLOYMENT} in namespace/${APP_NAMESPACE}"
kubectl -n "$APP_NAMESPACE" rollout status deployment "$INGEST_DEPLOYMENT" --timeout="${WAIT_SECONDS}s"

echo "Deployment complete. Current resources:"
kubectl -n "$APP_NAMESPACE" get deploy,svc,ingress,configmap,secret
kubectl -n "$APP_NAMESPACE" get certificate >/dev/null 2>&1 && kubectl -n "$APP_NAMESPACE" get certificate || true
