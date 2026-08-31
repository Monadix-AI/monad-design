# Monad Design Core

Monad Design Core is the minimum standalone Design MCP runtime. It owns the
active project session, Simulator state, agent handoff, and a small browser UI
containing only Simulator selection and the live canvas. It is compiled as one
Bun executable and embeds that UI, the `serve-sim` middleware, and its native
addon.

Core owns its runtime and server implementation under `src/`; its minimal Web
UI lives under `ui/`. The Core workspace depends only on shared protocol
packages and runtime libraries. It does not import Desktop code or invoke a
Desktop build. Electron declares the reverse workspace dependency on
`@monaddesign/core` for discovery paths and packages the already-built Core
executable as an installation source.

Any coding agent can connect through Design MCP. When a session reaches
Simulator selection, Core opens the session-bound browser surface. Project
management and pairing UI are deliberately absent. Electron is a richer client
of the same process and retains those product features.

## Commands

- `bun run --cwd apps/core dev` starts the source entrypoint.
- `bun run --cwd apps/core build` creates `dist/monad-design`.
- `bun run --cwd apps/cli build` packages that executable with the npm CLI and
  the `monad-design-live` Skill.
- `bun run --cwd apps/desktop package` embeds that executable under
  `Contents/Resources/core/` as an installation source for the Electron
  application.

Every local client discovers the same machine Core under
`~/Library/Application Support/Monad Design`. The npm CLI and Electron install
or update the bundled executable at `bin/monad-design`, then connect through
the shared `bootstrap.json`; neither owns a private Core instance. A process lock
prevents duplicate Core instances, while projects, pairing state, credentials,
and agent sessions use the same persistent directory.

The installed Core is detached from Electron and remains available after the
desktop window quits. If a live session is active, Electron hands the flow to
Core's browser UI before exiting. The next desktop launch reconnects to that
same session and Core process.
