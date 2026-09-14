# Monad Design 0.0.1 — App Store materials

## Release
- Version: 0.0.1, build 2. Uploaded, processed, export-compliance answered, and bound to the version in App Store Connect on September 14, 2026. The version remains Prepare for Submission.
- App ID: 6811795040. Bundle ID: ai.monadix.design.
- Price: Free. Initial availability: 174 countries and regions, excluding China mainland.
- Copyright: 2026 Monadix Labs, Inc.
- Privacy policy: https://design.monadix.ai/privacy
- Privacy label: Data Not Collected, published with owner confirmation.

## Assets
- app-icon-1024.png: opaque, full-square 1024 × 1024 icon. Based on the existing M mark, with regenerated edge-to-edge background.
- screenshots/01-workspace.jpg: actual iPad workspace displaying the Daylight demo app.
- screenshots/02-select.jpg: actual element selection and accessibility bounds.
- screenshots/03-annotate.jpg: actual rectangle, text and arrow annotations.
- Current store screenshots: branded/01-workspace.jpg, branded/02-select.jpg, branded/03-annotate.jpg. All are 2064 × 2752 portrait JPEG, no alpha. Uploaded in that order.
- branded/background-panorama.png: one continuous 6192 × 2752 background, split at exact third boundaries.
- branded/triptych-preview.jpg: side-by-side overview. Original UI screenshots remain unchanged in screenshots/.
- branded/render.cjs and individual SVG layouts preserve the editable composition. Run `npm install --prefix branded && node branded/render.cjs` from this directory to regenerate the three posters. The background was generated; interface content and typography were composed separately to preserve the original UI.
- Daylight/Daylight.swift: original SwiftUI demonstration app created for these materials. Its content is fictional sample content, not user project data. A screen capture from it is bundled in build 2 for the offline sample workspace.
- review/NOTES-build2.txt: App Review notes describing the offline sample and the separate live Mac workflow. The notes are saved in App Store Connect.
- review/sample-workspace-build2.png: iPad Simulator proof of the interactive offline sample.
- verification/privacy-in-safari.png: proof of the in-app privacy button opening the public policy in Safari (raw Simulator orientation).

The screenshots show the standalone workspace, without an active coding-agent session. They do not claim to demonstrate generation or variant comparison. A complete Live demonstration is pending explicit authorization under the repository workflow.

## Release artifacts
The current build 2 archive and IPA are kept outside Git in `~/Downloads/MonadDesign-AppStore-0.0.1/release/`. Build 1 artifacts and the superseded privacy draft are retained in `~/Downloads/MonadDesign-AppStore-0.0.1/superseded/` and must not be submitted.

## Validation
- Mobile TypeScript check passed.
- 46 unit tests passed, 0 failed.
- Changed TypeScript files passed Biome checks.
- Release build 2 archive and upload succeeded. Apple reported non-blocking missing dSYM warnings for prebuilt React, ReactNativeDependencies and Hermes frameworks.
- On iPad Pro 13-inch (M5), Settings opens without an orientation exception and Privacy Policy opens https://design.monadix.ai/privacy in Safari.
- On iPad Pro 13-inch (M5), the offline sample entry, image scaling, touch completion, element selection, annotation drag, and local request preview were verified.

## Outstanding review
- Content Rights Information: owner confirmed the necessary rights to third-party content; the declaration is saved in App Store Connect.
- Apple has not yet received a physical-device video of pairing and live Mac interaction. The physical iPad is paired but still locked, so the Mac cannot inspect or launch its apps. Record the clip after it is unlocked and a suitable camera view of both devices is available.
- No Live demonstration is required for this three-poster set.
- Do not submit for App Review: the owner explicitly requested preparation only on September 14, 2026.
