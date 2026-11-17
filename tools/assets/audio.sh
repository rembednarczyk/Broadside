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
  # Fade out over the last 0.15 s, or the last quarter of a very short clip.
  local fade st
  fade="$(awk -v l="$3" 'BEGIN { f = l / 4; if (f > 0.15) f = 0.15; printf "%.3f", f }')"
  st="$(awk -v l="$3" -v f="$fade" 'BEGIN { printf "%.3f", l - f }')"
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -af "volume=${5:-0}dB,afade=t=out:st=$st:d=$fade" "${enc[@]}" "$out/$4.mp3"
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
# Shipboard sounds: JC Sounds "Pirate Pack Vol 1" (CC BY 4.0) and "Chain winch sounds" (CC0).
pp="$src/pirate/Pirate Pack Vol 1"
loop "$pp/Ambiences (Loops)/amb_deck_creaks.wav" 0 15 2 deck 10
shot "$pp/Misc Sfx/sfx_rope_pull_01.wav" 0 3.7 rope1 12
shot "$pp/Misc Sfx/sfx_rope_pull_02.wav" 0 2.7 rope2 16
shot "$pp/Misc Sfx/sfx_rope_pull_03.wav" 0 1.1 rope3 15
for i in 1 2 3; do shot "$pp/Footsteps/steps_wood_slow_0$i.wav" 0 0.45 "step$i" 4; done
for i in 1 2; do shot "$pp/Footsteps/steps_wood_fast_0$i.wav" 0 0.23 "run$i" 3; done
for i in 1 2 3; do shot "$pp/Misc Sfx/sfx_sword_swing_0$i.wav" 0 0.46 "sword$i"; done
shot "$pp/Misc Sfx/sfx_pistol_01.wav" 0 1.8 pistol
shot "$pp/Misc Sfx/sfx_coin_spill_01.wav" 0 0.7 coins 3
shot "$pp/Misc Sfx/sfx_chest_open.wav" 0 1.3 chest 2
shot "$src/winch/winch - Marker 2.wav" 0 3.6 winch1 6
shot "$src/winch/winch - Marker #8.wav" 0 3.5 winch2 8
for f in "$out"/*.mp3; do printf "%s " "$(basename "$f")"; ffmpeg -hide_banner -i "$f" -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: [-0-9.]+ dB" ; done
