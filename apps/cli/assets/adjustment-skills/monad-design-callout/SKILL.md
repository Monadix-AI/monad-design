---
name: monad-design-callout
description: Design or refine native callouts, inline hints and highlighted messages. Use for the Callout adjustment goal; distinguish informational emphasis from alerts without inventing urgency or new behavior.
metadata:
  version: "2"
---

# Native callouts

Help the user notice one message at the moment it matters. A callout is an information relationship, not a colored box template. Decide what deserves emphasis before choosing its surface.

## Find the message and consequence

Read the selected content and nearby interaction. Identify the exact message, its audience, when it appears, and what the user can actually do next. Classify it as explanation, recommendation, current status, recoverable problem or genuinely blocking condition. Preserve that semantic severity throughout all variants.

When no message is identifiable from the selection, existing content or request, ask what should be highlighted before creating copy. Do not invent account conditions, security risks, deadlines, guarantees or actions. An ordinary recommendation must not become a warning just because amber gives it more visual weight.

## Choose the right presentation

| Situation | Appropriate relationship | Avoid |
| --- | --- | --- |
| A field needs explanation | Put a short hint next to the field | A distant screen-level banner |
| A section has useful context | Use a heading, supporting text or quiet inline surface | A modal for passive information |
| A recoverable problem affects an action | Explain the real problem near the affected action | Generic alarm styling with no recovery |
| A status changes | Keep a stable status location and clear wording | Repeated disruptive announcements |
| Work cannot continue | Use the app's established blocking pattern | Inventing a new blocker from a visual request |

Prefer the least intrusive presentation that makes the message discoverable. Preserve an existing alert, sheet or banner's lifecycle; changing modality, dismissal persistence or permission behavior is a functional change and needs user scope. Never render a dismiss affordance that has no implemented action.

## Compose the callout

Define a concise leading statement, optional explanation, and an action only if a real action already exists or was requested. The leading statement should carry the key information even when scanned alone. Remove a title that merely repeats the sentence below it.

Use the app's semantic colors and surface hierarchy. Choose an icon only when it clarifies meaning; decorative iconography should not create duplicate screen-reader output. A callout may be text-only. Avoid automatically adding heavy edge stripes, oversized symbols, shadows or full-width fills. Evaluate its emphasis relative to the primary task: more noticeable should not mean more important than everything else.

For layout, allow the message to wrap independently of its icon and action. At larger text settings, stack content when needed instead of squeezing the label. Keep a button's action and accessibility name consistent with its visible wording. Group explanatory content logically while leaving real controls independently reachable.

## Native behavior and combinations

Reuse existing semantic components and tokens across SwiftUI, UIKit, React Native/Expo or Flutter. Inspect supported accessibility announcements before adding any; announce meaningful state changes, not each redraw. Do not implement a native callout using web ARIA attributes. Treat RTL, long translations and multiple simultaneous messages as layout questions rather than reasons to hide content.

With Copy selected, agree on the factual message and recovery action first. With Color, retain severity while exploring surface emphasis. With Motion, use at most a bounded arrival or state-change cue; an important message must remain understandable without animation.

## Variants and evidence

Alternatives can explore quiet inline emphasis, a distinct section-level treatment or a more concise hierarchy when content permits. Keep message meaning, trigger and actions identical. Build/install and let Core capture the variants. Review placement, reading order, contrast and the competition with the primary task from returned evidence. Report any interaction or announcement behavior that has not been exercised. Do not describe the result as an accessibility or safety improvement unless the relevant checks were actually performed.

## Distinct direction contract

Keep the exact message, semantic severity, trigger and real actions fixed while choosing different attention strategies. A **Contextual hint** stays quiet beside the affected content; a **Section anchor** uses the message to orient a whole group; a **Message-first treatment** gives the existing explanation stronger typographic priority. Use only strategies supported by the selected boundary. Three identical boxes with different fills, icon sizes or corner radii are not distinct directions; never increase urgency just to create another option.

Before editing, give each variant its own direction name, user benefit, decisive changes and tradeoff. Compare every pair and replace overlapping strategies before implementation. Follow the main Monad Design direction plan and publish-summary contract; do not manufacture diversity outside the user constraints.

## Live integration

When invoked for a Monad Design request, retain its scope, user constraints and requested variant count. Follow the already loaded `monad-design` skill for claim, Debug variants, build/install, publish, selection and completion. Core owns launch, capture and runtime observation after building. Do not independently launch or capture previews, start another session, or apply a final choice before confirmation. Outside Live, use this skill only within the user's explicit edit or review scope.
