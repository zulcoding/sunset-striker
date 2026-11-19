import type {
  Vec3,
  WorldBuilding,
  WorldCloud,
  WorldData,
  WorldMountain,
  WorldPark,
  WorldTree,
} from './types';

export const WORLD_RADIUS = 460;
export const WATER_LEVEL = 0;

/** Deterministic PRNG (Mulberry32) */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Signed coastline distance function:
 *   < 0 => Land (downtown peninsula, mountain range, or distant coastal hills)
 *   > 0 => Open turquoise bay water
 */
export function getCoastlineSignedDistance(x: number, z: number): number {
  // Curved downtown shoreline running roughly from (-120, 210) through (30, 0) to (135, -170)
  const wave = Math.sin(z * 0.017) * 26 + Math.cos(z * 0.033) * 12;
  const shoreX = 28 - z * 0.42 + wave;

  // Main peninsula on the west/north-west side
  const dPeninsula = x - shoreX;

  // Southern headland curving slightly eastward around z > 155
  const southCove = z > 140 ? (z - 140) * 0.55 : 0;

  // Northern far-bay hills & Sugarloaf peninsula across the bay
  const sugarloafDist = Math.hypot(x - 245, z + 215) - 92;
  const farRimDist = z + 295 + Math.sin(x * 0.014) * 32; // land when z < -295

  // Combine land regions (minimum signed distance = union of land masses)
  const peninsulaWithCove = Math.max(dPeninsula, southCove - 90);
  return Math.min(peninsulaWithCove, sugarloafDist, farRimDist);
}

export function isOverWater(x: number, z: number): boolean {
  return getCoastlineSignedDistance(x, z) > 0;
}

export function createMountains(): WorldMountain[] {
  return [
    // Iconic massive twin-peaked dark mountain behind downtown (Corcovado silhouette)
    {
      x: -185,
      z: -275,
      radiusX: 145,
      radiusZ: 125,
      height: 185,
      conical: false,
      snowCap: true,
      hue: 'slate',
    },
    {
      x: -70,
      z: -310,
      radiusX: 118,
      radiusZ: 110,
      height: 148,
      conical: false,
      snowCap: false,
      hue: 'slate',
    },
    // West flank foothills
    {
      x: -305,
      z: -160,
      radiusX: 120,
      radiusZ: 140,
      height: 112,
      conical: false,
      snowCap: false,
      hue: 'olive',
    },
    {
      x: -290,
      z: 35,
      radiusX: 105,
      radiusZ: 115,
      height: 82,
      conical: false,
      snowCap: false,
      hue: 'golden',
    },
    // Distinctive conical Sugarloaf coastal peak across the sparkling bay
    {
      x: 245,
      z: -215,
      radiusX: 68,
      radiusZ: 68,
      height: 128,
      conical: true,
      snowCap: false,
      hue: 'slate',
    },
    // Distant golden-green coastal hills ringing the horizon bay
    {
      x: 115,
      z: -345,
      radiusX: 115,
      radiusZ: 90,
      height: 88,
      conical: false,
      snowCap: false,
      hue: 'golden',
    },
    {
      x: 345,
      z: -310,
      radiusX: 130,
      radiusZ: 98,
      height: 94,
      conical: false,
      snowCap: false,
      hue: 'golden',
    },
    {
      x: -245,
      z: 215,
      radiusX: 110,
      radiusZ: 95,
      height: 68,
      conical: false,
      snowCap: false,
      hue: 'olive',
    },
  ];
}

export function getTerrainHeight(
  x: number,
  z: number,
  mountains: readonly WorldMountain[] = DEFAULT_MOUNTAINS,
): number {
  const coastDist = getCoastlineSignedDistance(x, z);
  let baseHeight = 0;

  if (coastDist < 0) {
    // Smooth beach rise into flat downtown plateau (~2.4m above sea level)
    const inland = Math.min(1, -coastDist / 26);
    baseHeight = 0.35 + inland * 2.1;
  } else {
    return WATER_LEVEL;
  }

  let mtnLift = 0;
  for (let i = 0; i < mountains.length; i++) {
    const m = mountains[i];
    const dx = (x - m.x) / m.radiusX;
    const dz = (z - m.z) / m.radiusZ;
    const r2 = dx * dx + dz * dz;
    if (r2 < 1) {
      const r = Math.sqrt(r2);
      const falloff = m.conical
        ? Math.pow(1 - r, 1.45)
        : Math.pow(Math.cos(r * Math.PI * 0.5), 1.55);
      // Craggy coastal peak ridging
      const ridge =
        1 +
        Math.sin(x * 0.045 + z * 0.032) * 0.09 +
        Math.cos(x * 0.085 - z * 0.07) * 0.05;
      const h = m.height * falloff * ridge;
      if (h > mtnLift) mtnLift = h;
    }
  }

  return baseHeight + mtnLift;
}

const DEFAULT_MOUNTAINS = createMountains();

export function generateWorld(seed = 20261119): WorldData {
  const rng = createRng(seed);
  const mountains = createMountains();
  const buildings: WorldBuilding[] = [];
  const parks: WorldPark[] = [];
  const trees: WorldTree[] = [];
  const clouds: WorldCloud[] = [];
  const helipadSpots: Vec3[] = [];
  const radarSpots: Vec3[] = [];

  // Structured Manhattan/Rio downtown grid with crisp avenues
  const blockStep = 24;
  let nextBuildingId = 1;

  for (let gx = -220; gx <= 96; gx += blockStep) {
    for (let gz = -220; gz <= 160; gz += blockStep) {
      const coastDist = getCoastlineSignedDistance(gx, gz);
      // Only place downtown blocks well inland and on flatter plateau (not steep mountain cliffs)
      if (coastDist > -16) continue;
      const terrainH = getTerrainHeight(gx, gz, mountains);
      if (terrainH > 13.5) continue;

      // Occasional green city park quad (seen in reference frames 00:01, 00:02, 00:18, 00:19)
      const parkRoll = rng();
      if (parkRoll < 0.11) {
        parks.push({ x: gx, z: gz, width: 17, depth: 17 });
        // Cluster of autumn-orange & emerald park trees
        for (let t = 0; t < 4; t++) {
          const tx = gx + (rng() - 0.5) * 11;
          const tz = gz + (rng() - 0.5) * 11;
          trees.push({
            x: tx,
            y: getTerrainHeight(tx, tz, mountains),
            z: tz,
            scale: 0.85 + rng() * 0.55,
            colorIndex: rng() < 0.55 ? 0 : 3,
          });
        }
        continue;
      }

      // Compute skyline density: taller towers near downtown core (-70, -45), stepping down toward shore & foothills
      const coreDist = Math.hypot(gx + 75, gz + 35);
      const coreFactor = Math.max(0.22, 1 - coreDist / 235);
      const width = 12 + rng() * 5.2;
      const depth = 12 + rng() * 5.2;
      const height = 14 + coreFactor * (22 + rng() * 34) + rng() * 10;

      // Style palette: 0 steel-blue, 1 dark indigo, 2 slate grey, 3 warm terracotta
      const styleRoll = rng();
      const styleIndex =
        styleRoll < 0.34 ? 0 : styleRoll < 0.66 ? 1 : styleRoll < 0.86 ? 2 : 3;

      const hasHelipad = height > 28 && rng() < 0.24;
      const hasSpire = !hasHelipad && height > 44 && rng() < 0.25;

      const building: WorldBuilding = {
        id: nextBuildingId++,
        x: gx + (rng() - 0.5) * 1.4,
        z: gz + (rng() - 0.5) * 1.4,
        width,
        depth,
        height,
        styleIndex,
        hasHelipad,
        hasSpire,
      };
      buildings.push(building);

      if (hasHelipad) {
        helipadSpots.push({
          x: building.x,
          y: terrainH + building.height + 0.5,
          z: building.z,
        });
      }
      if (hasSpire) {
        radarSpots.push({
          x: building.x,
          y: terrainH + building.height + 0.5,
          z: building.z,
        });
      }
    }
  }

  // Ensure enough helipad spots and radar spots for waves
  if (radarSpots.length < 6) {
    const sorted = [...buildings].sort((a, b) => b.height - a.height);
    for (let i = 0; i < Math.min(8, sorted.length); i++) {
      const b = sorted[i];
      radarSpots.push({
        x: b.x,
        y: getTerrainHeight(b.x, b.z, mountains) + b.height + 0.5,
        z: b.z,
      });
    }
  }

  // Coastal autumn-orange & lush hillside trees lining the shoreline coves and mountain bases
  for (let i = 0; i < 240; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 60 + rng() * 320;
    const tx = Math.cos(angle) * dist - 40;
    const tz = Math.sin(angle) * dist - 60;
    const coastDist = getCoastlineSignedDistance(tx, tz);
    if (coastDist > -3) continue;
    const ty = getTerrainHeight(tx, tz, mountains);
    // Place either right along the shoreline coves OR on the mountain foothills (12..68m)
    const isCoastalStrip = coastDist >= -18 && coastDist <= -3 && ty < 12;
    const isFoothill = ty >= 12 && ty <= 68;
    if (!isCoastalStrip && !isFoothill) continue;

    trees.push({
      x: tx,
      y: ty,
      z: tz,
      scale: 1.1 + rng() * 1.35,
      colorIndex:
        rng() < 0.45 ? 0 : rng() < 0.72 ? 1 : rng() < 0.88 ? 2 : 3,
    });
  }

  // Stylized flat-layered sunset clouds drifting high across the sky
  for (let i = 0; i < 34; i++) {
    const angle = (i / 34) * Math.PI * 2 + rng() * 0.25;
    const radius = 150 + rng() * 340;
    clouds.push({
      x: Math.cos(angle) * radius,
      y: 135 + rng() * 75,
      z: Math.sin(angle) * radius - 40,
      scaleX: 28 + rng() * 44,
      scaleY: 7 + rng() * 8,
      scaleZ: 18 + rng() * 26,
      driftSpeed: 1.6 + rng() * 2.4,
    });
  }

  // Bay patrol gunboat spawn positions in open turquoise water
  const gunboatSpawns: Vec3[] = [
    { x: 115, y: 0.6, z: -25 },
    { x: 165, y: 0.6, z: 45 },
    { x: 85, y: 0.6, z: 75 },
    { x: 185, y: 0.6, z: -90 },
    { x: 130, y: 0.6, z: -135 },
    { x: 235, y: 0.6, z: 15 },
  ];

  return {
    seed,
    worldRadius: WORLD_RADIUS,
    buildings,
    parks,
    mountains,
    trees,
    clouds,
    helipadSpots,
    gunboatSpawns,
    radarSpots,
  };
}

export function checkBuildingCollision(
  x: number,
  y: number,
  z: number,
  radius: number,
  buildings: readonly WorldBuilding[],
  mountains: readonly WorldMountain[] = DEFAULT_MOUNTAINS,
): WorldBuilding | null {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const halfW = b.width * 0.5 + radius;
    const halfD = b.depth * 0.5 + radius;
    if (Math.abs(x - b.x) <= halfW && Math.abs(z - b.z) <= halfD) {
      const baseH = getTerrainHeight(b.x, b.z, mountains);
      if (y - radius <= baseH + b.height) {
        return b;
      }
    }
  }
  return null;
}
