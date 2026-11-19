# ADR 0004: Five Open Operation Sectors, 4-Aircraft Speed/Health/Power Trade-offs, Smooth Flight/Camera Damping, and Transparent Chase Radar

- **Status**: Accepted
- **Date**: 2026-11-19
- **Version**: 0.3.0

## Context
Player feedback requested four concrete improvements over v0.2.0:
1. Smoother flight feel, camera motion, and visual clarity.
2. Unlocking all operation sectors immediately and adding more sectors to fly.
3. Expanded aircraft selection where every aircraft has explicit plus/minus trade-offs across **Speed**, **Health**, and **Power**.
4. A transparent tactical radar while flying in third-person **Chase** mode.

## Decisions

### 1. Smoother Flight Physics, Camera Banking, and Pixel Resolution
- Added `rollRate` and `pitchRate` angular velocity state to `AircraftState` (`src/game/types.ts`, `src/game/flightPhysics.ts`) using frame-rate-independent exponential rate blending (`1 - Math.exp(-10.5 * dt)`). Key taps and releases now ease smoothly instead of stepping instantaneously.
- Upgraded `FlightViewport` (`src/engine/FlightViewport.ts`):
  - Raised internal vertical pixel resolution from `240px` to `270px` (`480×270` at 16:9), keeping authentic retro pixel-art crispness while smoothing diagonal edges and horizon glide.
  - Replaced random per-frame camera shake jitter with smooth multi-frequency sinusoidal trauma oscillation.
  - Added gentle Chase camera horizon banking (`~16%` of aircraft roll smoothly interpolated) and increased HUD/radar refresh cadence to ~15Hz (`0.065s`) so radar blips and target brackets glide smoothly.
  - Reduced software-WebGL frame pacing delay from `80ms` to `45ms` while retaining `gl.fenceSync` safety.

### 2. Five Open Campaign Sectors
- Removed progression locking on the Title Screen so all **5 Operation Sectors** are selectable immediately with instant live 3D background atmosphere preview:
  1. **OP-01 Golden Bay** — Sunset Defense
  2. **OP-02 Emerald Dawn** — First-Light Patrol (new sunrise pastel/emerald theme)
  3. **OP-03 Crimson Dusk** — Stormfront Strike
  4. **OP-04 Cobalt Monsoon** — Fleet Intercept (new stormy teal-indigo theme + Vanguard Carrier)
  5. **OP-05 Midnight Citadel** — Night · Boss Finale (Aegis-09 Dreadnought)

### 3. Four Playable Aircraft with Explicit Speed / Health / Power Trade-offs
- Expanded `AIRCRAFT_LOADOUTS` to 4 distinct jets (**A-10 Warthog**, **F-16 Falcon**, **Su-25 Rook**, **F-22 Raptor**), each defining `speedRating`, `healthRating`, `powerRating`, `pros`, `cons`, and real gameplay combat parameters (`maxHull`, `cannonDamage`, `cannonCooldown`, `rocketDamage`, `rocketCooldown`, `speedBonus`, `turnBonus`, `boostRegenRate`).
- `FlightSimulation.fireCannon()` and `fireRocket()` read weapon damage and cadence directly from `getLoadoutSpec()`, guaranteeing UI trade-offs faithfully match in-flight combat performance.
- Added a compact **Aircraft Specs Panel** on the Title Screen showing SPD/HLT/PWR meters alongside emerald `+` advantage and coral `−` drawback lines.

### 4. Transparent Tactical Chase Radar
- Added a semi-transparent (`bg-[#0d1724]/38`, zero `backdrop-filter`) circular SVG tactical radar in `FlightHud` exclusively during Chase view, displaying concentric range rings, a rotating sweep beam, forward cone, center aircraft chevron, and color-coded blips for enemies, locked targets, incoming SAMs, Sky Carrier bosses, and mid-air supply crates.

## Consequences
- Zero `backdrop-filter` overhead over WebGL preserves smooth frame delivery across all GPUs.
- All 5 sectors, 4 aircraft trade-offs, smooth angular damping, and radar blip projection are covered by deterministic `node:test` unit tests (`npm test`).
