---
name: monad-design-motion
description: Refine native transitions, animation and interaction feedback. Use for the Motion adjustment goal with reduced-motion support, interruption handling and existing navigation behavior.
metadata:
  version: "2"
---

# Native motion

Use animation to explain a state change or preserve continuity. The goal is a clearer interaction, not motion added to every visible element. Keep the action responsive even when the animation is interrupted or disabled.

## Identify the transition contract

Read the control or view's state ownership, triggers, destination state, cancellation path and existing animation conventions. Identify whether the need is feedback, expansion/collapse, navigation continuity, progress or a meaningful status change. A screenshot cannot show timing or interruption; use source and supplied interaction evidence without inventing observations.

Describe the transition in four parts: the user/system trigger, the state before it, the state after it, and what remains interactive during the transition. Inspect repeated taps, reverse actions, disappearing views and late asynchronous results. Fix a state ownership problem before decorating it.

## Choose the motion language

| Purpose | Suitable direction | Common failure |
| --- | --- | --- |
| Acknowledge input | Immediate, small state feedback | Delaying the real action until animation ends |
| Explain expansion | Preserve the connection between trigger and content | Moving unrelated content without a stable anchor |
| Navigate | Reuse the app's transition and back behavior | Replacing the navigation stack for a custom effect |
| Show progress | Reflect real ongoing work | Invented completion percentages or decorative waits |
| Highlight a changed state | One bounded cue | A perpetual pulse demanding attention |

Prefer the app's established springs, durations and easing. Choose timing based on travel and consequence rather than applying one fixed duration everywhere. Ordinary feedback should feel immediate. Decorative stagger must not serially delay access to a list of actions. A static component with no meaningful state change may need no animation; say why instead of inventing a trigger.

## Implement with state, not timers

In SwiftUI, scope animation to the state value that should animate and preserve view identity. Avoid attaching a broad animation to a parent where unrelated updates can inherit it. In UIKit, use the existing transition or animator machinery and define completion/cancellation behavior explicitly. In React Native/Expo, use installed animation facilities, clean up listeners and work on the appropriate thread; do not add a motion dependency for a simple local effect. In Flutter, use existing implicit transitions when adequate and dispose explicit controllers with their owner.

Do not run network mutations, navigation side effects or model writes from repeated animation callbacks. The final state must be correct even when animation duration is zero, the user reverses immediately, or the view disappears. Preserve scroll position, focus, hit testing and back gestures. Invisible content must not keep intercepting input.

## Reduced motion and performance

Provide an understandable non-spatial or immediate state change when reduced motion is enabled. Preserve the information, not necessarily the effect. Avoid automatic looping for nonessential decoration; stop transient work when its owning view is gone or inactive. Test the fallback path in source even if the current capture does not expose that setting.

Bound expensive masks, blur, shadows and large-area redraws. Do not equate a successful build or smooth desktop capture with target-device frame performance. Profiling is warranted when a reported performance problem or an expensive effect makes it relevant; do not start a broad performance audit for a routine feedback refinement.

## Variants and handoff

Compare distinct transition strategies, such as direct state feedback versus spatial continuity, while keeping triggers, destination content and behavior identical. Do not compare different workflows and call them animation variants. With Layout selected, establish stable destinations first; with Callout, keep the message readable after the arrival cue ends.

Build/install and publish through Monad Design. Core owns variant launch and capture; do not autonomously replay gestures or take additional Simulator screenshots after building. Static captures cannot validate timing, repeat input, reduced motion or smoothness. State those limits in the publish summary and use user/Core interaction feedback for focused repair. Never claim runtime motion verification from source inspection alone.

## Distinct direction contract

Define each direction through its transition mechanism and purpose: for example **Immediate feedback** communicates the state change in place; **Spatial continuity** shows the relationship between existing source and destination; **Staged explanation** reveals already-related information in a bounded sequence where that order helps understanding. Keep triggers, final state, actions and reduced-motion correctness equivalent. Three durations or spring constants for the same transition are refinements of one direction, not independent directions. Describe temporal differences explicitly and never claim that static variant captures verify them.

Before editing, give each variant its own direction name, user benefit, decisive changes and tradeoff. Compare every pair and replace overlapping strategies before implementation. Follow the main Monad Design direction plan and publish-summary contract; do not manufacture diversity outside the user constraints.

## Live integration

When invoked for a Monad Design request, retain its scope, user constraints and requested variant count. Follow the already loaded `monad-design` skill for claim, Debug variants, build/install, publish, selection and completion. Core owns launch, capture and runtime observation after building. Do not independently launch or capture previews, start another session, or apply a final choice before confirmation. Outside Live, use this skill only within the user's explicit edit or review scope.
