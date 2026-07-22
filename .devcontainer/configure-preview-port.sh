#!/usr/bin/env bash
set -u

PORT="${EVIDARA_CODESPACES_PORT:-20241}"

if [[ -z "${CODESPACE_NAME:-}" ]]; then
  exit 0
fi

# Codespaces may reset a public port to private after a restart. Reapply the
# intended visibility whenever the dev container starts. The command is allowed
# to fail silently when an organization policy disallows public ports.
gh codespace ports visibility "${PORT}:public" -c "${CODESPACE_NAME}" >/dev/null 2>&1 || true
