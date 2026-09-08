---
name: monad-design-color
description: Refine semantic colors, emphasis, surfaces and contrast in native UI. Use for the Color adjustment goal while preserving the existing brand and state meanings.
metadata:
  version: "2"
---

# Native color

Use color to clarify the app's information and interaction roles. Keep the brand recognizable and the semantic states trustworthy. A successful adjustment can use less color if that makes the intended focal point clearer.

## Inventory roles, not swatches

Read the design tokens, theme definitions, asset colors and the selected view's actual foreground/background combinations. Identify roles for reading text, secondary text, canvas, raised surfaces, primary action, selection, focus, separators and meaningful status. Check enabled, pressed, selected, error and disabled treatments when relevant.

Separate a local hard-coded override from the app's established palette. Determine whether the requested change concerns emphasis, mood, contrast or an explicit rebrand. The Color goal alone does not authorize a rebrand. Do not introduce a new color library, convert all tokens to another color space or replace platform semantic colors as a side effect.

## Choose a color relationship

Name the intended focal point and the roles that should recede. Explore a coherent relationship such as quieter surfaces with a stronger action, warmer support surfaces inside the existing palette, or clearer separation of selected and unselected content. Avoid arbitrary rules about how much of the screen must use an accent.

For each changed role, keep both a foreground and a background decision. Transparent layers depend on what is behind them; inspect the composed result rather than treating an opacity value as a contrast guarantee. Elevation in dark appearance is not simply the inverse of light appearance. A branded accent may need different tonal values across appearances to remain recognizable and readable.

## Preserve semantics and accessibility

| Color use | Required companion decision |
| --- | --- |
| Error, warning or success | Keep the correct meaning and a non-color cue |
| Selected row or option | Preserve a visible state marker and accessible selection state |
| Primary action | Keep text readable in the actual control state |
| Secondary copy | Reduce emphasis without making necessary information unreadable |
| Data categories | Keep categories distinguishable through labels, markers or patterns where needed |

Use measured contrast where the design changes critical text or controls; do not claim a pass from visual impression. As a practical baseline for ordinary text, target at least 4.5:1, and 3:1 for sufficiently large text and meaningful control boundaries. Account for the actual font and rendered pair. Disabled controls have different formal requirements, but must remain understandable. Do not use a decorative border around every control as a substitute for a coherent state treatment.

## Implement through the existing framework

In SwiftUI/UIKit, prefer the app's named assets or semantic color abstraction with appearance variants. In React Native/Expo, use the established theme/provider and respect appearance changes rather than reading the setting once. In Flutter, map changes to the appropriate theme or component roles. Do not force a color scheme locally to make one screenshot look right.

Check translucency, materials, image backgrounds and system tint inheritance when they affect the selected component. Respect platform options for increased contrast and differentiating without color where the app supports them. Use platform-appropriate APIs already available to the target rather than web-only CSS or ARIA techniques.

## Variants and verification

Each variant should communicate a different emphasis strategy within the same identity; random hue rotations are not a useful comparison. Keep content and state equivalent. When Callout is selected, preserve the message severity; when Fonts is selected, coordinate color with weight instead of maximizing both.

Build/install and inspect the Core-returned evidence. Report changed semantic roles, actual contrast checks and missing appearances or states. A static capture does not prove theme switching or state transitions; make that limit explicit.

## Distinct direction contract

Name the emphasis strategy and affected semantic roles: for example **Action emphasis** reserves the strongest existing accent for the next step; **Content emphasis** gives the key result priority while keeping actions recognizable; **Surface separation** improves grouping through appearance-aware tonal levels. These strategies must fit the requested content and brand. Swapping hues or varying accent opacity on the same roles is not sufficient. Explain the resulting attention tradeoff without altering status meanings.

Before editing, give each variant its own direction name, user benefit, decisive changes and tradeoff. Compare every pair and replace overlapping strategies before implementation. Follow the main Monad Design direction plan and publish-summary contract; do not manufacture diversity outside the user constraints.

## Live integration

When invoked for a Monad Design request, retain its scope, user constraints and requested variant count. Follow the already loaded `monad-design` skill for claim, Debug variants, build/install, publish, selection and completion. Core owns launch, capture and runtime observation after building. Do not independently launch or capture previews, start another session, or apply a final choice before confirmation. Outside Live, use this skill only within the user's explicit edit or review scope.
