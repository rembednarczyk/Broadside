#!/usr/bin/env bash
# Downloads every free upload of an itch.io page (free, or pay what you want at 0) the way the
# page's "No thanks, just take me to the downloads" button does: the download page for this
# session, then a short-lived link per file. Used for Quaternius's CC0 packs (see README).
# Usage: tools/assets/itch-fetch.sh <game-url> <out-dir>
G=$1; O=$2; mkdir -p "$O"; cd "$O" || exit 1; rm -f jar
curl -sS -c jar -b jar --max-time 30 "$G/purchase" -o purchase.html
T=$(grep -o -E 'csrf_token" value="[^"]+"' purchase.html | head -1 | sed 's/.*value="//;s/"$//')
URL=$(curl -sS -c jar -b jar --max-time 30 -X POST --data-urlencode "csrf_token=$T" "$G/download_url" | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
curl -sS -c jar -b jar --max-time 30 "$URL" -o dl.html
T2=$(grep -o -E 'csrf_token" value="[^"]+"' dl.html | head -1 | sed 's/.*value="//;s/"$//')
python3 - <<'PY' > uploads.txt
import re,html
t=open('dl.html').read()
ids=re.findall(r'data-upload_id="(\d+)"',t)
names=[html.unescape(n) for n in re.findall(r'class="name"[^>]*>([^<]+)',t)]
for i,n in zip(ids,names): print(i, n)
PY
cat uploads.txt
while read -r id name; do
  F=$(curl -sS -c jar -b jar --max-time 30 -X POST -H "X-Requested-With: XMLHttpRequest" -H "Referer: $URL" --data-urlencode "csrf_token=$T2" "$G/file/$id?source=game_download" | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])")
  curl -sS -L --max-time 1200 -o "$name" "$F" && echo "got $name $(stat -c %s "$name")"
done < uploads.txt
