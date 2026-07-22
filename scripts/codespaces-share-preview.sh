#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
ORIGIN="http://127.0.0.1:${PORT}"
STARTED_SERVER=0
NEXT_PID=""

cleanup() {
  if [[ "$STARTED_SERVER" == "1" && -n "$NEXT_PID" ]]; then
    kill "$NEXT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if curl -fsS "$ORIGIN" >/dev/null 2>&1; then
  echo "Evidara is already running on ${ORIGIN}."
else
  echo "Starting Evidara on ${ORIGIN}..."
  npm run dev:codespaces &
  NEXT_PID=$!
  STARTED_SERVER=1

  READY=0
  for _ in $(seq 1 60); do
    if curl -fsS "$ORIGIN" >/dev/null 2>&1; then
      READY=1
      break
    fi
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
      echo "The Next.js server stopped before becoming ready."
      wait "$NEXT_PID" || true
      exit 1
    fi
    sleep 1
  done

  if [[ "$READY" != "1" ]]; then
    echo "Timed out waiting for Evidara on ${ORIGIN}."
    exit 1
  fi
fi

echo
echo "Local Evidara check passed. Starting a temporary Cloudflare preview..."
echo "Open the https://...trycloudflare.com URL printed below."
echo "Keep this terminal running while you test."
echo

npx wrangler tunnel quick-start "$ORIGIN"
