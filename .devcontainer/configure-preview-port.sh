#!/usr/bin/env bash
set -u

PORT="${EVIDARA_CODESPACES_PORT:-20241}"
ORIGIN="http://127.0.0.1:${PORT}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/tmp/evidara-v7-${PORT}.log"
PID_FILE="/tmp/evidara-v7-${PORT}.pid"

if [[ -z "${CODESPACE_NAME:-}" ]]; then
  exit 0
fi

if ! curl -fsS "${ORIGIN}" >/dev/null 2>&1; then
  cd "${ROOT}" || exit 0
  nohup npm run dev:codespaces >"${LOG_FILE}" 2>&1 &
  echo $! >"${PID_FILE}"

  for _ in $(seq 1 60); do
    if curl -fsS "${ORIGIN}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

# Codespaces can reset public ports after a restart. Reapply visibility whenever
# the container starts. This may be blocked by an organization-level policy.
gh codespace ports visibility "${PORT}:public" -c "${CODESPACE_NAME}" >/dev/null 2>&1 || true

echo "Evidara preview: https://${CODESPACE_NAME}-${PORT}.app.github.dev/"
echo "Server log: ${LOG_FILE}"
