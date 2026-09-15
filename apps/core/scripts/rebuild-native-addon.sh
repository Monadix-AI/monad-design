#!/bin/bash
set -euo pipefail

core_root="$(cd "$(dirname "$0")/.." && pwd)"
serve_sim_path="$core_root/node_modules/serve-sim"
if [ ! -d "$serve_sim_path" ]; then
  echo "Install Core dependencies before rebuilding the native addon." >&2
  exit 1
fi
serve_sim_version="$(node -p "require('$serve_sim_path/package.json').version")"
if [ "$serve_sim_version" != "0.1.46" ]; then
  echo "Expected serve-sim 0.1.46, found $serve_sim_version." >&2
  exit 1
fi

build_root="$(mktemp -d -t monaddesign-native-ax)"
trap 'rm -rf "$build_root"' EXIT
cp -RL "$serve_sim_path" "$build_root/serve-sim"
mkdir -p "$build_root/serve-sim/node_modules/node-swift"
npm pack node-swift@1.5.1 --pack-destination "$build_root" --silent >/dev/null
tar -xf "$build_root/node-swift-1.5.1.tgz" -C "$build_root/serve-sim/node_modules/node-swift" --strip-components=1
patch -d "$build_root/serve-sim" -p1 < "$core_root/native/serve-sim-tvos-ax-grid.patch"
bash "$build_root/serve-sim/Sources/SimNative/build.sh" "$core_root/native"
