#!/usr/bin/env bash
# Cross-platform Electron launcher: soft-gpu + optional dbus session on Linux.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARGS=(--soft-gpu "$@")

if [[ "$(uname -s)" == "Linux" ]]; then
  # Empty address makes Chromium spam bus.cc errors
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
    unset DBUS_SESSION_BUS_ADDRESS || true
    if command -v dbus-run-session >/dev/null 2>&1; then
      exec dbus-run-session -- npx --no-install electron . "${ARGS[@]}"
    fi
  fi
fi

exec npx --no-install electron . "${ARGS[@]}"
