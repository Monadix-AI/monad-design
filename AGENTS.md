# Agent workflow

Ordinary development in this repository, including `apps/mobile` UI changes, uses direct source edits and normal build/test validation. Working on Monad Design itself does not mean using Monad Design to perform the work.

Only start or resume Monad Design Live when the user explicitly asks to use it. The presence of `.monaddesign`, an MCP server, an installed `monad-design` or companion skill, Simulator access, or an existing live session is not a trigger. Do not probe Live to decide whether an ordinary coding request belongs to it.

Only apply the Monad Design variant workflow to a concrete change request received through an authorized Live session and claimed with its exact request ID. Ordinary chat requests must not trigger adjustment skills, Original/v1 preview scaffolding, variant publication, selection waits, or completion receipts. This boundary also applies to older globally installed Monad Design skills. Inspecting or fixing Live/variant product code is ordinary development and does not itself authorize running that workflow.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tools** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them. `codegraph_node` returns one symbol's source + callers, or reads a whole file with line numbers. If the tools are listed but deferred, load them by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` and `codegraph node <symbol-or-file>` print the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
