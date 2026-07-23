#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-20242}"
ORIGIN="http://127.0.0.1:${PORT}"
STARTED_SERVER=0
NEXT_PID=""
CLOUDFLARED_DIR="${HOME}/.local/bin"
CLOUDFLARED_BIN="${CLOUDFLARED_DIR}/cloudflared"

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

if [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  mkdir -p "$CLOUDFLARED_DIR"
  case "$(uname -m)" in
    x86_64|amd64) CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    *)
      echo "Unsupported Codespaces architecture: $(uname -m)"
      exit 1
      ;;
  esac

  DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
  echo "Downloading cloudflared for ${CF_ARCH} without an interactive prompt..."
  curl -fL --retry 3 --retry-delay 2 "$DOWNLOAD_URL" -o "${CLOUDFLARED_BIN}.tmp"
  chmod +x "${CLOUDFLARED_BIN}.tmp"
  mv "${CLOUDFLARED_BIN}.tmp" "$CLOUDFLARED_BIN"
fi

echo
echo "Local Evidara check passed on port ${PORT}. Starting a temporary Cloudflare preview..."
echo "Codespaces direct URL: https://${CODESPACE_NAME:-your-codespace}-${PORT}.app.github.dev/"
echo "Open the https://...trycloudflare.com URL printed below for the temporary tunnel."
echo "Keep this terminal running while you test."
echo

exec "$CLOUDFLARED_BIN" tunnel --url "$ORIGIN"
