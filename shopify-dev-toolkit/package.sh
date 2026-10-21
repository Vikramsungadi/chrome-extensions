#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/theme-dev-toolkit-<version>.zip
# Only runtime files are included (manifest, icons, src) — docs and store assets stay out.
set -euo pipefail
cd "$(dirname "$0")"

version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
out="dist/theme-dev-toolkit-${version}.zip"

# Fail fast on syntax errors and an invalid manifest.
python3 -c "import json; m=json.load(open('manifest.json')); assert len(m['description']) <= 132, 'description > 132 chars'"
if command -v node >/dev/null; then
  find src -name '*.js' -print0 | xargs -0 -n1 node --check
fi

mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json icons src -x '*.DS_Store'
echo "Built $out ($(du -h "$out" | cut -f1))"
unzip -l "$out" | tail -1
