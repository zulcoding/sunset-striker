import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  AircraftLoadoutId,
  CameraMode,
  EnemyEntity,
  HudSnapshot,
  InputState,
  RunSummary,
  TargetReticleHint,
} from '../game/types';
import {
  FlightSimulation,
  PARTICLE_POOL_SIZE,
  PROJECTILE_POOL_SIZE,
} from '../game/simulation';
import { getLoadoutSpec } from '../game/levels';
import {
  getCoastlineSignedDistance,
  getTerrainHeight,
} from '../game/worldGen';
import { getForwardVector } from '../game/flightPhysics';
import { createPixelTextureSet, PixelTextureSet } from './textures';
import {
  applyLevelThemeToShaders,
  createBayWaterMaterial,
  createDitherCloudMaterial,
  createSunsetSkyMaterial,
} from './pixelShaders';
import {
  createEnemyMesh,
  createHeroAircraftRig,
  createPickupMesh,
  HeroAircraftRig,
} from './aircraftMesh';
import {
  COCKPIT_HEIGHT,
  COCKPIT_WIDTH,
  renderPixelCockpit,
} from './cockpitCanvas';
import { RetroFlightAudio } from './audio';

export interface ViewportCallbacks {
  onHudUpdate: (hud: HudSnapshot, targetHint: TargetReticleHint | null) => void;
  onRunSummary: (summary: RunSummary | null) => void;
  onContextLost: (lost: boolean) => void;
}

// Reusable scratch math objects (Zero GC inside render loop)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _color = new THREE.Color();
const _camDesiredPos = new THREE.Vector3();
const _camDesiredLook = new THREE.Vector3();
const _camLookCurrent = new THREE.Vector3();
const _ndcVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

const FIRE_COLORS = [
  new THREE.Color('#fff199'),
  new THREE.Color('#ff9d3b'),
  new THREE.Color('#e8472a'),
];
const SMOKE_COLOR_SAM = new THREE.Color('#f4f6fa');
const SMOKE_COLOR_FLARE = new THREE.Color('#ffe89e');
const WAKE_COLOR = new THREE.Color('#e2f7f8');

const PROJ_COLORS = {
  cannon: new THREE.Color('#fff5a8'),
  rocket: new THREE.Color('#ffae42'),
  sam: new THREE.Color('#ff5442'),
  flak: new THREE.Color('#ff884d'),
  bandit_bolt: new THREE.Color('#ff4a68'),
  flare: new THREE.Color('#fff8cc'),
};

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class FlightViewport {
  readonly sim: FlightSimulation;
  readonly audio: RetroFlightAudio;

  private container: HTMLElement;
  private callbacks: ViewportCallbacks;
  private inputRef: () => InputState;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cockpitCanvas: HTMLCanvasElement;
  private cockpitCtx: CanvasRenderingContext2D;
  private flashEl: HTMLDivElement;

  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private worldGroup: THREE.Group;
  private buildingFacadeMaterials: THREE.MeshStandardMaterial[] = [];

  private textures: PixelTextureSet;
  private skyMat: THREE.ShaderMaterial;
  private waterMat: THREE.ShaderMaterial;
  private cloudMat: THREE.ShaderMaterial;
  private cloudMesh!: THREE.InstancedMesh;
  private heroRig!: HeroAircraftRig;

  private enemyMeshes = new Map<number, THREE.Group>();
  private pickupMeshes = new Map<number, THREE.Group>();
  private particleMesh!: THREE.InstancedMesh;
  private projectileMesh!: THREE.InstancedMesh;
  private trafficMesh!: THREE.InstancedMesh;
  private trafficData: { x: number; z: number; vx: number; vz: number; y: number }[] = [];

  private appliedWorldRevision = 0;
  private appliedLoadout: AircraftLoadoutId | null = null;
  private isSoftwareGl: boolean;
  private disposed = false;
  private frameId = 0;
  private lastTimeMs = 0;
  private hudEmitAccum = 0;
  private lastPhase = '';
  private lastCamMode: CameraMode = 'chase';
  private cameraInitialized = false;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    sim: FlightSimulation,
    inputRef: () => InputState,
    callbacks: ViewportCallbacks,
  ) {
    this.container = container;
    this.sim = sim;
    this.inputRef = inputRef;
    this.callbacks = callbacks;
    this.audio = new RetroFlightAudio();
    this.isSoftwareGl = detectSoftwareGl();

    // Native low-res pixel-art WebGLRenderer (426x240 logical pixels, crisp nearest upscale!)
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;

    const glCanvas = this.renderer.domElement;
    glCanvas.className = 'pixel-canvas block w-full h-full';
    glCanvas.style.width = '100%';
    glCanvas.style.height = '100%';
    glCanvas.setAttribute('data-testid', 'flight-webgl-canvas');
    this.container.appendChild(glCanvas);

    // WebGL context loss resilience
    glCanvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    glCanvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // Synchronized 426x240 pixel-art cockpit overlay canvas
    this.cockpitCanvas = document.createElement('canvas');
    this.cockpitCanvas.width = COCKPIT_WIDTH;
    this.cockpitCanvas.height = COCKPIT_HEIGHT;
    this.cockpitCanvas.className =
      'pixel-canvas pointer-events-none absolute inset-0 w-full h-full hidden';
    this.cockpitCanvas.setAttribute('data-testid', 'cockpit-overlay-canvas');
    this.cockpitCtx = this.cockpitCanvas.getContext('2d')!;
    this.container.appendChild(this.cockpitCanvas);

    // Warm orange explosion flash layer
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'pointer-events-none absolute inset-0';
    this.flashEl.style.backgroundColor = '#ffcaa0';
    this.flashEl.style.opacity = '0';
    this.container.appendChild(this.flashEl);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(this.sim.levelConfig.theme.fogColor, 250, 790);

    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.8, 1300);

    // Mandatory Studio Environment Reflection (RoomEnvironment via PMREMGenerator)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Dynamic themed key + hemisphere lights
    const initTheme = this.sim.levelConfig.theme;
    this.hemiLight = new THREE.HemisphereLight(initTheme.hemiSky, initTheme.hemiGround, 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(initTheme.sunLightColor, initTheme.sunLightIntensity);
    this.sunLight.position.set(220, 145, -360);
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x8899dd, 0.52);
    rimLight.position.set(-180, 90, 220);
    this.scene.add(rimLight);

    // Shaders & Textures
    this.textures = createPixelTextureSet();
    this.skyMat = createSunsetSkyMaterial(initTheme);
    this.waterMat = createBayWaterMaterial(initTheme);
    this.cloudMat = createDitherCloudMaterial(initTheme);

    // Permanent sky dome & bay water plane (themed dynamically via shader uniforms)
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(980, 24, 16), this.skyMat);
    this.scene.add(skyDome);

    const waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), this.waterMat);
    waterPlane.rotation.x = -Math.PI / 2;
    waterPlane.position.y = 0;
    this.scene.add(waterPlane);

    // Level-specific replaceable world geometry container
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.rebuildWorldForLevel();
    this.buildHeroAndPools();
    this.syncLoadoutLivery();
    this.syncSize();

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(this.container);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTimeMs = performance.now();
    this.scheduleNextFrame(true);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  private syncSize(): void {
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(180, this.container.clientHeight || window.innerHeight);
    const aspect = w / h;

    // Lock vertical internal resolution to 270px (480x270 at 16:9) for crisp yet silky pixel motion
    const pixelH = 270;
    const pixelW = Math.max(270, Math.min(600, Math.round(pixelH * aspect)));
    this.renderer.setSize(pixelW, pixelH, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private applyLevelTheme(): void {
    const theme = this.sim.levelConfig.theme;
    applyLevelThemeToShaders(theme, this.skyMat, this.waterMat, this.cloudMat);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(theme.fogColor);
    }
    this.hemiLight.color.setHex(theme.hemiSky);
    this.hemiLight.groundColor.setHex(theme.hemiGround);
    this.sunLight.color.setHex(theme.sunLightColor);
    this.sunLight.intensity = theme.sunLightIntensity;
    for (let i = 0; i < this.buildingFacadeMaterials.length; i++) {
      this.buildingFacadeMaterials[i].emissiveIntensity = theme.windowEmissiveIntensity;
    }
  }

  private rebuildWorldForLevel(): void {
    // Dispose existing level world meshes cleanly before rebuilding for the new level seed
    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0];
      this.worldGroup.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
      const mat = (child as THREE.Mesh).material;
      if (mat && mat !== this.cloudMat) {
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    }
    this.buildingFacadeMaterials = [];
    this.trafficData = [];
    this.buildWorldMeshes();
    this.applyLevelTheme();
    this.appliedWorldRevision = this.sim.worldRevision;
  }

  private syncLoadoutLivery(): void {
    const loadout = this.sim.aircraft.loadout;
    if (this.appliedLoadout === loadout) return;
    const spec = getLoadoutSpec(loadout);
    this.heroRig.primaryMat.color.setHex(spec.primaryColor);
    this.heroRig.accentMat.color.setHex(spec.accentColor);
    this.appliedLoadout = loadout;
  }

  private buildWorldMeshes(): void {
    const world = this.sim.world;
    const theme = this.sim.levelConfig.theme;

    // 3. Coastal Landmass, Beaches & Iconic Mountains (vertex-colored low-poly faceted terrain)
    const segs = 112;
    const size = 980;
    const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);

    const colSand = new THREE.Color('#e6c986');
    const colCity = new THREE.Color('#303344');
    const colGrass = new THREE.Color('#5c7c48');
    const colAutumn = new THREE.Color('#c86832');
    const colSlateMtn = new THREE.Color('#4a4663');
    const colGoldHill = new THREE.Color('#c99d4a');
    const colSnow = new THREE.Color('#f4ede6');

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const cd = getCoastlineSignedDistance(vx, vz);
      let vy = -3.2;

      if (cd < 8) {
        if (cd < 0) {
          vy = getTerrainHeight(vx, vz, world.mountains);
        } else {
          // Taper beach cleanly beneath water surface
          vy = 0.35 - (cd / 8) * 3.5;
        }
      }
      posAttr.setY(i, vy);

      // Assign rich sunset coastal vertex colors
      if (cd >= -10 && vy < 4.5) {
        _color.copy(colSand);
      } else if (vy < 13.5 && vx < 105 && vz > -230 && vz < 175) {
        _color.copy(colCity);
      } else if (vy > 148) {
        _color.copy(colSnow);
      } else if (vy > 48) {
        // Distinguish warm sunlit distant hills (east/north) vs dramatic dark purple-slate mountains
        if (vx > 80 && vz < -250) {
          _color.copy(colGoldHill).lerp(colSlateMtn, Math.min(1, (vy - 55) / 60));
        } else {
          _color.copy(colSlateMtn);
        }
      } else if (vy > 22) {
        const patch = Math.sin(vx * 0.06) * Math.cos(vz * 0.06);
        _color.copy(patch > 0.1 ? colAutumn : colGrass);
      } else {
        _color.copy(vx > 80 ? colGoldHill : colGrass);
      }

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.worldGroup.add(terrainMesh);

    // 4. Downtown Street Grid Overlay (slightly above terrain plateau, zero Z-fighting)
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.textures.roadGrid,
      roughness: 0.9,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    // Place crisp road quads strictly beneath downtown buildings/parks
    const roadTileGeo = new THREE.PlaneGeometry(24, 24);
    roadTileGeo.rotateX(-Math.PI / 2);
    const downtownSlots = [...world.buildings, ...world.parks];
    const roadInst = new THREE.InstancedMesh(roadTileGeo, roadMat, downtownSlots.length);
    for (let i = 0; i < downtownSlots.length; i++) {
      const slot = downtownSlots[i];
      const ty = getTerrainHeight(slot.x, slot.z, world.mountains) + 0.14;
      _pos.set(slot.x, ty, slot.z);
      _quat.identity();
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      roadInst.setMatrixAt(i, _mat4);
    }
    roadInst.instanceMatrix.needsUpdate = true;
    roadInst.computeBoundingSphere();
    this.worldGroup.add(roadInst);

    // 5. Downtown Green City Parks
    if (world.parks.length > 0) {
      const parkGeo = new THREE.PlaneGeometry(17, 17);
      parkGeo.rotateX(-Math.PI / 2);
      const parkMat = new THREE.MeshStandardMaterial({
        map: this.textures.parkQuad,
        roughness: 0.9,
        metalness: 0.02,
      });
      const parkInst = new THREE.InstancedMesh(parkGeo, parkMat, world.parks.length);
      for (let i = 0; i < world.parks.length; i++) {
        const pk = world.parks[i];
        const ty = getTerrainHeight(pk.x, pk.z, world.mountains) + 0.28;
        _pos.set(pk.x, ty, pk.z);
        _quat.identity();
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        parkInst.setMatrixAt(i, _mat4);
      }
      parkInst.instanceMatrix.needsUpdate = true;
      parkInst.computeBoundingSphere();
      this.worldGroup.add(parkInst);
    }

    // 6. Skyscrapers grouped by architectural facade style (InstancedMesh per style + rooftops!)
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const roofPlane = new THREE.PlaneGeometry(1, 1);
    roofPlane.rotateX(-Math.PI / 2);

    const helipadBuildings = world.buildings.filter((b) => b.hasHelipad);
    const normalRoofBuildings = world.buildings.filter((b) => !b.hasHelipad);

    for (let styleIdx = 0; styleIdx < 4; styleIdx++) {
      const groupList = world.buildings.filter((b) => b.styleIndex === styleIdx);
      if (groupList.length === 0) continue;

      const facadeMat = new THREE.MeshStandardMaterial({
        map: this.textures.buildingFacades[styleIdx],
        emissiveMap: this.textures.buildingEmissives[styleIdx],
        emissive: new THREE.Color('#ffdf78'),
        emissiveIntensity: theme.windowEmissiveIntensity,
        roughness: 0.72,
        metalness: 0.12,
      });
      this.buildingFacadeMaterials.push(facadeMat);
      const inst = new THREE.InstancedMesh(unitBox, facadeMat, groupList.length);
      for (let i = 0; i < groupList.length; i++) {
        const b = groupList[i];
        const baseY = getTerrainHeight(b.x, b.z, world.mountains);
        _pos.set(b.x, baseY + b.height * 0.5, b.z);
        _quat.identity();
        _scale.set(b.width, b.height, b.depth);
        _mat4.compose(_pos, _quat, _scale);
        inst.setMatrixAt(i, _mat4);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.worldGroup.add(inst);
    }

    // Crisp Helipad (H) rooftops
    if (helipadBuildings.length > 0) {
      const heliMat = new THREE.MeshStandardMaterial({
        map: this.textures.helipadRoof,
        roughness: 0.85,
        metalness: 0.08,
      });
      const heliInst = new THREE.InstancedMesh(roofPlane, heliMat, helipadBuildings.length);
      for (let i = 0; i < helipadBuildings.length; i++) {
        const b = helipadBuildings[i];
        const baseY = getTerrainHeight(b.x, b.z, world.mountains);
        _pos.set(b.x, baseY + b.height + 0.08, b.z);
        _quat.identity();
        _scale.set(b.width * 0.98, 1, b.depth * 0.98);
        _mat4.compose(_pos, _quat, _scale);
        heliInst.setMatrixAt(i, _mat4);
      }
      heliInst.instanceMatrix.needsUpdate = true;
      heliInst.computeBoundingSphere();
      this.worldGroup.add(heliInst);
    }

    // Standard industrial rooftops
    if (normalRoofBuildings.length > 0) {
      const stdRoofMat = new THREE.MeshStandardMaterial({
        map: this.textures.standardRoof,
        roughness: 0.88,
        metalness: 0.08,
      });
      const roofInst = new THREE.InstancedMesh(roofPlane, stdRoofMat, normalRoofBuildings.length);
      for (let i = 0; i < normalRoofBuildings.length; i++) {
        const b = normalRoofBuildings[i];
        const baseY = getTerrainHeight(b.x, b.z, world.mountains);
        _pos.set(b.x, baseY + b.height + 0.08, b.z);
        _quat.identity();
        _scale.set(b.width * 0.98, 1, b.depth * 0.98);
        _mat4.compose(_pos, _quat, _scale);
        roofInst.setMatrixAt(i, _mat4);
      }
      roofInst.instanceMatrix.needsUpdate = true;
      roofInst.computeBoundingSphere();
      this.worldGroup.add(roofInst);
    }

    // 7. Autumn-Orange & Emerald Coastal/Park Trees (Composite Trunk + Crown InstancedMeshes!)
    const treeCount = world.trees.length;
    if (treeCount > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.45, 0.65, 3.2, 5);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5c3c28,
        roughness: 0.92,
        flatShading: true,
      });
      const crownGeo = new THREE.DodecahedronGeometry(2.6, 0);
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        flatShading: true,
      });
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
      const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
      const foliagePalette = [
        new THREE.Color('#e8782b'), // vibrant autumn orange (exact match to 00:05, 00:10, 00:16!)
        new THREE.Color('#c84d27'), // burnt sienna
        new THREE.Color('#e0a93b'), // golden ochre
        new THREE.Color('#3b8a4b'), // lush emerald
      ];

      for (let i = 0; i < treeCount; i++) {
        const t = world.trees[i];
        const s = t.scale;
        // Sink trunk base slightly into sloped terrain so zero hillside trees ever float
        _pos.set(t.x, t.y + 0.6 * s, t.z);
        _quat.identity();
        _scale.set(s, s * 1.35, s);
        _mat4.compose(_pos, _quat, _scale);
        trunkInst.setMatrixAt(i, _mat4);

        _pos.set(t.x, t.y + 2.8 * s, t.z);
        _scale.set(s * 1.2, s * 0.95, s * 1.2);
        _mat4.compose(_pos, _quat, _scale);
        crownInst.setMatrixAt(i, _mat4);
        crownInst.setColorAt(i, foliagePalette[t.colorIndex % foliagePalette.length]);
      }
      trunkInst.instanceMatrix.needsUpdate = true;
      crownInst.instanceMatrix.needsUpdate = true;
      if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      crownInst.computeBoundingSphere();
      this.worldGroup.add(trunkInst, crownInst);
    }

    // 8. Stylized Rounded Flat-Layered Sunset Clouds (3 overlapping flattened ellipsoids per cloud!)
    const cloudGeo = new THREE.SphereGeometry(0.55, 10, 7);
    this.cloudMesh = new THREE.InstancedMesh(cloudGeo, this.cloudMat, world.clouds.length * 3);
    this.cloudMesh.frustumCulled = false;
    this.worldGroup.add(this.cloudMesh);

    // 9. Tiny glowing city street traffic dots cruising avenues
    const trafficCount = 48;
    const carGeo = new THREE.BoxGeometry(1.1, 0.65, 2.0);
    const carMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.trafficMesh = new THREE.InstancedMesh(carGeo, carMat, trafficCount);
    this.trafficMesh.frustumCulled = false;
    for (let i = 0; i < trafficCount; i++) {
      const b = world.buildings[(i * 7) % world.buildings.length];
      const alongX = i % 2 === 0;
      const offset = 11.2;
      const x = alongX ? b.x : b.x + offset;
      const z = alongX ? b.z + offset : b.z;
      const y = getTerrainHeight(x, z, world.mountains) + 0.55;
      this.trafficData.push({
        x,
        z,
        y,
        vx: alongX ? (i % 4 === 0 ? 14 : -14) : 0,
        vz: alongX ? 0 : i % 4 === 1 ? 14 : -14,
      });
      _color.set(i % 3 === 0 ? '#ffe788' : i % 3 === 1 ? '#ff5947' : '#e6edf7');
      this.trafficMesh.setColorAt(i, _color);
    }
    if (this.trafficMesh.instanceColor) this.trafficMesh.instanceColor.needsUpdate = true;
    this.worldGroup.add(this.trafficMesh);
  }

  private buildHeroAndPools(): void {
    // Hero A-10 Warthog composite 11-part rig + ground shadow
    this.heroRig = createHeroAircraftRig();
    this.scene.add(this.heroRig.group);
    this.scene.add(this.heroRig.shadowMesh);

    // Pooled particle instanced mesh (white SAM contrails, pixel fireballs, sparks, wakes)
    const puffGeo = new THREE.IcosahedronGeometry(0.65, 0);
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(puffGeo, puffMat, PARTICLE_POOL_SIZE);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);

    // Pooled projectile instanced mesh (cannon tracers, rockets, SAMs, flak, flares)
    const projGeo = new THREE.BoxGeometry(0.65, 0.65, 3.6);
    const projMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.projectileMesh = new THREE.InstancedMesh(projGeo, projMat, PROJECTILE_POOL_SIZE);
    this.projectileMesh.frustumCulled = false;
    this.scene.add(this.projectileMesh);
  }

  private scheduleNextFrame(immediate = false): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      if (immediate) {
        this.frameId = window.setTimeout(this.tick, 16);
      } else {
        this.afterDraw(this.tick);
      }
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 45);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 45);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const rawDt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastTimeMs) / 1000));
    this.lastTimeMs = nowMs;

    const input = this.inputRef();
    this.sim.step(rawDt, input);

    // Audio updates
    const events = this.sim.drainEvents();
    const speedNorm = (this.sim.aircraft.speed - 36) / (94 - 36);
    this.audio.updateEngine(
      this.sim.phase === 'playing' && !this.sim.pendingDefeat,
      this.sim.aircraft.throttle,
      speedNorm,
    );
    this.audio.playEvents(events);

    // Rebuild world geometry & apply lighting/shader theme if campaign level changed
    if (this.sim.worldRevision !== this.appliedWorldRevision) {
      this.rebuildWorldForLevel();
    }
    this.syncLoadoutLivery();

    // Sync scene objects
    const elapsedSec = nowMs / 1000;
    this.syncVisuals(rawDt, elapsedSec);
    this.updateCamera(rawDt, elapsedSec);

    // Render 3D WebGL frame
    this.renderer.render(this.scene, this.camera);

    // Render pixel-art 1st-person cockpit overlay when in cockpit view
    const showCockpit =
      this.sim.phase === 'playing' &&
      this.sim.cameraMode === 'cockpit' &&
      !this.sim.pendingDefeat;

    let cachedHud: HudSnapshot | null = null;
    if (showCockpit) {
      this.cockpitCanvas.classList.remove('hidden');
      cachedHud = this.sim.getHudSnapshot();
      let lockedNdc: { x: number; y: number; visible: boolean } | null = null;
      if (cachedHud.lockedTargetScreenHint) {
        _ndcVec.set(
          cachedHud.lockedTargetScreenHint.x,
          cachedHud.lockedTargetScreenHint.y,
          cachedHud.lockedTargetScreenHint.z,
        );
        _ndcVec.project(this.camera);
        lockedNdc = {
          x: _ndcVec.x,
          y: _ndcVec.y,
          visible: _ndcVec.z >= -1 && _ndcVec.z <= 1,
        };
      }
      renderPixelCockpit(this.cockpitCtx, cachedHud, elapsedSec, lockedNdc);
    } else {
      this.cockpitCanvas.classList.add('hidden');
    }

    // Warm explosion bloom flash overlay
    this.flashEl.style.opacity =
      this.sim.flashBloom > 0.01 ? String(Math.min(0.82, this.sim.flashBloom)) : '0';

    // Smooth ~15Hz React HUD / Chase Radar updates (plus instant emission on phase/camera change)
    this.hudEmitAccum += rawDt;
    const phaseChanged = this.sim.phase !== this.lastPhase;
    const camChanged = this.sim.cameraMode !== this.lastCamMode;
    if (this.hudEmitAccum >= 0.065 || phaseChanged || camChanged) {
      this.hudEmitAccum = 0;
      this.lastPhase = this.sim.phase;
      this.lastCamMode = this.sim.cameraMode;
      document.body.dataset.state = this.sim.phase;
      document.body.dataset.camera = this.sim.cameraMode;
      document.body.dataset.level = String(this.sim.levelConfig.id);

      const snapshot = cachedHud ?? this.sim.getHudSnapshot();
      let targetHint: TargetReticleHint | null = null;
      if (
        this.sim.phase === 'playing' &&
        this.sim.cameraMode === 'chase' &&
        !this.sim.pendingDefeat &&
        snapshot.lockedTargetScreenHint &&
        snapshot.lockedTargetLabel
      ) {
        _ndcVec.set(
          snapshot.lockedTargetScreenHint.x,
          snapshot.lockedTargetScreenHint.y,
          snapshot.lockedTargetScreenHint.z,
        );
        _ndcVec.project(this.camera);
        const inFront =
          _ndcVec.z >= -1 &&
          _ndcVec.z <= 1 &&
          Math.abs(_ndcVec.x) <= 0.94 &&
          Math.abs(_ndcVec.y) <= 0.9;
        targetHint = {
          screenX: (_ndcVec.x * 0.5 + 0.5) * 100,
          screenY: (-_ndcVec.y * 0.5 + 0.5) * 100,
          label: snapshot.lockedTargetLabel,
          distanceM: snapshot.lockedTargetDistance,
          visible: inFront,
        };
      }

      this.callbacks.onHudUpdate(snapshot, targetHint);
      if (phaseChanged) {
        this.callbacks.onRunSummary(this.sim.runSummary);
      }
    }

    this.scheduleNextFrame(false);
  };

  private syncVisuals(dt: number, elapsedSec: number): void {
    const plane = this.sim.aircraft;

    // Shader time uniforms
    this.skyMat.uniforms.uTime.value = elapsedSec;
    this.waterMat.uniforms.uTime.value = elapsedSec;

    // Hero Aircraft transform (hidden in cockpit mode so fuselage doesn't block windshield)
    const hideHero =
      this.sim.phase === 'playing' &&
      this.sim.cameraMode === 'cockpit' &&
      !this.sim.pendingDefeat;
    this.heroRig.group.visible = !hideHero && !this.sim.pendingDefeat;
    this.heroRig.group.position.set(plane.x, plane.y, plane.z);
    _euler.set(plane.pitch, plane.yaw, plane.roll, 'YXZ');
    this.heroRig.group.quaternion.setFromEuler(_euler);

    // Animated jet exhaust thrust cones (cyan surge on Afterburner!)
    const thrustPulse = 0.78 + plane.throttle * 0.72 + Math.sin(elapsedSec * 38) * 0.14;
    if (plane.afterburnerActive) {
      this.heroRig.exhaustMat.color.setHex(0x63f5ff);
      this.heroRig.exhaustLeft.scale.set(1.28, thrustPulse * 1.95, 1.28);
      this.heroRig.exhaustRight.scale.set(1.28, thrustPulse * 1.95, 1.28);
    } else {
      this.heroRig.exhaustMat.color.setHex(0xffc95c);
      this.heroRig.exhaustLeft.scale.set(1, thrustPulse, 1);
      this.heroRig.exhaustRight.scale.set(1, thrustPulse, 1);
    }

    // Nose cannon muzzle flash
    this.heroRig.muzzleFlash.visible = plane.muzzleFlashTimer > 0 && !hideHero;
    if (this.heroRig.muzzleFlash.visible) {
      const ms = 0.85 + Math.random() * 0.55;
      this.heroRig.muzzleFlash.scale.set(ms, ms, ms);
      this.heroRig.muzzleFlash.rotation.z = elapsedSec * 25;
    }

    // Brief white emissive damage hit flash on aircraft
    const flashEmissive = plane.hitFlashTimer > 0 ? 0xff9b6a : 0x000000;
    for (let i = 0; i < this.heroRig.hullMaterials.length; i++) {
      this.heroRig.hullMaterials[i].emissive.setHex(flashEmissive);
    }

    // Contact shadow silhouette directly beneath aircraft over bay water / roofs
    const groundY = getTerrainHeight(plane.x, plane.z, this.sim.world.mountains);
    this.heroRig.shadowMesh.visible = !this.sim.pendingDefeat;
    this.heroRig.shadowMesh.position.set(plane.x, groundY + 0.35, plane.z);
    this.heroRig.shadowMesh.rotation.z = plane.yaw;
    const altScale = Math.max(0.55, 1.35 - (plane.y - groundY) / 140);
    this.heroRig.shadowMesh.scale.set(altScale, altScale, 1);

    // Sync drifting rounded cumulus clouds (3 overlapping flattened puffs per cloud!)
    const clouds = this.sim.world.clouds;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      _quat.identity();
      // Main wide cumulus base disc
      _pos.set(c.x, c.y, c.z);
      _scale.set(c.scaleX, c.scaleY * 0.58, c.scaleZ);
      _mat4.compose(_pos, _quat, _scale);
      this.cloudMesh.setMatrixAt(i * 3, _mat4);
      // Center billowy crown puff
      _pos.set(c.x + c.scaleX * 0.06, c.y + c.scaleY * 0.36, c.z - c.scaleZ * 0.04);
      _scale.set(c.scaleX * 0.64, c.scaleY * 0.72, c.scaleZ * 0.7);
      _mat4.compose(_pos, _quat, _scale);
      this.cloudMesh.setMatrixAt(i * 3 + 1, _mat4);
      // Secondary flank puff for organic silhouette
      _pos.set(c.x - c.scaleX * 0.24, c.y + c.scaleY * 0.18, c.z + c.scaleZ * 0.08);
      _scale.set(c.scaleX * 0.52, c.scaleY * 0.55, c.scaleZ * 0.62);
      _mat4.compose(_pos, _quat, _scale);
      this.cloudMesh.setMatrixAt(i * 3 + 2, _mat4);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // Sync street traffic dots
    for (let i = 0; i < this.trafficData.length; i++) {
      const td = this.trafficData[i];
      td.x += td.vx * dt;
      td.z += td.vz * dt;
      if (td.x > 65) td.x = -195;
      if (td.x < -195) td.x = 65;
      if (td.z > 130) td.z = -190;
      if (td.z < -190) td.z = 130;
      _pos.set(td.x, td.y, td.z);
      _euler.set(0, td.vx !== 0 ? Math.PI / 2 : 0, 0);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      this.trafficMesh.setMatrixAt(i, _mat4);
    }
    this.trafficMesh.instanceMatrix.needsUpdate = true;

    // Sync Enemy 3D Groups & Supply Crate Pickups
    this.syncEnemies(elapsedSec);
    this.syncPickups(elapsedSec);

    // Sync Pooled Particles
    const particles = this.sim.particles;
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      if (!pt.active) {
        _pos.set(0, -9999, 0);
        _scale.set(0.001, 0.001, 0.001);
        _quat.identity();
        _mat4.compose(_pos, _quat, _scale);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }

      const lifeFrac = pt.life / pt.maxLife;
      const s = pt.scale * (pt.kind === 'smoke' ? 0.55 + (1 - lifeFrac) * 0.65 : Math.max(0.25, lifeFrac));
      _pos.set(pt.x, pt.y, pt.z);
      _quat.identity();
      _scale.set(s, pt.kind === 'water_wake' ? 0.15 : s, s);
      _mat4.compose(_pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);

      if (pt.kind === 'fire' || pt.kind === 'spark') {
        const cIdx = lifeFrac > 0.62 ? 0 : lifeFrac > 0.32 ? 1 : 2;
        this.particleMesh.setColorAt(i, FIRE_COLORS[cIdx]);
      } else if (pt.kind === 'flare_smoke') {
        this.particleMesh.setColorAt(i, SMOKE_COLOR_FLARE);
      } else if (pt.kind === 'water_wake') {
        this.particleMesh.setColorAt(i, WAKE_COLOR);
      } else {
        this.particleMesh.setColorAt(i, SMOKE_COLOR_SAM);
      }
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // Sync Pooled Projectiles
    const projectiles = this.sim.projectiles;
    for (let i = 0; i < projectiles.length; i++) {
      const pr = projectiles[i];
      if (!pr.active) {
        _pos.set(0, -9999, 0);
        _scale.set(0.001, 0.001, 0.001);
        _quat.identity();
        _mat4.compose(_pos, _quat, _scale);
        this.projectileMesh.setMatrixAt(i, _mat4);
        continue;
      }

      _pos.set(pr.x, pr.y, pr.z);
      const speed = Math.max(0.01, Math.hypot(pr.vx, pr.vy, pr.vz));
      const yaw = Math.atan2(-pr.vx, -pr.vz);
      const pitch = Math.asin(Math.max(-1, Math.min(1, pr.vy / speed)));
      _euler.set(pitch, yaw, 0, 'YXZ');
      _quat.setFromEuler(_euler);

      if (pr.kind === 'cannon') {
        _scale.set(0.55, 0.55, 2.2);
      } else if (pr.kind === 'sam' || pr.kind === 'rocket') {
        _scale.set(1.05, 1.05, 1.55);
      } else if (pr.kind === 'flare') {
        _scale.set(1.3, 1.3, 0.45);
      } else {
        _scale.set(1.0, 1.0, 1.1);
      }

      _mat4.compose(_pos, _quat, _scale);
      this.projectileMesh.setMatrixAt(i, _mat4);
      this.projectileMesh.setColorAt(i, PROJ_COLORS[pr.kind]);
    }
    this.projectileMesh.instanceMatrix.needsUpdate = true;
    if (this.projectileMesh.instanceColor) this.projectileMesh.instanceColor.needsUpdate = true;
  }

  private syncEnemies(elapsedSec: number): void {
    const activeIds = new Set<number>();

    for (let i = 0; i < this.sim.enemies.length; i++) {
      const e: EnemyEntity = this.sim.enemies[i];
      if (!e.alive) continue;
      activeIds.add(e.id);

      let mesh = this.enemyMeshes.get(e.id);
      if (!mesh) {
        mesh = createEnemyMesh(e.archetype);
        this.scene.add(mesh);
        this.enemyMeshes.set(e.id, mesh);
      }

      mesh.position.set(e.x, e.y, e.z);
      _euler.set(0, e.yaw, e.roll, 'YXZ');
      mesh.quaternion.setFromEuler(_euler);

      // Telegraph beacon pulse when enemy is charging/locking onto player
      const beacon = mesh.getObjectByName('telegraphBeacon');
      if (beacon) {
        const telegraphing = e.telegraphTimer > 0;
        beacon.visible = telegraphing || e.archetype === 'radar' || e.archetype === 'carrier';
        const pulse = telegraphing ? 1.5 + Math.sin(elapsedSec * 36) * 0.65 : 1.0;
        beacon.scale.set(pulse, pulse, pulse);
      }

      // Brief white hit flash (preserving each material's base emissive glow, e.g. carrier reactors)
      const flash = e.hitFlashTimer > 0;
      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive) {
            if (typeof mat.userData.baseEmissive !== 'number') {
              mat.userData.baseEmissive = mat.emissive.getHex();
            }
            mat.emissive.setHex(flash ? 0xffffff : (mat.userData.baseEmissive as number));
          }
        }
      });
    }

    // Remove dead enemy meshes cleanly
    for (const [id, mesh] of this.enemyMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.enemyMeshes.delete(id);
      }
    }
  }

  private syncPickups(elapsedSec: number): void {
    const activeIds = new Set<number>();

    for (let i = 0; i < this.sim.pickups.length; i++) {
      const pk = this.sim.pickups[i];
      if (!pk.active) continue;
      activeIds.add(pk.id);

      let mesh = this.pickupMeshes.get(pk.id);
      if (!mesh) {
        mesh = createPickupMesh(pk.kind);
        this.scene.add(mesh);
        this.pickupMeshes.set(pk.id, mesh);
      }

      mesh.position.set(pk.x, pk.y + Math.sin(pk.bobPhase) * 1.8, pk.z);
      mesh.rotation.y = elapsedSec * 2.2;
      mesh.rotation.z = Math.sin(pk.bobPhase * 0.7) * 0.18;
    }

    for (const [id, mesh] of this.pickupMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.pickupMeshes.delete(id);
      }
    }
  }

  private updateCamera(dt: number, elapsedSec: number): void {
    const plane = this.sim.aircraft;
    const fwd = getForwardVector(plane.yaw, plane.pitch);
    const mode = this.sim.phase === 'title' ? 'chase' : this.sim.cameraMode;

    // Smooth multi-frequency sinusoidal trauma shake (zero jittery white-noise jumpiness)
    const shakeMag = this.sim.trauma * this.sim.trauma * 1.45;
    const shakeX = (Math.sin(elapsedSec * 46) * 0.65 + Math.cos(elapsedSec * 71) * 0.35) * shakeMag;
    const shakeY = (Math.cos(elapsedSec * 53) * 0.65 + Math.sin(elapsedSec * 83) * 0.35) * shakeMag;

    if (mode === 'chase') {
      const followDist = this.sim.phase === 'title' ? 21 : 17.8;
      const followHeight = this.sim.phase === 'title' ? 6.4 : 5.3;
      const desiredX = plane.x - fwd.x * followDist;
      const desiredZ = plane.z - fwd.z * followDist;
      const camTerrainFloor =
        getTerrainHeight(desiredX, desiredZ, this.sim.world.mountains) + 6.5;
      _camDesiredPos.set(
        desiredX,
        Math.max(camTerrainFloor, plane.y - fwd.y * followDist + followHeight),
        desiredZ,
      );
      _camDesiredLook.set(
        plane.x + fwd.x * 40,
        plane.y + fwd.y * 40 + 1.1,
        plane.z + fwd.z * 40,
      );

      const posLambda = 1 - Math.exp(-10.5 * dt);
      const lookLambda = 1 - Math.exp(-14.5 * dt);
      if (!this.cameraInitialized) {
        this.camera.position.copy(_camDesiredPos);
        _camLookCurrent.copy(_camDesiredLook);
        this.cameraInitialized = true;
      } else {
        this.camera.position.lerp(_camDesiredPos, posLambda);
        _camLookCurrent.lerp(_camDesiredLook, lookLambda);
      }

      const liveCamFloor =
        getTerrainHeight(this.camera.position.x, this.camera.position.z, this.sim.world.mountains) +
        5.5;
      if (this.camera.position.y < liveCamFloor) {
        this.camera.position.y = liveCamFloor;
      }

      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;

      // Gentle horizon banking tilt aligned to aircraft roll for silky Ace-Combat flight feel
      const bankTilt = this.sim.phase === 'playing' ? -plane.roll * 0.16 : 0;
      const rightX = Math.cos(plane.yaw);
      const rightZ = -Math.sin(plane.yaw);
      _upVec.set(rightX * Math.sin(bankTilt), Math.cos(bankTilt), rightZ * Math.sin(bankTilt));
      this.camera.up.lerp(_upVec, 1 - Math.exp(-8 * dt)).normalize();
      this.camera.lookAt(_camLookCurrent);

      // Smooth dynamic FOV widening with throttle & Afterburner boost surge
      const targetFov = 58 + plane.throttle * 9 + (plane.afterburnerActive ? 8 : 0);
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-6.5 * dt));
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    if (mode === 'cockpit') {
      // Exact nose-seated 1st-person pilot view aligned with aircraft attitude
      this.camera.position.set(
        plane.x + fwd.x * 1.8 + shakeX * 0.25,
        plane.y + 1.05 + shakeY * 0.25,
        plane.z + fwd.z * 1.8,
      );
      _euler.set(plane.pitch, plane.yaw, plane.roll, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
      if (Math.abs(this.camera.fov - 66) > 0.2) {
        this.camera.fov = 66;
        this.camera.updateProjectionMatrix();
      }
      this.cameraInitialized = false;
      return;
    }

    // mode === 'topdown' (iconic overhead view over city grid, helipads, bay, and missile contrails!)
    _camDesiredPos.set(plane.x - fwd.x * 14, plane.y + 108, plane.z - fwd.z * 14);
    _camDesiredLook.set(plane.x + fwd.x * 16, plane.y - 6, plane.z + fwd.z * 16);

    const tdLambda = 1 - Math.exp(-9 * dt);
    this.camera.position.lerp(_camDesiredPos, this.cameraInitialized ? tdLambda : 1);
    _camLookCurrent.lerp(_camDesiredLook, this.cameraInitialized ? tdLambda : 1);
    this.cameraInitialized = true;

    this.camera.position.x += shakeX;
    this.camera.position.z += shakeY;
    // Orient top-down camera north-up or heading-up smoothly
    _upVec.set(-Math.sin(plane.yaw), 0, -Math.cos(plane.yaw));
    this.camera.up.copy(_upVec);
    this.camera.lookAt(_camLookCurrent);

    if (Math.abs(this.camera.fov - 56) > 0.2) {
      this.camera.fov = 56;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.audio.dispose();

    const glCanvas = this.renderer.domElement;
    glCanvas.removeEventListener('webglcontextlost', this.handleContextLost);
    glCanvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.textures.dispose();
    this.skyMat.dispose();
    this.waterMat.dispose();
    this.cloudMat.dispose();
    this.renderer.dispose();

    if (glCanvas.parentElement) glCanvas.parentElement.removeChild(glCanvas);
    if (this.cockpitCanvas.parentElement) this.cockpitCanvas.parentElement.removeChild(this.cockpitCanvas);
    if (this.flashEl.parentElement) this.flashEl.parentElement.removeChild(this.flashEl);
  }
}
