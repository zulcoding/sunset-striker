import type { AircraftLoadoutId, AircraftState, CameraMode, InputState, Vec3 } from './types';
import { getLoadoutSpec } from './levels';
import { WORLD_RADIUS } from './worldGen';

export const MIN_SPEED = 30;
export const CRUISE_SPEED = 48;
export const MAX_SPEED = 86;
export const AFTERBURNER_BONUS_SPEED = 40;
export const MIN_ALTITUDE = 10;
export const MAX_ALTITUDE = 185;

/**
 * Compute unit forward vector for aircraft given yaw (0 = -Z) and pitch (+ = up).
 */
export function getForwardVector(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

export function createInitialAircraft(loadout: AircraftLoadoutId = 'warthog'): AircraftState {
  const spec = getLoadoutSpec(loadout);
  // Spawn over the open turquoise bay sweeping smoothly along the downtown skyline & coastal peaks
  const yaw = 0.34;
  const pitch = 0.0;
  const speed = CRUISE_SPEED + spec.speedBonus * 0.4;
  const fwd = getForwardVector(yaw, pitch);
  return {
    loadout: spec.id,
    x: 132,
    y: 78,
    z: 138,
    vx: fwd.x * speed,
    vy: fwd.y * speed,
    vz: fwd.z * speed,
    yaw,
    pitch,
    roll: 0,
    rollRate: 0,
    pitchRate: 0,
    speed,
    throttle: 0.62,
    afterburnerFuel: 1.0,
    afterburnerActive: false,
    afterburnerOverheated: false,
    hull: spec.maxHull,
    maxHull: spec.maxHull,
    invulnTimer: 2.5,
    cannonCooldown: 0,
    rocketCooldown: 0,
    rockets: spec.maxRockets,
    maxRockets: spec.maxRockets,
    rocketRegenTimer: 0,
    flareCooldown: 0,
    flares: spec.maxFlares,
    maxFlares: spec.maxFlares,
    flareRegenTimer: 0,
    muzzleFlashTimer: 0,
    hitFlashTimer: 0,
  };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Pure flight kinematics step.
 * Supports aircraft loadout speed/agility tuning, Afterburner boost with thermal recharge,
 * coordinated bank-to-turn yaw, gentle aerodynamic self-leveling, and soft coastal return.
 */
export function stepAircraftPhysics(
  plane: AircraftState,
  input: InputState,
  dt: number,
  cameraMode: CameraMode,
  terrainHeightAtPos: number,
): { scrapedTerrain: boolean; afterburnerEngaged: boolean } {
  const spec = getLoadoutSpec(plane.loadout);

  // Timers
  plane.invulnTimer = Math.max(0, plane.invulnTimer - dt);
  plane.cannonCooldown = Math.max(0, plane.cannonCooldown - dt);
  plane.rocketCooldown = Math.max(0, plane.rocketCooldown - dt);
  plane.flareCooldown = Math.max(0, plane.flareCooldown - dt);
  plane.muzzleFlashTimer = Math.max(0, plane.muzzleFlashTimer - dt);
  plane.hitFlashTimer = Math.max(0, plane.hitFlashTimer - dt);

  // Passive ordnance replenishment so dogfights never dry out
  if (plane.rockets < plane.maxRockets) {
    plane.rocketRegenTimer += dt;
    if (plane.rocketRegenTimer >= 4.2) {
      plane.rocketRegenTimer = 0;
      plane.rockets += 1;
    }
  } else {
    plane.rocketRegenTimer = 0;
  }

  if (plane.flares < plane.maxFlares) {
    plane.flareRegenTimer += dt;
    if (plane.flareRegenTimer >= 7.5) {
      plane.flareRegenTimer = 0;
      plane.flares += 1;
    }
  } else {
    plane.flareRegenTimer = 0;
  }

  // Throttle & Afterburner Boost state machine
  const throttleInput = (input.throttleUp ? 1 : 0) - (input.throttleDown ? 1 : 0);
  if (throttleInput !== 0) {
    plane.throttle = clamp(plane.throttle + throttleInput * 0.55 * dt, 0.25, 1.0);
  }

  const prevBoost = plane.afterburnerActive;
  if (input.afterburner && !plane.afterburnerOverheated && plane.afterburnerFuel > 0) {
    plane.afterburnerActive = true;
    plane.afterburnerFuel = Math.max(0, plane.afterburnerFuel - 0.38 * dt);
    if (plane.afterburnerFuel <= 0.005) {
      plane.afterburnerFuel = 0;
      plane.afterburnerActive = false;
      plane.afterburnerOverheated = true;
    }
  } else {
    plane.afterburnerActive = false;
    const regenRate =
      plane.afterburnerOverheated && input.afterburner
        ? spec.boostRegenRate * 0.35
        : spec.boostRegenRate;
    plane.afterburnerFuel = Math.min(1, plane.afterburnerFuel + regenRate * dt);
    if (plane.afterburnerOverheated && !input.afterburner && plane.afterburnerFuel >= 0.35) {
      plane.afterburnerOverheated = false;
    }
  }

  const minSpd = Math.max(28, MIN_SPEED + spec.speedBonus * 0.4);
  const maxSpd = MAX_SPEED + spec.speedBonus;
  const boostDelta = plane.afterburnerActive ? AFTERBURNER_BONUS_SPEED : 0;
  const targetSpeed = minSpd + (maxSpd - minSpd) * plane.throttle + boostDelta;
  plane.speed += (targetSpeed - plane.speed) * (1 - Math.exp(-3.8 * dt));

  // Steering inputs
  let rollInput = (input.rollLeft ? 1 : 0) - (input.rollRight ? 1 : 0);
  let pitchInput = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const yawTrim = (input.yawLeft ? 1 : 0) - (input.yawRight ? 1 : 0);

  if (Math.abs(input.pointerSteerX) > 0.05 && rollInput === 0) {
    rollInput = clamp(-input.pointerSteerX, -1, 1);
  }
  if (Math.abs(input.pointerSteerY) > 0.05 && pitchInput === 0) {
    pitchInput = clamp(-input.pointerSteerY, -1, 1);
  }

  // Silky roll & pitch angular-rate smoothing (prevents jerky snapping on key tap/release)
  const maxRoll = cameraMode === 'topdown' ? 0.82 : 1.18;
  const targetRollRate =
    Math.abs(rollInput) > 0.01 ? rollInput * 2.75 * spec.turnBonus : -plane.roll * 3.1;
  const rollRateBlend = 1 - Math.exp(-10.5 * dt);
  plane.rollRate += (targetRollRate - plane.rollRate) * rollRateBlend;
  plane.roll = clamp(plane.roll + plane.rollRate * dt, -maxRoll, maxRoll);

  const maxPitch = cameraMode === 'topdown' ? 0.42 : 0.78;
  const targetPitchRate =
    Math.abs(pitchInput) > 0.01 ? pitchInput * 1.72 * spec.turnBonus : -plane.pitch * 2.1;
  const pitchRateBlend = 1 - Math.exp(-9.5 * dt);
  plane.pitchRate += (targetPitchRate - plane.pitchRate) * pitchRateBlend;
  plane.pitch = clamp(plane.pitch + plane.pitchRate * dt, -maxPitch, maxPitch);

  // Coordinated bank-to-turn yaw + manual rudder trim
  const bankTurnRate = Math.sin(plane.roll) * 1.52 * spec.turnBonus;
  plane.yaw = normalizeAngle(plane.yaw + (bankTurnRate + yawTrim * 0.85) * dt);

  // Soft perimeter auto-return if aircraft wanders past outer coastal ring
  const distFromCenter = Math.hypot(plane.x, plane.z);
  const softLimit = WORLD_RADIUS - 70;
  if (distFromCenter > softLimit) {
    const desiredYaw = Math.atan2(plane.x, plane.z);
    const angleDiff = normalizeAngle(desiredYaw - plane.yaw);
    const pullStrength = clamp((distFromCenter - softLimit) / 65, 0, 1);
    plane.yaw = normalizeAngle(plane.yaw + angleDiff * pullStrength * 2.2 * dt);
    plane.roll = clamp(
      plane.roll + Math.sign(angleDiff) * pullStrength * 1.2 * dt,
      -maxRoll,
      maxRoll,
    );
  }

  // Advance position along forward vector
  const fwd = getForwardVector(plane.yaw, plane.pitch);
  plane.vx = fwd.x * plane.speed;
  plane.vy = fwd.y * plane.speed;
  plane.vz = fwd.z * plane.speed;

  plane.x += plane.vx * dt;
  plane.y += plane.vy * dt;
  plane.z += plane.vz * dt;

  // Altitude ceiling & terrain/water floor safety
  if (plane.y > MAX_ALTITUDE) {
    plane.y = MAX_ALTITUDE;
    if (plane.pitch > 0) plane.pitch *= Math.exp(-6 * dt);
  }

  let scrapedTerrain = false;
  const cushionFloor = Math.max(MIN_ALTITUDE + 4, terrainHeightAtPos + 13.5);
  const safeFloor = Math.max(MIN_ALTITUDE, terrainHeightAtPos + 7.5);
  // Gentle predictive climb assist near hillsides so casual players don't accidentally slam into peaks
  if (plane.y < cushionFloor && !input.pitchDown) {
    plane.pitch = Math.max(plane.pitch, 0.14);
  }
  if (plane.y < safeFloor) {
    plane.y = safeFloor;
    if (plane.pitch < 0.14) {
      plane.pitch = 0.22;
    }
    scrapedTerrain = true;
  }

  return {
    scrapedTerrain,
    afterburnerEngaged: !prevBoost && plane.afterburnerActive,
  };
}

/**
 * Convert heading yaw (0 = North/-Z) into 0..359 aviation compass degrees.
 */
export function yawToHeadingDegrees(yaw: number): number {
  const deg = ((-yaw * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}
