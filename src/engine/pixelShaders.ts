import * as THREE from 'three';
import type { LevelTheme } from '../game/types';
import { LEVEL_CONFIGS } from '../game/levels';

const DEFAULT_THEME = LEVEL_CONFIGS[0].theme;

const BAYER_GLSL = `
float bayer4x4(vec2 p) {
  vec2 c = floor(mod(p, 4.0));
  int idx = int(c.x) + int(c.y) * 4;
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}
`;

/**
 * Dynamic themed sky dome with radiating horizon beams and Bayer 4x4 dithering.
 * Supports Golden Sunset (Level 1), Crimson Dusk (Level 2), and Midnight Ops (Level 3).
 */
export function createSunsetSkyMaterial(theme: LevelTheme = DEFAULT_THEME): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.42, 0.2, -0.88).normalize() },
      uTime: { value: 0 },
      uHorizon: { value: new THREE.Vector3(...theme.skyHorizon) },
      uMid: { value: new THREE.Vector3(...theme.skyMid) },
      uUpper: { value: new THREE.Vector3(...theme.skyUpper) },
      uZenith: { value: new THREE.Vector3(...theme.skyZenith) },
      uRayColor: { value: new THREE.Vector3(...theme.sunRayColor) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform vec3 uHorizon;
      uniform vec3 uMid;
      uniform vec3 uUpper;
      uniform vec3 uZenith;
      uniform vec3 uRayColor;
      varying vec3 vWorldDir;
      ${BAYER_GLSL}

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -0.1, 1.0);

        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.19, h));
        col = mix(col, uUpper, smoothstep(0.16, 0.42, h));
        col = mix(col, uZenith, smoothstep(0.38, 0.85, h));

        float sunDot = max(0.0, dot(dir, uSunDir));
        float glow = pow(sunDot, 5.0) * 0.32;
        float angle = atan(dir.y - uSunDir.y * 0.65, dir.x - uSunDir.x);
        float rays = smoothstep(0.25, 0.85, sin(angle * 11.0 + uTime * 0.08) * 0.5 + 0.5);
        float rayMask = smoothstep(-0.02, 0.14, h) * (1.0 - smoothstep(0.25, 0.68, h)) * pow(sunDot, 1.4);
        col += uRayColor * (glow + rays * rayMask * 0.18);

        float d = (bayer4x4(gl_FragCoord.xy) - 0.5) / 14.0;
        col = floor(clamp(col + d, 0.0, 1.0) * 14.0 + 0.5) / 14.0;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Dynamic themed coastal bay water shader with animated glittering sun/moon sparkles
 * and foamy shoreline surf.
 */
export function createBayWaterMaterial(theme: LevelTheme = DEFAULT_THEME): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.24, -0.86).normalize() },
      uShallow: { value: new THREE.Vector3(...theme.waterShallow) },
      uMidWater: { value: new THREE.Vector3(...theme.waterMid) },
      uDeepWater: { value: new THREE.Vector3(...theme.waterDeep) },
      uGlintColor: { value: new THREE.Vector3(...theme.sunRayColor) },
      uFogColor: { value: new THREE.Color(theme.fogColor) },
      uFogNear: { value: 340.0 },
      uFogFar: { value: 860.0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uShallow;
      uniform vec3 uMidWater;
      uniform vec3 uDeepWater;
      uniform vec3 uGlintColor;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorldPos;
      ${BAYER_GLSL}

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float coastDist(vec2 xz) {
        float wave = sin(xz.y * 0.017) * 26.0 + cos(xz.y * 0.033) * 12.0;
        float shoreX = 28.0 - xz.y * 0.42 + wave;
        float dPen = xz.x - shoreX;
        float southCove = xz.y > 140.0 ? (xz.y - 140.0) * 0.55 : 0.0;
        float sugar = length(xz - vec2(245.0, -215.0)) - 92.0;
        float farRim = xz.y + 295.0 + sin(xz.x * 0.014) * 32.0;
        return min(min(max(dPen, southCove - 90.0), sugar), farRim);
      }

      void main() {
        vec2 p = vWorldPos.xz;
        float cd = coastDist(p);

        float ripple = sin(p.x * 0.14 + uTime * 1.4) * cos(p.y * 0.12 - uTime * 1.1);
        float depthT = clamp((cd + ripple * 4.0) / 140.0, 0.0, 1.0);
        vec3 col = mix(uShallow, uMidWater, smoothstep(0.0, 0.36, depthT));
        col = mix(col, uDeepWater, smoothstep(0.30, 0.95, depthT));

        float foamWave = sin(cd * 0.65 - uTime * 2.4 + sin(p.y * 0.08) * 2.0);
        float foamMask = (1.0 - smoothstep(0.0, 8.5, cd)) * step(0.15, foamWave + (1.0 - cd / 6.0));
        col = mix(col, vec3(0.93, 0.98, 0.99), clamp(foamMask, 0.0, 0.85));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 halfVec = normalize(viewDir + uSunDir);
        float specBand = pow(max(0.0, dot(vec3(0.0, 1.0, 0.0), halfVec)), 4.5);
        vec2 cell = floor(p * 0.44 + vec2(floor(uTime * 2.0) * 0.35, -floor(uTime * 1.6) * 0.22));
        float twinkle = hash21(cell + floor(uTime * 4.5) * 0.17);
        float glint = step(0.87 - specBand * 0.34, twinkle) * smoothstep(4.0, 24.0, cd);
        vec3 brightGlint = mix(vec3(1.0, 0.98, 0.92), uGlintColor, 0.35);
        col = mix(col, brightGlint, glint * 0.92);

        float streak = step(0.78, sin(p.x * 0.18 + p.y * 0.07 + uTime * 1.8) * 0.5 + 0.5);
        col += vec3(0.04, 0.08, 0.10) * streak;

        float d = (bayer4x4(gl_FragCoord.xy) - 0.5) / 16.0;
        col = floor(clamp(col + d, 0.0, 1.0) * 16.0 + 0.5) / 16.0;

        float dist = length(cameraPosition - vWorldPos);
        float fogT = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, fogT * 0.72);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Dynamic themed Bayer-dithered clouds matching each level's time-of-day palette.
 */
export function createDitherCloudMaterial(theme: LevelTheme = DEFAULT_THEME): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.45, 0.25, -0.86).normalize() },
      uShadow: { value: new THREE.Vector3(...theme.cloudShadow) },
      uMid: { value: new THREE.Vector3(...theme.cloudMid) },
      uTop: { value: new THREE.Vector3(...theme.cloudTop) },
    },
    vertexShader: `
      varying vec3 vNormalW;
      void main() {
        #ifdef USE_INSTANCING
          mat3 nMat = mat3(modelMatrix) * mat3(instanceMatrix);
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          mat3 nMat = mat3(modelMatrix);
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        vNormalW = normalize(nMat * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uShadow;
      uniform vec3 uMid;
      uniform vec3 uTop;
      varying vec3 vNormalW;
      ${BAYER_GLSL}

      void main() {
        vec3 n = normalize(vNormalW);
        float upLight = clamp(n.y * 0.72 + dot(n, uSunDir) * 0.35 + 0.32, 0.0, 1.0);
        float dither = bayer4x4(gl_FragCoord.xy);

        vec3 col = uShadow;
        if (upLight + (dither - 0.5) * 0.24 > 0.32) col = uMid;
        if (upLight + (dither - 0.5) * 0.24 > 0.58) col = uTop;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function applyLevelThemeToShaders(
  theme: LevelTheme,
  skyMat: THREE.ShaderMaterial,
  waterMat: THREE.ShaderMaterial,
  cloudMat: THREE.ShaderMaterial,
): void {
  (skyMat.uniforms.uHorizon.value as THREE.Vector3).set(...theme.skyHorizon);
  (skyMat.uniforms.uMid.value as THREE.Vector3).set(...theme.skyMid);
  (skyMat.uniforms.uUpper.value as THREE.Vector3).set(...theme.skyUpper);
  (skyMat.uniforms.uZenith.value as THREE.Vector3).set(...theme.skyZenith);
  (skyMat.uniforms.uRayColor.value as THREE.Vector3).set(...theme.sunRayColor);

  (waterMat.uniforms.uShallow.value as THREE.Vector3).set(...theme.waterShallow);
  (waterMat.uniforms.uMidWater.value as THREE.Vector3).set(...theme.waterMid);
  (waterMat.uniforms.uDeepWater.value as THREE.Vector3).set(...theme.waterDeep);
  (waterMat.uniforms.uGlintColor.value as THREE.Vector3).set(...theme.sunRayColor);
  (waterMat.uniforms.uFogColor.value as THREE.Color).set(theme.fogColor);

  (cloudMat.uniforms.uShadow.value as THREE.Vector3).set(...theme.cloudShadow);
  (cloudMat.uniforms.uMid.value as THREE.Vector3).set(...theme.cloudMid);
  (cloudMat.uniforms.uTop.value as THREE.Vector3).set(...theme.cloudTop);
}
