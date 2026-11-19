# ADR 0001: Pixel-Art 3D Combat Flight Architecture

- **Status**: Accepted
- **Date**: 2026-11-19
- **Context**: Build a retro 3D pixel-art combat flight game over a sunset coastal metropolis with seamless switching between 3rd-person Chase, 1st-person Cockpit (with live analog gauges, radar, and green glass HUD), and Top-Down arcade camera perspectives.

## Decisions

1. **Native Low-Resolution Pixel-Art WebGL Pipeline (~240p vertical resolution)**:
   - Render the Three.js scene directly to an aspect-matched internal framebuffer (~426×240 pixels) with `antialias: false`, `NearestFilter` procedural `CanvasTexture`s, and CSS `image-rendering: pixelated`.
   - **Rationale**: Produces authentic pixel-locked polygon edges, window grids, ocean sparkles, and Bayer-dithered sky/clouds without blurry post-downsampling artifacts, while dramatically reducing fragment fill rate on both GPUs and software WebGL renderers.

2. **Decoupled Pure TypeScript Simulation Engine (`src/game/`)**:
   - Isolate deterministic world generation (`worldGen.ts`), arcade-sim flight kinematics (`flightPhysics.ts`), enemy AI archetypes & attack token budgeting (`combatRules.ts`), and the master tick loop (`simulation.ts`) from Three.js and React.
   - **Rationale**: Enables millisecond deterministic verification via Node's native test runner (`node:test` via `tsx`) and guarantees zero-GC pooled projectile/particle rings inside the 60Hz loop.

3. **Dedicated Pixel-Art Cockpit Canvas Overlay (`cockpitCanvas.ts`)**:
   - Render the first-person cockpit console (amber sweep radar, artificial horizon attitude indicator, analog gauges, moving throttle lever, and translucent green glass HUD combiner) on a synchronized low-resolution 2D canvas (`426×240`) layered directly over the WebGL viewport in Cockpit mode.
   - **Rationale**: Guarantees crisp 1:1 pixel alignment between the 3D horizon outside the canopy and the cockpit instrument artwork, avoiding blurry vector scaling or expensive multi-pass WebGL compositing.

4. **Software-WebGL Pacing & Stable React Lifecycle**:
   - Mount Three.js in an isolated `useRef` container initialized once (`useEffect(..., [])`), throttle React HUD snapshots to ~10Hz, forbid `backdrop-filter` over the active canvas, and pace software WebGL loops with `gl.fenceSync` (`afterDraw`).

## Consequences

- **Positive**: Fast, crisp pixel aesthetic matching classic 32-bit/indie low-res 3D flight shooters; full unit-test coverage of physics, collisions, enemy policies, and wave progression; smooth performance in headless verification and real browsers alike.
- **Trade-offs**: Low internal resolution requires deliberate high-contrast color separation and clean silhouettes (composite multi-part aircraft/enemies and bright yellow glowing skyscraper windows) so targets remain instantly readable at distance.
