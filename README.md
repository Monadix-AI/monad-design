# Monad Design

A Bun and TypeScript monorepo powered by Turborepo, Biome, and mise.

## Structure

```text
apps/core/     Standalone MCP, project, Simulator, server, and minimal Web UI runtime
apps/desktop/  Electron client and richer desktop interface; depends on Core
apps/mobile/   iPad client; connects to Core over the local network
packages/   Shared libraries, tooling, and their tests
```

Each workspace owns its tests under `test/unit` and, where needed, `test/e2e`.

Core is the business/runtime boundary. Clients may install, discover, and
connect to Core, but Core never imports or builds Desktop or Mobile sources.

## Architecture proposals

- [Third-party coding-agent runtime](apps/desktop/AGENT_RUNTIME.md)

## Setup

Install the pinned Node.js toolchain and the Bun version declared in
`package.json#packageManager`:

```bash
mise install
```

Then install dependencies:

```bash
bun install
```

## Commands

Run all repository checks (Biome, TypeScript, and workspace checks):

```bash
bun run check
```

Other common commands:

```bash
bun run dev          # Run workspace development tasks
bun run build        # Build all workspaces
bun test             # Run unit and e2e tests
bun run test:unit    # Run unit tests only
bun run test:e2e     # Run end-to-end tests only
bun run check:fix    # Apply safe Biome fixes and formatting
bun run format       # Format supported files
```

The same entry points are available through mise, for example `mise run check`
and `mise run dev`.
