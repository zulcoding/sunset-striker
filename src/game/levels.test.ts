import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getForwardVector } from './flightPhysics';
import { AIRCRAFT_LOADOUTS, getLevelConfig, getLoadoutSpec, LEVEL_CONFIGS } from './levels';
import { createEmptyInput, FlightSimulation } from './simulation';
import { getTerrainHeight } from './worldGen';

describe('5 open campaign sectors, 4 aircraft trade-offs, smooth flight, and Chase radar', () => {
  it('defines 5 distinct open campaign sectors with unique seeds and themes', () => {
    assert.equal(LEVEL_CONFIGS.length, 5);
    const seeds = new Set(LEVEL_CONFIGS.map((l) => l.seed));
    assert.equal(seeds.size, 5);
    const fogs = new Set(LEVEL_CONFIGS.map((l) => l.theme.fogColor));
    assert.equal(fogs.size, 5);
    assert.equal(getLevelConfig(4).waves[1].carriers, 1);
    assert.equal(getLevelConfig(5).waves[1].carriers, 1);
  });

  it('switches world revision and generates distinct level geometry across all 5 sectors', () => {
    const sim = new FlightSimulation(undefined, 0, 1);
    const rev1 = sim.worldRevision;
    const seed1 = sim.world.seed;

    assert.equal(sim.selectLevel(4), true);
    assert.equal(sim.worldRevision, rev1 + 1);
    assert.notEqual(sim.world.seed, seed1);
    assert.equal(sim.levelConfig.name, 'Cobalt Monsoon');

    // Selecting the same level is a clean no-op
    assert.equal(sim.selectLevel(4), false);
    assert.equal(sim.worldRevision, rev1 + 1);
  });

  it('gives each of the 4 aircraft distinct Speed, Health, Power trade-offs and real combat stats', () => {
    assert.equal(AIRCRAFT_LOADOUTS.length, 4);

    for (const spec of AIRCRAFT_LOADOUTS) {
      assert.ok(spec.speedRating >= 40 && spec.speedRating <= 100);
      assert.ok(spec.healthRating >= 40 && spec.healthRating <= 100);
      assert.ok(spec.powerRating >= 40 && spec.powerRating <= 100);
      assert.ok(spec.pros.length > 5);
      assert.ok(spec.cons.length > 5);
    }

    const simWarthog = new FlightSimulation();
    simWarthog.startGame({ loadout: 'warthog' });

    const simFalcon = new FlightSimulation();
    simFalcon.startGame({ loadout: 'falcon' });

    const simRook = new FlightSimulation();
    simRook.startGame({ loadout: 'rook' });

    const simRaptor = new FlightSimulation();
    simRaptor.startGame({ loadout: 'raptor' });

    // Health trade-off: Rook > Warthog > Raptor > Falcon
    assert.ok(simRook.aircraft.maxHull > simWarthog.aircraft.maxHull);
    assert.ok(simWarthog.aircraft.maxHull > simRaptor.aircraft.maxHull);
    assert.ok(simRaptor.aircraft.maxHull > simFalcon.aircraft.maxHull);

    // Speed trade-off: Falcon > Raptor > Warthog > Rook
    assert.ok(simFalcon.aircraft.speed > simRaptor.aircraft.speed);
    assert.ok(simRaptor.aircraft.speed > simWarthog.aircraft.speed);
    assert.ok(simWarthog.aircraft.speed > simRook.aircraft.speed);

    // Power trade-off: Raptor rocket damage > Falcon rocket damage; Warthog cannon damage > Falcon
    assert.ok(getLoadoutSpec('raptor').rocketDamage > getLoadoutSpec('falcon').rocketDamage);
    assert.ok(getLoadoutSpec('warthog').cannonDamage > getLoadoutSpec('falcon').cannonDamage);
    assert.equal(simRaptor.aircraft.maxRockets, 8);
    assert.equal(simRook.aircraft.maxRockets, 16);
  });

  it('smoothly ramps angular rollRate without harsh single-frame snapping', () => {
    const sim = new FlightSimulation();
    sim.startGame({ loadout: 'warthog', levelId: 1 });
    const leftInput = createEmptyInput();
    leftInput.rollLeft = true;

    sim.step(1 / 60, leftInput);
    const rateFrame1 = sim.aircraft.rollRate;
    sim.step(1 / 60, leftInput);
    const rateFrame2 = sim.aircraft.rollRate;
    for (let i = 0; i < 15; i++) sim.step(1 / 60, leftInput);
    const rateLater = sim.aircraft.rollRate;

    assert.ok(rateFrame1 > 0 && rateFrame2 > rateFrame1, 'rollRate should ramp smoothly');
    assert.ok(rateLater > rateFrame2, 'rollRate should continue accelerating smoothly');

    // Releasing control smoothly decays roll back toward level
    const neutral = createEmptyInput();
    for (let i = 0; i < 60; i++) sim.step(1 / 60, neutral);
    assert.ok(Math.abs(sim.aircraft.roll) < 0.25, 'aircraft should smoothly self-level');
  });

  it('engages Afterburner boost for extra speed, overheats on depletion, and recovers on release', () => {
    const sim = new FlightSimulation();
    sim.startGame({ loadout: 'falcon', levelId: 1 });
    const baseSpeed = sim.aircraft.speed;

    const boostInput = createEmptyInput();
    boostInput.afterburner = true;

    for (let i = 0; i < 30; i++) {
      sim.step(1 / 30, boostInput);
    }
    assert.equal(sim.aircraft.afterburnerActive, true);
    assert.ok(sim.aircraft.speed > baseSpeed + 18);
    assert.ok(sim.aircraft.afterburnerFuel < 0.75);

    for (let i = 0; i < 90; i++) {
      sim.step(1 / 30, boostInput);
    }
    assert.equal(sim.aircraft.afterburnerOverheated, true);
    assert.equal(sim.aircraft.afterburnerActive, false);

    const cruiseInput = createEmptyInput();
    for (let i = 0; i < 90; i++) {
      sim.step(1 / 30, cruiseInput);
    }
    assert.equal(sim.aircraft.afterburnerOverheated, false);
    assert.ok(sim.aircraft.afterburnerFuel >= 0.35);
  });

  it('collects mid-air Repair and Ordnance supply crates and populates Chase radar blips', () => {
    const sim = new FlightSimulation();
    sim.startGame({ loadout: 'warthog', levelId: 1, cameraMode: 'chase' });
    sim.aircraft.hull = 50;
    sim.aircraft.rockets = 4;
    sim.aircraft.flares = 1;
    sim.aircraft.afterburnerFuel = 0.1;
    sim.aircraft.afterburnerOverheated = true;

    const hudBefore = sim.getHudSnapshot();
    assert.ok(hudBefore.radarBlips.length > 0, 'Chase HUD snapshot should include live radar blips');

    const repairCrate = sim.spawnPickup(
      'repair',
      sim.aircraft.x,
      sim.aircraft.y - 18,
      sim.aircraft.z,
    );
    repairCrate.y = sim.aircraft.y;

    const ordCrate = sim.spawnPickup(
      'ordnance',
      sim.aircraft.x,
      sim.aircraft.y - 18,
      sim.aircraft.z,
    );
    ordCrate.y = sim.aircraft.y;

    sim.step(0.016, createEmptyInput());

    assert.equal(repairCrate.active, false);
    assert.equal(ordCrate.active, false);
    assert.equal(sim.aircraft.hull, 75);
    assert.equal(sim.aircraft.rockets, 8);
    assert.equal(sim.aircraft.flares, 3);
    assert.equal(sim.aircraft.afterburnerFuel, 1.0);
    assert.equal(sim.aircraft.afterburnerOverheated, false);
    assert.ok(sim.score >= 300);
  });

  it('spawns Sky Carrier Boss Aegis-09 on Level 5 Wave 2 and awards Campaign Victory when cleared', () => {
    const sim = new FlightSimulation();
    sim.startGame({ levelId: 5, startWaveIndex: 1, loadout: 'raptor' });

    const boss = sim.enemies.find((e) => e.archetype === 'carrier');
    assert.ok(boss, 'Expected Sky Carrier boss on Level 5 Wave 2');
    assert.equal(boss.maxHp, 340);

    const hud = sim.getHudSnapshot();
    assert.equal(hud.bossName, 'SKY CARRIER AEGIS-09');
    assert.equal(hud.bossHp, 340);
    assert.equal(hud.levelId, 5);
    assert.ok(
      hud.radarBlips.some((b) => b.kind === 'carrier'),
      'Carrier boss should appear on radar blips',
    );

    for (const enemy of sim.enemies) {
      enemy.alive = false;
    }
    sim.step(0.02, createEmptyInput());

    assert.equal(sim.phase, 'gameover');
    assert.ok(sim.runSummary);
    assert.equal(sim.runSummary.victory, true);
    assert.equal(sim.runSummary.levelId, 5);
    assert.equal(sim.runSummary.hasNextLevel, false);
  });

  it('converges cannon bolts toward a slightly off-axis forward target via smart aim-assist', () => {
    const sim = new FlightSimulation();
    sim.startGame({ levelId: 1, loadout: 'warthog' });

    // Place a stationary target 110 units ahead along the aircraft forward vector, offset laterally inside the cone
    const fwd = getForwardVector(sim.aircraft.yaw, sim.aircraft.pitch);
    const rightX = Math.cos(sim.aircraft.yaw);
    const rightZ = -Math.sin(sim.aircraft.yaw);
    const target = sim.enemies[0];
    target.archetype = 'radar';
    target.alive = true;
    target.hp = 40;
    target.maxHp = 40;
    target.x = sim.aircraft.x + fwd.x * 110 + rightX * 14;
    target.y = sim.aircraft.y + fwd.y * 110 + 6;
    target.z = sim.aircraft.z + fwd.z * 110 + rightZ * 14;
    target.vx = 0;
    target.vy = 0;
    target.vz = 0;

    // Disable other enemies so the test target is unambiguous
    for (let i = 1; i < sim.enemies.length; i++) {
      sim.enemies[i].alive = false;
    }

    const fireInput = createEmptyInput();
    fireInput.fireCannon = true;

    let damaged = false;
    for (let i = 0; i < 65; i++) {
      sim.step(1 / 60, fireInput);
      if (target.hp < 40 || !target.alive) {
        damaged = true;
        break;
      }
    }
    assert.equal(damaged, true, 'Smart cannon aim-assist should land hits on off-center forward targets');
  });

  it('applies softer scrape damage and 0.95s invulnerability grace period after taking a hit', () => {
    const sim = new FlightSimulation();
    sim.startGame({ levelId: 1, loadout: 'warthog' });
    sim.aircraft.invulnTimer = 0;
    const startHull = sim.aircraft.hull;

    sim.damagePlayer(12);
    assert.equal(sim.aircraft.hull, startHull - 12);
    assert.ok(sim.aircraft.invulnTimer >= 0.9, 'Post-hit invulnerability should last ~0.95s');

    // Immediate follow-up hit during i-frames must not drain additional hull
    sim.damagePlayer(12);
    assert.equal(sim.aircraft.hull, startHull - 12);
  });

  it('engages predictive hillside climb cushion when flying low over terrain without diving', () => {
    const sim = new FlightSimulation();
    sim.startGame({ levelId: 1, loadout: 'warthog' });

    // Position jet just above coastal ground with neutral pitch input
    const groundY = getTerrainHeight(sim.aircraft.x, sim.aircraft.z, sim.world.mountains);
    sim.aircraft.y = groundY + 10.5;
    sim.aircraft.pitch = -0.08;
    sim.aircraft.pitchRate = 0;

    const neutral = createEmptyInput();
    for (let i = 0; i < 20; i++) {
      sim.step(1 / 60, neutral);
    }

    assert.ok(
      sim.aircraft.pitch > -0.02 && sim.aircraft.y > groundY + 10.5,
      'Predictive terrain cushion should lift the nose smoothly above rising hillsides',
    );
  });
});
