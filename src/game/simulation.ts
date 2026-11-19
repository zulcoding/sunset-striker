import type {
  AircraftLoadoutId,
  AircraftState,
  CameraMode,
  EnemyEntity,
  GamePhase,
  HudSnapshot,
  InputState,
  LevelConfig,
  LevelId,
  Particle,
  ParticleKind,
  PickupKind,
  Projectile,
  RunSummary,
  SimulationEvent,
  SupplyPickup,
  Vec3,
  WorldData,
} from './types';
import {
  acquireLockTarget,
  buildRadarBlips,
  createParticlePool,
  createProjectilePool,
  ENEMY_LABEL_TABLE,
  ENEMY_SCORE_TABLE,
  spawnWaveEnemies,
  stepEnemies,
  updateProjectileGuidance,
} from './combatRules';
import {
  createInitialAircraft,
  getForwardVector,
  stepAircraftPhysics,
  yawToHeadingDegrees,
} from './flightPhysics';
import { getLevelConfig, getLoadoutSpec, LEVEL_CONFIGS } from './levels';
import { checkBuildingCollision, generateWorld, getTerrainHeight } from './worldGen';

export const MAX_DT = 0.05;
export const PROJECTILE_POOL_SIZE = 160;
export const PARTICLE_POOL_SIZE = 520;

export function createEmptyInput(): InputState {
  return {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    yawLeft: false,
    yawRight: false,
    throttleUp: false,
    throttleDown: false,
    afterburner: false,
    fireCannon: false,
    fireRocket: false,
    deployFlare: false,
    pointerSteerX: 0,
    pointerSteerY: 0,
  };
}

export interface StartGameOptions {
  cameraMode?: CameraMode;
  levelId?: LevelId;
  loadout?: AircraftLoadoutId;
  startWaveIndex?: number;
}

export class FlightSimulation {
  world: WorldData;
  levelConfig: LevelConfig;
  phase: GamePhase = 'title';
  cameraMode: CameraMode = 'chase';
  loadout: AircraftLoadoutId = 'warthog';
  aircraft: AircraftState;
  enemies: EnemyEntity[] = [];
  pickups: SupplyPickup[] = [];
  readonly projectiles: Projectile[];
  readonly particles: Particle[];

  score = 0;
  bestScore = 0;
  combo = 1;
  comboTimer = 0;
  waveIndex = 0;
  waveTotalEnemies = 0;
  kills = 0;
  elapsedTime = 0;
  hitstopTimer = 0;
  trauma = 0;
  flashBloom = 0;
  bannerText: string | null = null;
  bannerTimer = 0;
  defeatDelayTimer = 0;
  pendingDefeat = false;
  runSummary: RunSummary | null = null;
  lockedTargetId: number | null = null;
  worldRevision = 1;

  private activeAttackTokens = 0;
  private nextEnemyId = 1;
  private nextPickupId = 1;
  private nextProjectileCursor = 0;
  private nextParticleCursor = 0;
  private eventQueue: SimulationEvent[] = [];
  private ambientSamTimer = 1.4;

  constructor(seed?: number, initialBestScore = 0, initialLevel: LevelId = 1) {
    this.levelConfig = getLevelConfig(initialLevel);
    this.world = generateWorld(seed ?? this.levelConfig.seed);
    this.bestScore = initialBestScore;
    this.aircraft = createInitialAircraft(this.loadout);
    this.projectiles = createProjectilePool(PROJECTILE_POOL_SIZE);
    this.particles = createParticlePool(PARTICLE_POOL_SIZE);
    this.loadWave(0);
  }

  selectLevel(levelId: LevelId): boolean {
    if (this.levelConfig.id === levelId) return false;
    this.levelConfig = getLevelConfig(levelId);
    this.world = generateWorld(this.levelConfig.seed);
    this.worldRevision += 1;
    this.loadWave(0);
    return true;
  }

  selectLoadout(loadout: AircraftLoadoutId): void {
    this.loadout = loadout;
    if (this.phase === 'title') {
      this.aircraft = createInitialAircraft(loadout);
    }
  }

  startGame(options?: CameraMode | StartGameOptions): void {
    const opts: StartGameOptions =
      typeof options === 'string' ? { cameraMode: options } : (options ?? {});

    if (opts.cameraMode) {
      this.cameraMode = opts.cameraMode;
    }
    if (opts.loadout) {
      this.loadout = opts.loadout;
    }
    if (opts.levelId && opts.levelId !== this.levelConfig.id) {
      this.selectLevel(opts.levelId);
    }

    this.phase = 'playing';
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.kills = 0;
    this.elapsedTime = 0;
    this.hitstopTimer = 0;
    this.trauma = 0;
    this.flashBloom = 0;
    this.pendingDefeat = false;
    this.defeatDelayTimer = 0;
    this.runSummary = null;
    this.activeAttackTokens = 0;
    this.pickups = [];
    this.clearPools();
    this.aircraft = createInitialAircraft(this.loadout);

    const waveStart = Math.max(
      0,
      Math.min(this.levelConfig.waves.length - 1, opts.startWaveIndex ?? 0),
    );
    this.loadWave(waveStart);
    const waveCfg = this.levelConfig.waves[waveStart];
    this.showBanner(`${this.levelConfig.code} · ${waveCfg.name}`, 2.6);
  }

  returnToTitle(): void {
    this.phase = 'title';
    this.pendingDefeat = false;
    this.defeatDelayTimer = 0;
    this.runSummary = null;
    this.pickups = [];
    this.clearPools();
    this.aircraft = createInitialAircraft(this.loadout);
    this.loadWave(0);
  }

  togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
    }
  }

  cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'cockpit', 'topdown'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    return this.cameraMode;
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  drainEvents(): SimulationEvent[] {
    if (this.eventQueue.length === 0) return [];
    const copy = this.eventQueue;
    this.eventQueue = [];
    return copy;
  }

  private emit(ev: SimulationEvent): void {
    this.eventQueue.push(ev);
  }

  private showBanner(text: string, duration = 2.2): void {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  private clearPools(): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].active = false;
    }
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }
  }

  private loadWave(index: number): void {
    this.waveIndex = index;
    const cfg = this.levelConfig.waves[index];
    this.enemies = spawnWaveEnemies(cfg, this.world, this.nextEnemyId);
    this.nextEnemyId += this.enemies.length + 10;
    this.waveTotalEnemies = this.enemies.length;
    this.activeAttackTokens = 0;
  }

  spawnPickup(kind: PickupKind, x: number, y: number, z: number): SupplyPickup {
    const floor = getTerrainHeight(x, z, this.world.mountains);
    const pickup: SupplyPickup = {
      id: this.nextPickupId++,
      kind,
      x,
      y: Math.max(floor + 26, Math.min(96, y + 18)),
      z,
      life: 24,
      maxLife: 24,
      bobPhase: Math.random() * Math.PI * 2,
      active: true,
    };
    this.pickups.push(pickup);
    return pickup;
  }

  spawnProjectile = (
    kind: Projectile['kind'],
    friendly: boolean,
    pos: Vec3,
    vel: Vec3,
    damage: number,
    radius: number,
    maxLife: number,
    targetId: number | null,
  ): void => {
    const pr = this.projectiles[this.nextProjectileCursor];
    this.nextProjectileCursor = (this.nextProjectileCursor + 1) % this.projectiles.length;
    pr.kind = kind;
    pr.friendly = friendly;
    pr.x = pos.x;
    pr.y = pos.y;
    pr.z = pos.z;
    pr.vx = vel.x;
    pr.vy = vel.y;
    pr.vz = vel.z;
    pr.damage = damage;
    pr.radius = radius;
    pr.life = maxLife;
    pr.maxLife = maxLife;
    pr.targetId = targetId;
    pr.decoyedByFlare = false;
    pr.trailTimer = 0;
    pr.active = true;
  };

  spawnParticle = (
    kind: ParticleKind,
    pos: Vec3,
    vel: Vec3,
    scale: number,
    maxScale: number,
    maxLife: number,
    colorIndex: number,
  ): void => {
    const pt = this.particles[this.nextParticleCursor];
    this.nextParticleCursor = (this.nextParticleCursor + 1) % this.particles.length;
    pt.kind = kind;
    pt.x = pos.x;
    pt.y = pos.y;
    pt.z = pos.z;
    pt.vx = vel.x;
    pt.vy = vel.y;
    pt.vz = vel.z;
    pt.scale = scale;
    pt.maxScale = maxScale;
    pt.life = maxLife;
    pt.maxLife = maxLife;
    pt.colorIndex = colorIndex;
    pt.active = true;
  };

  spawnExplosion(x: number, y: number, z: number, big = false): void {
    const count = big ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const elev = (Math.random() - 0.35) * Math.PI * 0.65;
      const spd = (big ? 16 : 10) + Math.random() * (big ? 22 : 14);
      this.spawnParticle(
        i % 3 === 0 ? 'smoke' : 'fire',
        {
          x: x + (Math.random() - 0.5) * 3,
          y: y + (Math.random() - 0.5) * 3,
          z: z + (Math.random() - 0.5) * 3,
        },
        {
          x: Math.cos(ang) * Math.cos(elev) * spd,
          y: Math.sin(elev) * spd + 4,
          z: Math.sin(ang) * Math.cos(elev) * spd,
        },
        big ? 2.6 : 1.7,
        big ? 8.5 : 5.8,
        big ? 0.72 + Math.random() * 0.35 : 0.45 + Math.random() * 0.25,
        i % 3,
      );
    }
    const distToPlane = Math.hypot(x - this.aircraft.x, y - this.aircraft.y, z - this.aircraft.z);
    if (distToPlane < 48) {
      this.flashBloom = Math.max(this.flashBloom, (1 - distToPlane / 48) * 0.65);
    }
    this.trauma = Math.min(1, this.trauma + (big ? 0.5 : 0.25));
  }

  fireCannon(): boolean {
    if (this.phase !== 'playing' || this.pendingDefeat) return false;
    if (this.aircraft.cannonCooldown > 0) return false;

    const spec = getLoadoutSpec(this.aircraft.loadout);
    this.aircraft.cannonCooldown = spec.cannonCooldown;
    this.aircraft.muzzleFlashTimer = 0.05;
    const fwd = getForwardVector(this.aircraft.yaw, this.aircraft.pitch);
    const boltSpeed = 250 + this.aircraft.speed;
    let aimX = fwd.x;
    let aimY = fwd.y;
    let aimZ = fwd.z;

    // Smart arcade cannon convergence toward locked target when inside forward cone (~26 deg)
    const locked = acquireLockTarget(this.aircraft, this.enemies, 360, 0.86);
    if (locked) {
      const dist = Math.hypot(
        locked.x - this.aircraft.x,
        locked.y - this.aircraft.y,
        locked.z - this.aircraft.z,
      );
      const leadT = Math.min(0.85, dist / boltSpeed);
      const tx = locked.x + locked.vx * leadT - this.aircraft.x;
      const ty = locked.y + locked.vy * leadT - this.aircraft.y;
      const tz = locked.z + locked.vz * leadT - this.aircraft.z;
      const tLen = Math.max(1, Math.hypot(tx, ty, tz));
      const nx = tx / tLen;
      const ny = ty / tLen;
      const nz = tz / tLen;
      // Blend strongly toward target lead so keyboard strafing feels crisp & rewarding
      const bx = aimX * 0.18 + nx * 0.82;
      const by = aimY * 0.18 + ny * 0.82;
      const bz = aimZ * 0.18 + nz * 0.82;
      const bLen = Math.max(0.001, Math.hypot(bx, by, bz));
      aimX = bx / bLen;
      aimY = by / bLen;
      aimZ = bz / bLen;
    }

    const spread = 0.01;
    const vx = (aimX + (Math.random() - 0.5) * spread) * boltSpeed;
    const vy = (aimY + (Math.random() - 0.5) * spread) * boltSpeed;
    const vz = (aimZ + (Math.random() - 0.5) * spread) * boltSpeed;

    this.spawnProjectile(
      'cannon',
      true,
      {
        x: this.aircraft.x + fwd.x * 5.2,
        y: this.aircraft.y + fwd.y * 5.2 - 0.4,
        z: this.aircraft.z + fwd.z * 5.2,
      },
      { x: vx, y: vy, z: vz },
      spec.cannonDamage,
      4.4,
      1.75,
      null,
    );
    this.emit({ type: 'cannon', intensity: 0.4 });
    return true;
  }

  fireRocket(): boolean {
    if (this.phase !== 'playing' || this.pendingDefeat) return false;
    if (this.aircraft.rocketCooldown > 0 || this.aircraft.rockets <= 0) return false;

    const spec = getLoadoutSpec(this.aircraft.loadout);
    this.aircraft.rocketCooldown = spec.rocketCooldown;
    this.aircraft.rockets -= 1;
    const fwd = getForwardVector(this.aircraft.yaw, this.aircraft.pitch);
    const sideSign = this.aircraft.rockets % 2 === 0 ? 1 : -1;
    const rightX = Math.cos(this.aircraft.yaw) * sideSign * 2.6;
    const rightZ = -Math.sin(this.aircraft.yaw) * sideSign * 2.6;

    const locked = acquireLockTarget(this.aircraft, this.enemies);
    const rocketSpeed = 160;
    this.spawnProjectile(
      'rocket',
      true,
      {
        x: this.aircraft.x + rightX + fwd.x * 2.5,
        y: this.aircraft.y - 0.8,
        z: this.aircraft.z + rightZ + fwd.z * 2.5,
      },
      {
        x: fwd.x * rocketSpeed,
        y: fwd.y * rocketSpeed,
        z: fwd.z * rocketSpeed,
      },
      spec.rocketDamage,
      7.0,
      4.0,
      locked ? locked.id : null,
    );
    this.trauma = Math.min(1, this.trauma + 0.12);
    this.emit({ type: 'rocket', intensity: 0.7 });
    return true;
  }

  deployFlares(): boolean {
    if (this.phase !== 'playing' || this.pendingDefeat) return false;
    if (this.aircraft.flareCooldown > 0 || this.aircraft.flares <= 0) return false;

    this.aircraft.flareCooldown = 1.6;
    this.aircraft.flares -= 1;
    const fwd = getForwardVector(this.aircraft.yaw, this.aircraft.pitch);
    for (let i = -1; i <= 1; i += 2) {
      const rightX = Math.cos(this.aircraft.yaw) * i;
      const rightZ = -Math.sin(this.aircraft.yaw) * i;
      this.spawnProjectile(
        'flare',
        true,
        {
          x: this.aircraft.x - fwd.x * 3,
          y: this.aircraft.y - 0.5,
          z: this.aircraft.z - fwd.z * 3,
        },
        {
          x: this.aircraft.vx * 0.35 + rightX * 16,
          y: -6,
          z: this.aircraft.vz * 0.35 + rightZ * 16,
        },
        0,
        3.0,
        3.4,
        null,
      );
    }
    this.emit({ type: 'flare', intensity: 0.6 });
    return true;
  }

  damagePlayer(amount: number): void {
    if (this.phase !== 'playing' || this.pendingDefeat) return;
    if (this.aircraft.invulnTimer > 0) return;

    this.aircraft.hull = Math.max(0, this.aircraft.hull - amount);
    this.aircraft.invulnTimer = 0.95;
    this.aircraft.hitFlashTimer = 0.16;
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.035);
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.flashBloom = Math.max(this.flashBloom, 0.32);
    this.combo = 1;
    this.comboTimer = 0;
    this.emit({ type: 'player_hit', intensity: Math.min(1, amount / 25) });

    if (this.aircraft.hull <= 0) {
      this.pendingDefeat = true;
      this.defeatDelayTimer = 0.55;
      this.spawnExplosion(this.aircraft.x, this.aircraft.y, this.aircraft.z, true);
      this.emit({ type: 'defeat', intensity: 1.0 });
    }
  }

  private damageEnemy(enemy: EnemyEntity, amount: number): void {
    if (!enemy.alive || enemy.koTimer > 0) return;
    enemy.hp -= amount;
    enemy.hitFlashTimer = 0.07;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.koTimer = enemy.archetype === 'carrier' ? 1.15 : 0.42;
      this.kills += 1;
      this.comboTimer = 5.5;
      const basePoints = ENEMY_SCORE_TABLE[enemy.archetype];
      const earned = Math.round(basePoints * this.combo);
      this.score += earned;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
      }
      this.combo = Math.min(8, this.combo + 1);
      this.hitstopTimer = Math.max(this.hitstopTimer, enemy.archetype === 'carrier' ? 0.08 : 0.04);
      this.spawnExplosion(enemy.x, enemy.y + 1.5, enemy.z, true);

      // Drop mid-air Repair or Ordnance supply crates from destroyed Radars / Gunboats / Bandits
      if (enemy.archetype === 'radar') {
        this.spawnPickup('repair', enemy.x, enemy.y, enemy.z);
      } else if (enemy.archetype === 'gunboat' || (enemy.archetype === 'bandit' && this.kills % 2 === 0)) {
        const dropKind: PickupKind =
          this.aircraft.hull < this.aircraft.maxHull * 0.65 ? 'repair' : 'ordnance';
        this.spawnPickup(dropKind, enemy.x, enemy.y, enemy.z);
      }

      this.emit({
        type: 'kill_enemy',
        intensity: enemy.archetype === 'carrier' || enemy.archetype === 'radar' ? 1.0 : 0.75,
        x: enemy.x,
        y: enemy.y,
        z: enemy.z,
      });
    } else {
      this.emit({ type: 'hit_enemy', intensity: 0.4, x: enemy.x, y: enemy.y, z: enemy.z });
    }
  }

  private finishRun(victory: boolean): void {
    this.phase = 'gameover';
    this.pendingDefeat = false;
    const boss = this.enemies.find((e) => e.archetype === 'carrier' && e.alive);
    this.runSummary = {
      victory,
      levelId: this.levelConfig.id,
      levelName: this.levelConfig.name,
      hasNextLevel: this.levelConfig.id < LEVEL_CONFIGS.length,
      score: this.score,
      bestScore: Math.max(this.bestScore, this.score),
      waveReached: this.waveIndex + 1,
      maxWaves: this.levelConfig.waves.length,
      kills: this.kills,
      elapsedSeconds: Math.round(this.elapsedTime),
      hullRemaining: Math.round(this.aircraft.hull),
      maxHull: this.aircraft.maxHull,
      bossHpRemaining: boss ? Math.round(boss.hp) : 0,
    };
  }

  step(rawDt: number, input: InputState): void {
    const dt = Math.min(Math.max(rawDt, 0), MAX_DT);
    if (this.phase === 'paused' || this.phase === 'gameover') {
      return;
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.45);
    this.flashBloom = Math.max(0, this.flashBloom - dt * 1.9);
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer === 0) this.bannerText = null;
    }

    for (let i = 0; i < this.world.clouds.length; i++) {
      const c = this.world.clouds[i];
      c.x += c.driftSpeed * dt;
      if (c.x > 520) c.x = -520;
    }

    // Title screen live scenic flyover
    if (this.phase === 'title') {
      this.elapsedTime += dt;
      const orbitAngle = this.elapsedTime * 0.17 + 0.7;
      const radius = 148;
      const nextX = 25 + Math.cos(orbitAngle) * radius;
      const nextZ = 15 + Math.sin(orbitAngle) * radius;
      const vx = (nextX - this.aircraft.x) / Math.max(0.016, dt);
      const vz = (nextZ - this.aircraft.z) / Math.max(0.016, dt);
      this.aircraft.x = nextX;
      this.aircraft.z = nextZ;
      this.aircraft.y = 66 + Math.sin(this.elapsedTime * 0.45) * 8;
      this.aircraft.yaw = Math.atan2(-vx, -vz);
      this.aircraft.roll = 0.28;
      this.aircraft.pitch = Math.cos(this.elapsedTime * 0.45) * 0.05;
      this.aircraft.speed = 56;
      this.aircraft.throttle = 0.65;

      this.ambientSamTimer -= dt;
      if (this.ambientSamTimer <= 0 && this.world.helipadSpots.length > 0) {
        this.ambientSamTimer = 2.6;
        const spot =
          this.world.helipadSpots[Math.floor(this.elapsedTime * 2) % this.world.helipadSpots.length];
        this.spawnProjectile(
          'sam',
          false,
          { x: spot.x, y: spot.y + 2, z: spot.z },
          { x: 24, y: 58, z: 22 },
          0,
          2,
          3.4,
          null,
        );
      }
      this.stepProjectiles(dt, true);
      this.stepParticles(dt);
      return;
    }

    if (this.pendingDefeat) {
      this.defeatDelayTimer -= dt;
      this.stepParticles(dt);
      if (this.defeatDelayTimer <= 0) {
        this.finishRun(false);
      }
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.stepParticles(dt * 0.25);
      return;
    }

    this.elapsedTime += dt;

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) {
        this.combo = 1;
      }
    }

    // Aircraft physics + Afterburner Boost
    const terrainH = getTerrainHeight(
      this.aircraft.x,
      this.aircraft.z,
      this.world.mountains,
    );
    const { scrapedTerrain, afterburnerEngaged } = stepAircraftPhysics(
      this.aircraft,
      input,
      dt,
      this.cameraMode,
      terrainH,
    );

    if (afterburnerEngaged) {
      this.emit({ type: 'afterburner', intensity: 0.7 });
      this.trauma = Math.min(1, this.trauma + 0.12);
    }

    if (this.aircraft.afterburnerActive && Math.random() < 0.45) {
      const fwd = getForwardVector(this.aircraft.yaw, this.aircraft.pitch);
      this.spawnParticle(
        'flare_smoke',
        {
          x: this.aircraft.x - fwd.x * 4.5,
          y: this.aircraft.y + 0.5,
          z: this.aircraft.z - fwd.z * 4.5,
        },
        { x: -fwd.x * 8, y: 0, z: -fwd.z * 8 },
        1.1,
        2.8,
        0.38,
        0,
      );
    }

    if (scrapedTerrain) {
      this.damagePlayer(6);
    }

    const hitBuilding = checkBuildingCollision(
      this.aircraft.x,
      this.aircraft.y,
      this.aircraft.z,
      2.6,
      this.world.buildings,
      this.world.mountains,
    );
    if (hitBuilding) {
      const roofY =
        getTerrainHeight(hitBuilding.x, hitBuilding.z, this.world.mountains) +
        hitBuilding.height;
      this.aircraft.y = Math.max(this.aircraft.y, roofY + 7.5);
      this.aircraft.pitch = Math.max(this.aircraft.pitch, 0.24);
      this.damagePlayer(10);
      this.spawnExplosion(this.aircraft.x, this.aircraft.y - 3, this.aircraft.z, false);
    }

    if (input.fireCannon) this.fireCannon();
    if (input.fireRocket) this.fireRocket();
    if (input.deployFlare) this.deployFlares();

    const lockedTarget = acquireLockTarget(this.aircraft, this.enemies);
    this.lockedTargetId = lockedTarget ? lockedTarget.id : null;

    const waveConfig = this.levelConfig.waves[this.waveIndex];
    this.activeAttackTokens = stepEnemies(
      {
        plane: this.aircraft,
        enemies: this.enemies,
        waveConfig,
        activeTokens: this.activeAttackTokens,
        spawnProjectile: this.spawnProjectile,
        spawnParticle: this.spawnParticle,
        emitEvent: (ev) => this.emit(ev),
      },
      dt,
    );

    this.stepPickups(dt);
    this.stepProjectiles(dt, false);
    this.stepParticles(dt);

    // Wave completion check
    const remaining = this.enemies.filter((e) => e.alive).length;
    if (remaining === 0) {
      if (this.waveIndex + 1 < this.levelConfig.waves.length) {
        this.aircraft.hull = Math.min(this.aircraft.maxHull, this.aircraft.hull + 25);
        this.aircraft.rockets = this.aircraft.maxRockets;
        this.aircraft.flares = this.aircraft.maxFlares;
        this.loadWave(this.waveIndex + 1);
        const nextCfg = this.levelConfig.waves[this.waveIndex];
        this.showBanner(`Wave ${nextCfg.wave} · ${nextCfg.name}`, 2.8);
        this.emit({ type: 'wave_clear', intensity: 1.0 });
      } else {
        this.emit({ type: 'victory', intensity: 1.0 });
        this.finishRun(true);
      }
    }
  }

  private stepPickups(dt: number): void {
    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i];
      if (!pk.active) continue;
      pk.life -= dt;
      pk.bobPhase += dt * 3.2;
      if (pk.life <= 0) {
        pk.active = false;
        continue;
      }

      const dist = Math.hypot(
        pk.x - this.aircraft.x,
        pk.y - this.aircraft.y,
        pk.z - this.aircraft.z,
      );
      if (dist <= 16.5) {
        pk.active = false;
        if (pk.kind === 'repair') {
          this.aircraft.hull = Math.min(this.aircraft.maxHull, this.aircraft.hull + 25);
          this.showBanner('HULL REPAIRED +25', 1.6);
        } else {
          this.aircraft.rockets = Math.min(this.aircraft.maxRockets, this.aircraft.rockets + 4);
          this.aircraft.flares = Math.min(this.aircraft.maxFlares, this.aircraft.flares + 2);
          this.aircraft.afterburnerFuel = 1.0;
          this.aircraft.afterburnerOverheated = false;
          this.showBanner('ORDNANCE RESUPPLIED', 1.6);
        }
        this.score += 150;
        if (this.score > this.bestScore) this.bestScore = this.score;
        this.emit({ type: 'pickup', intensity: 0.7 });
      }
    }
    if (this.pickups.length > 24) {
      this.pickups = this.pickups.filter((p) => p.active);
    }
  }

  private stepProjectiles(dt: number, titleMode: boolean): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const pr = this.projectiles[i];
      if (!pr.active) continue;

      pr.life -= dt;
      if (pr.life <= 0) {
        if (pr.kind === 'flak' || pr.kind === 'sam') {
          this.spawnExplosion(pr.x, pr.y, pr.z, false);
        }
        pr.active = false;
        continue;
      }

      if (!titleMode) {
        updateProjectileGuidance(
          pr,
          this.aircraft,
          this.enemies,
          this.projectiles,
          dt,
          this.world,
        );
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;

      if (pr.kind === 'sam' || pr.kind === 'rocket' || pr.kind === 'flare') {
        pr.trailTimer -= dt;
        const interval = pr.kind === 'sam' ? 0.028 : 0.036;
        if (pr.trailTimer <= 0) {
          pr.trailTimer = interval;
          this.spawnParticle(
            pr.kind === 'flare' ? 'flare_smoke' : 'smoke',
            { x: pr.x, y: pr.y, z: pr.z },
            { x: (Math.random() - 0.5) * 1.4, y: 0.6, z: (Math.random() - 0.5) * 1.4 },
            pr.kind === 'sam' ? 1.55 : 1.25,
            pr.kind === 'sam' ? 4.4 : 3.2,
            pr.kind === 'sam' ? 2.4 : 1.15,
            pr.kind === 'flare' ? 1 : 0,
          );
        }
      }

      const groundH = getTerrainHeight(pr.x, pr.z, this.world.mountains);
      if (pr.y <= groundH + 0.5) {
        if (pr.kind === 'rocket' || pr.kind === 'sam') {
          this.spawnExplosion(pr.x, groundH + 1, pr.z, false);
        }
        pr.active = false;
        continue;
      }

      if (titleMode) continue;

      if (pr.friendly && pr.kind !== 'flare') {
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (!e.alive || e.koTimer > 0) continue;
          const dist = Math.hypot(pr.x - e.x, pr.y - e.y, pr.z - e.z);
          if (dist <= e.radius + pr.radius) {
            this.damageEnemy(e, pr.damage);
            if (pr.kind === 'rocket') {
              this.spawnExplosion(pr.x, pr.y, pr.z, true);
              this.emit({ type: 'explosion_big', x: pr.x, y: pr.y, z: pr.z });
            } else {
              this.spawnParticle(
                'spark',
                { x: pr.x, y: pr.y, z: pr.z },
                { x: (Math.random() - 0.5) * 18, y: 6 + Math.random() * 10, z: (Math.random() - 0.5) * 18 },
                1.2,
                3.2,
                0.28,
                0,
              );
            }
            pr.active = false;
            break;
          }
        }
      } else if (!pr.friendly) {
        const dist = Math.hypot(
          pr.x - this.aircraft.x,
          pr.y - this.aircraft.y,
          pr.z - this.aircraft.z,
        );
        if (dist <= pr.radius + 4.0) {
          this.damagePlayer(pr.damage);
          this.spawnExplosion(pr.x, pr.y, pr.z, pr.kind === 'sam');
          pr.active = false;
        }
      }
    }
  }

  private stepParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vx *= Math.exp(-1.4 * dt);
      pt.vy *= Math.exp(-1.1 * dt);
      pt.vz *= Math.exp(-1.4 * dt);
      const t = 1 - pt.life / pt.maxLife;
      pt.scale = pt.scale + (pt.maxScale - pt.scale) * Math.min(1, t * 2.5) * dt * 4;
    }
  }

  getHudSnapshot(): HudSnapshot {
    const waveCfg = this.levelConfig.waves[this.waveIndex];
    const remaining = this.enemies.filter((e) => e.alive && e.koTimer <= 0).length;
    const boss = this.enemies.find((e) => e.archetype === 'carrier' && e.alive && e.koTimer <= 0);

    let missileWarning = false;
    for (let i = 0; i < this.projectiles.length; i++) {
      const pr = this.projectiles[i];
      if (pr.active && pr.kind === 'sam' && !pr.decoyedByFlare) {
        const d = Math.hypot(
          pr.x - this.aircraft.x,
          pr.y - this.aircraft.y,
          pr.z - this.aircraft.z,
        );
        if (d < 230) {
          missileWarning = true;
          break;
        }
      }
    }

    let lockWarning = false;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (
        e.alive &&
        (e.archetype === 'sam' || e.archetype === 'carrier') &&
        e.telegraphTimer > 0
      ) {
        lockWarning = true;
        break;
      }
    }

    const lockedEnemy =
      this.lockedTargetId !== null
        ? this.enemies.find((e) => e.id === this.lockedTargetId && e.alive && e.koTimer <= 0) ?? null
        : null;

    const lockedDist = lockedEnemy
      ? Math.round(
          Math.hypot(
            lockedEnemy.x - this.aircraft.x,
            lockedEnemy.y - this.aircraft.y,
            lockedEnemy.z - this.aircraft.z,
          ),
        )
      : 0;

    return {
      phase: this.phase,
      cameraMode: this.cameraMode,
      levelId: this.levelConfig.id,
      levelCode: this.levelConfig.code,
      levelName: this.levelConfig.name,
      loadout: this.aircraft.loadout,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      combo: this.combo,
      comboTimer: this.comboTimer,
      wave: waveCfg.wave,
      maxWaves: this.levelConfig.waves.length,
      waveName: waveCfg.name,
      enemiesRemaining: remaining,
      enemiesTotal: this.waveTotalEnemies,
      bossName: boss ? 'SKY CARRIER AEGIS-09' : null,
      bossHp: boss ? Math.round(boss.hp) : 0,
      bossMaxHp: boss ? boss.maxHp : 0,
      hull: Math.round(this.aircraft.hull),
      maxHull: this.aircraft.maxHull,
      afterburnerPct: Math.round(this.aircraft.afterburnerFuel * 100),
      afterburnerActive: this.aircraft.afterburnerActive,
      afterburnerOverheated: this.aircraft.afterburnerOverheated,
      speedKnots: Math.round(this.aircraft.speed * 5.6),
      altitudeFeet: Math.round(this.aircraft.y * 4.8),
      headingDeg: Math.round(yawToHeadingDegrees(this.aircraft.yaw)),
      throttlePct: Math.round(this.aircraft.throttle * 100),
      pitchRad: this.aircraft.pitch,
      rollRad: this.aircraft.roll,
      rockets: this.aircraft.rockets,
      maxRockets: this.aircraft.maxRockets,
      flares: this.aircraft.flares,
      maxFlares: this.aircraft.maxFlares,
      flareReady: this.aircraft.flareCooldown <= 0 && this.aircraft.flares > 0,
      missileWarning,
      lockWarning,
      lockedTargetId: this.lockedTargetId,
      lockedTargetScreenHint: lockedEnemy
        ? { x: lockedEnemy.x, y: lockedEnemy.y, z: lockedEnemy.z }
        : null,
      lockedTargetLabel: lockedEnemy ? ENEMY_LABEL_TABLE[lockedEnemy.archetype] : null,
      lockedTargetDistance: lockedDist,
      elapsedTime: this.elapsedTime,
      kills: this.kills,
      radarBlips: buildRadarBlips(
        this.aircraft,
        this.enemies,
        this.projectiles,
        this.pickups,
        this.lockedTargetId,
      ),
      bannerText: this.bannerText,
    };
  }
}
