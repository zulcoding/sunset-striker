# Changelog

All notable changes to **Sunset Striker** are documented in this file.

## [0.3.1] - 2026-11-19

### Added
- **Pitch Y Toggle (`I` / Title Screen / Pause Modal)**: Added a persisted **Standard (`W=Up`) / Inverted (`S=Up`)** pitch toggle accessible from the Title Screen, Pause menu, or `I` hotkey.
- **Smart Arcade Cannon Aim-Assist (`src/game/simulation.ts`)**: Cannon fire now converges smoothly toward enemy lead positions inside the forward reticle cone for crisp, satisfying keyboard gunnery.
- **Predictive Terrain Climb Cushion (`src/game/flightPhysics.ts`)**: Approaching rising coastal hills without actively diving gently pitches the aircraft nose up to prevent sudden hillside crashes.
- **ADR & Test Coverage**: Added ADR `docs/adr/0005-arcade-controls-aim-assist-and-difficulty-rebalance.md` and unit tests for aim-assist, softer obstacle/SAM damage with i-frames, and terrain climb cushioning.

### Changed
- **Standard Arcade Pitch Default (`src/App.tsx`)**: Flipped default keyboard pitch from inverted sim-style to intuitive arcade controls (`W` / `ArrowUp` = Climb, `S` / `ArrowDown` = Dive).
- **Fairer Combat & Speed Rebalance (`src/game/combatRules.ts`, `src/game/flightPhysics.ts`)**: Calmed base cruise/min airspeed for easier aiming, widened rocket lock-on cone and homing agility, softened enemy SAM/flak/bandit and rooftop scrape damage, extended post-hit invulnerability (`0.55s -> 0.95s`), slowed enemy SAM turn rate so banking reliably dodges missiles, and tightened explosion puffs so close blasts don't block the reticle.
- **Terrain-Safe Chase Camera (`src/engine/FlightViewport.ts`)**: Clamped Chase camera altitude above local terrain height to eliminate mountain-mesh clipping when skimming peaks.

## [0.3.0] - 2026-11-19

### Added
- **5 Open Campaign Sectors (`src/game/levels.ts`)**: Unlocked all operations immediately on the Title Screen with instant live 3D atmosphere previews and added two new sectors: **OP-02 Emerald Dawn** (First-Light Patrol) and **OP-04 Cobalt Monsoon** (Fleet Intercept with Vanguard Carrier), alongside **OP-01 Golden Bay**, **OP-03 Crimson Dusk**, and **OP-05 Midnight Citadel**.
- **4-Aircraft Hangar with Speed / Health / Power Trade-offs**: Added **F-22 Raptor** alongside **A-10 Warthog**, **F-16 Falcon**, and **Su-25 Rook**. Every jet features visual **SPD / HLT / PWR** rating bars, explicit **`+` Pro / `−` Con** callouts, and real hull, speed, turn, boost, cannon DPS, and rocket damage differences.
- **Transparent Chase Radar (`src/components/FlightHud.tsx`)**: Added a semi-transparent circular tactical radar scope in Chase view with rotating sweep beam, forward arc, and live color-coded blips for enemies, locked targets, incoming SAMs, Sky Carrier bosses, and mid-air supply crates.
- **ADR & Test Coverage**: Added ADR `docs/adr/0004-five-sectors-aircraft-tradeoffs-smooth-flight-and-chase-radar.md` and expanded `src/game/levels.test.ts`.

### Changed
- **Smoother Flight & Camera Motion**: Upgraded `flightPhysics.ts` with exponentially smoothed `rollRate` and `pitchRate` angular velocity ramping; upgraded `FlightViewport.ts` to 270p crisp 16:9 pixel rendering (`480×270`), smooth sinusoidal trauma shake, gentle Chase horizon banking, and ~15Hz HUD/radar updates.

## [0.2.0] - 2026-11-19

### Added
- **3-Operation Campaign (`src/game/levels.ts`)**: Added **OP-01 Golden Bay** (Sunset Coastal Defense), **OP-02 Crimson Dusk** (Stormfront Counterstrike), and **OP-03 Midnight Citadel** (Night Ops · Sky Carrier Boss), each with distinct seeded skylines, sky/water/cloud shader palettes, lighting, and emissive city intensities.
- **Campaign Progression & Unlock Persistence**: Unreached operations stay locked on the Title Screen selector until cleared, unlocking progressively in `localStorage` with a direct **Next Mission** CTA on the Victory modal.
- **3 Playable Aircraft Loadouts**: Choose between **A-10 Warthog** (Balanced · 30mm Rotary), **F-16 Falcon** (Fast · Agile Afterburner), and **Su-25 Rook** (Armored · Heavy Rockets) with unique stats and dynamic 3D liveries.
- **Afterburner Boost (`B` / `Tab`)**: Thermal fuel gauge (`[B] BST` and Cockpit `A/B` bar) with airspeed surge, cyan exhaust flames, dynamic FOV widening, procedural jet surge audio, and overheat lockout protection.
- **Mid-Air Supply Crate Pickups**: Destroyed Radars, Gunboats, and Bandits drop bobbing emerald **Repair (+25 Hull)** and amber **Ordnance (+4 Rockets, +2 Flares, Full Boost)** crates visible in 3D space and on Cockpit amber radar.
- **Sky Carrier Boss "Aegis-09"**: Composite 10-part airborne dreadnought with glowing hover-lift turbines, dorsal reactor core, 2-phase dual-SAM/flak salvos, and dedicated top-center Boss Integrity Bar.
- **Projected Target Lock Diamond**: Real-time 3D-to-screen target bracket in Chase view displaying target archetype and distance in meters.
- **Automated Tests & ADR**: Added `src/game/levels.test.ts` and ADR `docs/adr/0003-multi-level-campaign-boss-and-combat-upgrades.md`.

## [0.1.1] - 2026-11-19

### Changed
- **Downtown Street Clarity**: Switched city block road tiles to 1×1 per-block UV mapping with crisp dark charcoal avenues and seamless white lane dashes, removing top-down moiré static.
- **Stylized Sunset Clouds**: Upgraded clouds from rectangular slabs to 3-puff flattened ellipsoidal cumulus clusters with brighter cream-peach Bayer-dithered tops.
- **Terrain & Foliage Grounding**: Added multi-frequency ridge faceting to coastal peaks, grounded hillside tree trunks into sloped terrain, and refined distant bay horizon fog warmth.
- **Cockpit HUD Legibility**: Added subtle contrast backing behind the green glass `SPD` and `ALT` boxes for razor-sharp readability over golden-hour skies.

## [0.1.0] - 2026-11-19

### Added
- **Deterministic Coastal Sunset World (`src/game/worldGen.ts`)**: Seeded downtown skyscraper grid with glowing pixel windows, rooftop `(H)` helipads, city parks, twin-peaked mountain range, conical Sugarloaf coastal peak, autumn-orange foliage, drifting sunset clouds, and sparkling turquoise bay.
- **Arcade-Sim Flight Physics (`src/game/flightPhysics.ts`)**: Responsive bank-to-turn yaw coordination, throttle speed envelope, aerodynamic pitch/roll self-leveling, and soft coastal perimeter guidance.
- **Combat & Wave Engine (`src/game/combatRules.ts`, `src/game/simulation.ts`)**: 4 distinct enemy archetypes (Rooftop SAM Batteries, Coastal Patrol Gunboats, Airborne Bandit Interceptors, Armored Radar Spires), shared attack token pool, telegraphed missile lock-ons, 30mm rotary cannon, homing rockets, flare countermeasures, combo scoring, hitstop, and 3 escalating coastal strike waves.
- **Pixel-Art 3D Renderer & Shaders (`src/engine/`)**: Native low-res pixelated Three.js pipeline with Bayer-dithered sunset sky dome, animated sparkling bay water shader, composite 11-part A-10 Warthog aircraft mesh, pooled contrail/fireball/tracer instanced meshes, and procedural Web Audio synthesizer.
- **3 Seamless Camera Modes**: Third-Person Chase Cam, First-Person Pixel-Art Cockpit (with live amber radar, moving artificial horizon, analog gauges, throttle lever, and green glass HUD combiner), and Top-Down Arcade View.
- **Game Shell & Unit Test Suite**: Live flyover Title Screen, minimal perimeter HUD, Pause/Victory/Defeat modals, ADR documentation (`docs/adr/0001-pixel-art-3d-flight-architecture.md`), and automated `node:test` unit tests (`npm test`).
