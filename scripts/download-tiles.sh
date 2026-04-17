#!/usr/bin/env bash
set -euo pipefail

# Download OSRS map tiles via shallow clone of mejrs/layers_osrs
# This avoids GitHub API rate limits by cloning the full repo once.
#
# Usage:
#   ./scripts/download-tiles.sh          # download all tiles
#   ./scripts/download-tiles.sh -2 2     # only keep zoom -2 through 2

REPO="https://github.com/mejrs/layers_osrs.git"
DEST="$(cd "$(dirname "$0")/.." && pwd)/tiles"
TMPDIR="$(mktemp -d)"

MIN_ZOOM="${1:--4}"
MAX_ZOOM="${2:-4}"

echo "Shallow-cloning mejrs/layers_osrs..."
git clone --depth 1 --filter=blob:none --sparse "$REPO" "$TMPDIR/layers" 2>&1

cd "$TMPDIR/layers"

# Sparse checkout only the zoom levels we need
sparse_paths=""
for z in $(seq "$MIN_ZOOM" "$MAX_ZOOM"); do
    sparse_paths="$sparse_paths mapsquares/-1/$z"
done
echo "Checking out zoom levels $MIN_ZOOM to $MAX_ZOOM..."
git sparse-checkout set $sparse_paths 2>&1
git checkout 2>&1

# Move tiles into place
echo "Moving tiles to $DEST..."
mkdir -p "$DEST"
for z in $(seq "$MIN_ZOOM" "$MAX_ZOOM"); do
    src="$TMPDIR/layers/mapsquares/-1/$z"
    if [ -d "$src" ]; then
        mv "$src" "$DEST/$z"
        count=$(find "$DEST/$z" -name '*.png' | wc -l)
        echo "  zoom $z: $count tiles"
    fi
done

# Cleanup
rm -rf "$TMPDIR"

total_files=$(find "$DEST" -name '*.png' | wc -l)
total_size=$(du -sh "$DEST" 2>/dev/null | cut -f1)
echo ""
echo "Complete: $total_files tiles, $total_size"
