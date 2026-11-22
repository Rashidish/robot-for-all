#!/usr/bin/env bash
# Builds the micro:bit Foundation's MicroPython simulator (MIT) from source at the pinned
# version, applies our patches, and puts the result in apps/web/public/simulator/<version>-<build>/
# (ADR-0006). CI caches the output, so this only runs when the version or patches change.
# Needs: git, Node, Python 3, make, and network access to GitHub and the Emscripten SDK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# apps/web/simulator.json: the upstream release, and our build number. The build number is part
# of the served folder name, so browsers never keep an old copy after our patches change.
VERSION="$(node -p "require('$ROOT/apps/web/simulator.json').upstream")"
FOLDER="$(node -p "const s = require('$ROOT/apps/web/simulator.json'); s.upstream + '-' + s.build")"
OUT="$ROOT/apps/web/public/simulator/$FOLDER"
WORK="${RUNNER_TEMP:-/tmp}/rfa-simulator"
EMSDK_VERSION="6.0.6" # the version upstream's ci-build.sh uses for this release

rm -rf "$WORK"
git clone --depth 1 --branch "$VERSION" \
  https://github.com/microbit-foundation/micropython-microbit-v2-simulator "$WORK"
cd "$WORK"
git submodule update --init lib/micropython-microbit-v2
(cd lib/micropython-microbit-v2 && git submodule update --init lib/micropython)

for patch in "$ROOT"/patches/simulator/*.patch; do
  echo "Applying $(basename "$patch")"
  git apply "$patch"
done
node "$ROOT/scripts/vendor-simulator.mjs" svg src/microbit-drawing.svg

if [ ! -d "$HOME/.emsdk" ]; then
  git clone --depth 1 --branch "$EMSDK_VERSION" https://github.com/emscripten-core/emsdk.git "$HOME/.emsdk"
fi
"$HOME/.emsdk/emsdk" install "$EMSDK_VERSION"
"$HOME/.emsdk/emsdk" activate "$EMSDK_VERSION"
NODE_BIN="$(dirname "$(command -v node)")"
# shellcheck disable=SC1091
source "$HOME/.emsdk/emsdk_env.sh"
export PATH="$NODE_BIN:$PATH"

make -C lib/micropython-microbit-v2/lib/micropython/mpy-cross CFLAGS_EXTRA=-Wno-error
npm ci --no-audit --no-fund
make -C src

rm -rf "$OUT"
node "$ROOT/scripts/vendor-simulator.mjs" finish "$WORK/src" "$OUT" "$FOLDER"
ls -la "$OUT" "$OUT/build"
