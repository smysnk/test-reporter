#!/usr/bin/env bash

set -euo pipefail

_fleet_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${_fleet_lib_dir}/../.." && pwd)"
FLEET_FILE="${FLEET_FILE:-${REPO_ROOT}/fleet.yaml}"
GITREPO_FILE="${GITREPO_FILE:-${REPO_ROOT}/fleet/gitrepo.yml}"

trim_quotes() {
  local value="${1:-}"

  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  printf '%s\n' "$value"
}

fleet_default_namespace() {
  local value=""

  if [[ -f "$FLEET_FILE" ]]; then
    value="$(awk '/^defaultNamespace:/{print $2; exit}' "$FLEET_FILE" 2>/dev/null || true)"
  fi

  trim_quotes "${value:-test-station}"
}

fleet_release_name() {
  local value=""

  if [[ -f "$FLEET_FILE" ]]; then
    value="$(awk '/^[[:space:]]*releaseName:/{print $2; exit}' "$FLEET_FILE" 2>/dev/null || true)"
  fi

  trim_quotes "${value:-test-station}"
}

gitrepo_name() {
  local value=""

  if [[ -f "$GITREPO_FILE" ]]; then
    value="$(
      awk '
        /^metadata:/ { in_metadata=1; next }
        /^spec:/ { in_metadata=0 }
        in_metadata && /^[[:space:]]*name:/ { print $2; exit }
      ' "$GITREPO_FILE" 2>/dev/null || true
    )"
  fi

  trim_quotes "${value:-$(fleet_release_name)}"
}

gitrepo_namespace() {
  local value=""

  if [[ -f "$GITREPO_FILE" ]]; then
    value="$(
      awk '
        /^metadata:/ { in_metadata=1; next }
        /^spec:/ { in_metadata=0 }
        in_metadata && /^[[:space:]]*namespace:/ { print $2; exit }
      ' "$GITREPO_FILE" 2>/dev/null || true
    )"
  fi

  trim_quotes "${value:-fleet-local}"
}

gitrepo_client_secret_name() {
  local value=""

  if [[ -f "$GITREPO_FILE" ]]; then
    value="$(awk '/^[[:space:]]*clientSecretName:/{print $2; exit}' "$GITREPO_FILE" 2>/dev/null || true)"
  fi

  trim_quotes "${value:-smysnk-com-github-ssh}"
}

runtime_secret_name() {
  local value=""

  if [[ -f "$FLEET_FILE" ]]; then
    value="$(awk '/existingSecret:/{print $2; exit}' "$FLEET_FILE" 2>/dev/null || true)"
  fi

  if [[ -f "$GITREPO_FILE" ]]; then
    if [[ -z "$value" ]]; then
      value="$(awk '/existingSecret:/{print $2; exit}' "$GITREPO_FILE" 2>/dev/null || true)"
    fi
  fi

  if [[ -n "$value" ]]; then
    trim_quotes "$value"
    return
  fi

  printf '%s-runtime-secret\n' "$(fleet_release_name)"
}

runtime_configmap_name() {
  local value=""

  if [[ -f "$FLEET_FILE" ]]; then
    value="$(awk '/existingConfigMap:/{print $2; exit}' "$FLEET_FILE" 2>/dev/null || true)"
  fi

  if [[ -f "$GITREPO_FILE" ]]; then
    if [[ -z "$value" ]]; then
      value="$(awk '/existingConfigMap:/{print $2; exit}' "$GITREPO_FILE" 2>/dev/null || true)"
    fi
  fi

  if [[ -n "$value" ]]; then
    trim_quotes "$value"
    return
  fi

  printf '%s-runtime-config\n' "$(fleet_release_name)"
}

deployment_name() {
  local component="${1:-}"

  if [[ -z "$component" ]]; then
    echo "deployment_name requires a component" >&2
    return 1
  fi

  printf '%s-%s\n' "$(fleet_release_name)" "$component"
}
