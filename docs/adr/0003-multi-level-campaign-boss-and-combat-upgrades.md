# ADR 0003: Multi-Level Campaign, Aircraft Loadouts, Afterburner Boost, Supply Crates, and Sky Carrier Boss

- **Status**: Accepted
- **Date**: 2026-11-19
- **Version**: 0.2.0

## Context
Following the initial release of Sunset Striker (v0.1.x), players requested richer gameplay depth, multiple levels, and additional combat features while preserving the crisp low-resolution pixel-art aesthetic, 60fps simulation decoupling, and instant browser playability.

## Decisions

### 1. Three-Operation Campaign with Dynamic Shader/Lighting Themes
- Added `src/game/levels.ts` defining three distinct operations:
  - **OP-01 Golden Bay** (`seed: 20261119`): Golden-hour sunset coastal defense (2 waves).
  - **OP-02 Crimson Dusk** (`seed: 20264477`): Stormfront dusk counterstrike with crimson horizon and heightened SAM/bandit tempo (2 waves).
  - **OP-03 Midnight Citadel** (`seed: 20269911`): Moonlit night operations with amplified skyscraper window emissives culminating in the **Sky Carrier Boss "Aegis-09"** (2 waves).
- Parameterized `createSunsetSkyMaterial`, `createBayWaterMaterial`, and `createDitherCloudMaterial` with theme uniforms and added `applyLevelThemeToShaders()` so level switches re-theme the sky, bay water, clouds, fog, directional/hemisphere lighting, and emissive city windows without recreating WebGL contexts.
- Wrapped replaceable level world meshes inside a dedicated `worldGroup: THREE.Group` in `FlightViewport` keyed off `sim.worldRevision`, ensuring clean GPU geometry/material disposal on operation switches.
- Persisted campaign unlocks in `localStorage` (`sunset_striker_unlocked_level_v1`) and enforced locked UI states (`disabled`) for unreached operations on the Title Screen selector, with a primary **Next Mission** CTA on the Victory modal.

### 2. Three Playable Aircraft Loadouts
- Added `AIRCRAFT_LOADOUTS` (`warthog` A-10 Warthog, `falcon` F-16 Falcon, `rook` Su-25 Rook) affecting hull capacity, rocket/flare racks, cannon/rocket tuning, cruise speed, turn agility, afterburner recharge rate, and dynamic 3D livery material colors (`primaryMat`, `accentMat`).

### 3. Afterburner Boost with Thermal Overheat Management
- Bound `KeyB` / `Tab` to `InputState.afterburner`.
- Engaging Afterburner surges airspeed (`+38` units/s), drains thermal fuel, triggers a cyan exhaust flame + dynamic Chase FOV widening + procedural jet surge SFX, and displays a thermal gauge (`[B] BST`) in Chase/Top-Down HUD and `A/B` bar on the Cockpit green HUD glass.
- Draining fuel to 0 triggers a temporary overheat lockout until cooled above 35%, adding risk-reward evasion against SAM salvos.

### 4. Mid-Air Supply Crate Pickups
- Destroyed Radar Towers, Bay Gunboats, and alternating Bandit Interceptors drop bobbing, rotating mid-air supply crates (`repair` +25 hull or `ordnance` +4 rockets, +2 flares, full boost reset) visible in 3D space and on the Cockpit amber radar scope as emerald blips.

### 5. Sky Carrier Boss "Aegis-09" & Projected Target Lock Diamond
- Built a composite 10-part airborne fortress (`createEnemyMesh('carrier')`) with glowing cyan hover-lift turbine rings, dorsal crimson reactor core, and 2-phase enraged attack patterns (salvos of SAMs + flak bursts).
- Added a top-center Boss Integrity Bar (`SKY CARRIER AEGIS-09`) and Boss HP Remaining readout on defeat.
- Added a 3D-to-screen projected Target Lock Diamond in Chase mode showing target archetype and distance in meters.

## Consequences
- All new mechanics remain strictly decoupled inside `src/game/` and verified with `node:test` (`src/game/levels.test.ts`).
- `FlightViewport` cleanly disposes old `worldGroup` meshes when switching levels, keeping memory flat across multi-mission sessions.
- Query parameters (`?autostart=1&level=1|2|3&wave=1|2&loadout=warthog|falcon|rook&camera=chase|cockpit|topdown`) enable deterministic testing of every operation, boss wave, and camera mode.
