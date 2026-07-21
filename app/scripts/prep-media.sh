#!/bin/bash
# Convert & place slot media. Usage: ./scripts/prep-media.sh <source-folder> [city]
#
# Files in <source-folder> must already be RENAMED to their slot id (see
# public/media/<city>/SLOTS.md), e.g. cafe-1.HEIC, berthillon-3.mov.
# Photos (heic/png/tiff/jpg) are converted to web-sized JPEGs via sips (built
# into macOS). Videos: .mp4 copied as-is; .mov converted with ffmpeg when
# available, otherwise copied (HEVC .mov may not play in Chrome).
set -euo pipefail

SRC="${1:?usage: prep-media.sh <source-folder> [city]}"
CITY="${2:-paris}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/media/$CITY"
mkdir -p "$DEST"

shopt -s nullglob nocaseglob

for f in "$SRC"/*.{jpg,jpeg,png,heic,tif,tiff}; do
  base="$(basename "${f%.*}")"
  sips -s format jpeg -s formatOptions 82 --resampleHeightWidthMax 1600 "$f" --out "$DEST/$base.jpg" >/dev/null
  echo "photo  ✓ $base.jpg"
done

for f in "$SRC"/*.{mp4,mov}; do
  base="$(basename "${f%.*}")"
  ext="$(echo "${f##*.}" | tr '[:upper:]' '[:lower:]')"
  if [ "$ext" = "mp4" ]; then
    cp "$f" "$DEST/$base.mp4"
    echo "video  ✓ $base.mp4 (copied)"
  elif command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -y -loglevel error -i "$f" -c:v libx264 -crf 23 -movflags +faststart -an "$DEST/$base.mp4"
    echo "video  ✓ $base.mp4 (converted from .mov)"
  else
    cp "$f" "$DEST/$base.mp4"
    echo "video  ⚠ $base.mp4 copied without conversion — install ffmpeg (brew install ffmpeg) if it doesn't play in Chrome"
  fi
done

echo "→ $DEST"
