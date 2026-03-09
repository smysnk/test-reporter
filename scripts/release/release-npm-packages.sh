#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${THIS_DIR}/paths.sh"
source "${THIS_DIR}/npm-helpers.sh"

NPM_CACHE_DIR="${NPM_CONFIG_CACHE:-$ROOT_DIR/.test-results/npm-cache}"
NPM_RELEASE_MODE="${NPM_PUBLISH:-0}"

step() {
  echo "[npm-release] $1"
}

step "1/6 Preflight required tools"
if ! command -v npm >/dev/null 2>&1; then
  echo "Missing npm in PATH" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Missing node in PATH" >&2
  exit 1
fi

step "2/6 Prepare npm cache"
mkdir -p "$NPM_CACHE_DIR"
export NPM_CONFIG_CACHE="$NPM_CACHE_DIR"

step "3/6 Select non-private npm packages"
selected_dirs=()
selected_names=()

for pkg_dir in "${PUBLISH_PACKAGE_DIRS[@]}"; do
  manifest_path="${pkg_dir}/package.json"
  if [[ ! -f "$manifest_path" ]]; then
    echo "Missing package.json: $manifest_path" >&2
    exit 1
  fi

  pkg_name="$(node -p "require(process.argv[1]).name" "$manifest_path")"
  pkg_version="$(node -p "require(process.argv[1]).version" "$manifest_path")"
  pkg_private="$(node -p "require(process.argv[1]).private === true ? 'true' : 'false'" "$manifest_path")"

  if [[ "$pkg_name" != @test-station/* ]]; then
    echo "Unexpected package name: $pkg_name" >&2
    exit 1
  fi

  if [[ "$pkg_private" == "true" ]]; then
    echo "Skipping private package: ${pkg_name}@${pkg_version}"
    continue
  fi

  echo "Selected package: ${pkg_name}@${pkg_version}"
  selected_dirs+=("$pkg_dir")
  selected_names+=("$pkg_name")
done

if [[ "${#selected_dirs[@]}" -eq 0 ]]; then
  step "4/6 No non-private npm packages selected; publish skipped"
  step "5/6 Publish preflight skipped (NPM_PUBLISH has no effect without publishable packages)"
  step "6/6 Release validation complete"
  exit 0
fi

step "4/6 Validate npm package tarballs"
for pkg_dir in "${selected_dirs[@]}"; do
  run_npm_no_workspace pack --dry-run --ignore-scripts "$pkg_dir" >/dev/null
done

if [[ "$NPM_RELEASE_MODE" == "1" ]]; then
  step "5/6 Authenticate and preflight npm registry checks"
  configure_npm_auth_token "${NPM_TOKEN:-}"
  verify_npm_auth
  for pkg_name in "${selected_names[@]}"; do
    check_npm_package_visibility "$pkg_name"
  done

  step "6/6 Publish npm packages"
  for pkg_dir in "${selected_dirs[@]}"; do
    run_npm_no_workspace publish --ignore-scripts --access public "$pkg_dir"
  done
else
  step "5/6 Publish preflight skipped (NPM_PUBLISH!=1)"
  step "6/6 Publish skipped; release validation complete"
fi
