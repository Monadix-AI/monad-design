# Native variant preview protocol

Monad Design captures the unchanged original plus the 1–5 alternatives requested for the current turn by terminating and relaunching a target Debug app with the corresponding prefix of:

```text
-MonadDesignVariant original
-MonadDesignVariant v1
-MonadDesignVariant v2
-MonadDesignVariant v3
-MonadDesignVariant v4
-MonadDesignVariant v5
```

The target app owns the temporary source implementations and the Debug-only preparation needed to reach the selected screen. Monad Design only launches and captures them; selecting a capture does not modify source.

After the capture set completes—or stops after a partial failure—Monad Design terminates the preview launch and starts the app normally without `-MonadDesignVariant`. The captured evidence remains available for comparison. Monad Design uses the preview argument again only when the user explicitly opens a selected variant live.

## Automatic destination contract

A valid `-MonadDesignVariant` launch must reach the selected screen and a stable, equivalent UI state without taps, typing, authentication, scrolling, or other manual setup. This applies when the selected element is several navigation steps away from the normal app entry point or below the initial viewport. The prepared launch must build the real ancestor route stack: if screen B normally follows screen A, the preview opens on B with `A -> B` intact, and Back from B returns to A. When scrolling is required, the Debug-only preparation must use a stable element or item identity to position the selected element near the center of its production scroll container after deterministic content is ready. It must not restore a hard-coded pixel offset, and the final positioning must not animate.

Use the least invasive preparation already available in the target app:

1. An existing deep link or internal route that constructs the production navigation stack.
2. Existing navigation restoration with deterministic local state.
3. A narrow Debug-only bootstrap that seeds the real router or navigation path.

The preparation is temporary source scaffold generated alongside the variants. It must not require a Monad Design SDK, package, permanent URL scheme, or release-build behavior. It must not mount the selected screen as a replacement root view, detached preview host, sheet, or overlay. Debug-only fixtures may supply deterministic data, but the app's production navigation container and Back behavior remain authoritative. The original and every requested variant must share the same destination, complete navigation stack, data, viewport, scroll target, appearance, and surrounding state. Before accepting a capture, Monad Design verifies through the accessibility tree that the selected target is visible and its frame has settled. An explicit `original` value shows the unchanged implementation at that destination; a missing or invalid flag preserves normal app launch behavior.

## SwiftUI integration

Keep the protocol Debug-only. Treat only an explicit, valid value as a preview launch; missing or invalid values leave the normal app entry point untouched:

```swift
enum MonadDesignVariant: String {
    case original
    case v1
    case v2
    case v3
    case v4
    case v5

    static var requested: Self? {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        guard
            let flag = arguments.firstIndex(of: "-MonadDesignVariant"),
            arguments.indices.contains(flag + 1),
            let variant = Self(rawValue: arguments[flag + 1])
        else { return nil }
        return variant
        #else
        return nil
        #endif
    }
}
```

At the app boundary, use the requested value to seed the real navigation path and enter the target destination only for a valid Debug preview launch. Keep normal launch behavior when `requested` is `nil`. Do not replace the production root with the target screen. At the smallest coherent source boundary, switch the implementation:

```swift
@ViewBuilder
private var previewContent: some View {
    switch MonadDesignVariant.requested ?? .original {
    case .original:
        OriginalContent()
    case .v1:
        VariantOneContent()
    case .v2:
        VariantTwoContent()
    case .v3:
        VariantThreeContent()
    case .v4:
        VariantFourContent()
    case .v5:
        VariantFiveContent()
    }
}
```

Each alternative should preserve data, actions, accessibility semantics, and native navigation. Verify that the target screen's normal Back control returns to its expected parent for every variant. After selection, a separate source change must keep the chosen implementation and remove the temporary switch and the other variants.
