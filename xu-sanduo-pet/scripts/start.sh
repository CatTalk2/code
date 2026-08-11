#!/usr/bin/env bash
# Cross-platform launcher:
# - macOS / Windows: native GPU（本机桌面）
# - Linux / CI: soft-gpu + optional dbus-run-session
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OS="$(uname -s)"
EXTRA=("$@")

if [[ "$OS" == "Linux" ]]; then
  ARGS=(--soft-gpu "${EXTRA[@]}")
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
    unset DBUS_SESSION_BUS_ADDRESS || true
    if command -v dbus-run-session >/dev/null 2>&1; then
      exec dbus-run-session -- npx --no-install electron . "${ARGS[@]}"
    fi
  fi
  exec npx --no-install electron . "${ARGS[@]}"
fi

# Darwin / Windows(Git Bash) / 其他：本机原生启动
exec npx --no-install electron . "${EXTRA[@]}"
