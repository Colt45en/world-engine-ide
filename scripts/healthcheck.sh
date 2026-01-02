#!/usr/bin/env bash
# Simple healthcheck helper: checks ports and HTTP endpoints
set -euo pipefail

function wait_for_http() {
  url=$1
  attempts=0
  until [ $attempts -ge 30 ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$url is available"
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  echo "$url did not become available" >&2
  return 1
}

wait_for_http http://localhost:8000/state
wait_for_http http://localhost:5173

echo "All checks passed"
