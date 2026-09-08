# Adjustment skills

The Inspector selects versioned skill identities. It does not bundle skill bodies into change requests. The short `DesignReference.instructions` field is UI description only; `skillName` identifies the companion skill. Core resolves a fixed goal allowlist and adds `requiredSkills` to MCP responses, with a name, version and path relative to the installed `monad-design` directory. Imported references cannot supply arbitrary invocation paths.

The Live entrypoint asks the agent to invoke the selected skills before planning/editing. Agents with no invocation tool read the specified `SKILL.md` files. A missing or mismatched version is reported rather than replaced by the UI description. Skill invocation is an agent action: the Core response requests it but cannot prove that an external agent obeyed. The publish summary records usage without treating it as verification evidence.

## Source and installation

- Canonical distribution content: `apps/cli/assets/adjustment-skills/monad-design-*/SKILL.md`.
- Repository-discoverable copies: `.agents/skills/monad-design-*/SKILL.md`.
- The main skill's `companion-skills.json` lists the six installed siblings. CLI build copies their assets; normal installation and Kimi Work export use the same bundle installer.
- Keep canonical and repository copies identical. Bundle tests check names, versions, relative-path resolution, replacement and preservation of unrelated skills.
- The live request still uses the existing `designGuidance` scope/focus/preserve fields and four-reference limit. Multi-goal requests produce one integrated variant set.

## Variant direction contract

Before source edits, the agent presents one plan row per variant: stable ID, named strategy, user need, decisive changes, tradeoff and observable differences from peers. The plan does not add a confirmation gate. A pairwise check rejects overlapping strategies; source choices are checked against the plan before publication. The publish summary preserves the direction names and explains the actual differences.

Small parameter changes are refinements within a direction, not substitutes for independent alternatives. When constraints cannot support the requested count, the agent asks to reduce the count or broaden an allowed dimension instead of fabricating diversity. A request to regenerate a similar set retires the previous directions for that request. Explicit user requests to fine-tune one selected direction remain supported.

This is an agent instruction contract, not a server-side visual similarity detector. Core continues to own post-build launch and capture.

## Research and adaptation

Reviewed 2026-09-08. The following are references for the new Monad Design material, not runtime dependencies or instructions to install external plugins:

- [Impeccable](https://github.com/pbakaus/impeccable), Paul Bakaus, Apache-2.0: the locally installed 4.0.4 `typeset`, `layout`, `colorize`, `clarify` and `animate` references, and `scripts/live/instructions.mjs`. Its action event explicitly directs the agent to read the corresponding command reference. Monad Design adopts that explicit dispatch pattern, with six independently discoverable skill entrypoints.
- [SwiftUI Agent Skill](https://github.com/twostraws/SwiftUI-Agent-Skill/blob/main/swiftui-pro/SKILL.md), Paul Hudson, MIT, and its [accessibility reference](https://github.com/twostraws/SwiftUI-Agent-Skill/blob/main/swiftui-pro/references/accessibility.md): useful emphasis on semantic text, assistive interaction and targeted reference loading. Monad Design retains the app's actual deployment target and supports UIKit, React Native/Expo and Flutter too.
- [UX Writing Skill](https://github.com/content-designer/ux-writing-skill/blob/main/SKILL.md), Christopher Greer, MIT: useful attention to interface state, real recovery actions and wording in context. Monad Design's Copy and Callout guidance is independently written around existing handlers, localization resources and native variant comparisons; no universal readability score or fixed character count is imposed.

The new skills contain original native-specific workflows, intervention tables, tradeoffs and validation guidance. They do not copy upstream command bodies, browser wrappers, CSS parameter protocols, mandatory aesthetic tournaments or generic polish handoffs. Core retains ownership of Simulator launch/capture after build; skill instructions explicitly distinguish source/build checks from observed runtime behavior.
