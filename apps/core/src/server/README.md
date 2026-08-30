# Core server

This directory implements the network boundary used by the standalone Monad
Design Core executable. Electron, companion clients, local development
runtimes, and approved agents all connect to that Core process.

## Boundaries

- `core-server.ts` owns the Core listener lifecycle.
- `core-app.ts` is the composition root for global lifecycle and errors.
- `admin-project-routes.ts` exposes local project-management capabilities to authorized clients.
- `project-routes.ts` and `simulator-routes.ts` are feature-based Elysia plugins.
- `mcp-server.ts` exposes the loopback-only external-agent tools and resources at `/mcp`.
- `auth.ts` is the request-dependent pairing guard shared by protected plugins.
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

The pairing code authenticates companion requests. An authorized local client gets a
separate persistent admin token through the narrow Core bootstrap channel.
Health remains public; project, Simulator, streaming, and input routes use the
same authentication guard. Folder selection and unrestricted local-path
operations require the local admin token and must not become pairing-code LAN
routes. Electron retains only the native directory picker.
