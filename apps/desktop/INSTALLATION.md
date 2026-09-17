# Desktop installation

The DMG is a standalone installation entry point. Node, npm, npx and a separate
Bun installation are not required. Xcode and Simulator runtimes remain separate
prerequisites for operating native apps.

On first launch, the window shows runtime preparation, then agent setup. Core is
copied from the signed application to the current user's Application Support
directory and managed by the same LaunchAgent used by the CLI. Existing active
Live sessions defer runtime replacement. Closing a session and choosing
**Settings → Coding agents & runtime → Check / repair runtime** retries it.
Startup failures remain visible with Retry. If launchd registration fails, Core
may run for the current login and the UI reports that auto-start needs repair.

Agent detection is read-only. The user selects agents and confirms installation
of both their MCP configuration and the bundled self-contained skill. First
launch defaults to user scope. Choose a Git root for project scope, including
TRAE. Configuration files with parse errors are left untouched. Existing skills
with local changes require the explicit replacement checkbox. Each result is
checked from disk, independently; one failure does not hide another success.
Restart agent sessions to load the configuration: files on disk are not proof
that an agent has loaded the skill or connected to MCP.

The same setup screen remains available from Settings. Kimi Work exports a
plugin directory for manual import; export is not installation or activation.
The shared adapters and installers live in packages/agent-integration, and Core
lifecycle helpers live in packages/core-installation. CLI modules re-export the
shared implementations.

## Packaging

Run `bun run --cwd apps/desktop dist` to build Desktop, both Core binaries,
prepare the installer assets and create DMG/ZIP artifacts. Each application
contains its matching Core architecture, native addon, skill directory and
release.json. Core/skill versions come from the CLI release version, independently
of the Desktop application version. For a cross-architecture build set
MONAD_DESIGN_DESKTOP_ARCH and pass the matching electron-builder architecture;
the afterPack hook rejects mismatches.

For a local unsigned artifact, set CSC_IDENTITY_AUTO_DISCOVERY=false. Production
packaging requires CSC_NAME, signs the nested Core payload before calculating its
hashes, and excludes it from subsequent re-signing. The outer application must
then be signed and notarized by the release environment. Hash verification covers
the final payload bytes. A successful local unsigned build does not establish
Gatekeeper/notarization acceptance.

For explicit ad-hoc signing (`CSC_NAME=-`), the Core payload is signed without
hardened runtime: an ad-hoc signature has no Team ID for library validation.
Production Developer ID builds retain hardened runtime and sign Core and its
external native addon with the same identity. The addon must not be embedded in
the compiled Core, which would preserve an unsigned/pre-signing copy.

After packaging, run `bun apps/desktop/scripts/verify-installer.ts
"<app path>/Contents/Resources/installer" [arm64|x64]`. The architecture argument
defaults to the current Mac and is required when cross-verifying the other build.
This checks the final payload hashes, copies Core and its addon to a temporary
installation, and requires a successful bootstrap and `/v1/health` response
without Node/npm/Bun on PATH. It does not change the machine LaunchAgent, user
data, or agent configuration.

Core and native addon hashes are checked before installation. Release testing
must include a fresh macOS user without Node/npm/Bun, startup after logout/login,
and actual agent tool discovery. No real user Agent configuration should be
modified by automated fixture tests.

## Release

Desktop releases use independent `desktop@<version>` tags. The tag version must
match `apps/desktop/package.json`; Core and bundled skill versions continue to
come from `apps/cli/package.json` and do not need to match the Desktop version.

The GitHub release workflow builds separate Apple Silicon and Intel DMG/ZIP
artifacts. Before publishing it verifies the nested installer payload, the full
application signature, the stapled notarization ticket and Gatekeeper acceptance.
It then publishes the four installers plus `SHA256SUMS.txt` to one GitHub Release.

Configure these repository secrets before pushing a Desktop tag:

- `MAC_CSC_LINK`: base64-encoded Developer ID Application `.p12`
- `MAC_CSC_KEY_PASSWORD`: password for that `.p12`
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for notarization

`APPLE_TEAM_ID`, electron-builder's certificate qualifier, and the exact nested
Core signing identity are fixed in the workflow to the repository's
`TS8D697RLN` release team. To release, update the Desktop package and lockfile
versions together, run `bun run --cwd apps/desktop verify:release
desktop@<version>`, commit the release, and push an annotated tag with the same
name. Do not move an existing release tag.
