import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkBuildingCollision,
  generateWorld,
  getTerrainHeight,
  isOverWater,
} from './worldGen';
import { createInitialAircraft } from './flightPhysics';

test('generateWorld is deterministic for a fixed seed', () => {
  const worldA = generateWorld(123456);
  const worldB = generateWorld(123456);
  assert.equal(worldA.buildings.length, worldB.buildings.length);
  assert.ok(worldA.buildings.length >= 60, 'Expected dense downtown skyline');
  assert.deepEqual(worldA.buildings[0], worldB.buildings[0]);
  assert.ok(worldA.helipadSpots.length >= 4, 'Expected rooftop helipads');
  assert.ok(worldA.parks.length >= 2, 'Expected downtown city parks');
  assert.ok(worldA.trees.length >= 80, 'Expected coastal and hillside trees');
  assert.ok(worldA.clouds.length >= 20, 'Expected sunset cloud field');
});

test('coastline separates open bay water from inland mountains and downtown', () => {
  assert.equal(isOverWater(140, 60), true, 'Eastern bay should be water');
  assert.equal(isOverWater(-80, -40), false, 'Downtown core should be land');

  const waterHeight = getTerrainHeight(140, 60);
  const mountainHeight = getTerrainHeight(-185, -275);
  assert.equal(waterHeight, 0, 'Open water must be at sea level');
  assert.ok(mountainHeight > 140, 'Main mountain peak should tower above downtown');
});

test('initial aircraft spawns in open air over bay with zero collisions', () => {
  const world = generateWorld();
  const plane = createInitialAircraft();
  assert.equal(isOverWater(plane.x, plane.z), true, 'Aircraft should spawn over bay');
  const hit = checkBuildingCollision(plane.x, plane.y, plane.z, 4, world.buildings, world.mountains);
  assert.equal(hit, null, 'Initial spawn must not collide with any building');
});

test('checkBuildingCollision detects intersection inside skyscraper volume', () => {
  const world = generateWorld();
  const b = world.buildings[0];
  const baseH = getTerrainHeight(b.x, b.z, world.mountains);
  const hit = checkBuildingCollision(b.x, baseH + b.height * 0.5, b.z, 2, world.buildings, world.mountains);
  assert.equal(hit?.id, b.id);

  const clear = checkBuildingCollision(b.x, baseH + b.height + 20, b.z, 2, world.buildings, world.mountains);
  assert.equal(clear, null);
});
