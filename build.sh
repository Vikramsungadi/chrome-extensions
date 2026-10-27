#!/usr/bin/env bash
# Builds every extension (or the ones named) into dist/<name>/, ready for "Load unpacked".
# shared/ (Polaris tokens + icons) is copied into each build at src/shared/.
#
#   ./build.sh                       build all
#   ./build.sh shopify-image-sizer   build one
#   ./build.sh --zip [names…]        also write dist/<name>-<version>.zip for the Chrome Web Store
set -euo pipefail
cd "$(dirname "$0")"

zip=false
names=()
for arg in "$@"; do
  case "$arg" in
    --zip) zip=true ;;
    *) names+=("${arg%/}") ;;
  esac
done
if [ ${#names[@]} -eq 0 ]; then
  for dir in extensions/*/; do names+=("$(basename "$dir")"); done
fi

for name in "${names[@]}"; do
  src="extensions/$name"
  out="dist/$name"
  [ -f "$src/manifest.json" ] || { echo "No extension at $src" >&2; exit 1; }

  # Fail fast on an invalid manifest.
  version=$(python3 -c "
import json; m = json.load(open('$src/manifest.json'))
assert len(m['description']) <= 132, 'description > 132 chars'
print(m['version'])")

  rm -rf "$out"
  mkdir -p "$out/src/shared"
  cp -R "$src/manifest.json" "$src/icons" "$out/"
  cp -R "$src/src/." "$out/src/"
  cp -R shared/. "$out/src/shared/"
  find "$out" -name '.DS_Store' -delete

  if command -v node >/dev/null; then
    find "$out/src" -name '*.js' -print0 | xargs -0 -n1 node --check
  fi
  echo "Built $out (v$version)"

  if $zip; then
    archive="dist/$name-$version.zip"
    rm -f "$archive"
    (cd "$out" && zip -qr "../../$archive" .)
    echo "  → $archive ($(du -h "$archive" | cut -f1))"
  fi
done
