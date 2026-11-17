#!/usr/bin/env bash
# Builds the game's sound clips from CC0 recordings (OpenGameArt; list and authors in
# tools/assets/audio-sources.txt and CREDITS.md). Loops are made seamless by cross-fading the tail
# of a segment into its head (the head then continues from where the tail left off).
# Usage: tools/assets/audio.sh   (sources in .asset-cache/audio, output in packages/app/public/assets/audio)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="$here/../../.asset-cache/audio"
out="$here/../../packages/app/public/assets/audio"
mkdir -p "$out"
enc=(-ac 1 -ar 44100 -c:a libmp3lame -b:a 80k)

# loop <input> <start s> <length s> <crossfade s> <name> [gain dB]
loop() {
  local in="$1" s="$2" len="$3" xf="$4" name="$5" gain="${6:-0}"
  local t; t="$(mktemp -d)"
  ffmpeg -v error -y -ss "$s" -t "$(echo "$len + $xf" | bc)" -i "$in" -ac 1 -ar 44100 -af "volume=${gain}dB" "$t/seg.wav"
  ffmpeg -v error -y -i "$t/seg.wav" -af "atrim=0:$xf,afade=t=in:d=$xf" "$t/head.wav"
  ffmpeg -v error -y -i "$t/seg.wav" -af "atrim=$len:$(echo "$len + $xf" | bc),asetpts=PTS-STARTPTS,afade=t=out:d=$xf" "$t/tail.wav"
  ffmpeg -v error -y -i "$t/seg.wav" -af "atrim=$xf:$len,asetpts=PTS-STARTPTS" "$t/body.wav"
  ffmpeg -v error -y -i "$t/head.wav" -i "$t/tail.wav" -filter_complex "amix=inputs=2:normalize=0:duration=shortest" "$t/x.wav"
  printf "file '%s'\nfile '%s'\n" "$t/x.wav" "$t/body.wav" > "$t/list.txt"
  ffmpeg -v error -y -f concat -safe 0 -i "$t/list.txt" "${enc[@]}" "$out/$name.mp3"
  rm -rf "$t"
}
# shot <input> <start s> <length s> <name> [gain dB]
shot() {
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -af "volume=${5:-0}dB,afade=t=out:st=$(echo "$3 - 0.15" | bc):d=0.15" "${enc[@]}" "$out/$4.mp3"
}

loop "$src/vistula/Vistula.mp3" 600 50 3 sea
loop "$src/storm_arwen_2022.flac" 20 40 3 wind_storm 15
loop "$src/wind_woosh_loop.ogg" 0 5.4 0.5 wind_light 11
loop "$src/amb_rain_loop_1.ogg" 5 30 2 rain 16
loop "$src/rain-thunder.ogg" 0 40 3 storm
shot "$src/tree_creak.flac" 0 6.5 creak 12
shot "$src/Seagull_Ambient_1.wav" 0 3.85 gulls
shot "$src/wave_01_cc0-18363__jasinski__alkaibeach.flac" 0 4 shore 10
shot "$src/cannon_fire_1.ogg" 0 3.5 gun
shot "$src/cannon_hit_ship_short.ogg" 0 3.3 hit
shot "$src/cannon_miss_1.ogg" 0 1.6 splash
shot "$src/ship_ram_ship_shortened.ogg" 0 5.1 ram
shot "$src/ship_destroyed_short.ogg" 0 11 sinking
for f in "$out"/*.mp3; do printf "%s " "$(basename "$f")"; ffmpeg -hide_banner -i "$f" -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: [-0-9.]+ dB" ; done
