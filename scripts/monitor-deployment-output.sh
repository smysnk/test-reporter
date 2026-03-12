#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/fleet-defaults.sh
source "${script_dir}/lib/fleet-defaults.sh"

usage() {
  cat <<USAGE
Usage:
  monitor-deployment-output.sh [options]

Options:
  --namespace <name>         Kubernetes namespace (default: fleet.yaml defaultNamespace)
  --web <deployment>         Web deployment name (default: <releaseName>-web)
  --server <deployment>      Server deployment name (default: <releaseName>-server)
  --events-tail <count>      Number of recent events to print (default: 40)
  --log-tail <count>         Number of recent log lines to print (default: 120)
  --help                     Show this help
USAGE
}

NAMESPACE="$(fleet_default_namespace)"
WEB_DEPLOYMENT="$(deployment_name web)"
SERVER_DEPLOYMENT="$(deployment_name server)"
EVENTS_TAIL="40"
LOG_TAIL="120"

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
    --events-tail)
      EVENTS_TAIL="${2:-40}"
      shift 2
      ;;
    --log-tail)
      LOG_TAIL="${2:-120}"
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

run_prefixed() {
  local label="$1"
  local command="$2"

  bash -lc "$command" 2>&1 | while IFS= read -r line || [[ -n "$line" ]]; do
    printf '[%-7s] %s\n' "$label" "$line"
  done
}

PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

run_prefixed "events" "kubectl -n ${NAMESPACE} get events --sort-by=.lastTimestamp | tail -n ${EVENTS_TAIL}" &
PIDS+=("$!")

run_prefixed "web" "kubectl -n ${NAMESPACE} logs deploy/${WEB_DEPLOYMENT} --tail=${LOG_TAIL}" &
PIDS+=("$!")

run_prefixed "server" "kubectl -n ${NAMESPACE} logs deploy/${SERVER_DEPLOYMENT} --tail=${LOG_TAIL}" &
PIDS+=("$!")

wait "${PIDS[@]}"
