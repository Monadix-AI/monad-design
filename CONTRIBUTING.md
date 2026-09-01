# Contributing to Monad Design

Thanks for helping improve Monad Design. The project is early-stage, so opening
an issue before a large change is the best way to confirm scope and avoid
duplicated work.

## Before you start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues and pull requests.
- Keep changes focused. Separate refactors from behavior changes when possible.
- Never commit local project data, screenshots, or files from `.monaddesign/`.

## Development setup

The complete desktop and Simulator workflow requires:

- macOS with Xcode and an installed iOS Simulator runtime
- [mise](https://mise.jdx.dev/) for the pinned developer toolchain
- Bun 1.4.0, pinned by `package.json#packageManager`

```bash
git clone <your-fork-or-checkout-url>
cd monadesign
mise install
bun install --frozen-lockfile
```

Repository checks and most unit tests do not require a running Simulator.

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

## Development commands

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

See the workspace READMEs for surface-specific setup and pairing instructions.

## Quality checks

```bash
bun run check            # formatting, dependency consistency, and TypeScript
bun run check:boundaries # workspace dependency and import architecture
bun test apps packages   # unit and end-to-end tests
bun run build            # build all workspaces
bun run ci               # the complete pull-request gate
```

Additional commands:

```bash
bun run test:unit
bun run test:e2e
bun run check:fix
bun run format
```

## CLI release

The public npm package is `apps/cli`; every other workspace remains private.
Build Core before the CLI so the platform executable and native simulator addon
are copied into the package, then inspect the exact npm file list:

```bash
bun run --cwd apps/core build
bun run --cwd apps/cli build
npm pack ./apps/cli --dry-run
```

The CLI `prepack` check rejects stale versions, mismatched platforms or
architectures, missing release assets, and workspace runtime dependencies.
Publish only from a clean release commit after the full `bun run ci` gate.

The same primary entry points are available through mise, such as
`mise run check` and `mise run build`.

## Making a change

1. Create a branch from the latest `main`.
2. Add or update tests for observable behavior.
3. Preserve the boundaries between Core, Desktop, Mobile, and shared packages.
4. Run the narrowest relevant test while iterating, then run the full checks
   above before opening a pull request.
5. Use a [Conventional Commit](https://www.conventionalcommits.org/) style
   subject for commits, such as `fix(core): reject an invalid project root`.

For changes that affect the live native workflow, describe what was actually
verified: source checks, build, Simulator behavior, physical-device behavior,
and external-agent behavior are separate levels of evidence.

`bun run check:boundaries` enforces the workspace dependency direction,
requires internal imports to be declared with `workspace:*`, rejects dependency
cycles, and prevents relative imports across workspace roots.

## Pull requests

A pull request should explain the problem, the chosen approach, user-visible
effects, and validation performed. Include screenshots or recordings for UI
changes. Keep generated build output out of the diff.

By submitting a contribution, you agree that it is licensed under the
[Apache License 2.0](LICENSE).
