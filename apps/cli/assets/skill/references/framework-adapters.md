# Framework adapter configuration

Configure every target from inspected source and build metadata. Paths are repository-relative. `sourceRoots`, `variant.bootstrapPath`, `build.workingDirectory`, and `navigation.bootstrapPath` must identify existing or intentionally planned locations.

## Common invariants

- `schemaVersion` is `1`.
- `configuration` is `Debug`.
- `variant.launchArgument` is `-MonadDesignVariant`.
- Variant values are `original` plus the supported prefix of `v1` through `v5`.
- Prefer an existing production router or restoration path. Use a narrow Debug bootstrap only when no existing route can construct the real stack deterministically.
- Use `system: custom` only for a checked-in authoritative wrapper; store an argv-style command, never a shell pipeline.

## Native iOS

For SwiftUI use `framework: swiftui`; for UIKit use `uikit-swift` or `uikit-objective-c`. Use `variant.bridge: native-launch-arguments` and parse process arguments behind a Debug guard. Switch at the smallest owning production UI boundary. Record the inspected `.xcodeproj` or `.xcworkspace`, scheme, working directory, and navigation owner.

## React Native and Expo

Use `framework: react-native` or `expo` and `variant.bridge: react-native-initial-properties`. The native AppDelegate reads the launch argument and passes it through initial properties or an existing local bridge; JavaScript must not guess native process arguments. Point navigation bootstrap at the real React Navigation container or state builder. Confirm whether Expo uses prebuild, a development build, or direct Xcode build; do not assume Expo Go.

## Flutter

Use `framework: flutter` and `variant.bridge: flutter-method-channel`. Read the launch argument in AppDelegate and pass it through an early channel before Dart routing while retaining the normal entry point. Record working directory, optional flavor, and deterministic Simulator `.app` artifact when known. Point navigation bootstrap at the production Router or Navigator owner.
