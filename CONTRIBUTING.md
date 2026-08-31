# Contributing to Monad Design

Thanks for helping improve Monad Design. The project is early-stage, so opening
an issue before a large change is the best way to confirm scope and avoid
duplicated work.

## Before you start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues and pull requests.
- Keep changes focused. Separate refactors from behavior changes when possible.
- Never commit credentials, pairing codes, local project data, screenshots, or
  files from `.monaddesign/`.

## Development setup

The complete desktop and Simulator workflow requires macOS with Xcode and an
iOS Simulator runtime. Repository checks and most unit tests only require the
toolchain pinned by the repository.

```bash
mise install
bun install --frozen-lockfile
bun run ci
```

Useful development commands are documented in the root [README](README.md).

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
