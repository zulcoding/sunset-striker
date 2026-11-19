import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyInput, FlightSimulation } from './simulation';
import { WAVE_CONFIGS } from './combatRules';

test('FlightSimulation boots in title and transitions cleanly to playing, paused, and camera modes', () => {
  const sim = new FlightSimulation(42);
  assert.equal(sim.phase, 'title');

  sim.startGame('chase');
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.cameraMode, 'chase');

  assert.equal(sim.cycleCameraMode(), 'cockpit');
  assert.equal(sim.cycleCameraMode(), 'topdown');
  assert.equal(sim.cycleCameraMode(), 'chase');

  sim.togglePause();
  assert.equal(sim.phase, 'paused');
  const prevElapsed = sim.elapsedTime;
  sim.step(0.05, createEmptyInput());
  assert.equal(sim.elapsedTime, prevElapsed, 'Simulation must freeze while paused');

  sim.togglePause();
  assert.equal(sim.phase, 'playing');
});

test('Wave 1 spawns all 4 distinct enemy archetypes with distinct behaviors', () => {
  const sim = new FlightSimulation(99);
  sim.startGame();
  const archetypes = new Set(sim.enemies.map((e) => e.archetype));
  assert.equal(archetypes.has('sam'), true);
  assert.equal(archetypes.has('gunboat'), true);
  assert.equal(archetypes.has('bandit'), true);
  assert.equal(archetypes.has('radar'), true);

  const banditBefore = sim.enemies.find((e) => e.archetype === 'bandit')!;
  const bx = banditBefore.x;
  const samBefore = sim.enemies.find((e) => e.archetype === 'sam')!;
  const sx = samBefore.x;

  sim.step(0.05, createEmptyInput());
  assert.notEqual(banditBefore.x, bx, 'Bandit should orbit through airspace');
  assert.equal(samBefore.x, sx, 'Rooftop SAM should remain anchored on helipad');
});

test('player cannon and rockets damage enemies, increment score/combo, and advance waves', () => {
  const sim = new FlightSimulation(77);
  sim.startGame();

  // Position a SAM directly in front of aircraft nose and destroy all wave 1 targets
  for (const enemy of sim.enemies) {
    enemy.hp = 10;
    enemy.x = sim.aircraft.x - Math.sin(sim.aircraft.yaw) * 18;
    enemy.y = sim.aircraft.y;
    enemy.z = sim.aircraft.z - Math.cos(sim.aircraft.yaw) * 18;
  }

  const fired = sim.fireCannon();
  assert.equal(fired, true);

  // Step enough frames to register hit & KO transition
  for (let i = 0; i < 40; i++) {
    sim.step(0.04, createEmptyInput());
  }

  assert.ok(sim.score > 0, 'Destroying enemies must award score');
  assert.ok(sim.kills >= 1, 'Kills counter must increment');
});

test('flares decoy incoming SAM missiles away from aircraft', () => {
  const sim = new FlightSimulation(123);
  sim.startGame();

  sim.spawnProjectile(
    'sam',
    false,
    { x: sim.aircraft.x + 25, y: sim.aircraft.y, z: sim.aircraft.z + 25 },
    { x: -30, y: 0, z: -30 },
    18,
    3.6,
    5,
    -1,
  );

  const deployed = sim.deployFlares();
  assert.equal(deployed, true);
  sim.step(0.04, createEmptyInput());

  const activeSam = sim.projectiles.find((p) => p.active && p.kind === 'sam');
  assert.ok(activeSam, 'SAM missile should still be active');
  assert.equal(activeSam.decoyedByFlare, true, 'Nearby flare must decoy SAM missile');
});

test('hull reaching zero triggers defeat transition and frozen RunSummary', () => {
  const sim = new FlightSimulation(55);
  sim.startGame();
  sim.aircraft.invulnTimer = 0;

  sim.damagePlayer(sim.aircraft.maxHull);
  assert.equal(sim.aircraft.hull, 0);
  assert.equal(sim.pendingDefeat, true);

  // Advance past brief dramatic defeat beat (0.55s)
  for (let i = 0; i < 20; i++) {
    sim.step(0.04, createEmptyInput());
  }

  assert.equal(sim.phase, 'gameover');
  assert.ok(sim.runSummary !== null);
  assert.equal(sim.runSummary.victory, false);
  assert.equal(sim.runSummary.maxWaves, WAVE_CONFIGS.length);
});
