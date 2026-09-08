# Monad Design CLI

The `monad-design` npm package installs the machine-level Monad Design Core and
connects it to supported coding agents with both a Skill and an MCP
registration. Inside a Git project, the installer offers Project or Global
scope; outside one, it installs the agent integration globally.

The supported Skill + MCP capability intersection currently includes
Antigravity, Cline and Cline CLI, Claude Code, Codex, Cursor, DeepSeek Harness,
Gemini CLI, Goose, GitHub Copilot, Grok Build, Kilo Code, Kimi Code CLI,
Kiro CLI, OpenCode, Qoder, Qwen Code, TRAE / TraeWork, CodeBuddy Code,
VS Code with GitHub Copilot, Windsurf, ZCode, and Zed. Clients without Agent Skills
support are not presented as complete targets.

Every interactive install inside a Git project asks for Project or Global
scope before selecting agents. Project scope shows only agents that support
both project-level MCP and Skill installation; Global scope shows targets with
global installation support. The installer only updates the selected scope, so an existing
project-level integration is left alone after a later Global install, and vice
versa.

### Kimi Work desktop app

On an Apple silicon Mac, a release containing this integration prepares a native
Kimi plugin with:

```bash
npx monad-design install --kimi-work
```

Before that release is published, build the CLI from this checkout and run
`node apps/cli/dist/cli.js install --kimi-work` from the repository root.

This installs and starts Core, then exports `kimi.plugin.json` and the complete
Monad Design Skill into a new directory printed by the installer. The manifest
uses the running Core's local MCP URL. No Kimi Code CLI installation is required,
and this mode does not modify CLI or private desktop-app configuration.

In Kimi Work, open **Custom plugin / Plugin Builder** and ask it to import the
printed local plugin directory, preserving its manifest, Skill references, and
MCP URL. Install the result from **Plugins > Personal**. Open your native app
repository in a Work task and ask it to use Monad Design. Confirm that the Skill
and MCP tools are available; start a new task if its tool catalog has not refreshed.

The export is a plugin source directory, not an automatic App installation.
Keep it for future imports. Repeating the command creates a fresh source without
overwriting earlier exports. If the Core endpoint changes, regenerate and
reimport. Kimi Work and Core must run on the same Mac, with Xcode and an iOS
Simulator available. Windows, Intel Kimi Chat, and cloud sessions are not targets
of this integration. Desktop import, localhost access, and the complete Simulator
workflow still require verification in Kimi Work; packaging tests alone do not
establish end-to-end compatibility.

Format and import references: [Kimi plugin manifest](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html),
[Kimi Work Plugin Builder](https://www.kimi.com/en/help/plugins-and-skills/create).

### Adjustment guides

Installation includes one self-contained `monad-design` skill. Its Typography,
Layout, Callout, Color, Copy, and Motion guides live under that skill's
`references/adjustments/` directory. The same structure is included in Kimi Work exports.

Select adjustment goals in the editing panel and send the request. Core tells
the agent which versioned guides to read before planning or editing.
Full instructions are loaded on demand rather than embedded in every request.
If a guide is missing or outdated, update the installation and restart the agent
session so the new skill catalog is available.

### TRAE

TRAE installation currently supports **Project scope only**. Run
`npx monad-design install` inside your Git project, choose **Project**, then
select **TRAE / TraeWork**. The installer writes `.trae/mcp.json` and installs
the Skill at `.trae/skills/monad-design/`, preserving other MCP registrations.

In TRAE, open **Settings > MCP**, enable **project-level MCP**
(**启用项目级 MCP**), and confirm. Open the same project and start a new agent
session to load the Skill. See the [official MCP setup instructions](https://docs.trae.cn/ide_add-mcp-servers).
TRAE is not offered under Global scope; run the installer from a Git project
if it does not appear.

DeepSeek Harness discovers the Monad Design Skill from `.dsh/skills` and loads
the existing Streamable HTTP MCP server through its built-in
`@deepseek-ai/dsh-mcp-client`. The installer adds a managed row to
`$DSH_HOME/cordis.patch.yml` (or `~/.dsh/cordis.patch.yml`), which makes the
tools available across DSH profiles. A running profile may need to be restarted
before an existing conversation receives the new tool catalog.

```bash
npx monad-design install
```

Version 0.0.2 ships the CLI and its machine-level Core runtime for macOS on
Apple silicon and Intel. The npm package does not contain the Desktop or Mobile
apps.

Core always lives in the machine-level Monad Design application-support
directory so the Desktop app can reuse it. The install is safe to repeat:
managed skills and MCP registrations are updated in place while unrelated agent
configuration is preserved. After installing or verifying the machine Core,
the installer gracefully stops any active Core process, registers a per-user
macOS LaunchAgent, and starts the final installed executable through launchd.
Core starts again automatically after the user logs in and is relaunched if it
exits unexpectedly.

If an agent cannot reach the configured MCP endpoint after Core has stopped,
the installed runtime can be recovered without reinstalling it:

```bash
npx monad-design core start
```
