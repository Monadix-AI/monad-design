# Monad Design CLI

The `monad-design` npm package installs the machine-level Monad Design Core and
connects it to supported coding agents with both a Skill and an MCP
registration. Inside a Git project, the installer offers Project or Global
scope; outside one, it installs the agent integration globally.

The supported Skill + MCP capability intersection currently includes
Antigravity, Cline and Cline CLI, Claude Code, Codex, Cursor, Gemini CLI, Goose,
GitHub Copilot, Grok Build, Kilo Code, Kimi Code CLI, Kiro CLI, OpenCode,
VS Code with GitHub Copilot, Windsurf, and Zed. Clients without Agent Skills
support are not presented as complete targets.

Project scope is offered only when every selected agent supports project-level
MCP configuration. Antigravity, Cline, Cline CLI, Goose, and Windsurf currently
support the complete integration globally; the other targets support both
Project and Global scope.

```bash
npx monad-design install
```

Core always lives in the machine-level Monad Design application-support
directory so the Desktop app can reuse it. The install is safe to repeat:
managed skills and MCP registrations are updated in place while unrelated agent
configuration is preserved.
