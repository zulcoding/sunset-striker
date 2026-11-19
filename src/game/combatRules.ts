import type {
  AircraftState,
  EnemyArchetype,
  EnemyEntity,
  Particle,
  ParticleKind,
  Projectile,
  RadarBlip,
  SimulationEvent,
  SupplyPickup,
  Vec3,
  WaveConfig,
  WorldData,
} from './types';
import { getForwardVector } from './flightPhysics';
import { getTerrainHeight } from './worldGen';
import { LEVEL_CONFIGS } from './levels';

export const WAVE_CONFIGS: readonly WaveConfig[] = LEVEL_CONFIGS[0].waves;

export const ENEMY_SCORE_TABLE: Record<EnemyArchetype, number> = {
  sam: 250,
  gunboat: 200,
  bandit: 350,
  radar: 500,
  carrier: 2500,
};

export const ENEMY_HP_TABLE: Record<EnemyArchetype, number> = {
  sam: 40,
  gunboat: 48,
  bandit: 36,
  radar: 85,
  carrier: 340,
};

export const ENEMY_RADIUS_TABLE: Record<EnemyArchetype, number> = {
  sam: 6.5,
  gunboat: 8.0,
  bandit: 6.2,
  radar: 9.0,
  carrier: 22.0,
};

export const ENEMY_LABEL_TABLE: Record<EnemyArchetype, string> = {
  sam: 'SAM',
  gunboat: 'GUNBOAT',
  bandit: 'BANDIT',
  radar: 'RADAR',
  carrier: 'AEGIS-09',
};

export function spawnWaveEnemies(
  waveConfig: WaveConfig,
  world: WorldData,
  startId: number,
): EnemyEntity[] {
  const enemies: EnemyEntity[] = [];
  let nextId = startId;

  // 1. Rooftop SAM Batteries on helipads (Area-Denial Turrets)
  const helipads = world.helipadSpots;
  for (let i = 0; i < waveConfig.sams; i++) {
    const spot =
      helipads.length > 0
        ? helipads[(i * 3 + waveConfig.wave) % helipads.length]
        : { x: -40 - i * 25, y: 42, z: -20 - i * 18 };
    enemies.push({
      id: nextId++,
      archetype: 'sam',
      x: spot.x,
      y: spot.y,
      z: spot.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      roll: 0,
      hp: ENEMY_HP_TABLE.sam,
      maxHp: ENEMY_HP_TABLE.sam,
      radius: ENEMY_RADIUS_TABLE.sam,
      fireCooldown: 4.2 + i * 1.35,
      telegraphTimer: 0,
      telegraphDuration: 1.15,
      hasAttackToken: false,
      patrolAngle: 0,
      patrolCenterX: spot.x,
      patrolCenterZ: spot.z,
      patrolRadius: 0,
      hitFlashTimer: 0,
      koTimer: 0,
      alive: true,
    });
  }

  // 2. Coastal Patrol Gunboats (Naval Escorts cruising bay circuits)
  for (let i = 0; i < waveConfig.gunboats; i++) {
    const base = world.gunboatSpawns[i % world.gunboatSpawns.length];
    const angle = (i / Math.max(1, waveConfig.gunboats)) * Math.PI * 2;
    enemies.push({
      id: nextId++,
      archetype: 'gunboat',
      x: base.x,
      y: 0.8,
      z: base.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: angle,
      roll: 0,
      hp: ENEMY_HP_TABLE.gunboat,
      maxHp: ENEMY_HP_TABLE.gunboat,
      radius: ENEMY_RADIUS_TABLE.gunboat,
      fireCooldown: 3.6 + i * 1.1,
      telegraphTimer: 0,
      telegraphDuration: 0.72,
      hasAttackToken: false,
      patrolAngle: angle,
      patrolCenterX: base.x,
      patrolCenterZ: base.z,
      patrolRadius: 28 + (i % 3) * 10,
      hitFlashTimer: 0,
      koTimer: 0,
      alive: true,
    });
  }

  // 3. Airborne Bandit Interceptors (Orbiters / Flankers above skyline & bay)
  for (let i = 0; i < waveConfig.bandits; i++) {
    const angle = (i / Math.max(1, waveConfig.bandits)) * Math.PI * 2 + waveConfig.wave * 0.6;
    const rad = 115 + (i % 2) * 45;
    const cx = -20;
    const cz = -30;
    enemies.push({
      id: nextId++,
      archetype: 'bandit',
      x: cx + Math.cos(angle) * rad,
      y: 68 + (i % 3) * 14,
      z: cz + Math.sin(angle) * rad,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: angle + Math.PI * 0.5,
      roll: 0.35,
      hp: ENEMY_HP_TABLE.bandit,
      maxHp: ENEMY_HP_TABLE.bandit,
      radius: ENEMY_RADIUS_TABLE.bandit,
      fireCooldown: 4.4 + i * 1.25,
      telegraphTimer: 0,
      telegraphDuration: 0.8,
      hasAttackToken: false,
      patrolAngle: angle,
      patrolCenterX: cx,
      patrolCenterZ: cz,
      patrolRadius: rad,
      hitFlashTimer: 0,
      koTimer: 0,
      alive: true,
    });
  }

  // 4. Armored Radar Spires (High-value objective towers)
  for (let i = 0; i < waveConfig.radars; i++) {
    const spot =
      world.radarSpots.length > 0
        ? world.radarSpots[(i * 2 + waveConfig.wave) % world.radarSpots.length]
        : { x: -85 - i * 35, y: 55, z: -65 - i * 20 };
    enemies.push({
      id: nextId++,
      archetype: 'radar',
      x: spot.x,
      y: spot.y,
      z: spot.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      roll: 0,
      hp: ENEMY_HP_TABLE.radar,
      maxHp: ENEMY_HP_TABLE.radar,
      radius: ENEMY_RADIUS_TABLE.radar,
      fireCooldown: 99,
      telegraphTimer: 0,
      telegraphDuration: 0,
      hasAttackToken: false,
      patrolAngle: 0,
      patrolCenterX: spot.x,
      patrolCenterZ: spot.z,
      patrolRadius: 0,
      hitFlashTimer: 0,
      koTimer: 0,
      alive: true,
    });
  }

  // 5. Sky Carrier Boss "Aegis-09" (Airborne Fortress patrolling high above the bay!)
  for (let i = 0; i < waveConfig.carriers; i++) {
    const angle = 0.8 + i * Math.PI;
    const cx = 65;
    const cz = -35;
    const rad = 95;
    enemies.push({
      id: nextId++,
      archetype: 'carrier',
      x: cx + Math.cos(angle) * rad,
      y: 92,
      z: cz + Math.sin(angle) * rad,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: angle + Math.PI * 0.5,
      roll: 0,
      hp: ENEMY_HP_TABLE.carrier,
      maxHp: ENEMY_HP_TABLE.carrier,
      radius: ENEMY_RADIUS_TABLE.carrier,
      fireCooldown: 2.6,
      telegraphTimer: 0,
      telegraphDuration: 0.95,
      hasAttackToken: false,
      patrolAngle: angle,
      patrolCenterX: cx,
      patrolCenterZ: cz,
      patrolRadius: rad,
      hitFlashTimer: 0,
      koTimer: 0,
      alive: true,
    });
  }

  return enemies;
}

/**
 * Find the best enemy inside the aircraft's forward targeting cone for rocket lock-on.
 */
export function acquireLockTarget(
  plane: AircraftState,
  enemies: readonly EnemyEntity[],
  maxRange = 480,
  minDot = 0.56,
): EnemyEntity | null {
  const fwd = getForwardVector(plane.yaw, plane.pitch);
  let best: EnemyEntity | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.koTimer > 0) continue;
    const dx = e.x - plane.x;
    const dy = e.y - plane.y;
    const dz = e.z - plane.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxRange || dist < 10) continue;
    const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist;
    if (dot < minDot) continue;
    const score = (1 - dot) * 260 + dist * 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/**
 * Compute relative radar blips rotated into aircraft-heading frame (-1..1).
 */
export function buildRadarBlips(
  plane: AircraftState,
  enemies: readonly EnemyEntity[],
  projectiles: readonly Projectile[],
  pickups: readonly SupplyPickup[],
  lockedTargetId: number | null,
  radarRange = 340,
): RadarBlip[] {
  const blips: RadarBlip[] = [];
  const cosY = Math.cos(plane.yaw);
  const sinY = Math.sin(plane.yaw);

  const projectToRadar = (wx: number, wz: number): { relX: number; relZ: number } | null => {
    const dx = wx - plane.x;
    const dz = wz - plane.z;
    const lx = dx * cosY - dz * sinY;
    const lz = dx * sinY + dz * cosY;
    const nx = lx / radarRange;
    const nz = lz / radarRange;
    const mag = Math.hypot(nx, nz);
    if (mag > 0.96) {
      return { relX: (nx / mag) * 0.94, relZ: (nz / mag) * 0.94 };
    }
    return { relX: nx, relZ: nz };
  };

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.koTimer > 0) continue;
    const p = projectToRadar(e.x, e.z);
    if (!p) continue;
    blips.push({
      relX: p.relX,
      relZ: p.relZ,
      kind: e.archetype,
      locked: e.id === lockedTargetId,
    });
  }

  for (let i = 0; i < projectiles.length; i++) {
    const pr = projectiles[i];
    if (!pr.active || pr.kind !== 'sam') continue;
    const p = projectToRadar(pr.x, pr.z);
    if (!p) continue;
    blips.push({
      relX: p.relX,
      relZ: p.relZ,
      kind: 'sam_missile',
      locked: false,
    });
  }

  for (let i = 0; i < pickups.length; i++) {
    const pk = pickups[i];
    if (!pk.active) continue;
    const p = projectToRadar(pk.x, pk.z);
    if (!p) continue;
    blips.push({
      relX: p.relX,
      relZ: p.relZ,
      kind: 'pickup',
      locked: false,
    });
  }

  return blips;
}

export interface EnemyStepContext {
  plane: AircraftState;
  enemies: EnemyEntity[];
  waveConfig: WaveConfig;
  activeTokens: number;
  spawnProjectile: (
    kind: Projectile['kind'],
    friendly: boolean,
    pos: Vec3,
    vel: Vec3,
    damage: number,
    radius: number,
    maxLife: number,
    targetId: number | null,
  ) => void;
  spawnParticle: (
    kind: ParticleKind,
    pos: Vec3,
    vel: Vec3,
    scale: number,
    maxScale: number,
    maxLife: number,
    colorIndex: number,
  ) => void;
  emitEvent: (ev: SimulationEvent) => void;
}

/**
 * Advance all 5 enemy archetypes (including Sky Carrier Boss) with telegraphed attacks and attack token budget.
 */
export function stepEnemies(ctx: EnemyStepContext, dt: number): number {
  const { plane, enemies, waveConfig } = ctx;
  let activeTokens = ctx.activeTokens;

  const activeRadars = enemies.filter((e) => e.alive && e.koTimer <= 0 && e.archetype === 'radar').length;
  const radarBoost = 1 - Math.min(0.24, activeRadars * 0.08);

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;

    e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);

    // KO topple / smoke dissolve phase
    if (e.koTimer > 0) {
      e.koTimer -= dt;
      if (e.archetype === 'bandit' || e.archetype === 'carrier') {
        e.x += e.vx * dt;
        e.y += (e.vy - (e.archetype === 'carrier' ? 12 : 18)) * dt;
        e.z += e.vz * dt;
        e.roll += (e.archetype === 'carrier' ? 0.65 : 6.5) * dt;
      } else {
        e.y -= 4.5 * dt;
      }
      if (Math.random() < (e.archetype === 'carrier' ? 0.85 : 0.45)) {
        const spread = e.archetype === 'carrier' ? 18 : 3;
        ctx.spawnParticle(
          'fire',
          {
            x: e.x + (Math.random() - 0.5) * spread,
            y: e.y + (Math.random() - 0.5) * spread * 0.4,
            z: e.z + (Math.random() - 0.5) * spread,
          },
          { x: (Math.random() - 0.5) * 10, y: 6 + Math.random() * 10, z: (Math.random() - 0.5) * 10 },
          e.archetype === 'carrier' ? 5.2 : 2.6,
          e.archetype === 'carrier' ? 14.5 : 7.5,
          0.55,
          0,
        );
      }
      if (e.koTimer <= 0) {
        if (e.hasAttackToken) {
          e.hasAttackToken = false;
          activeTokens = Math.max(0, activeTokens - 1);
        }
        e.alive = false;
      }
      continue;
    }

    const dx = plane.x - e.x;
    const dy = plane.y - e.y;
    const dz = plane.z - e.z;
    const dist = Math.hypot(dx, dy, dz);

    // --- Archetype 1: Rooftop SAM Battery ---
    if (e.archetype === 'sam') {
      e.yaw = Math.atan2(-dx, -dz);
      if (e.telegraphTimer > 0) {
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          const launchSpeed = 76;
          const dirX = dx / Math.max(1, dist);
          const dirZ = dz / Math.max(1, dist);
          ctx.spawnProjectile(
            'sam',
            false,
            { x: e.x, y: e.y + 3.2, z: e.z },
            { x: dirX * launchSpeed * 0.45, y: launchSpeed * 0.85, z: dirZ * launchSpeed * 0.45 },
            12,
            3.2,
            6.8,
            -1,
          );
          for (let p = 0; p < 5; p++) {
            ctx.spawnParticle(
              'smoke',
              { x: e.x, y: e.y + 2, z: e.z },
              { x: (Math.random() - 0.5) * 8, y: 4 + Math.random() * 6, z: (Math.random() - 0.5) * 8 },
              2.2,
              6.5,
              0.9,
              0,
            );
          }
          ctx.emitEvent({ type: 'sam_launch', x: e.x, y: e.y, z: e.z });
          if (e.hasAttackToken) {
            e.hasAttackToken = false;
            activeTokens = Math.max(0, activeTokens - 1);
          }
          e.fireCooldown = (5.4 + Math.random() * 2.2) * waveConfig.samCadenceScale * radarBoost;
        }
      } else {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 340 && activeTokens < waveConfig.maxAttackTokens) {
          e.hasAttackToken = true;
          activeTokens += 1;
          e.telegraphTimer = e.telegraphDuration;
          ctx.emitEvent({ type: 'sam_lock', x: e.x, y: e.y, z: e.z });
        }
      }
      continue;
    }

    // --- Archetype 2: Patrol Gunboat ---
    if (e.archetype === 'gunboat') {
      const orbitSpeed = 0.28;
      e.patrolAngle += orbitSpeed * dt;
      const targetX = e.patrolCenterX + Math.cos(e.patrolAngle) * e.patrolRadius;
      const targetZ = e.patrolCenterZ + Math.sin(e.patrolAngle) * e.patrolRadius;
      e.vx = (targetX - e.x) / Math.max(0.016, dt);
      e.vz = (targetZ - e.z) / Math.max(0.016, dt);
      e.x = targetX;
      e.z = targetZ;
      e.y = 0.8;
      e.yaw = Math.atan2(-e.vx, -e.vz);

      if (Math.random() < 0.35) {
        ctx.spawnParticle(
          'water_wake',
          { x: e.x - Math.sin(e.yaw) * -5, y: 0.3, z: e.z - Math.cos(e.yaw) * -5 },
          { x: 0, y: 0, z: 0 },
          1.4,
          3.4,
          1.2,
          0,
        );
      }

      if (e.telegraphTimer > 0) {
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          const leadT = Math.min(1.6, dist / 120);
          const aimX = plane.x + plane.vx * leadT - e.x;
          const aimY = plane.y + plane.vy * leadT - (e.y + 3);
          const aimZ = plane.z + plane.vz * leadT - e.z;
          const aimLen = Math.max(1, Math.hypot(aimX, aimY, aimZ));
          const flakSpeed = 122;
          ctx.spawnProjectile(
            'flak',
            false,
            { x: e.x, y: e.y + 3.2, z: e.z },
            {
              x: (aimX / aimLen) * flakSpeed,
              y: (aimY / aimLen) * flakSpeed,
              z: (aimZ / aimLen) * flakSpeed,
            },
            7,
            3.8,
            2.9,
            null,
          );
          if (e.hasAttackToken) {
            e.hasAttackToken = false;
            activeTokens = Math.max(0, activeTokens - 1);
          }
          e.fireCooldown = (4.2 + Math.random() * 1.5) * waveConfig.samCadenceScale;
        }
      } else {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 290 && activeTokens < waveConfig.maxAttackTokens) {
          e.hasAttackToken = true;
          activeTokens += 1;
          e.telegraphTimer = e.telegraphDuration;
        }
      }
      continue;
    }

    // --- Archetype 3: Bandit Interceptor ---
    if (e.archetype === 'bandit') {
      const angularSpeed = 0.34;
      e.patrolAngle += angularSpeed * dt;
      e.patrolCenterX += (plane.x * 0.45 - e.patrolCenterX) * 0.12 * dt;
      e.patrolCenterZ += (plane.z * 0.45 - e.patrolCenterZ) * 0.12 * dt;
      const desiredX = e.patrolCenterX + Math.cos(e.patrolAngle) * e.patrolRadius;
      const desiredZ = e.patrolCenterZ + Math.sin(e.patrolAngle) * e.patrolRadius;
      const desiredY = Math.max(48, Math.min(115, plane.y + Math.sin(e.patrolAngle * 2) * 16));

      const toX = desiredX - e.x;
      const toY = desiredY - e.y;
      const toZ = desiredZ - e.z;
      const len = Math.max(1, Math.hypot(toX, toY, toZ));
      const speed = 44;
      e.vx = (toX / len) * speed;
      e.vy = (toY / len) * speed;
      e.vz = (toZ / len) * speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += e.vz * dt;
      e.yaw = Math.atan2(-e.vx, -e.vz);
      e.roll = 0.42;

      if (e.telegraphTimer > 0) {
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          const boltSpeed = 148;
          const aimX = plane.x + plane.vx * 0.4 - e.x;
          const aimY = plane.y + plane.vy * 0.4 - e.y;
          const aimZ = plane.z + plane.vz * 0.4 - e.z;
          const aimLen = Math.max(1, Math.hypot(aimX, aimY, aimZ));
          ctx.spawnProjectile(
            'bandit_bolt',
            false,
            { x: e.x, y: e.y, z: e.z },
            {
              x: (aimX / aimLen) * boltSpeed,
              y: (aimY / aimLen) * boltSpeed,
              z: (aimZ / aimLen) * boltSpeed,
            },
            5,
            2.4,
            2.2,
            null,
          );
          if (e.hasAttackToken) {
            e.hasAttackToken = false;
            activeTokens = Math.max(0, activeTokens - 1);
          }
          e.fireCooldown = 4.0 + Math.random() * 1.6;
        }
      } else {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 245 && activeTokens < waveConfig.maxAttackTokens) {
          e.hasAttackToken = true;
          activeTokens += 1;
          e.telegraphTimer = e.telegraphDuration;
        }
      }
      continue;
    }

    // --- Archetype 4: Coastal Radar Spire ---
    if (e.archetype === 'radar') {
      e.yaw += 1.4 * dt;
      continue;
    }

    // --- Archetype 5: Sky Carrier Boss "Aegis-09" ---
    if (e.archetype === 'carrier') {
      const orbitSpeed = 0.12;
      e.patrolAngle += orbitSpeed * dt;
      const targetX = e.patrolCenterX + Math.cos(e.patrolAngle) * e.patrolRadius;
      const targetZ = e.patrolCenterZ + Math.sin(e.patrolAngle) * e.patrolRadius;
      const targetY = 92 + Math.sin(e.patrolAngle * 3) * 6;
      e.vx = (targetX - e.x) / Math.max(0.016, dt);
      e.vy = (targetY - e.y) / Math.max(0.016, dt);
      e.vz = (targetZ - e.z) / Math.max(0.016, dt);
      e.x = targetX;
      e.y = targetY;
      e.z = targetZ;
      e.yaw = Math.atan2(-e.vx, -e.vz);

      // Phase 2 below 50% HP fires faster salvos!
      const enraged = e.hp < e.maxHp * 0.5;

      if (e.telegraphTimer > 0) {
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          // Launch dual SAM missile + flak spread salvo from dorsal deck
          const dirX = dx / Math.max(1, dist);
          const dirY = dy / Math.max(1, dist);
          const dirZ = dz / Math.max(1, dist);
          const samCount = enraged ? 2 : 1;
          for (let s = 0; s < samCount; s++) {
            const side = s === 0 ? -9 : 9;
            ctx.spawnProjectile(
              'sam',
              false,
              { x: e.x + side, y: e.y + 6, z: e.z },
              { x: dirX * 55 + side * 1.4, y: 42, z: dirZ * 55 },
              12,
              3.4,
              7.0,
              -1,
            );
          }
          // Accompanying flak burst
          ctx.spawnProjectile(
            'flak',
            false,
            { x: e.x, y: e.y + 4, z: e.z },
            { x: dirX * 130, y: dirY * 130, z: dirZ * 130 },
            8,
            4.0,
            2.8,
            null,
          );
          ctx.emitEvent({ type: 'sam_launch', x: e.x, y: e.y, z: e.z });
          if (e.hasAttackToken) {
            e.hasAttackToken = false;
            activeTokens = Math.max(0, activeTokens - 1);
          }
          e.fireCooldown = enraged ? 3.2 : 4.5;
        }
      } else {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 410 && activeTokens < waveConfig.maxAttackTokens) {
          e.hasAttackToken = true;
          activeTokens += 1;
          e.telegraphTimer = e.telegraphDuration;
          ctx.emitEvent({ type: 'sam_lock', x: e.x, y: e.y, z: e.z });
        }
      }
    }
  }

  return activeTokens;
}

/**
 * Proportional guidance for homing missiles (friendly rockets & hostile SAMs)
 * and flare countermeasure decoying.
 */
export function updateProjectileGuidance(
  pr: Projectile,
  plane: AircraftState,
  enemies: readonly EnemyEntity[],
  projectiles: readonly Projectile[],
  dt: number,
  world: WorldData,
): void {
  if (pr.kind === 'sam') {
    let targetPos: Vec3 = { x: plane.x, y: plane.y, z: plane.z };
    let flareFound = false;
    for (let j = 0; j < projectiles.length; j++) {
      const f = projectiles[j];
      if (!f.active || f.kind !== 'flare') continue;
      const d = Math.hypot(f.x - pr.x, f.y - pr.y, f.z - pr.z);
      if (d < 95) {
        targetPos = { x: f.x, y: f.y, z: f.z };
        pr.decoyedByFlare = true;
        flareFound = true;
        break;
      }
    }

    const dx = targetPos.x - pr.x;
    const dy = targetPos.y - pr.y;
    const dz = targetPos.z - pr.z;
    const dist = Math.max(1, Math.hypot(dx, dy, dz));
    const speed = Math.hypot(pr.vx, pr.vy, pr.vz) || 74;
    const targetSpeed = Math.min(82, speed + 12 * dt);
    const turnRate = flareFound ? 5.2 : 1.72;

    const curX = pr.vx / speed;
    const curY = pr.vy / speed;
    const curZ = pr.vz / speed;

    const blend = 1 - Math.exp(-turnRate * dt);
    let nx = curX + (dx / dist - curX) * blend;
    let ny = curY + (dy / dist - curY) * blend;
    let nz = curZ + (dz / dist - curZ) * blend;
    const nLen = Math.max(0.001, Math.hypot(nx, ny, nz));
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;

    pr.vx = nx * targetSpeed;
    pr.vy = ny * targetSpeed;
    pr.vz = nz * targetSpeed;
  } else if (pr.kind === 'rocket' && pr.targetId !== null) {
    const target = enemies.find((e) => e.id === pr.targetId && e.alive && e.koTimer <= 0);
    if (target) {
      const dx = target.x - pr.x;
      const dy = target.y - pr.y;
      const dz = target.z - pr.z;
      const dist = Math.max(1, Math.hypot(dx, dy, dz));
      const speed = 166;
      const curSpeed = Math.max(1, Math.hypot(pr.vx, pr.vy, pr.vz));
      const blend = 1 - Math.exp(-8.5 * dt);
      let nx = pr.vx / curSpeed + (dx / dist - pr.vx / curSpeed) * blend;
      let ny = pr.vy / curSpeed + (dy / dist - pr.vy / curSpeed) * blend;
      let nz = pr.vz / curSpeed + (dz / dist - pr.vz / curSpeed) * blend;
      const nLen = Math.max(0.001, Math.hypot(nx, ny, nz));
      pr.vx = (nx / nLen) * speed;
      pr.vy = (ny / nLen) * speed;
      pr.vz = (nz / nLen) * speed;
    }
  } else if (pr.kind === 'flare') {
    pr.vy -= 14 * dt;
    pr.vx *= Math.exp(-1.2 * dt);
    pr.vz *= Math.exp(-1.2 * dt);
    const floorY = getTerrainHeight(pr.x, pr.z, world.mountains) + 1;
    if (pr.y < floorY) {
      pr.active = false;
    }
  }
}

export function createParticlePool(capacity: number): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < capacity; i++) {
    pool.push({
      kind: 'smoke',
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 1,
      maxScale: 1,
      life: 0,
      maxLife: 1,
      colorIndex: 0,
      active: false,
    });
  }
  return pool;
}

export function createProjectilePool(capacity: number): Projectile[] {
  const pool: Projectile[] = [];
  for (let i = 0; i < capacity; i++) {
    pool.push({
      id: i + 1,
      kind: 'cannon',
      friendly: true,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      damage: 10,
      radius: 2,
      targetId: null,
      decoyedByFlare: false,
      trailTimer: 0,
      active: false,
    });
  }
  return pool;
}
