#!/bin/sh
set -eu

cmd="${1:-server}"

if [ "$#" -gt 0 ]; then
  shift
fi

case "$cmd" in
  web)
    exec yarn workspace web exec next start -H 0.0.0.0 -p "${WEB_PORT:-3001}" "$@"
    ;;
  server)
    exec yarn workspace server start "$@"
    ;;
  *)
    exec "$cmd" "$@"
    ;;
esac
