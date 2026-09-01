# Core server

This directory implements the network boundary used by the standalone Monad
Design Core executable. Electron, companion clients, local development
runtimes, and approved agents all connect to that Core process.

## Boundaries

- `core-server.ts` owns the Core listener lifecycle.
- `core-app.ts` is the composition root for global lifecycle and errors.
- `admin-project-routes.ts` exposes project-management capabilities.
- `project-routes.ts` and `simulator-routes.ts` are feature-based Elysia plugins.
- `mcp-server.ts` exposes the loopback-only external-agent tools and resources at `/mcp`.
- `@monaddesign/client-contract` is the shared Zod-first v1 request/response
  contract; `api-contract.ts` re-exports it for server modules.
- `@monaddesign/client-rtk` is the shared typed client used by both the desktop
  renderer over localhost and companion clients over the LAN.

## Extending the server

Add companion capabilities as feature routes with request and response schemas. Keep
business logic in the existing project and Simulator services; route plugins
own HTTP validation and projection. Do not add generic shell, filesystem-path,
executable, environment, or raw-stdin endpoints.

External-agent capabilities belong in the MCP server, not private REST routes.
Keep the MCP tool surface task-specific and backed by the same project, session,
and Simulator services. Validate localhost Host and Origin headers before MCP
protocol handling.

The REST, streaming, and input routes do not authenticate requests. The pairing
code is connection metadata used by the desktop and mobile UI to establish the
intended Core address. The `/v1/pair` handshake checks it once without issuing
credentials or gating later requests. Electron retains the native directory
picker.
