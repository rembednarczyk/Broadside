#!/usr/bin/env bash
# Builds the modelled hulls in two tiers from the owner's source models (tools/assets/README.md):
# cut the hull from the full-resolution source first (so the triangle budget goes to the hull, not to
# rigging that is cut away); the full tier keeps the whole mesh, the lite tier (low preset) is simplified.
# Usage: tools/assets/hulls.sh [class]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
raw="$root/.asset-cache/hulls-raw"
out="$root/packages/app/public/assets/hulls"
mkdir -p "$raw" "$out"
node "$here/hull-cut.mjs" "$root/.asset-cache/drive" "$raw" ${1:-} | grep -v '^prune'
for f in "$raw"/*.glb; do
  c="$(basename "$f" .glb)"
  [ -n "${1:-}" ] && [ "$c" != "$1" ] && continue
  # Full tier: every triangle of the cut hull (a simplifier opens the planking along its UV seams).
  QUANTIZE=1 TEX_FORMAT=jpeg node "$here/optimize.mjs" "$f" "$out/$c.glb" 100000000 4096 | grep triangles
  # Lite tier (low preset): simplified with the seams locked in place.
  QUANTIZE=1 LOCK_BORDER=1 TEX_FORMAT=jpeg node "$here/optimize.mjs" "$f" "$out/$c-lite.glb" 120000 2048 | grep triangles
  cp "$raw/$c.json" "$out/$c.json"
done
# Planking patches for what the game builds on the hulls itself (the sterncastle).
node "$here/hull-patches.mjs" "$raw" "$out" ${1:-}
ls -la "$out"
