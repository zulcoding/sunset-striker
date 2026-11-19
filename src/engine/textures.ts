import * as THREE from 'three';
import { createRng } from '../game/worldGen';

function makePixelTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export interface SkyscraperPalette {
  wallBase: string;
  wallShade: string;
  wallHighlight: string;
  litWindowA: string;
  litWindowB: string;
  darkWindow: string;
  roofColor: number;
}

export const SKYSCRAPER_PALETTES: readonly SkyscraperPalette[] = [
  // 0: Steel-blue high-rise (iconic blue buildings with bright yellow windows in reference!)
  {
    wallBase: '#284972',
    wallShade: '#1d3456',
    wallHighlight: '#3b6496',
    litWindowA: '#ffea8a',
    litWindowB: '#ffd063',
    darkWindow: '#162742',
    roofColor: 0x52647c,
  },
  // 1: Dark indigo-slate tower
  {
    wallBase: '#27293c',
    wallShade: '#1c1e2e',
    wallHighlight: '#3a3e57',
    litWindowA: '#ffe590',
    litWindowB: '#a9d2f5',
    darkWindow: '#141523',
    roofColor: 0x464a5d,
  },
  // 2: Concrete slate-grey tower
  {
    wallBase: '#4c5261',
    wallShade: '#393e4c',
    wallHighlight: '#676e7f',
    litWindowA: '#fff1a6',
    litWindowB: '#f7c96e',
    darkWindow: '#252936',
    roofColor: 0x676d7c,
  },
  // 3: Warm terracotta-sienna tower (sunset lit coastal high-rises in reference!)
  {
    wallBase: '#6e4942',
    wallShade: '#533530',
    wallHighlight: '#8d5e51',
    litWindowA: '#fff09c',
    litWindowB: '#ffd470',
    darkWindow: '#2e1d1c',
    roofColor: 0x7a655d,
  },
];

export interface PixelTextureSet {
  buildingFacades: THREE.CanvasTexture[];
  buildingEmissives: THREE.CanvasTexture[];
  helipadRoof: THREE.CanvasTexture;
  standardRoof: THREE.CanvasTexture;
  roadGrid: THREE.CanvasTexture;
  parkQuad: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates razor-sharp NearestFilter pixel-art textures for buildings,
 * glowing window emissive maps, rooftop (H) helipads, roads, and parks.
 */
export function createPixelTextureSet(): PixelTextureSet {
  const buildingFacades: THREE.CanvasTexture[] = [];
  const buildingEmissives: THREE.CanvasTexture[] = [];

  for (let s = 0; s < SKYSCRAPER_PALETTES.length; s++) {
    const pal = SKYSCRAPER_PALETTES[s];
    const rng = createRng(4011 + s * 997);

    const w = 32;
    const h = 64;
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = w;
    albedoCanvas.height = h;
    const ctx = albedoCanvas.getContext('2d')!;

    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = w;
    emissiveCanvas.height = h;
    const ectx = emissiveCanvas.getContext('2d')!;
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, w, h);

    // Wall base + vertical pixel pilasters for architectural rhythm
    ctx.fillStyle = pal.wallBase;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = pal.wallShade;
    ctx.fillRect(0, 0, 2, h);
    ctx.fillRect(w - 2, 0, 2, h);
    ctx.fillStyle = pal.wallHighlight;
    ctx.fillRect(2, 0, 1, h);

    // Horizontal floor ledges + crisp 2x2 / 3x2 pixel windows
    for (let row = 2; row < h - 2; row += 4) {
      ctx.fillStyle = pal.wallShade;
      ctx.fillRect(0, row + 3, w, 1);

      for (let col = 3; col < w - 3; col += 4) {
        const litRoll = rng();
        if (litRoll < 0.34) {
          const litColor = litRoll < 0.25 ? pal.litWindowA : pal.litWindowB;
          ctx.fillStyle = litColor;
          ctx.fillRect(col, row, 2, 2);
          ectx.fillStyle = litColor;
          ectx.fillRect(col, row, 2, 2);
        } else {
          ctx.fillStyle = pal.darkWindow;
          ctx.fillRect(col, row, 2, 2);
        }
      }
    }

    buildingFacades.push(makePixelTexture(albedoCanvas, 1, 1));
    buildingEmissives.push(makePixelTexture(emissiveCanvas, 1, 1));
  }

  // Rooftop (H) Helipad texture (matching exact white ring + H seen in 00:00, 00:01, 00:18, 00:19)
  const heliCanvas = document.createElement('canvas');
  heliCanvas.width = 32;
  heliCanvas.height = 32;
  const hctx = heliCanvas.getContext('2d')!;
  hctx.fillStyle = '#5c6678';
  hctx.fillRect(0, 0, 32, 32);
  // Roof parapet border
  hctx.fillStyle = '#7b879c';
  hctx.fillRect(0, 0, 32, 2);
  hctx.fillRect(0, 30, 32, 2);
  hctx.fillRect(0, 0, 2, 32);
  hctx.fillRect(30, 0, 2, 32);
  // Inner concrete pad
  hctx.fillStyle = '#475061';
  hctx.fillRect(3, 3, 26, 26);
  // Crisp pixel circle
  hctx.strokeStyle = '#eceff5';
  hctx.lineWidth = 2;
  hctx.beginPath();
  hctx.arc(16, 16, 10, 0, Math.PI * 2);
  hctx.stroke();
  // Crisp pixel "H"
  hctx.fillStyle = '#f8f9fc';
  hctx.fillRect(11, 10, 2, 12);
  hctx.fillRect(19, 10, 2, 12);
  hctx.fillRect(13, 15, 6, 2);
  const helipadRoof = makePixelTexture(heliCanvas);

  // Standard industrial roof with parapet & HVAC vents
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = 32;
  roofCanvas.height = 32;
  const rctx = roofCanvas.getContext('2d')!;
  rctx.fillStyle = '#505668';
  rctx.fillRect(0, 0, 32, 32);
  rctx.fillStyle = '#6c7487';
  rctx.fillRect(0, 0, 32, 2);
  rctx.fillRect(0, 30, 32, 2);
  rctx.fillRect(0, 0, 2, 32);
  rctx.fillRect(30, 0, 2, 32);
  rctx.fillStyle = '#383d4c';
  rctx.fillRect(6, 6, 8, 6);
  rctx.fillRect(18, 17, 7, 7);
  rctx.fillStyle = '#7b8396';
  rctx.fillRect(7, 7, 6, 2);
  rctx.fillRect(19, 18, 5, 2);
  const standardRoof = makePixelTexture(roofCanvas);

  // Downtown road grid texture (1x1 per 24m city block: crisp dark charcoal avenues bordering clean concrete sidewalk!)
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 32;
  roadCanvas.height = 32;
  const gctx = roadCanvas.getContext('2d')!;
  // Dark asphalt avenues around block perimeter
  gctx.fillStyle = '#202330';
  gctx.fillRect(0, 0, 32, 32);
  // Crisp center avenue lane dashes along outer edges (seamless across adjacent 24m blocks)
  gctx.fillStyle = '#d4ccb4';
  for (let i = 5; i < 28; i += 6) {
    gctx.fillRect(i, 0, 3, 1);
    gctx.fillRect(i, 31, 3, 1);
    gctx.fillRect(0, i, 1, 3);
    gctx.fillRect(31, i, 1, 3);
  }
  // Clean concrete sidewalk curb pad inside the block
  gctx.fillStyle = '#5e6475';
  gctx.fillRect(4, 4, 24, 24);
  gctx.fillStyle = '#474c5c';
  gctx.fillRect(5, 5, 22, 22);
  const roadGrid = makePixelTexture(roadCanvas, 1, 1);

  // Green city park quad texture
  const parkCanvas = document.createElement('canvas');
  parkCanvas.width = 32;
  parkCanvas.height = 32;
  const pctx = parkCanvas.getContext('2d')!;
  pctx.fillStyle = '#3d8048';
  pctx.fillRect(0, 0, 32, 32);
  pctx.fillStyle = '#4fa157';
  pctx.fillRect(2, 2, 28, 28);
  // Park diagonal footpaths
  pctx.fillStyle = '#b9a787';
  pctx.fillRect(14, 0, 4, 32);
  pctx.fillRect(0, 14, 32, 4);
  pctx.fillStyle = '#c9b796';
  pctx.fillRect(12, 12, 8, 8);
  const parkQuad = makePixelTexture(parkCanvas);

  return {
    buildingFacades,
    buildingEmissives,
    helipadRoof,
    standardRoof,
    roadGrid,
    parkQuad,
    dispose: () => {
      buildingFacades.forEach((t) => t.dispose());
      buildingEmissives.forEach((t) => t.dispose());
      helipadRoof.dispose();
      standardRoof.dispose();
      roadGrid.dispose();
      parkQuad.dispose();
    },
  };
}
