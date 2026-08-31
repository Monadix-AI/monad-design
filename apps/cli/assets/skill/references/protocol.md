# Monad Design MCP live-session protocol

Monad Design serves Streamable HTTP MCP at `http://127.0.0.1:41765/mcp`. The endpoint validates localhost Host and Origin headers and is separate from the mobile pairing API.

## State machine

```text
configuring_project --configure_live_project--> selecting_simulator
selecting_simulator --user connects-----------> awaiting_request
awaiting_request --user sends-----------------> change_requested
change_requested --claim_change---------------> working
working --publish_variants--------------------> variants_ready
variants_ready --user confirms---------------> selection_confirmed
selection_confirmed --complete_change---------> awaiting_request
any non-closed state --user ends Live---------> closed
```

Every transition increments `revision`. Start, configure, and get return full bootstrap data. Wait and mutation results return the current state with IDs, status, revision, timestamps, current request, and result when relevant.

## Tools

- `start_live_session` — `{ workspacePath, task? }`
- `configure_live_project` — `{ sessionId, targets: [{ bundleIdentifier, live }] }`
- `get_live_session` — `{ sessionId? }`
- `wait_for_change` — `{ sessionId, afterRevision, waitMs? }`
- `capture_simulator_context` — `{ sessionId, includeScreenshot?, includeAccessibility? }`
- `claim_change` — `{ sessionId, requestId }`
- `publish_variants` — `{ sessionId, requestId, summary }`
- `complete_change` — `{ sessionId, requestId, summary }`
- `close_live_session` — `{ sessionId }`

Mutations fail for stale state or request IDs. Call `get_live_session`, reconcile by exact request ID, and continue only when it is still the same user request.
