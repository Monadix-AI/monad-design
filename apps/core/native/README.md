# tvOS accessibility addon

`serve-sim-native.node` is a universal macOS addon rebuilt from the pinned
`serve-sim@0.1.46` source. The only source change is
[`serve-sim-tvos-ax-grid.patch`](serve-sim-tvos-ax-grid.patch): it increases the
sampling distance on large screens so the native accessibility walk covers the
whole tvOS screen within its existing 600-query budget. iOS screens continue
using the original 32-point sampling distance.

To rebuild the addon on macOS, install the workspace dependencies and run
`bash apps/core/scripts/rebuild-native-addon.sh`. The script checks the pinned
serve-sim version, applies the source patch to a temporary copy, and rebuilds
both arm64 and x86_64 slices. The checked-in binary's SHA-256 is
`9aff6168f635fb20a2d48b7d986f95d086edb098aabdd29002653a125b091f1e`.
Swift build paths can change the binary hash even when the source patch and
runtime behavior are the same.
