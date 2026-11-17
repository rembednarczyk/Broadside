#!/usr/bin/env bash
# Downloads the owner's Drive models (shared by link, list in sources.txt) into .asset-cache/drive,
# skipping files already complete.
here="$(cd "$(dirname "$0")" && pwd)"
dest="$here/../../.asset-cache/drive"
mkdir -p "$dest"
while read -r id name; do
  [ -s "$dest/$name" ] && continue
  for try in 1 2 3; do
    curl -sS -L --max-time 900 -o "$dest/$name.part" "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t" && mv "$dest/$name.part" "$dest/$name" && break
    sleep $((try * 5))
  done
  echo "$name $(stat -c %s "$dest/$name" 2>/dev/null)"
done < "$here/sources.txt"
