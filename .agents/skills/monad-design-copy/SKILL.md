---
name: monad-design-copy
description: Write and refine native interface labels, help, empty states and errors. Use for the Copy adjustment goal while preserving factual meaning, localization structure and existing actions.
metadata:
  version: "2"
---

# Native interface copy

Make the next decision or action understandable in the context where the string appears. Rewrite the user's requested surface, not the product's entire voice. Keep factual claims, permissions, prices and consequences grounded in the existing product.

## Read the interaction before the string

Inspect the selected UI, surrounding flow, action handlers and localization resources. Determine who is reading, what they are trying to do, what the system actually knows, and which action is available. Distinguish a first-use empty state from no search results, a permission restriction or a failed load. Those states need different messages even when they share the same blank layout.

Build a tiny working glossary when terms conflict: the object name, primary action and status vocabulary. Preserve established domain terminology unless it demonstrably causes the reported confusion. Do not replace precise language with a simpler but inaccurate synonym.

## Write for the state

| Surface | Question the copy should answer |
| --- | --- |
| Action label | What will happen to which object? |
| Field label | What information belongs here? |
| Help text | What does the user need to know before acting? |
| Error | What is known to have failed, and what recovery is actually possible? |
| Empty state | Why is there no content, and what useful step exists? |
| Success | What outcome has really completed? |
| Progress | What operation is happening, with only supported timing claims? |

Use specific actions rather than generic confirmation words when the outcome would otherwise be ambiguous. Keep a persistent field label; a placeholder is an example, not the only name of a field. Place format constraints before submission when needed. Let an explanation add useful information instead of restating its heading.

A shorter message is only better if it retains the decision, consequence or recovery. Conversely, remove reassurance that adds no usable fact. Match tone to the situation: neutral and direct is often right for blocked work; do not add humor to loss, privacy or payment states.

## Protect truth and behavior

Trace a proposed recovery action to an existing handler or user request. Do not promise autosave, reversibility, a retry deadline or a cause that the implementation cannot establish. Preserve legal language and regulated meaning; flag ambiguity rather than creatively rewriting it. Do not add confirmation dialogs, tracking, permissions or new navigation under a Copy request.

For example, if an upload failed and the cause is unknown, identify the failed operation and an available retry rather than claiming the connection is offline. If retry does not exist, do not tell the user to tap it. This rule matters more than following a stock error-message template.

## Implement localization and accessibility

Edit the existing string catalog or localization mechanism. Preserve placeholders, plural forms, format specifiers and translator context. Use complete localizable messages rather than concatenating fragments whose word order only works in one language. Do not overwrite other translations with a machine translation unless requested; identify translations that need follow-up through the project's established process.

Visible labels and accessible names should describe the same action. Preserve platform-provided semantics and inspect custom labels that might still speak the old wording. Keep links meaningful outside surrounding prose. Avoid information conveyed only by punctuation, an icon or a color.

## Useful alternatives and checks

Differentiate variants by information priority or explicitness, not synonyms for their own sake. For example, an action-led version can prioritize recovery while a context-led version explains an unfamiliar state first; both must preserve the same facts. Combine with Callout before styling, and with Layout when longer truthful wording needs room.

Build the affected target and validate placeholder consistency, key usage and supported localization checks. Review returned Core captures for actual wrapping and truncation. Check representative dynamic values when permitted; never fabricate research scores or comprehension percentages. Report the meaningful wording changes, factual assumptions and any unverified locale or assistive reading behavior.

## Distinct direction contract

Differentiate information strategy while preserving the same facts and actions: for example **Action-led** starts with the available next step; **Context-led** first explains an unfamiliar state; **Consequence-led** first makes an existing consequential outcome explicit. Choose only strategies that actually fit the current state. Synonyms, punctuation changes and equivalent sentence order do not count as distinct directions. If an isolated label only has one accurate formulation, keep it fixed while another selected goal supplies the difference, or report that the requested count exceeds the meaningful copy options.

Before editing, give each variant its own direction name, user benefit, decisive changes and tradeoff. Compare every pair and replace overlapping strategies before implementation. Follow the main Monad Design direction plan and publish-summary contract; do not manufacture diversity outside the user constraints.

## Live integration

When invoked for a Monad Design request, retain its scope, user constraints and requested variant count. Follow the already loaded `monad-design` skill for claim, Debug variants, build/install, publish, selection and completion. Core owns launch, capture and runtime observation after building. Do not independently launch or capture previews, start another session, or apply a final choice before confirmation. Outside Live, use this skill only within the user's explicit edit or review scope.
