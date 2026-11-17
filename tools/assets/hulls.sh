#!/usr/bin/env bash
# Builds the modelled hulls in two tiers from the owner's source models (tools/assets/README.md):
# cut the hull from the full-resolution source first (so the triangle budget goes to the hull, not to
# rigging that is cut away), then simplify: full tier for high and above, lite tier for low/medium.
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
  TEX_FORMAT=jpeg node "$here/optimize.mjs" "$f" "$out/$c.glb" 250000 4096 | grep triangles
  TEX_FORMAT=jpeg node "$here/optimize.mjs" "$f" "$out/$c-lite.glb" 80000 2048 | grep triangles
  cp "$raw/$c.json" "$out/$c.json"
done
ls -la "$out"
