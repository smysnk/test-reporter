#!/usr/bin/env bash

set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "${THIS_DIR}/../.." && pwd)}"

PUBLISH_PACKAGE_DIRS=(
  "${ROOT_DIR}/packages/adapter-jest"
  "${ROOT_DIR}/packages/adapter-node-test"
  "${ROOT_DIR}/packages/adapter-playwright"
  "${ROOT_DIR}/packages/adapter-shell"
  "${ROOT_DIR}/packages/adapter-vitest"
  "${ROOT_DIR}/packages/plugin-source-analysis"
  "${ROOT_DIR}/packages/core"
  "${ROOT_DIR}/packages/render-html"
  "${ROOT_DIR}/packages/cli"
)
