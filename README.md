# Monad Design

Monad Design is a native visual implementation layer for coding agents. It
connects a real iOS Simulator, runtime evidence, and source-change requests so
developers can evaluate UI work in the running product instead of a detached
mockup.

> **Project status:** early-stage and under active development. APIs, local
> configuration, and workflows may change before the first stable release.
>
> **Desktop and Mobile apps are coming soon.**

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

## Requirements

- macOS with Xcode and an installed iOS Simulator runtime for the complete
  product workflow
- Node.js 22.18.0 or later to run the installer
- A supported local coding agent

## Install the coding-agent integration

```bash
npx monad-design install
```

The 0.0.1 npm release supports macOS on Apple silicon and Intel and contains
only the CLI, the machine-level Core runtime, and coding-agent integration
assets. Desktop and Mobile apps are not published to npm.

The installer puts Core in the machine-level Monad Design application-support
directory, where the Desktop app can reuse it. It detects supported coding
agents and installs both the `monad-design` Skill and the local MCP
registration. The current capability intersection covers 17 MCP clients,
including Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode,
Windsurf, and Zed. Every interactive install inside a Git checkout asks for
Project or Global scope and only updates the chosen scope; Core itself is
always machine-level. Each install gracefully restarts Core from the final
machine-level executable before writing the MCP registration.

## Local data and trust

Monad Design operates on explicitly selected local projects and controls local
iOS Simulators. Pair only trusted devices on trusted networks, review agent-made
source changes, and never commit `.monaddesign/`, credentials, pairing data, or
captured project evidence.

## License

Licensed under the [Apache License 2.0](LICENSE).

## Contributing

Developer setup, repository architecture, commands, and contribution guidance
are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
