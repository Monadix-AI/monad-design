# Monad Design for iPad

The Expo app connects to the machine's Monad Design Core on the same local network. Core remains responsible for Xcode, `simctl`, accessibility inspection, and `serve-sim`; the iPad provides the full touch workspace.

Navigation uses Expo Router file routes: `/` pairs a Client, `/simulators` selects a booted device, and `/workspace` owns the live session. Route guards return incomplete deep links to the nearest valid step, and leaving the workspace disconnects the remote Simulator session.

## Run

1. Start Core directly with `bun --cwd apps/core dev`, or start the Electron client and let it install/discover Core.
2. Start the Expo development server with `bun --cwd apps/mobile dev`.
3. Open the app on an iPad, then enter the Core address and pairing code shown by Electron.

Core listens on TCP port `41765`. macOS may ask permission to accept local-network connections. The pairing code establishes the intended Core connection through a one-time handshake but does not issue credentials or authorize later requests. After the first successful pairing, the app reconnects automatically while the Core host's LAN IP remains unchanged. A new IP rotates the pairing code and requires pairing again.

## iPad capabilities

- Choose a booted Simulator on the paired Mac.
- View its live MJPEG stream and forward touch input.
- Rotate, switch appearance, go Home, lock, and paste text.
- Inspect the accessibility hierarchy and prepare a coding-agent handoff locally.
- Capture annotated runtime evidence and send the composed image to the active
  local agent session.
- Capture, compare, open, and restore Debug-only `original` and `v1` through `v5` previews.

Variant selection remains preview evidence and is never presented as a source
change. Annotated evidence is sent only when the user explicitly chooses **Send
to agent** in an active session.
