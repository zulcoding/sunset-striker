export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'chase' | 'cockpit' | 'topdown';

export type LevelId = 1 | 2 | 3 | 4 | 5;

export type AircraftLoadoutId = 'warthog' | 'falcon' | 'rook' | 'raptor';

export type EnemyArchetype = 'sam' | 'gunboat' | 'bandit' | 'radar' | 'carrier';

export type PickupKind = 'repair' | 'ordnance';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface LevelTheme {
  skyHorizon: [number, number, number];
  skyMid: [number, number, number];
  skyUpper: [number, number, number];
  skyZenith: [number, number, number];
  sunRayColor: [number, number, number];
  waterShallow: [number, number, number];
  waterMid: [number, number, number];
  waterDeep: [number, number, number];
  fogColor: string;
  cloudShadow: [number, number, number];
  cloudMid: [number, number, number];
  cloudTop: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  sunLightColor: number;
  sunLightIntensity: number;
  windowEmissiveIntensity: number;
}

export interface WaveConfig {
  wave: number;
  name: string;
  sams: number;
  gunboats: number;
  bandits: number;
  radars: number;
  carriers: number;
  samCadenceScale: number;
  maxAttackTokens: number;
}

export interface LevelConfig {
  id: LevelId;
  code: string;
  name: string;
  subtitle: string;
  seed: number;
  theme: LevelTheme;
  waves: readonly WaveConfig[];
}

export interface WorldBuilding {
  id: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  styleIndex: number; // 0: slate-blue, 1: dark indigo, 2: steel grey, 3: warm terracotta
  hasHelipad: boolean;
  hasSpire: boolean;
}

export interface WorldPark {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface WorldMountain {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  height: number;
  conical: boolean;
  snowCap: boolean;
  hue: 'slate' | 'olive' | 'golden';
}

export interface WorldTree {
  x: number;
  y: number;
  z: number;
  scale: number;
  colorIndex: number; // 0: autumn orange, 1: burnt sienna, 2: golden ochre, 3: emerald green
}

export interface WorldCloud {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  driftSpeed: number;
}

export interface WorldData {
  seed: number;
  worldRadius: number;
  buildings: WorldBuilding[];
  parks: WorldPark[];
  mountains: WorldMountain[];
  trees: WorldTree[];
  clouds: WorldCloud[];
  helipadSpots: Vec3[];
  gunboatSpawns: Vec3[];
  radarSpots: Vec3[];
}

export interface AircraftState {
  loadout: AircraftLoadoutId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;   // radians, 0 = -Z forward
  pitch: number; // radians, + = nose up
  roll: number;  // radians, + = roll left (CCW around forward axis)
  rollRate: number;  // smoothed rad/s for silky banking
  pitchRate: number; // smoothed rad/s for silky pitch response
  speed: number;
  throttle: number; // 0.25 .. 1.0
  afterburnerFuel: number; // 0..1
  afterburnerActive: boolean;
  afterburnerOverheated: boolean;
  hull: number;
  maxHull: number;
  invulnTimer: number;
  cannonCooldown: number;
  rocketCooldown: number;
  rockets: number;
  maxRockets: number;
  rocketRegenTimer: number;
  flareCooldown: number;
  flares: number;
  maxFlares: number;
  flareRegenTimer: number;
  muzzleFlashTimer: number;
  hitFlashTimer: number;
}

export interface EnemyEntity {
  id: number;
  archetype: EnemyArchetype;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  roll: number;
  hp: number;
  maxHp: number;
  radius: number;
  fireCooldown: number;
  telegraphTimer: number; // > 0 means charging/locking before firing
  telegraphDuration: number;
  hasAttackToken: boolean;
  patrolAngle: number;
  patrolCenterX: number;
  patrolCenterZ: number;
  patrolRadius: number;
  hitFlashTimer: number;
  koTimer: number; // > 0 means dying animation before removal
  alive: boolean;
}

export interface SupplyPickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  bobPhase: number;
  active: boolean;
}

export type ProjectileKind = 'cannon' | 'rocket' | 'sam' | 'flak' | 'bandit_bolt' | 'flare';

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  friendly: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  damage: number;
  radius: number;
  targetId: number | null; // enemy id for friendly rocket, -1 for player, or flare id when decoyed
  decoyedByFlare: boolean;
  trailTimer: number;
  active: boolean;
}

export type ParticleKind = 'smoke' | 'fire' | 'spark' | 'flak_puff' | 'flare_smoke' | 'water_wake';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  maxScale: number;
  life: number;
  maxLife: number;
  colorIndex: number;
  active: boolean;
}

export interface InputState {
  pitchUp: boolean;
  pitchDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  throttleUp: boolean;
  throttleDown: boolean;
  afterburner: boolean;
  fireCannon: boolean;
  fireRocket: boolean;
  deployFlare: boolean;
  pointerSteerX: number; // -1..1 optional pointer assist
  pointerSteerY: number; // -1..1
}

export interface SimulationEvent {
  type:
    | 'cannon'
    | 'rocket'
    | 'flare'
    | 'afterburner'
    | 'pickup'
    | 'sam_lock'
    | 'sam_launch'
    | 'hit_enemy'
    | 'kill_enemy'
    | 'player_hit'
    | 'explosion_big'
    | 'wave_clear'
    | 'victory'
    | 'defeat';
  intensity?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface RadarBlip {
  relX: number; // -1..1 normalized to radar radius
  relZ: number; // -1..1 normalized to radar radius (-1 = ahead)
  kind: EnemyArchetype | 'sam_missile' | 'pickup';
  locked: boolean;
}

export interface TargetReticleHint {
  screenX: number; // 0..100 viewport %
  screenY: number; // 0..100 viewport %
  label: string;
  distanceM: number;
  visible: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  cameraMode: CameraMode;
  levelId: LevelId;
  levelCode: string;
  levelName: string;
  loadout: AircraftLoadoutId;
  score: number;
  bestScore: number;
  combo: number;
  comboTimer: number;
  wave: number;
  maxWaves: number;
  waveName: string;
  enemiesRemaining: number;
  enemiesTotal: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  hull: number;
  maxHull: number;
  afterburnerPct: number;
  afterburnerActive: boolean;
  afterburnerOverheated: boolean;
  speedKnots: number;
  altitudeFeet: number;
  headingDeg: number;
  throttlePct: number;
  pitchRad: number;
  rollRad: number;
  rockets: number;
  maxRockets: number;
  flares: number;
  maxFlares: number;
  flareReady: boolean;
  missileWarning: boolean;
  lockWarning: boolean;
  lockedTargetId: number | null;
  lockedTargetScreenHint: Vec3 | null;
  lockedTargetLabel: string | null;
  lockedTargetDistance: number;
  elapsedTime: number;
  kills: number;
  radarBlips: RadarBlip[];
  bannerText: string | null;
}

export interface RunSummary {
  victory: boolean;
  levelId: LevelId;
  levelName: string;
  hasNextLevel: boolean;
  score: number;
  bestScore: number;
  waveReached: number;
  maxWaves: number;
  kills: number;
  elapsedSeconds: number;
  hullRemaining: number;
  maxHull: number;
  bossHpRemaining: number;
}
