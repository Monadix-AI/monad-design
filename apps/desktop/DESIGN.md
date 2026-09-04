---
name: Monad Design Desktop
description: A dark local workspace that keeps native Simulator evidence at the center of design operations.
colors:
  canvas: "#0d0d0d"
  background: "#181818"
  shell: "#181818"
  panel: "#181818"
  elevated-panel: "#212121"
  control: "rgb(255 255 255 / 5%)"
  control-hover: "rgb(255 255 255 / 8%)"
  field: "rgb(255 255 255 / 4%)"
  brand-accent: "#339cff"
  brand-accent-hover: "#66b5ff"
  on-brand-accent: "#0d0d0d"
  foreground: "#dfdfdf"
  muted-foreground: "#afafaf"
  border: "rgb(255 255 255 / 8%)"
  error: "#ff9ca5"
  error-surface: "#251619"
  annotation-ink: "#ff4d67"
  annotation-active: "#ff6f84"
  annotation-surface: "#35191f"
  container-evidence: "#7dd3fc"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "normal"
  mono:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  compact: "6px"
  tool: "7px"
  control: "8px"
  field: "9px"
  surface: "10px"
  floating: "15px"
  capture: "16px"
  device-screen: "26px"
  device: "34px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  cluster: "14px"
  panel: "18px"
  workspace: "22px"
  canvas: "26px"
components:
  button-primary:
    backgroundColor: "{colors.brand-accent}"
    textColor: "{colors.on-brand-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.brand-accent-hover}"
    textColor: "{colors.on-brand-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
    height: "34px"
  button-tool:
    backgroundColor: "{colors.control}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.tool}"
    padding: "7px 10px"
    height: "34px"
  button-annotation-active:
    backgroundColor: "{colors.annotation-surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.tool}"
    padding: "7px 10px"
    height: "34px"
  evidence-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 11px"
  floating-panel:
    backgroundColor: "{colors.elevated-panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.floating}"
    padding: "18px"
    width: "344px"
---

# Design System: Monad Design Desktop

## Overview

**Creative North Star: "The Live Simulator Workbench"**

Monad Design Desktop is a dense, dark Operate workspace that moves from local project context to one visual authority: the real iOS Simulator frame. The home begins as a flat registry of explicitly chosen local projects; entering a project reveals the full available Simulator inventory; once connected, the application becomes an artifact-first free canvas. Across those states, brand expression comes from disciplined state color, compact proportions, and precise spacing rather than ornamental graphics.

Before connection, rows and status labels behave like a native local inventory rather than a dashboard of cards. Project configuration and loading stay on the home screen, while desktop-scoped mobile pairing moves into the persistent header; Simulator boot state appears only after a project is chosen. After connection, controls behave like local instruments around the artifact: device controls sit immediately below the Simulator; zoom floats at the canvas edge; the inspector anchors to the right; comparison and annotation replace the canvas content without pretending to change source. Copy such as “Configured locally,” “Prepared locally · not sent,” and “Preview evidence only” is part of the visual hierarchy because it keeps registration, preparation, preview, export, and source-changing action visibly distinct.

**Key Characteristics:**

- Dark neutral canvas and restrained tonal surfaces
- Flat local project registry with explicit configuration-write boundaries
- Scroll-contained all-available Simulator inventory with visible boot state
- Real Simulator imagery as the dominant artifact
- Compact floating controls with clear active, disabled, loading, and error states
- Codex blue reserved for primary, selected, focus, and brand emphasis states
- Green reserved for live, connected, ready, and success states
- Pink-red reserved for screenshot annotation ink and its active tools
- Cyan reserved for container-level accessibility evidence
- Explicit local-preparation and preview-only boundaries

## Colors

The palette is almost entirely charcoal and cool gray so runtime imagery carries the screen; chromatic accents communicate evidence and state, never decoration.

### Primary

- **Codex Blue:** Drives connect, copy, export, active mode, selection, focus, and primary action states. Its translucent companion surfaces support selection without turning whole panels blue.
- **Success Green:** Reports live, connected, ready, and completed states without acting as the product brand color.

### Secondary

- **Annotation Pink-Red:** Appears only in screenshot markup, active annotation tools, and the inline annotation field. The ink is exported at original image resolution and must not be reused for general warnings or branding.

### Tertiary

- **Container Evidence Cyan:** Distinguishes accessibility containers from ordinary selected elements through cyan borders, fills, and metadata surfaces.

### Neutral

- **Canvas Charcoal:** The dotted free-canvas ground and deepest application field.
- **Shell Charcoal:** Title bars, connected shell, and dark status backplates.
- **Panel Charcoal:** Sidebars, inspectors, and workspace surfaces.
- **Elevated Panel Charcoal:** Floating inspector and compact evidence cards.
- **Control Charcoal:** Resting tool buttons, segmented-control troughs, and utility actions.
- **Field Charcoal:** Text inputs and textareas that hold local requests or identifiers.
- **Cool White:** Primary text and high-confidence labels.
- **Muted Steel:** Metadata, hints, boundary copy, and secondary labels.
- **Structural Border:** Quiet separators and field outlines; divisions remain visible without becoming a grid of bright lines.

### Named Rules

**The Evidence Color Rule.** Codex blue means selected, focused, or primary; green means live, connected, ready, or successful; cyan means container evidence; pink-red means annotation. Do not interchange these roles.

**The Local Boundary Rule.** Preparation and preview surfaces must visibly state whether work stays local, is evidence only, or has not been applied to source.

## Typography

**Display Font:** Inter with native UI sans-serif fallbacks<br>
**Body Font:** Inter with native UI sans-serif fallbacks<br>
**Label/Mono Font:** Inter for controls; SFMono-Regular with Consolas and Liberation Mono fallbacks for coordinates, identifiers, and structured turn context

**Character:** The typography is compact, technical, and low-drama. Tight headline tracking provides authority while small labels and monospaced evidence support fast scanning without competing with the Simulator.

### Hierarchy

- **Headline** (620, 21px, 1.2): Full-canvas workspaces such as variant comparison and screenshot annotation.
- **Title** (650, 17px, 1.2): Floating inspector and evidence-panel headings.
- **Body** (400, 12px, 1.5): Instructions, adjustment requests, and supporting explanations.
- **Label** (650, 10px, 1.2): Tooling, actions, statuses, and section labels; quieter metadata may step down to 9px.
- **Mono** (400, 10px, 1.55): Bundle identifiers, geometry, pairing data, and structured turn context; tabular numerals are used for zoom percentages.

### Named Rules

**The Artifact First Rule.** Type supports operating context and evidence; it never becomes a display spectacle larger than the real Simulator artifact.

## Layout

The pre-connection experience has two deliberate scales. Home centers a flat project registry up to 1080px wide beneath a persistent 52px header whose controls align optically with the macOS traffic lights. The header carries no app icon, product name, separate fill, divider, or shadow, so it reads as part of one continuous window canvas. Pairing lives in a compact header popover, so a paired mobile can browse every registered project without entering one first. Settings shares the header's right-side control group and exposes Auto, Light, and Dark desktop themes without changing Simulator appearance; Auto follows macOS changes live. The local configuration-write boundary remains anchored below the registry. Entering a project switches to a 320px operating sidebar beside the empty preview canvas. Project identity and the All projects return action remain above the Simulator heading; the device inventory owns the remaining vertical space and scrolls independently; errors and the full-width primary action stay below it.

The connected experience is a fixed desktop workspace with an 800px by 560px minimum window. The same 52px header sits inside the continuous free canvas and carries centered live-device status. The entire application uses restrained translucency over the native macOS under-window material; neutral warm-gray layers follow the default Codex light/dark contrast model while semantic evidence colors retain their existing roles. The Simulator is rendered from its logical screen size and its fit calculation is capped at 200%, so a roomy canvas may enlarge the device while compact windows still reduce it to fit. The canvas reserves room for the 344px right inspector and its 18px outer margin. The initial fit biases the device 150px left of canvas center; after that, direct drag or wheel/trackpad panning and modifier-wheel zooming operate the artifact from 25% to 200%.

The Simulator and its controls form one transformable cluster. Rotate, Home, and appearance actions attach 14px below the frame and move and scale with it. The explicit zoom-out, percentage, zoom-in, and fit instruments remain fixed 18px from the lower-left canvas corner. The inspector floats at 18px from the top, right, and bottom edges; it keeps Interact, Select, and Annotate modes alongside the selected-element request workbench, variant comparison, and Disconnect without demoting the live artifact. Errors float above the canvas immediately to the left of this operating lane.

The floating inspector uses stacked sections and a fixed action footer. Variant comparison is a dedicated canvas workspace; annotation is a special state of the existing live canvas. Both keep the inspector present and reserve its 386px right-side operating lane. Variant evidence uses four equal columns; below 900px it becomes two columns and the inspector narrows to 310px. The annotation toolbar remains a compact floating canvas instrument that never covers the Simulator. The application deliberately does not collapse into a mobile layout.

**The Artifact Dominance Rule.** Preserve clear area around the Simulator or captured evidence. The fit calculation must reserve the right operations lane and cap at 200% of the device's logical size; floating tools may overlap the canvas ground, never the evidence itself.

**The Registry Before Runtime Rule.** Keep project selection flat and local, then reveal Simulator inventory only inside the chosen project. The registry, device list, and their loading or empty states scroll within their assigned regions instead of pushing boundary copy or the primary action out of view.

## Elevation & Depth

Depth is structural and sparse. Most hierarchy comes from tonal layering and inset 1px separators. Strong diffuse shadows are reserved for genuinely floating objects: the Simulator frame, its attached controls, the zoom palette, the inspector, canvas workspaces, and transient errors. The dominant device shadow is deep and cinematic; control shadows are smaller and functional. Focus and selected evidence may add a restrained Codex-blue glow, while live status dots use a tight green glow.

### Shadow Vocabulary

- **Device Float** (`0 34px 90px rgb(0 0 0 / 62%), 0 4px 14px rgb(0 0 0 / 46%)`): The live Simulator frame only.
- **Workspace Float** (`0 24px 70px rgb(0 0 0 / 44–48%)`): Inspector, variant comparison, and annotation workspaces.
- **Tool Float** (`0 12px 32–34px rgb(0 0 0 / 38%)`): Device and zoom controls.
- **Selected Evidence Glow** (`0 0 16px rgb(51 156 255 / 22%)`): Selected ordinary accessibility geometry.
- **Container Evidence Glow** (`0 0 16px rgb(125 211 252 / 20%)`): Selected container geometry.

**The Floating Instrument Rule.** Apply a large shadow only when a surface is spatially detached from the canvas or artifact. Ordinary sections remain flat and separated tonally.

## Shapes

The form language uses compact, gently rounded controls and larger rounded floating surfaces. Tool buttons sit at 6–8px radii, fields at 7–9px, cards around 10–14px, and canvas workspaces at 15–16px. The Simulator is the deliberate exception: its 34px outer frame and 26px screen clipping preserve the physical-device silhouette. Pills are limited to counts and small status capsules.

Borders are usually one pixel and cool gray. Dashed borders indicate empty or container evidence; two-pixel outlines indicate focused or selected runtime evidence. Annotation rectangles remain square-cornered because they mark image regions rather than becoming UI surfaces.

**The Compact Geometry Rule.** Small radii belong to tools; large radii belong to devices and floating workspaces. Do not inflate every control into a soft capsule.

## Components

### Buttons

- **Shape:** Compact tooling uses gently rounded 7–8px corners and a 34–36px minimum height.
- **Primary:** Codex blue with high-contrast text; used for connect, copy, export, opening a selected live variant, and the active workspace mode.
- **Hover / Focus:** Primary hover brightens slightly. All keyboard-focusable buttons receive a 2px Codex-blue outline with a 2px offset; the Simulator frame uses a 5px offset.
- **Secondary / Tool:** Charcoal with cool gray text, brightening on hover. Disabled states lose saturation and contrast while retaining readable labels.
- **Annotation Active:** Deep pink-red surface with a pink-red border and near-white text; active only for rectangle, ellipse, text, and arrow tools.

### Chips

- **Style:** Small 7px-radius status capsules use charcoal fill, quiet borders, and 9–11px labels.
- **State:** They report “Preview evidence only,” “Selected, not applied to source,” capture progress, annotation count, or readiness. They are informational boundaries, not decorative badges.

### Cards / Containers

- **Corner Style:** Evidence cards use 9–14px corners; floating workspaces use 15px corners.
- **Background:** Panel and elevated-panel charcoals keep evidence distinct from the canvas.
- **Shadow Strategy:** Cards are flat by default; only canvas-floating workspaces receive workspace elevation.
- **Border:** One-pixel structural borders; selected ordinary evidence shifts blue, selected container evidence shifts cyan.
- **Internal Padding:** Compact cards use 10–12px; floating inspector sections use 15–18px; full workspaces use 22–26px.

### Inputs / Fields

- **Style:** Dark field surface, cool white text, muted placeholder, 7–9px radius, and a one-pixel gray border. Identifiers use monospace; requests use the body face.
- **Focus:** Border shifts toward subdued blue and gains a 2px translucent Codex-blue ring.
- **Error / Disabled:** Errors appear as pink-tinted text on a deep red surface. Disabled request fields remain visible but reduce contrast and prevent editing.

### Navigation

- **Style:** The workspace has modes rather than page navigation. A three-option segmented control switches between Interact, Select, and Annotate; the active option is Codex blue with high-contrast text.
- **State:** Choosing Annotate keeps the same live Simulator mounted, moves and scales it into the annotation layout, and intercepts canvas input before it reaches the real Simulator. Choosing Interact or Select exits annotation. Variant comparison remains mutually exclusive with annotation and disables that mode while active.

### Local Project Registry

The home registry is a flat, native-feeling list, not a gallery. Each row pairs a quiet blue folder tile with project name and truncated monospaced path, then closes with either the configured bundle identifier or the number of configured target apps. The heading owns Connect project; after directory selection, a compact focused dialog first verifies that the selection is a Git repository root, then visibly scans existing configuration, Expo metadata, and Xcode settings. Every detected app is shown as the inventory that will be connected; the manual bundle-identifier field appears only after a zero-result or failed scan. Inside a project, the user explicitly selects one configured app before choosing a Simulator. A visible spinning row announces “Loading local projects…” in place; and the empty state explains that choosing a directory writes `.monaddesign/project.json` while changing no source.

### Simulator Picker

Inside a project, every available iOS Simulator appears in a scroll-contained radio inventory. Each row combines a restrained device silhouette, device and runtime identity, and an uppercase Booted or Shutdown label with a dot so state is not conveyed by color alone. Selection uses a translucent blue tonal surface and subtle border rather than a floating card. The iPad client is a compact collapsed disclosure that shows the six-digit code before expansion and reveals the QR code, LAN origin, and manual-entry guidance only on demand. The bottom primary action reads “Connect” for a booted device and “Start & connect” for a shut down device, changing to explicit “Connecting…” or “Starting Simulator…” progress while work is in flight.

### Simulator Frame

The live Simulator is the signature component. It is a black physical-device shell with a clipped real stream, deep shadow, hidden native cursor, a precise local pointer, and optional accessibility geometry. Ordinary elements use Codex-blue boxes; containers use cyan dashed or solid boxes. The frame derives from logical device size, supports direct pan and 25–200% zoom, and carries its attached Rotate, Home, and appearance controls with it. Paste, selection, annotation, and direct input remain available without visually demoting the runtime artifact to a card.

### Floating Operations Panel

The right panel is a persistent instrument rather than a sidebar in the document flow. Its header pairs runtime identity with Disconnect; its body keeps the Interact/Select/Annotate switch and request preparation visible; its footer exposes variant comparison. The request heading always states “Prepared locally · not sent,” making clipboard preparation visibly different from source application or any external dispatch.

### Live Simulator Annotation State

Annotation places vector markup directly over the existing live Simulator screen without replacing, freezing, or remounting the device view. The overlay captures all pointer input while this state is active, so drawing never operates the real Simulator. Rectangle, ellipse, and arrow marks receive stable ordered numbers, connect by curved pink-red lines to an implementation-note list, and immediately focus their new note field; free text remains image-local. Empty numbered notes block Finish with recovery guidance. Rectangle, ellipse, text, and arrow tools share the compact canvas toolbar; Undo removes the latest committed mark, Clear removes all, and Cancel exits. Finish takes one fresh Simulator screenshot and exports an original-resolution composition containing the marks, connectors, ordered numbers, and note sidecar. Capture and export errors remain explicit states rather than being inferred from a click.

## Do's and Don'ts

### Do:

- **Do** keep the real Simulator frame, capture, runtime geometry, and device identity visually primary.
- **Do** keep the home registry flat, show project path and “Configured locally” on each row, and keep the configuration-write boundary visible.
- **Do** show all available Simulators with explicit Booted or Shutdown labels and use “Connect” versus “Start & connect” according to the selected device state.
- **Do** use Codex blue for primary/selected states, green for live/success states, pink-red for annotation, and cyan for container evidence.
- **Do** keep controls compact, keyboard reachable, clearly labeled, and understandable without color alone.
- **Do** state local preparation, preview-only evidence, download initiation, and errors in visible text.
- **Do** keep annotation, variant comparison, selection, and direct interaction mutually exclusive where the implementation makes them exclusive.
- **Do** preserve original-resolution Simulator pixels, image-relative annotation geometry, and one-to-one numbering between every callout target and exported note.
- **Do** fit from logical Simulator dimensions, reserve the right operations lane, and cap automatic or manual zoom at 200%.
- **Do** keep “Prepared locally · not sent” adjacent to request preparation, not buried in secondary help text.

### Don't:

- **Don't** present a preview, selection, annotation, copied turn context, or captured frame as a source-code change.
- **Don't** present choosing a project directory as source modification; name the `.monaddesign/project.json` write and state that source is unchanged.
- **Don't** hide the project loading row, collapse the Simulator inventory to booted devices only, or let its scroll push the connection action out of view.
- **Don't** reuse annotation pink-red as a general brand accent or container cyan as a generic highlight.
- **Don't** add bright decorative surfaces that compete with the native app imagery.
- **Don't** turn every section into an elevated card; reserve large shadows for detached canvas instruments.
- **Don't** hide loading, disabled, empty, capture, clipboard, export, or stream failure states.
- **Don't** let floating controls cover the Simulator or frozen capture.
- **Don't** detach device controls from the Simulator cluster or move the zoom instruments out of the lower-left canvas corner.
