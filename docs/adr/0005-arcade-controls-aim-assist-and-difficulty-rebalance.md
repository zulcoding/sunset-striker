# ADR 0005: Arcade Flight Controls, Smart Aim-Assist, and Difficulty Rebalance

- **Status**: Accepted
- **Date**: 2026-11-19
- **Version**: 0.3.1

## Context

Live browser playtesting of Sunset Striker (`v0.3.0`) surfaced four distinct friction points that made the game feel unexpectedly punishing during the opening 10–15 seconds of a sortie:

1. **Inverted Default Pitch (`W`/`ArrowUp` = Dive, `S`/`ArrowDown` = Climb)**: While realistic for flight-stick simulations, keyboard arcade players intuitively press `W` or `Up` to climb. Holding `W` immediately drove the jet into downtown rooftops.
2. **Chase Camera Mountain Clipping**: Flying near the northern coastal peaks allowed the trailing Chase camera to pass inside sloped terrain geometry, momentarily obscuring the viewport.
3. **Strict Straight-Line Cannon Aiming**: Hitting small moving interceptors and rooftop SAM batteries with unassisted keyboard banking required pixel-exact nose alignment.
4. **Punishing Early Damage & Visual Clutter**: Terrain scrapes (`14`), building grazes (`20`), and fast early SAM salvos (`18` dmg, `2.35 rad/s` homing turn rate) could drop hull by half within seconds while oversized close-range explosion puffs (`maxScale: 13`) briefly covered the reticle.

## Decision

We rebalanced controls, targeting, survivability, and camera safety while keeping every aircraft's Speed/Health/Power trade-offs and escalating 5-sector challenge intact:

1. **Standard Arcade Pitch Default + Invert Y Option (`src/App.tsx`, `TitleOverlay.tsx`, `StatusModal.tsx`)**:
   - Default keyboard pitch now maps `W`/`ArrowUp` to Climb and `S`/`ArrowDown` to Dive.
   - Added a persisted `Pitch Y` preference (`sunset_striker_invert_pitch_v1`) toggleable via `I`, on the Title Screen, and inside the Pause modal so sim veterans can switch back to inverted pitch at any time.
2. **Smart Forward-Cone Cannon Aim-Assist & Stronger Rockets (`src/game/simulation.ts`, `src/game/combatRules.ts`)**:
   - Cannon bolts converge (`82%`) toward the lead position of the best enemy inside a ~26° forward cone (`minDot = 0.86`, `range = 360`) with a slightly wider hit radius (`4.4`).
   - Widened rocket lock-on cone (`maxRange: 480`, `minDot: 0.56`) and increased friendly rocket agility (`turnRate: 8.5`, `hitRadius: 7.0`).
3. **Fairer Speed, Terrain Cushion, and Damage Envelope (`src/game/flightPhysics.ts`, `src/game/combatRules.ts`, `src/game/simulation.ts`)**:
   - Calmed base airspeed (`MIN_SPEED: 30`, `CRUISE_SPEED: 48`, `MAX_SPEED: 86`) and added a predictive hillside climb cushion (`terrainHeight + 13.5`) when flying low without intentionally diving.
   - Reduced SAM (`18 -> 12`), flak (`10 -> 7`), bandit bolt (`8 -> 5`), terrain scrape (`14 -> 6`), and building graze (`20 -> 10`) damage; extended post-hit invulnerability to `0.95s`; slowed SAM homing (`2.35 -> 1.72 rad/s`) so banking reliably evades incoming missiles; scaled back explosion puff diameter (`13 -> 8.5`) for cleaner sightlines.
4. **Terrain-Safe Chase Camera (`src/engine/FlightViewport.ts`)**:
   - Clamped both the target and smoothed Chase camera altitude above local ground height (`getTerrainHeight + 6.5` / `+5.5`) so the camera never enters mountain meshes.

## Consequences

- **Positive**: Immediate control intuition on keyboard, crisp and rewarding cannon/rocket kills, fair recovery window after mistakes, and zero mountain clipping in Chase view.
- **Trade-off**: Slightly more forgiving early waves in OP-01/OP-02; late-sector bosses and high-wave bandit swarms remain challenging through multi-vector salvos and positioning.
- **Verification**: Covered by unit tests in `src/game/levels.test.ts` and verified via live Playwright browser playtesting.
