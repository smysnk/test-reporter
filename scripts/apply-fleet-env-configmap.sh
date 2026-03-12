#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/fleet-defaults.sh
source "${script_dir}/lib/fleet-defaults.sh"

usage() {
  cat <<USAGE
Usage:
  apply-fleet-env-configmap.sh [options]

Options:
  --env-file <path>          Path to env file (default: .env.fleet.config)
  --namespace <name>         Kubernetes namespace (default: fleet.yaml defaultNamespace)
  --configmap-name <name>    Kubernetes ConfigMap name (default: first existingConfigMap in fleet/gitrepo.yml)
  --kubeconfig <path>        Optional KUBECONFIG path
  --create-namespace         Create namespace if it does not exist
  --dry-run                  Render ConfigMap YAML and print to stdout only
  --help                     Show this help

Notes:
  - Expected env format: KEY=VALUE
  - Lines starting with # are ignored
  - 'export KEY=VALUE' lines are supported
  - Use for non-sensitive runtime config values only
USAGE
}

ENV_FILE="${REPO_ROOT}/.env.fleet.config"
NAMESPACE="$(fleet_default_namespace)"
CONFIGMAP_NAME="$(runtime_configmap_name)"
KUBECONFIG_PATH=""
CREATE_NAMESPACE="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --configmap-name)
      CONFIGMAP_NAME="${2:-}"
      shift 2
      ;;
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --create-namespace)
      CREATE_NAMESPACE="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required" >&2
  exit 1
fi

if [[ -n "$KUBECONFIG_PATH" ]]; then
  export KUBECONFIG="$KUBECONFIG_PATH"
fi

TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#${line%%[![:space:]]*}}"
  line="${line%${line##*[![:space:]]}}"

  if [[ -z "$line" || "$line" == \#* ]]; then
    continue
  fi

  if [[ "$line" == export\ * ]]; then
    line="${line#export }"
  fi

  if [[ "$line" != *=* ]]; then
    echo "Error: invalid line in $ENV_FILE: $line" >&2
    exit 1
  fi

  echo "$line" >> "$TMP_ENV"
done < "$ENV_FILE"

if [[ ! -s "$TMP_ENV" ]]; then
  echo "Error: no key/value entries found in $ENV_FILE" >&2
  exit 1
fi

if [[ "$CREATE_NAMESPACE" == "true" ]]; then
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  kubectl -n "$NAMESPACE" create configmap "$CONFIGMAP_NAME" \
    --from-env-file="$TMP_ENV" \
    --dry-run=client -o yaml
  exit 0
fi

kubectl -n "$NAMESPACE" create configmap "$CONFIGMAP_NAME" \
  --from-env-file="$TMP_ENV" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applied configmap '$CONFIGMAP_NAME' in namespace '$NAMESPACE' from '$ENV_FILE'"
