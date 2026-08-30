# Product

<!-- impeccable:product-schema 1 -->

## Platform

macOS desktop and iPadOS companion

## Users

Monad Design is for iOS developers and product designers working from a local app project against an available iOS Simulator. They inspect a real app, identify a rendered interface element, and prepare implementation work from runtime evidence.

## Product Purpose

Monad Design registers local project directories, initializes their explicit local configuration, starts or connects to an available iOS Simulator, mirrors and controls it, exposes its accessibility hierarchy, and turns a selected runtime element into a source-change handoff. Success means design decisions are evaluated against the real native app rather than a detached mockup.

## Positioning

The product joins a desktop design workspace to live native Simulator evidence: pixels, interaction, accessibility geometry, device/runtime identity, and implementation context stay connected.

## Operating Context

The desktop Client runs locally alongside Xcode and its installed iOS Simulator runtimes. The home surface manages explicitly selected Git repository roots. After the user chooses one, Monad Design performs a bounded read-only scan of existing project configuration, Expo app metadata, and Xcode build settings. Every detected launchable app is written to `.monaddesign/project.json`; a bundle identifier is requested manually only when detection finds none or cannot complete. This lets one monorepo project expose multiple apps. Before connection, the user selects both the app and Simulator. Available shut down devices may be booted directly before connection. Monad Design verifies and launches the selected configured app before opening the workspace. An iPad on the same local network can pair to one specified Client and operate the same runtime through that Mac. A target Debug app may opt into Monad Design launch arguments for controlled preview behavior. Coding-agent handoffs stay local unless the user is in an explicit external-agent session and chooses Send to agent.

## Capabilities and Constraints

- Project registration, configuration, all-available Simulator discovery, device startup, MJPEG screen streaming, remote input, screenshots, pasteboard access, and accessibility-tree inspection are local operations.
- Each project configuration is the single source of truth for its iOS target apps. Simulator connection and variant preview only accept a bundle identifier from that configured set.
- iPad access uses a six-digit pairing code persisted for the Client's current LAN IP. The mobile app reconnects automatically while that IP is unchanged; changing IP rotates the code and requires pairing again. The paired connection is LAN-only and the Mac remains the authority for every Simulator operation.
- Every agent request chooses 1–5 alternatives (default 1). Multi-variant comparison uses the target app's Debug-only `-MonadDesignVariant` launch argument with `original` and the requested prefix of `v1` through `v5`.
- A captured or selected preview is evidence only. It is not a source-code change and must never be presented as applied.
- Accessibility paths are runtime evidence and may not map directly to a source symbol.
- Source generation and accepted-variant carbonization are separate protocol stages. After the agent publishes built variants, Monad Design captures and arranges them automatically. Explicit user confirmation is returned to the agent, which remains responsible for permanently applying the choice, removing all temporary code, rebuilding, installing, and validating before final completion.

## Brand Commitments

The product name is Monad Design. Product language is concise, technical, and explicit about local preparation versus external or source-changing action.

## Evidence on Hand

The repository contains a working Electron Client and an Expo iPad companion with live Simulator streaming, input forwarding, screenshot annotation, accessibility-tree selection, coding-agent handoff preparation, variant comparison, and a loopback MCP external-agent session bridge. It does not contain a target iOS application or current runtime evidence that an external agent completed a live edit loop.

## Product Principles

- Real native runtime evidence outranks detached mockups.
- Preview, selection, authorization, and source application are distinct states.
- Preserve the target app's surrounding behavior and platform conventions.
- Make recovery and failure states visible instead of implying completion.

## Accessibility & Inclusion

Accessibility metadata is a first-class inspection surface. Desktop controls must remain keyboard reachable, clearly labeled, and operable without relying on color alone.
