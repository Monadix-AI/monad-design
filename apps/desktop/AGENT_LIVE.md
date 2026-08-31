# Monad Design agent bridge

## Outcome

An external local coding agent can open the Monad Design project containing its current working directory, hand Simulator and target-app selection to the user, receive one implementation request at a time, rebuild/install the app, ask Monad Design to relaunch it, and wait for the next request.

This is an MCP server, not an embedded agent runtime. Monad Design remains agent-neutral and does not spawn Codex or Claude. A reusable agent skill drives the MCP tools.

## Trust boundary

The desktop serves Streamable HTTP MCP at `http://127.0.0.1:41765/mcp`. The endpoint validates localhost Host and Origin headers before protocol handling, preventing DNS rebinding and browser-origin access. It is separate from the authenticated `/v1` mobile API; the six-digit mobile pairing code has no MCP role.

## Project and UI routing

The MCP tool `start_live_session` accepts an absolute `workspacePath`. The desktop first matches the deepest registered project whose root contains that canonical path. When none exists, it resolves the containing Git root, detects explicit Expo/Xcode iOS Bundle IDs, writes schema-v1 `.monaddesign/project.json`, records the project, and continues the same start call. It does not infer a project from a frontmost Xcode window or Simulator. If no explicit target can be detected, start fails before creating a session.

The first session enters `configuring_project` when any target lacks a `live` framework adapter. The agent inspects the repository and calls `configure_live_project` with framework, source roots, variant bridge/bootstrap, build facts, and navigation bootstrap for every target. Monad Design validates and persists schema version 1 in `.monaddesign/project.json`; only then does it focus the target-app and Simulator picker. Later sessions reuse the adapter.

## Serial state machine

```text
configuring_project
  -> selecting_simulator
  -> awaiting_request
  -> change_requested
  -> working
  -> awaiting_request
  -> ...

Any non-closed state -> closed
```

Every transition increments a revision. The `wait_for_change` MCP tool waits by revision for at most 120 seconds. The agent treats this long wait as an optimization: if its MCP client applies a shorter hard timeout, it reconciles with `get_live_session` and resumes polling. The distributed skill stops its current listening turn only after 10 continuous minutes without a new revision or instruction, and it does not close the live session on that idle stop. One immutable request ID is in flight, so a late completion cannot acknowledge a newer request.

`complete_change` validates the active request and Simulator connection, relaunches the exact connected UDID and Bundle ID, records the agent's summary, and only then returns to `awaiting_request`. The agent must build and install the updated Debug app before calling it. Build/container/scheme or framework-specific build facts come from the persisted adapter.

Start, configure, and explicit get calls return project bootstrap data. Wait, claim, complete, and close return lightweight state. A change request contains only the current request and turn-local Simulator/Accessibility context; stable variant, navigation, safety, and verification instructions live in the reusable `monad-design` skill.

## First-version limits

- Sessions are process-local and are not restored after Monad Design restarts.
- One active request is supported per session; there is no queued request backlog.
- The bridge transports turn-local request/context only. Screenshot capture remains on-demand through MCP.
- Relaunch proves the installed target was restarted. Visual correctness still requires the user or agent to inspect the resulting runtime.
