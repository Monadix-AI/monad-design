# Design Library

References is currently hidden by default in the canvas, including its launcher and `@` shortcut. The implementation is retained behind the workspace `showReferences` option. The following describes the enabled experience.

The canvas keeps its edit inspector visible with Interact, Select, and Annotate tools. **DESIGN.md** and **References** are separate, independently expandable panels beside it. Type `@` in the request to expand References; **Done** collapses it. Collapsing panels preserves the draft and reference selection. References shows the submitted snapshot while the agent works and during review. Agent status lives in the edit inspector footer. References has compact previews, search and type/favorite/recent filters, an expandable import section, and a persistent selection footer. Expand **How to apply** to edit scope, borrowing, and preservation guidance without leaving the library.

Attach up to four references per change. Select a built-in style, import a Markdown skill, or import a PNG/JPEG reference. Set what to borrow and what to preserve before sending.

The built-in styles use the same illustrative layout to show their different visual directions. Their previews are examples, not generated app results. Imported skills retain their original text and source filename, with a SHA-256 content version. Review platform compatibility and any referenced tools/files before use. Skill imports do not install scripts, dependencies, or linked files.

Favorites, imports, and recently submitted references persist in the current browser's local storage. They are shared across projects within that browser origin; they do not synchronize between Desktop, browser, or mobile clients. Each request embeds a separate snapshot, so deleting or changing a library entry cannot change a request already in flight. Failed requests retain the draft selection. Working and review states show the request's reference snapshots.

Limits: four references per request, 40 imported library entries, 30 KB per Markdown file, and 250 KB per PNG/JPEG file. Storage errors keep the last saved library intact. Use smaller images or remove an imported item if browser storage fills up.

`AgentTurnContext.designGuidance` carries reference snapshots, scope, focus, and preserve constraints. The existing request lifecycle remains unchanged. MCP session and wait responses provide reference images as image content blocks, with labels linking them to the references; the text/structured response omits the base64 body. HTTP clients retain image data for review. Agent guidance is included in MCP responses and the distributed Monad Design skill. User requests and project requirements take priority over reference suggestions.

GitHub import, automatic updates, third-party marketplace discovery, cross-device library sync, and separate style assignments per variant are outside this first version.
