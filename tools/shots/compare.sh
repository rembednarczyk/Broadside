#!/usr/bin/env bash
# Side-by-side of a game screenshot and a reference video frame (visual target, decyzje 16.11).
# Usage: tools/shots/compare.sh <game.png> <reference.mp4> <seconds> <out.jpg>
set -euo pipefail
game="$1"; ref="$2"; at="$3"; out="$4"
tmp="$(mktemp -d)"
ffmpeg -v error -y -ss "$at" -i "$ref" -frames:v 1 -vf "scale=-2:540" "$tmp/ref.png"
ffmpeg -v error -y -i "$game" -vf "scale=-2:540" "$tmp/game.png"
ffmpeg -v error -y -i "$tmp/game.png" -i "$tmp/ref.png" -filter_complex "hstack=inputs=2" "$out"
rm -rf "$tmp"
echo "$out"
