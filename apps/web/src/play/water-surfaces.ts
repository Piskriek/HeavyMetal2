// ============================================================================
// File: apps/web/src/play/water-surfaces.ts
// TICKET-02 (OPUS_NOTE_08 Item E):
// buildWaterSurfaces(water, heightAt, stage): THREE.Group
// Builds hydro lake & stream water meshes with depth-faded shoreline and sun glint.
// Replaces the flat crater disc from stage 4.
// ============================================================================

import * as THREE from 'three';
import type { Water } from '@hm/hydro';

export interface WaterSurfaceOptions {
  readonly x0?: number;
  readonly z0?: number;
  readonly cellM?: number;
  readonly sunDir?: THREE.Vector3;
}

const WATER_SURFACE_VERTEX = /* glsl */ `
  attribute float aDepth;
  attribute float aStream;

  varying vec3 vWorldPos;
  varying float vDepth;
  varying float vStream;

  void main() {
    vDepth = aDepth;
    vStream = aStream;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const WATER_SURFACE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uSunDir;
  uniform vec3 uShallowColour;
  uniform vec3 uDeepColour;
  uniform vec3 uSkyColour;
  uniform float uStage;
  uniform float uTime;

  varying vec3 vWorldPos;
  varying float vDepth;
  varying float vStream;

  float waveHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    // Discard completely dry exterior skirt vertices
    if (vDepth <= 0.002 && vStream <= 0.002) {
      discard;
    }

    // Dual capillary wave normal for sun glint
    vec2 p = vWorldPos.xz;
    float w1 = sin(p.x * 1.9 + p.y * 1.3 + uTime * 1.8);
    float w2 = cos(p.x * 2.7 - p.y * 2.1 - uTime * 1.4);
    float w3 = sin((p.x - p.y) * 4.3 + uTime * 2.3);
    vec3 N = normalize(vec3((w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * 0.06, 1.0, (w2 * 0.5 - w1 * 0.3 + w3 * 0.2) * 0.06));

    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    if (length(cameraPosition - vWorldPos) < 0.001) {
      V = vec3(0.0, 1.0, 0.0);
    }
    vec3 H = normalize(L + V);

    // Depth-faded shoreline: shallow turquoise (#3dc8ff) -> deep basin teal-sapphire
    float depthFactor = clamp(vDepth / 2.2, 0.0, 1.0);
    vec3 waterCol = mix(uShallowColour, uDeepColour, smoothstep(0.0, 1.0, depthFactor));

    // Stream aeration brighten
    if (vStream > 0.01) {
      waterCol = mix(waterCol, vec3(0.55, 0.88, 0.98), clamp(vStream * 0.45, 0.0, 0.45));
    }

    // Fresnel sky reflection + shoreline foam rim
    float NdotV = max(dot(N, V), 0.05);
    float fresnel = 0.06 + 0.65 * pow(1.0 - NdotV, 4.0);
    float diffuse = 0.55 + 0.45 * max(dot(N, L), 0.0);
    vec3 baseLit = mix(waterCol * diffuse, uSkyColour, fresnel * 0.45);

    // Crisp solar specular glint
    float NdotH = max(dot(N, H), 0.0);
    float glint = pow(NdotH, 96.0) * 1.35 + pow(NdotH, 16.0) * 0.18;
    vec3 finalCol = baseLit + vec3(1.0, 0.95, 0.82) * glint;

    // Soft depth-faded shoreline alpha (0 at water's edge -> 0.88 in deep basin)
    float effDepth = max(vDepth, vStream * 0.35);
    float shoreAlpha = smoothstep(0.0, 0.42, effDepth);
    float alpha = clamp(shoreAlpha * (0.78 + 0.16 * depthFactor + 0.15 * glint), 0.0, 0.94);

    gl_FragColor = vec4(finalCol, alpha);
  }
`;

/**
 * Infers the world grid origin (x0, z0) and cell size (cellM) by matching
 * `water.level[i] - water.depth[i]` (which equals the terrain height passed to `hydro.flood`)
 * against `heightAt(x, z)`. Falls back to centered 256 m plot if `heightAt` is flat/synthetic.
 */
export function inferWaterGridFrame(
  water: Water,
  n: number,
  heightAt: (x: number, z: number) => number,
  opts?: WaterSurfaceOptions,
): { x0: number; z0: number; cellM: number } {
  if (
    opts?.x0 !== undefined &&
    opts?.z0 !== undefined &&
    opts?.cellM !== undefined
  ) {
    return { x0: opts.x0, z0: opts.z0, cellM: opts.cellM };
  }

  const total = n * n;
  const sampleIndices: number[] = [
    0,
    Math.floor(n * 0.27) * n + Math.floor(n * 0.33),
    Math.floor(n * 0.5) * n + Math.floor(n * 0.5),
    Math.floor(n * 0.73) * n + Math.floor(n * 0.68),
    total - 1,
  ].filter((idx) => idx >= 0 && idx < total);

  const candidateSpans = [256, 200, 160, 128, 512, n, n * 2, n * 4];
  let bestCellM = opts?.cellM ?? 256 / Math.max(1, n);
  let bestX0 = opts?.x0 ?? -(n * bestCellM) * 0.5;
  let bestZ0 = opts?.z0 ?? -(n * bestCellM) * 0.5;
  let bestErr = Infinity;

  for (let sIdx = 0; sIdx < candidateSpans.length; sIdx++) {
    const span = candidateSpans[sIdx]!;
    const cellM = opts?.cellM ?? span / Math.max(1, n);
    const origins: readonly [number, number][] = [
      [-(n * cellM) * 0.5, -(n * cellM) * 0.5],
      [0, 0],
    ];
    for (let oIdx = 0; oIdx < origins.length; oIdx++) {
      const ox = opts?.x0 ?? origins[oIdx]![0];
      const oz = opts?.z0 ?? origins[oIdx]![1];
      let err = 0;
      for (let k = 0; k < sampleIndices.length; k++) {
        const i = sampleIndices[k]!;
        const cx = i % n;
        const cz = Math.floor(i / n);
        const wx = ox + (cx + 0.5) * cellM;
        const wz = oz + (cz + 0.5) * cellM;
        const hExpected = (water.level[i] ?? 0) - (water.depth[i] ?? 0);
        const hActual = heightAt(wx, wz);
        err += Math.abs(hExpected - hActual);
      }
      if (err < bestErr) {
        bestErr = err;
        bestCellM = cellM;
        bestX0 = ox;
        bestZ0 = oz;
      }
    }
  }

  return { x0: bestX0, z0: bestZ0, cellM: bestCellM };
}

/**
 * Builds a THREE.Group containing depth-faded, sun-glinted water surface meshes
 * from `@hm/hydro`'s `Water` output. Replaces the flat crater disc from Stage 4+.
 */
export function buildWaterSurfaces(
  water: Water,
  heightAt: (x: number, z: number) => number,
  stage: number,
  options?: WaterSurfaceOptions,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'hydro-water-surfaces';

  const total = water.depth.length;
  const n = Math.round(Math.sqrt(total));
  if (stage < 3 || n < 2 || n * n !== total) {
    return group;
  }

  let hasAnyWater = water.volume > 0;
  if (!hasAnyWater) {
    for (let i = 0; i < total; i++) {
      if ((water.depth[i] ?? 0) > 1e-3 || (water.stream[i] ?? 0) > 1e-3) {
        hasAnyWater = true;
        break;
      }
    }
  }
  if (!hasAnyWater) {
    return group;
  }

  const { x0, z0, cellM } = inferWaterGridFrame(water, n, heightAt, options);

  // Mark active cells: any wet cell (depth > 0 or stream > 0) plus its 1-cell shoreline ring
  const isWet = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if ((water.depth[i] ?? 0) > 1e-3 || (water.stream[i] ?? 0) > 1e-3) {
      isWet[i] = 1;
    }
  }

  const includeCell = new Uint8Array(total);
  let activeQuads = 0;
  for (let z = 0; z < n - 1; z++) {
    const row = z * n;
    const nextRow = (z + 1) * n;
    for (let x = 0; x < n - 1; x++) {
      const i00 = row + x;
      const i10 = row + x + 1;
      const i01 = nextRow + x;
      const i11 = nextRow + x + 1;
      if (isWet[i00] || isWet[i10] || isWet[i01] || isWet[i11]) {
        includeCell[i00] = 1;
        activeQuads++;
      }
    }
  }

  if (activeQuads === 0) {
    return group;
  }

  // Compute representative water surface elevation for shoreline skirt vertices
  // so the water plane extends smoothly into the sloped bank without stepping
  const vertexIndex = new Int32Array(total).fill(-1);
  const positions: number[] = [];
  const normals: number[] = [];
  const depths: number[] = [];
  const streams: number[] = [];
  const indices: number[] = [];

  const getOrAddVertex = (cx: number, cz: number): number => {
    const idx = cz * n + cx;
    const existing = vertexIndex[idx] ?? -1;
    if (existing >= 0) return existing;

    const wx = x0 + (cx + 0.5) * cellM;
    const wz = z0 + (cz + 0.5) * cellM;
    const d = water.depth[idx] ?? 0;
    const st = water.stream[idx] ?? 0;
    const terrainY = heightAt(wx, wz);

    // For a wet lake cell, use its hydro surface level; for a dry bank skirt vertex,
    // use the nearest adjacent wet cell's water level so the water surface stays flat
    // where it meets the sloped shore.
    let wy = terrainY + d;
    if (d <= 1e-3 && st <= 1e-3) {
      let sumLevel = 0;
      let countLevel = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const nIdx = nz * n + nx;
          if ((water.depth[nIdx] ?? 0) > 1e-3) {
            const nwx = x0 + (nx + 0.5) * cellM;
            const nwz = z0 + (nz + 0.5) * cellM;
            sumLevel += heightAt(nwx, nwz) + (water.depth[nIdx] ?? 0);
            countLevel++;
          }
        }
      }
      wy = countLevel > 0 ? sumLevel / countLevel : terrainY - 0.02;
    } else if (d <= 1e-3 && st > 1e-3) {
      wy = terrainY + 0.04;
    }

    const vIdx = positions.length / 3;
    positions.push(wx, wy, wz);
    normals.push(0, 1, 0);
    depths.push(d);
    streams.push(st);
    vertexIndex[idx] = vIdx;
    return vIdx;
  };

  for (let z = 0; z < n - 1; z++) {
    const row = z * n;
    for (let x = 0; x < n - 1; x++) {
      if (!includeCell[row + x]) continue;
      const v00 = getOrAddVertex(x, z);
      const v10 = getOrAddVertex(x + 1, z);
      const v01 = getOrAddVertex(x, z + 1);
      const v11 = getOrAddVertex(x + 1, z + 1);
      indices.push(v00, v01, v10, v10, v01, v11);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute('aStream', new THREE.Float32BufferAttribute(streams, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const sunDir = (options?.sunDir ?? new THREE.Vector3(0.42, 0.34, -0.84)).clone().normalize();
  const material = new THREE.ShaderMaterial({
    vertexShader: WATER_SURFACE_VERTEX,
    fragmentShader: WATER_SURFACE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uSunDir: { value: sunDir },
      uShallowColour: { value: new THREE.Color('#3dc8ff') },
      uDeepColour: { value: new THREE.Color('#0b4f6c') },
      uSkyColour: { value: new THREE.Color('#8db9de') },
      uStage: { value: stage },
      uTime: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hydro-water-mesh';
  mesh.renderOrder = 2;
  group.add(mesh);

  return group;
}
