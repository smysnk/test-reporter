#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/fleet-defaults.sh
source "${script_dir}/lib/fleet-defaults.sh"

usage() {
  cat <<USAGE
Usage:
  recycle-and-monitor.sh [options]

Options:
  --namespace <name>         Kubernetes namespace (default: fleet.yaml defaultNamespace)
  --web <deployment>         Web deployment name (default: <releaseName>-web)
  --server <deployment>      Server deployment name (default: <releaseName>-server)
  --help                     Show this help
USAGE
}

NAMESPACE="$(fleet_default_namespace)"
WEB_DEPLOYMENT="$(deployment_name web)"
SERVER_DEPLOYMENT="$(deployment_name server)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="${2:-}"
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

if ! kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" >/dev/null 2>&1; then
  echo "Error: deployment '$WEB_DEPLOYMENT' not found in namespace '$NAMESPACE'" >&2
  exit 1
fi

if ! kubectl -n "$NAMESPACE" get deployment "$SERVER_DEPLOYMENT" >/dev/null 2>&1; then
  echo "Error: deployment '$SERVER_DEPLOYMENT' not found in namespace '$NAMESPACE'" >&2
  exit 1
fi

PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

run_prefixed() {
  local label="$1"
  local command="$2"

  bash -lc "$command" 2>&1 | while IFS= read -r line || [[ -n "$line" ]]; do
    printf '[%-7s] %s\n' "$label" "$line"
  done
}

run_prefixed "events" "kubectl -n ${NAMESPACE} get events --watch-only" &
PIDS+=("$!")

run_prefixed "web" "kubectl -n ${NAMESPACE} logs deploy/${WEB_DEPLOYMENT} --follow --tail=0" &
PIDS+=("$!")

run_prefixed "server" "kubectl -n ${NAMESPACE} logs deploy/${SERVER_DEPLOYMENT} --follow --tail=0" &
PIDS+=("$!")

sleep 2

printf '[%-7s] %s\n' "action" "Restarting ${WEB_DEPLOYMENT} in ${NAMESPACE}"
kubectl -n "$NAMESPACE" rollout restart deployment "$WEB_DEPLOYMENT"

printf '[%-7s] %s\n' "action" "Restarting ${SERVER_DEPLOYMENT} in ${NAMESPACE}"
kubectl -n "$NAMESPACE" rollout restart deployment "$SERVER_DEPLOYMENT"

printf '[%-7s] %s\n' "action" "Waiting for rollout status (${WEB_DEPLOYMENT})"
kubectl -n "$NAMESPACE" rollout status deployment "$WEB_DEPLOYMENT"

printf '[%-7s] %s\n' "action" "Waiting for rollout status (${SERVER_DEPLOYMENT})"
kubectl -n "$NAMESPACE" rollout status deployment "$SERVER_DEPLOYMENT"

printf '[%-7s] %s\n' "action" "Rollout complete. Streaming continues. Press Ctrl+C to stop."

wait
