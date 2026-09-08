---
name: monad-design-layout
description: Refine native UI spacing, alignment, grouping, density and adaptive layout. Use for the Layout adjustment goal while preserving navigation and production view structure.
metadata:
  version: "2"
---

# Native layout

Organize the selected content so relationships are clear and actions remain reachable. Preserve the running app's structure and behavior; a layout refinement should not create a detached preview screen.

## Diagnose the actual constraint

Read the selected composition, parent layout and spacing tokens. Identify the content order, the action that should be found first, related groups, repeated rows, safe areas and scrolling owner. Separate visual alignment from accessibility traversal. Determine whether crowding comes from text length, fixed dimensions, conflicting constraints, excessive decoration or the wrong grouping.

Record only the measurements that explain the defect: available width, padding, inter-group versus intra-group spacing, baseline positions and reserved toolbar/keyboard space. Do not reverse-engineer an entire screen when the request concerns a single row. Treat a selection's runtime rectangle as evidence at one moment, not a permanent absolute position.

## Choose a composition

| Need | Direction to explore | Preserve |
| --- | --- | --- |
| Faster scanning | Align repeated labels and values; reduce competing anchors | Reading order and semantics |
| Stronger grouping | Tighten relationships within groups and separate groups | Content completeness |
| More breathing room | Remove redundant wrappers and redistribute space | Action reachability |
| More information visible | Reduce redundant chrome before compacting content | Legibility and touch areas |
| Larger text or narrow width | Reflow adjacent content into a clear sequence | Meaningful order and state |

Do not turn every related item into a card. A heading, spacing interval or separator may communicate the relationship more clearly. A new container must have a structural purpose. Use the existing spacing vocabulary; introduce a new token only when it represents a repeated role that the current system cannot express.

## Implement the layout relationship

Use native layout mechanisms that describe relationships rather than screenshot coordinates. In SwiftUI, prefer stacks, grids, alignment guides or the existing custom layout; avoid unneeded geometry readers and offset chains. In UIKit, make constraint priorities deliberate and check intrinsic content size and compression resistance. In React Native, inspect flex direction, shrinking, wrapping and scroll ownership together. In Flutter, distinguish bounded and unbounded constraints before introducing Expanded, Flexible or a new scrollable.

Retain the production navigation container, list identities, data bindings and focus behavior. Do not replace a native list with hand-built scrolling solely to change margins. Respect safe-area content, system bars and keyboard insets. If the app already supports multiple orientations or window sizes, keep that support without inventing new breakpoints for unsupported surfaces.

A dense variant may reduce whitespace; it must not reduce the intended hit area to the visible glyph. A spacious variant may expand content; it must not place the main action outside a reachable scroll region. Keep parent and child scroll behavior unambiguous.

## Coordinate variants

For multiple alternatives, vary one substantial composition decision: grouped sections versus continuous rows, adjacent versus stacked metadata, or compact versus relaxed density. Keep labels, data, navigation destination and appearance equivalent so the comparison isolates layout. When typography is selected too, choose the reflow strategy together; shrinking text is not a substitute for a workable layout.

## Verify and report

Build the actual target and inspect for ambiguous constraints, overflow, accidental nested scrolling, reordered accessibility elements and touch interception. Use returned Core captures to judge alignment, balance and reachability. Include longer realistic content when fixtures are already part of the allowed preview state. If keyboard, split view or accessibility text settings were not observed, name those gaps. Report the relationship improved and the tradeoff between variants, not a list of margin changes.

## Distinct direction contract

Choose genuinely different organization strategies allowed by the request: for example **Grouped tasks** separates related actions into clear sections; **Continuous scan** uses repeated aligned rows with fewer interruptions; **Content-first stack** puts the main information before supporting controls. Explain the order, grouping and density tradeoff. Do not apply these indiscriminately to a tiny element or change navigation. Three versions of the same stack with slightly different gaps do not establish different directions.

Before editing, give each variant its own direction name, user benefit, decisive changes and tradeoff. Compare every pair and replace overlapping strategies before implementation. Follow the main Monad Design direction plan and publish-summary contract; do not manufacture diversity outside the user constraints.

## Live integration

When invoked for a Monad Design request, retain its scope, user constraints and requested variant count. Follow the already loaded `monad-design` skill for claim, Debug variants, build/install, publish, selection and completion. Core owns launch, capture and runtime observation after building. Do not independently launch or capture previews, start another session, or apply a final choice before confirmation. Outside Live, use this skill only within the user's explicit edit or review scope.
