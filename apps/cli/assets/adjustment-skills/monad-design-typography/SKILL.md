---
name: monad-design-typography
description: Refine font choice, text hierarchy, readability and Dynamic Type in a native app. Use for the Fonts adjustment goal or a request focused on typography, without replacing the app identity.
metadata:
  version: "2"
---

# Native typography

Make the reading order obvious and the text comfortable at the user's actual size setting. A successful typography change improves the relationship between roles; it is not a tour of font families.

## Establish the type system

Read the selected view, its nearest production parent and the shared text styles. Identify the framework and minimum supported platform version before choosing APIs. Use current request evidence to connect the rendered text to source; an accessibility label is a clue, not a symbol name.

Make a small role inventory: screen title, section title, reading text, control label, secondary explanation and comparable numeric data. For each role, record the existing family, weight, size/scaling behavior, line limit and color token. Check a repeated instance elsewhere to distinguish deliberate rules from local exceptions. Respect a branded face already used by the app; do not introduce or download a font merely to make alternatives look different.

## Choose the intervention

| Symptom | Useful intervention | False fix |
| --- | --- | --- |
| Everything competes | Separate two adjacent roles by weight, scale or placement | Make every heading larger |
| Dense paragraphs | Improve available measure and leading together | Increase every margin |
| Weak metadata | Rebalance contrast within semantic roles | Make all secondary text tiny |
| Jumping counters | Use tabular figures for the comparable values | Monospace the entire component |
| Clipped larger text | Let containers grow, wrap or reflow | Disable scaling or shrink to fit |

For a small control, one role change may be enough. For a screen, define a coherent scale with a few named roles rather than separate point sizes for every label. Use size contrast where the content deserves it, not a fixed ratio everywhere. Judge measure in the writing system actually displayed: Latin character-count heuristics do not transfer directly to Chinese text or narrow native controls.

## Implement with the framework

- In SwiftUI, prefer semantic text styles for content roles. If a brand font is required, use its scaling-aware form; scale supporting geometry when it genuinely follows text size. Let multiline labels participate in layout rather than forcing a one-line frame.
- In UIKit, map roles to preferred text styles or the existing text-style abstraction. Scale custom fonts through the platform's font metrics and allow content-size-category updates. Check constraints and label line counts together.
- In React Native or Expo, preserve font scaling and the app's text abstraction; inspect fixed heights and line-height assumptions before applying new font metrics. Do not add blanket maximum scaling limits.
- In Flutter, refine the app's text theme and account for the current text scaler. Avoid a local scaler override as an overflow workaround.

Do not raise the deployment target or replace the existing typography infrastructure for a local adjustment. Use supported APIs already in the project, and verify uncertain API availability against the project's SDK.

## Design useful variants

Choose distinct, named reading strategies that fit the same identity: stronger section hierarchy, calmer reading rhythm, or denser operational scanning. Change only the axes needed for that distinction. Keep content, state and screen width equivalent. If Layout is also selected, agree on wrapping and grouping before tuning font sizes; if Copy is selected, size the final strings rather than the discarded ones.

## Verify and report

Inspect the source for line limits, fixed frames, scaling opt-outs, duplicated style constants and font availability. Check the supported build. In Core-provided captures, assess the reading order, clipping, mixed-language baselines, numeric alignment and primary-action visibility. If larger text or another appearance was not captured, state that limitation instead of claiming it passed. Report the changed roles and why each variant reads differently; do not report a font inventory as the result.

## Distinct direction contract

Choose directions by reading priority: for example **Section-led scanning** uses stronger heading/body separation; **Continuous reading** gives prose the clearest cadence and quieter headings; **Data comparison** prioritizes aligned numeric roles when the selected content contains comparable values. These are examples to adapt, not three mandatory presets. State which roles change, what becomes easier, and what becomes less prominent. Three nearby font sizes or alternate font families with the same hierarchy are not three directions.

Before editing, give each variant its own direction name, user benefit, decisive changes and tradeoff. Compare every pair and replace overlapping strategies before implementation. Follow the main Monad Design direction plan and publish-summary contract; do not manufacture diversity outside the user constraints.

## Live integration

When invoked for a Monad Design request, retain its scope, user constraints and requested variant count. Follow the already loaded `monad-design` skill for claim, Debug variants, build/install, publish, selection and completion. Core owns launch, capture and runtime observation after building. Do not independently launch or capture previews, start another session, or apply a final choice before confirmation. Outside Live, use this skill only within the user's explicit edit or review scope.
