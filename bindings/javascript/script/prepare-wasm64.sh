#!/usr/bin/env bash
# Seed build-wasm64 from an existing build-wasm tree (same autotools config;
# object files are rebuilt with -sMEMORY64 in build:obj:64).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="$ROOT/build-wasm"
DST="$ROOT/build-wasm64"

if [[ ! -f "$SRC/Makefile" ]]; then
  echo "prepare-wasm64: build-wasm is not configured. Run 'pnpm build:prepare:32' first." >&2
  exit 1
fi

rm -rf "$DST"
cp -a "$SRC" "$DST"
echo "prepare-wasm64: copied $SRC -> $DST (re-run pnpm build:obj:64 to compile with MEMORY64)."
