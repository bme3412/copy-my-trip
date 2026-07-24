#!/bin/bash
# Extracts real capture dates (EXIF for photos, QuickTime metadata for video)
# from public/media/<city>/ into src/cities/<city>/data/media-dates.json.
# `_gen-*` derived files inherit their source video's date.
# Usage: ./scripts/extract-dates.sh [city]
set -euo pipefail

CITY="${1:-paris}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/public/media/$CITY"
OUT="$ROOT/src/cities/$CITY/data/media-dates.json"

get_ym() { # -> YYYY-MM or empty
  local f="$1" d=""
  case "$f" in
    *.mov|*.mp4)
      d=$(ffprobe -v error -show_entries format_tags=com.apple.quicktime.creationdate -of csv=p=0 "$f" 2>/dev/null | head -1)
      [ -z "$d" ] && d=$(ffprobe -v error -show_entries format_tags=creation_time -of csv=p=0 "$f" 2>/dev/null | head -1)
      echo "$d" | sed -nE 's/^([0-9]{4})-([0-9]{2}).*/\1-\2/p'
      ;;
    *)
      # sips reads EXIF the strings scan misses (e.g. files whose date tags
      # aren't stored as plain "YYYY:MM:DD HH" text); fall back to strings.
      d=$(sips -g creation "$f" 2>/dev/null | awk '/creation:/{print $2}')
      [ -z "$d" ] && d=$(strings "$f" | grep -E "^20[0-9]{2}:[0-9]{2}:[0-9]{2} " | head -1)
      echo "$d" | sed -nE 's/^([0-9]{4}):([0-9]{2}).*/\1-\2/p'
      ;;
  esac
}

# _gen derived file → source video it inherits its date from
gen_source() {
  case "$1" in
    _gen-vosges-*) echo "paris-place-des-vosges.mov" ;;
    _gen-maison-rose*) echo "paris-montmartre-maison-rose.mov" ;;
    _gen-notre-dame-pano*) echo "paris-notre-dame-pano-empty.mov" ;;
    _gen-vert-galant-pano*) echo "paris-vert-gallant-pano.mov" ;;
    _gen-seine-boat-pano*) echo "paris-bridge-seine-boat-pano.mov" ;;
    _gen-pont-neuf-dec26*) echo "paris-pont-neuf-dec26.mov" ;;
    _gen-saint-germain-bonaparte*) echo "paris-saint-germain-bonaparte.mov" ;;
    _gen-chez-janou*) echo "paris-marais-chez-janou.mov" ;;
    _gen-pont-des-arts-stevie*) echo "paris-pont-des-arts-stevie-wonder.mov" ;;
    _gen-pont-des-arts*) echo "paris-pont-des-arts-pano.mov" ;;
    _gen-pompidou*) echo "paris-centre-pompidou.mov" ;;
    _gen-st-germain-christmas*) echo "paris-saint-germain-christmas.mov" ;;
    _gen-arc-pano*) echo "paris-arc-triomphe-pano.mov" ;;
    _gen-sacre-pano*) echo "paris-steps-sacre-coeur-pano-summer.mov" ;;
    _gen-sacre-steps-music*) echo "paris-sacre-coeur-steps-music.mov" ;;
    _gen-sacre-rhcp*) echo "paris-sacre-coeur-redhotchilipeppers.mov" ;;
    _gen-sacre-sunny*) echo "sacre-coeur-steps-sunny.mov" ;;
    _gen-tournelle-golden*) echo "paris-tournelle-golden.mov" ;;
    _gen-buci-fete*) echo "paris-buci-fete-musique.mov" ;;
    _gen-bateau-mouche*) echo "paris-bateau-mouche.mov" ;;
    *) echo "" ;;
  esac
}

cd "$DIR"
{
  echo "{"
  first=1
  for f in *.jpeg *.jpg *.mov *.mp4; do
    [ -e "$f" ] || continue
    if [[ "$f" == _gen-* ]]; then
      src=$(gen_source "$f")
      [ -n "$src" ] && [ -e "$src" ] && ym=$(get_ym "$src") || ym=""
    else
      ym=$(get_ym "$f")
    fi
    if [[ "$ym" =~ ^20[0-9]{2}-[0-9]{2}$ ]]; then
      [ "$first" = 1 ] || echo ","
      first=0
      printf '  "%s": "%s"' "$f" "$ym"
    fi
  done
  echo ""
  echo "}"
} > "$OUT"
echo "wrote $OUT ($(grep -c '": "' "$OUT") dated files)"
