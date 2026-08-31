# Maintainer Guide

This guide describes repository policy for maintainers. It does not imply that
a public release pipeline is already configured.

## Repository settings

When the repository is connected to GitHub and made public:

1. Protect `main` and require pull requests.
2. Require the **Check, test, and build**, **Review dependency changes**, and
   **Analyze JavaScript and TypeScript** checks.
3. Require conversation resolution and dismiss stale approvals after new
   commits.
4. Enable secret scanning, push protection, and private vulnerability
   reporting.
5. Restrict direct pushes, force pushes, and branch deletion.

Do not add `CODEOWNERS` until the responsible GitHub team or maintainers are
known. A placeholder owner creates a misleading review boundary.

## Change acceptance

Every pull request must pass:

```bash
bun run ci
```

For native workflow changes, record validation as separate evidence:

- repository checks and automated tests
- workspace build
- running macOS/Electron or Simulator behavior
- physical iPad or Apple Pencil behavior
- live external-agent and target-app completion

A lower layer does not prove a higher one. In particular, a successful build
does not prove runtime appearance, device input, or agent source application.

## Dependency updates

Dependabot opens weekly grouped development-dependency updates and separate
GitHub Actions updates. Review changelogs, lockfile changes, licenses, native
binary changes, and minimum macOS/Xcode requirements before merging. Never
silence a dependency-review or CodeQL failure without documenting why the alert
is not applicable.

## Architecture policy

`bun run check:boundaries` enforces these invariants:

- shared packages do not depend on applications
- Core does not depend on Desktop or Mobile
- Mobile communicates through shared contracts instead of importing another app
- Desktop may depend on Core, but not on Mobile
- internal dependencies use `workspace:*`
- imports do not cross workspace roots through relative paths
- the internal workspace dependency graph is acyclic

Change the checker and this policy together when an intentional architecture
change is approved.

## Release readiness

Automated releases are intentionally not configured yet. Before adding them,
maintainers must decide and document:

- public repository and artifact coordinates
- semantic versioning and changelog policy
- macOS signing, notarization, and update-channel requirements
- iPad distribution and provisioning ownership
- artifact checksums, provenance, SBOM, and retained third-party notices
- rollback and security-fix procedures

Do not publish an unsigned or unnotarized desktop artifact as a production
release, and do not describe a CI build as a published release.
