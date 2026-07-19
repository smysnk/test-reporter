#!/usr/bin/env bash

set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${THIS_DIR}/paths.sh"

run_npm_no_workspace() {
  env \
    -u NPM_CONFIG_WORKSPACE \
    -u npm_config_workspace \
    -u NPM_CONFIG_WORKSPACES \
    -u npm_config_workspaces \
    npm "$@"
}

check_npm_package_visibility() {
  local package_name="$1"
  if ! run_npm_no_workspace view "$package_name" name >/dev/null 2>&1; then
    echo "npm preflight: package '$package_name' not readable yet (may be first publish)." >&2
  fi
}
