import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialAircraft,
  MAX_ALTITUDE,
  MAX_SPEED,
  MIN_SPEED,
  stepAircraftPhysics,
  yawToHeadingDegrees,
} from './flightPhysics';
import { createEmptyInput } from './simulation';
import { getTerrainHeight } from './worldGen';

test('aircraft survives 6 seconds of zero-input cruise without crashing', () => {
  const plane = createInitialAircraft();
  const input = createEmptyInput();
  let scraped = false;

  for (let i = 0; i < 180; i++) {
    const dt = 1 / 30;
    const terrainH = getTerrainHeight(plane.x, plane.z);
    const res = stepAircraftPhysics(plane, input, dt, 'chase', terrainH);
    if (res.scrapedTerrain) scraped = true;
  }

  assert.equal(scraped, false, 'Aircraft should cruise cleanly without scraping terrain');
  assert.ok(plane.y > 20, 'Aircraft should maintain safe cruise altitude');
});

test('banking left induces positive coordinated yaw turn', () => {
  const plane = createInitialAircraft();
  const startYaw = plane.yaw;
  const input = createEmptyInput();
  input.rollLeft = true;

  for (let i = 0; i < 30; i++) {
    stepAircraftPhysics(plane, input, 1 / 30, 'chase', 0);
  }

  assert.ok(plane.roll > 0.3, 'Roll should bank left');
  assert.ok(plane.yaw > startYaw + 0.15, 'Left bank should coordinate a left yaw turn');
});

test('throttle clamps speed within physical min and max envelopes', () => {
  const plane = createInitialAircraft();
  const input = createEmptyInput();
  input.throttleUp = true;

  for (let i = 0; i < 120; i++) {
    stepAircraftPhysics(plane, input, 1 / 30, 'chase', 0);
  }
  assert.ok(plane.speed <= MAX_SPEED + 0.01);
  assert.ok(plane.speed > MIN_SPEED + 30);

  input.throttleUp = false;
  input.throttleDown = true;
  for (let i = 0; i < 160; i++) {
    stepAircraftPhysics(plane, input, 1 / 30, 'chase', 0);
  }
  assert.ok(plane.speed >= MIN_SPEED - 0.01);
  assert.ok(plane.speed < MAX_SPEED - 30);
});

test('altitude ceiling prevents climbing past MAX_ALTITUDE', () => {
  const plane = createInitialAircraft();
  plane.y = MAX_ALTITUDE - 2;
  const input = createEmptyInput();
  input.pitchUp = true;

  for (let i = 0; i < 60; i++) {
    stepAircraftPhysics(plane, input, 1 / 30, 'chase', 0);
  }
  assert.ok(plane.y <= MAX_ALTITUDE + 0.001);
});

test('yawToHeadingDegrees maps aviation cardinal directions accurately', () => {
  assert.equal(Math.round(yawToHeadingDegrees(0)), 0);
  assert.equal(Math.round(yawToHeadingDegrees(-Math.PI / 2)), 90);
  assert.equal(Math.round(yawToHeadingDegrees(Math.PI)), 180);
  assert.equal(Math.round(yawToHeadingDegrees(Math.PI / 2)), 270);
});
