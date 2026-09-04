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
both project-level MCP and Skill installation; Global scope shows all complete
targets. The installer only updates the selected scope, so an existing
project-level integration is left alone after a later Global install, and vice
versa.

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
