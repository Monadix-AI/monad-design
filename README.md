# Monad Design

Monad Design is a native visual implementation layer for coding agents. It
connects a real iOS Simulator, runtime evidence, and source-change requests so
developers can evaluate UI work in the running product instead of a detached
mockup.

> **Project status:** early-stage and under active development. APIs, local
> configuration, and workflows may change before the first stable release.

## What works today

- Register an existing Git project and detect explicit Expo or Xcode iOS apps.
- Discover, boot, mirror, and control iOS Simulators from a local Mac.
- Inspect accessibility metadata and capture runtime screenshots.
- Annotate screenshots with ordered implementation notes and send the composed
  evidence to an active local coding-agent session.
- Pair an iPad over the local network for touch control and Apple Pencil
  freehand annotation.
- Build and compare Debug-only UI variants while keeping preview selection
  distinct from permanent source changes.
- Connect external coding agents through a local MCP server.

The repository does not include a target iOS app, hosted agent service, or proof
that every external-agent and physical-device workflow works in every setup.

## Architecture

| Workspace | Responsibility |
| --- | --- |
| `apps/core` | Standalone local runtime for projects, Simulator control, pairing, MCP, and the minimal web client |
| `apps/desktop` | Electron client and full desktop workspace; discovers and packages Core |
| `apps/mobile` | Expo iPad companion that connects to Core over the local network |
| `packages/*` | Shared contracts, state, UI, pairing, device geometry, history, and tooling |

Core is the runtime boundary. Clients may discover and connect to Core, but Core
must not import or build Desktop or Mobile source.

More detail is available in the [Core README](apps/core/README.md), [iPad
README](apps/mobile/README.md), and [live agent bridge](apps/desktop/AGENT_LIVE.md).

## Requirements

- macOS with Xcode and an installed iOS Simulator runtime for the complete
  product workflow
- [mise](https://mise.jdx.dev/) for the pinned developer toolchain
- Bun 1.4.0, pinned by `package.json#packageManager`

## Install for coding agents

```bash
npx monad-design install
```

The installer puts Core in the machine-level Monad Design application-support
directory, where the Desktop app can reuse it. It detects supported coding
agents and installs both the `monad-design-live` Skill and the local MCP
registration. The current capability intersection covers 17 MCP clients,
including Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode,
Windsurf, and Zed. Inside a Git checkout it offers Project or Global scope;
Core itself is always machine-level.

## Getting started

```bash
git clone <your-fork-or-checkout-url>
cd monadesign
mise install
bun install --frozen-lockfile
```

Start all workspace development tasks:

```bash
bun run dev
```

Or start a specific surface:

```bash
bun run --cwd apps/core dev
bun run --cwd apps/desktop dev
bun run --cwd apps/mobile dev
```

See the workspace READMEs for product-specific setup and pairing instructions.

## Quality checks

```bash
bun run check          # formatting, dependency consistency, and TypeScript
bun run check:boundaries # workspace dependency and import architecture
bun test apps packages # unit and end-to-end tests
bun run build          # build all workspaces
bun run ci             # the complete pull-request gate
```

Additional commands:

```bash
bun run test:unit
bun run test:e2e
bun run check:fix
bun run format
```

The same primary entry points are available through mise, such as
`mise run check` and `mise run build`.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Bug
reports and focused proposals are welcome. Please use the private process in
[SECURITY.md](SECURITY.md) for vulnerabilities and follow the
[Code of Conduct](CODE_OF_CONDUCT.md) in project spaces. Repository policy and
release prerequisites are documented in [MAINTAINERS.md](MAINTAINERS.md).

## Local data and trust

Monad Design operates on explicitly selected local projects and controls local
iOS Simulators. Pair only trusted devices on trusted networks, review agent-made
source changes, and never commit `.monaddesign/`, credentials, pairing data, or
captured project evidence.

## License

Licensed under the [Apache License 2.0](LICENSE).
