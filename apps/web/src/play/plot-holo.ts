import * as THREE from 'three';
import type { PlotGround } from './plot-ground';
import type { PlotState } from '@hm/plotsim';
import { METRIC_COLOUR } from './quest';
import { PIXELS_OF } from './machine-props';

export interface ReliefSampleOptions {
  /** Grid dimensions (N x N points). Defaults to 48. */
  readonly gridSize?: number;
  /** Plot radius in meters on the planet. Defaults to 500. */
  readonly plotRadius?: number;
  /** Projected hologram radius on the table in meters. Defaults to 0.85 (1.7 m diameter). */
  readonly holoRadius?: number;
  /** Hologram base height above the lab floor. Table top is 0.95; 1.15 is +0.20 m. */
  readonly baseY?: number;
  /** Visual height range of hills in hologram meters (0.12 .. 0.15 m). Defaults to 0.14. */
  readonly targetHeightRange?: number;
  /** Height sampling function on the planet. */
  readonly heightFn: (x: number, z: number) => number;
  /** Position of the gate on the planet (plot centre). */
  readonly gate: { readonly x: number; readonly z: number };
}

export interface ReliefData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly plotCoords: Float32Array;
  readonly worldHeights: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly heightRange: number;
}

const DEFAULT_GRID_SIZE = 48;
const DEFAULT_PLOT_RADIUS = 500;
const DEFAULT_HOLO_RADIUS = 0.85; // 1.7 m diameter
const DEFAULT_BASE_Y = 1.15; // 0.95 + 0.20 m
const DEFAULT_TARGET_HEIGHT_RANGE = 0.14; // 0.12 .. 0.15 m
const SPARKLE_COUNT = 40;
const MAX_MARKERS = 64;

/**
 * Pure function sampling the plot's terrain onto a clipped disc relief grid.
 */
export function sampleReliefGrid(o: ReliefSampleOptions): ReliefData {
  const N = Math.max(4, o.gridSize ?? DEFAULT_GRID_SIZE);
  const plotR = o.plotRadius ?? DEFAULT_PLOT_RADIUS;
  const holoR = o.holoRadius ?? DEFAULT_HOLO_RADIUS;
  const baseY = o.baseY ?? DEFAULT_BASE_Y;
  const targetHRange = o.targetHeightRange ?? DEFAULT_TARGET_HEIGHT_RANGE;
  const gateX = o.gate.x, gateZ = o.gate.z;

  const totalPoints = N * N;
  const rawH = new Float32Array(totalPoints);
  const dxArr = new Float32Array(totalPoints);
  const dzArr = new Float32Array(totalPoints);
  const inside = new Uint8Array(totalPoints);

  let minH = Infinity;
  let maxH = -Infinity;

  for (let iz = 0; iz < N; iz++) {
    const v = (iz / (N - 1)) * 2 - 1;
    const dz = v * plotR;
    for (let ix = 0; ix < N; ix++) {
      const idx = iz * N + ix;
      const u = (ix / (N - 1)) * 2 - 1;
      const dx = u * plotR;
      const dist = Math.hypot(dx, dz);
      dxArr[idx] = dx;
      dzArr[idx] = dz;

      const h = o.heightFn(gateX + dx, gateZ + dz);
      rawH[idx] = h;

      if (dist <= plotR) {
        inside[idx] = 1;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
  }

  if (!Number.isFinite(minH) || !Number.isFinite(maxH)) {
    minH = 0;
    maxH = 1;
  }
  const hRange = Math.max(1.0, maxH - minH);

  // Collect triangles for quads whose corners fall inside the disc
  const triIndices: number[] = [];
  const usedVertexMap = new Int32Array(totalPoints).fill(-1);
  const usedGridIndices: number[] = [];

  const getOrAddVertex = (gridIdx: number): number => {
    let remapped = usedVertexMap[gridIdx]!;
    if (remapped === -1) {
      remapped = usedGridIndices.length;
      usedVertexMap[gridIdx] = remapped;
      usedGridIndices.push(gridIdx);
    }
    return remapped;
  };

  for (let iz = 0; iz < N - 1; iz++) {
    for (let ix = 0; ix < N - 1; ix++) {
      const i00 = iz * N + ix;
      const i10 = iz * N + (ix + 1);
      const i01 = (iz + 1) * N + ix;
      const i11 = (iz + 1) * N + (ix + 1);

      const in00 = inside[i00]!, in10 = inside[i10]!, in01 = inside[i01]!, in11 = inside[i11]!;

      // Quad triangle 1: (00, 10, 11)
      if (in00 && in10 && in11) {
        triIndices.push(getOrAddVertex(i00), getOrAddVertex(i10), getOrAddVertex(i11));
      }
      // Quad triangle 2: (00, 11, 01)
      if (in00 && in11 && in01) {
        triIndices.push(getOrAddVertex(i00), getOrAddVertex(i11), getOrAddVertex(i01));
      }
    }
  }

  const vertexCount = usedGridIndices.length;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const plotCoords = new Float32Array(vertexCount * 2);
  const worldHeights = new Float32Array(vertexCount);
  const indices = new Uint32Array(triIndices);

  for (let vi = 0; vi < vertexCount; vi++) {
    const gridIdx = usedGridIndices[vi]!;
    const dx = dxArr[gridIdx]!;
    const dz = dzArr[gridIdx]!;
    const h = rawH[gridIdx]!;

    const normX = dx / plotR;
    const normZ = dz / plotR;
    const hNorm = (h - minH) / hRange;

    positions[vi * 3] = normX * holoR;
    positions[vi * 3 + 1] = baseY + hNorm * targetHRange;
    positions[vi * 3 + 2] = normZ * holoR;

    uvs[vi * 2] = normX * 0.5 + 0.5;
    uvs[vi * 2 + 1] = normZ * 0.5 + 0.5;

    plotCoords[vi * 2] = dx;
    plotCoords[vi * 2 + 1] = dz;

    worldHeights[vi] = h;
  }

  // Calculate face normals and accumulate
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3;
    const ax = positions[a]!, ay = positions[a + 1]!, az = positions[a + 2]!;
    const bx = positions[b]!, by = positions[b + 1]!, bz = positions[b + 2]!;
    const cx = positions[c]!, cy = positions[c + 1]!, cz = positions[c + 2]!;

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    normals[a] = normals[a]! + nx;
    normals[a + 1] = normals[a + 1]! + ny;
    normals[a + 2] = normals[a + 2]! + nz;

    normals[b] = normals[b]! + nx;
    normals[b + 1] = normals[b + 1]! + ny;
    normals[b + 2] = normals[b + 2]! + nz;

    normals[c] = normals[c]! + nx;
    normals[c + 1] = normals[c + 1]! + ny;
    normals[c + 2] = normals[c + 2]! + nz;
  }

  // Normalize vertex normals
  for (let vi = 0; vi < vertexCount; vi++) {
    const idx = vi * 3;
    const nx = normals[idx]!, ny = normals[idx + 1]!, nz = normals[idx + 2]!;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-6) {
      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    } else {
      normals[idx] = 0;
      normals[idx + 1] = 1;
      normals[idx + 2] = 0;
    }
  }

  return {
    positions, normals, uvs, plotCoords, worldHeights, indices,
    triangleCount: indices.length / 3,
    vertexCount, minHeight: minH, maxHeight: maxH, heightRange: hRange,
  };
}

/**
 * Maps a planet point relative to the gate into local hologram space.
 */
export function mapPlotToHolo(
  dx: number,
  dz: number,
  groundHeight: number,
  minHeight: number,
  heightRange: number,
  options?: Partial<ReliefSampleOptions>,
): { x: number; y: number; z: number } {
  const plotR = options?.plotRadius ?? DEFAULT_PLOT_RADIUS;
  const holoR = options?.holoRadius ?? DEFAULT_HOLO_RADIUS;
  const baseY = options?.baseY ?? DEFAULT_BASE_Y;
  const targetHRange = options?.targetHeightRange ?? DEFAULT_TARGET_HEIGHT_RANGE;

  const normX = dx / plotR;
  const normZ = dz / plotR;
  const hNorm = Math.max(0, Math.min(1, (groundHeight - minHeight) / Math.max(1, heightRange)));

  return {
    x: normX * holoR,
    y: baseY + hNorm * targetHRange,
    z: normZ * holoR,
  };
}

const RELIEF_VERTEX = /* glsl */ `
  attribute vec2 aPlotCoords;
  attribute float aWorldHeight;

  uniform float uTime;
  uniform float uWaveR;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPos;
  varying float vDistPlot;
  varying float vWorldHeight;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vLocalPos = position;
    vDistPlot = length(aPlotCoords);
    vWorldHeight = aWorldHeight;
    vUv = uv;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const RELIEF_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  uniform float uWaveR;
  uniform float uFlicker;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPos;
  varying float vDistPlot;
  varying float vWorldHeight;
  varying vec2 vUv;

  void main() {
    if (uPower <= 0.001) discard;

    vec3 amberBase = vec3(1.0, 0.65, 0.15);
    vec3 amberBright = vec3(1.0, 0.94, 0.42);
    vec3 amberDeep = vec3(0.52, 0.26, 0.03);

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);
    float slope = clamp(N.y, 0.25, 1.0);

    // Sharp lit rim for contouring terrain shapes from distance (POL-19)
    float fresnel = pow(1.0 - max(0.0, dot(N, V)), 1.85);

    // Minor contour lines every 10 meters of height
    float minorMod = abs(fract(vWorldHeight / 10.0 - 0.5) - 0.5);
    float minorWidth = fwidth(vWorldHeight / 10.0) * 2.2;
    float minorContour = 1.0 - smoothstep(0.0, max(minorWidth, 0.05), minorMod);

    // Major index contour lines every 50 meters (bold, brighter)
    float majorMod = abs(fract(vWorldHeight / 50.0 - 0.5) - 0.5);
    float majorWidth = fwidth(vWorldHeight / 50.0) * 3.0;
    float majorContour = 1.0 - smoothstep(0.0, max(majorWidth, 0.075), majorMod);

    float contour = max(minorContour * 0.9, majorContour * 1.5);

    // Fine horizontal scanlines drifting upward
    float scanline = sin(vLocalPos.y * 360.0 - uTime * 7.5);
    float scan = 0.82 + 0.18 * scanline;

    // Disc perimeter soft falloff
    float edgeDist = length(vLocalPos.xz);
    float rimFalloff = smoothstep(0.85, 0.81, edgeDist);

    // Luminous perimeter disc boundary ring
    float discEdgeRing = smoothstep(0.79, 0.835, edgeDist) * smoothstep(0.855, 0.835, edgeDist);

    // Stage wave sweep ring
    float waveRing = 0.0;
    if (uWaveR >= 0.0) {
      float d = abs(vDistPlot - uWaveR);
      waveRing = smoothstep(16.0, 0.0, d) * 1.8;
    }

    vec3 col = mix(amberDeep, amberBase, slope * 0.7 + 0.3);
    col += amberBright * (contour * 1.1);
    col += vec3(1.0, 0.95, 0.7) * (waveRing * 1.4);
    col += amberBright * (fresnel * 1.25);
    col += amberBright * (discEdgeRing * 1.4);
    col *= scan;

    float flicker = 0.96 + 0.04 * sin(uTime * 37.0) * cos(uTime * 21.0);
    col *= flicker * uFlicker * uPower;

    float alpha = clamp((0.55 * slope + 0.45 * fresnel + contour * 0.55 + discEdgeRing * 0.75 + waveRing * 0.8) * rimFalloff * uPower, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

export interface PlotHolo {
  readonly group: THREE.Group;
  /** Builds the relief geometry once ground and gate are ready */
  build(ground: PlotGround, gatePos: { readonly x: number; readonly z: number }): void;
  /** Updates the machine list and connectivity */
  setPlot(plot: PlotState, running: ReadonlyMap<number, number>, connected: ReadonlySet<number>): void;
  /** Frame update for shader time, sparkles, wave radius, and machine pulse */
  update(now: number, dt: number, power: number, waveR: number): void;
  /** Debug hook exposed to hmPlay */
  debug(): { readonly visible: boolean; readonly machines: number };
  /** Precompiles materials behind loading screen */
  warm(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void;
  dispose(): void;
}

export function createPlotHolo(): PlotHolo {
  const group = new THREE.Group();
  group.visible = false;

  let reliefMesh: THREE.Mesh | null = null;
  let reliefGeo: THREE.BufferGeometry | null = null;

  const reliefUniforms = {
    uTime: { value: 0 },
    uPower: { value: 0 },
    uWaveR: { value: -1 },
    uFlicker: { value: 1 },
  };

  const reliefMat = new THREE.ShaderMaterial({
    vertexShader: RELIEF_VERTEX,
    fragmentShader: RELIEF_FRAGMENT,
    uniforms: reliefUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  // ---- Markers: InstancedMesh (1 gate ring + up to 63 machines = 64)
  const pinGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  pinGeo.translate(0, 0.5, 0); // Base at y=0

  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const markerMesh = new THREE.InstancedMesh(pinGeo, markerMat, MAX_MARKERS);
  markerMesh.count = 0;
  markerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  markerMesh.frustumCulled = false;
  group.add(markerMesh);

  // ---- Sparkles: 40 rising amber points
  const sparkleGeo = new THREE.BufferGeometry();
  const sparklePositions = new Float32Array(SPARKLE_COUNT * 3);
  const sparkleSpeeds = new Float32Array(SPARKLE_COUNT);
  const sparkleAngles = new Float32Array(SPARKLE_COUNT);
  const sparkleRadii = new Float32Array(SPARKLE_COUNT);

  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const r = 0.72 + Math.random() * 0.15;
    sparkleAngles[i] = angle;
    sparkleRadii[i] = r;
    sparkleSpeeds[i] = 0.04 + Math.random() * 0.05;

    sparklePositions[i * 3] = Math.cos(angle) * r;
    sparklePositions[i * 3 + 1] = DEFAULT_BASE_Y - 0.1 + Math.random() * 0.35;
    sparklePositions[i * 3 + 2] = Math.sin(angle) * r;
  }
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));

  const sparkleMat = new THREE.PointsMaterial({
    color: 0xffa526,
    size: 0.024,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const sparklePoints = new THREE.Points(sparkleGeo, sparkleMat);
  sparklePoints.frustumCulled = false;
  group.add(sparklePoints);

  // Cache state
  let cachedGround: PlotGround | null = null;
  let cachedGate = { x: 0, z: 0 };
  let cachedPlot: PlotState | null = null;
  let cachedRunning: ReadonlyMap<number, number> = new Map();
  let cachedConnected: ReadonlySet<number> = new Set();
  let reliefBounds = { minHeight: 0, heightRange: 1 };

  let currentPower = 0;
  let prevPower = 0;
  let flickerTimer = 0;
  let machineCount = 0;

  const tempMatrix = new THREE.Matrix4();
  const tempPos = new THREE.Vector3();
  const tempScale = new THREE.Vector3();
  const tempColor = new THREE.Color();

  const syncMarkers = (now: number): void => {
    if (!cachedGround || !cachedPlot) {
      markerMesh.count = 0;
      return;
    }

    const machines = cachedPlot.machines;
    machineCount = machines.length;
    const totalCount = Math.min(MAX_MARKERS, 1 + machines.length);
    markerMesh.count = totalCount;

    // Instance 0: Gate at center
    const gateH = cachedGround.heightAt(cachedGate.x, cachedGate.z);
    const gateHolo = mapPlotToHolo(0, 0, gateH, reliefBounds.minHeight, reliefBounds.heightRange);
    tempPos.set(gateHolo.x, gateHolo.y + 0.002, gateHolo.z);
    tempScale.set(0.034, 0.003, 0.034); // Flat circular ring
    tempMatrix.compose(tempPos, new THREE.Quaternion(), tempScale);
    markerMesh.setMatrixAt(0, tempMatrix);

    const gatePulse = 0.9 + 0.1 * Math.sin(now * 3.5);
    tempColor.set('#ffe088').multiplyScalar(gatePulse * currentPower);
    markerMesh.setColorAt(0, tempColor);

    // Instances 1 .. N: Machines
    for (let i = 0; i < machines.length && i < MAX_MARKERS - 1; i++) {
      const m = machines[i]!;
      const dx = m.x - cachedGate.x;
      const dz = m.z - cachedGate.z;
      const gh = cachedGround.heightAt(m.x, m.z);
      const holoPos = mapPlotToHolo(dx, dz, gh, reliefBounds.minHeight, reliefBounds.heightRange);

      tempPos.set(holoPos.x, holoPos.y, holoPos.z);
      tempScale.set(0.005, 0.065, 0.005); // Vertical light pin
      tempMatrix.compose(tempPos, new THREE.Quaternion(), tempScale);
      markerMesh.setMatrixAt(i + 1, tempMatrix);

      const metric = PIXELS_OF[m.kind];
      const baseHex = metric ? METRIC_COLOUR[metric] : '#fff0cc';
      tempColor.set(baseHex);

      const isConnected = cachedConnected.has(m.id);
      const runShare = cachedRunning.get(m.id) ?? 0;
      const isRunning = isConnected && runShare > 0.05;

      if (isRunning) {
        const pulse = (0.75 + 0.35 * Math.sin(now * 7.0 + m.id * 1.5)) * 1.3;
        tempColor.multiplyScalar(pulse * currentPower);
      } else {
        tempColor.multiplyScalar(0.25 * currentPower);
      }

      markerMesh.setColorAt(i + 1, tempColor);
    }

    markerMesh.instanceMatrix.needsUpdate = true;
    if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
  };

  return {
    group,

    build(ground, gatePos) {
      cachedGround = ground;
      cachedGate = { x: gatePos.x, z: gatePos.z };

      if (reliefMesh) {
        group.remove(reliefMesh);
        reliefGeo?.dispose();
      }

      const data = sampleReliefGrid({
        heightFn: (x, z) => ground.heightAt(x, z),
        gate: cachedGate,
      });

      reliefBounds = { minHeight: data.minHeight, heightRange: data.heightRange };

      reliefGeo = new THREE.BufferGeometry();
      reliefGeo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      reliefGeo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      reliefGeo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
      reliefGeo.setAttribute('aPlotCoords', new THREE.BufferAttribute(data.plotCoords, 2));
      reliefGeo.setAttribute('aWorldHeight', new THREE.BufferAttribute(data.worldHeights, 1));
      reliefGeo.setIndex(new THREE.BufferAttribute(data.indices, 1));

      reliefMesh = new THREE.Mesh(reliefGeo, reliefMat);
      reliefMesh.frustumCulled = false;
      group.add(reliefMesh);

      if (cachedPlot) syncMarkers(0);
    },

    setPlot(plot, running, connected) {
      cachedPlot = plot;
      cachedRunning = running;
      cachedConnected = connected;
      syncMarkers(0);
    },

    update(now, dt, power, waveR) {
      currentPower = power;

      // Power-on flicker detection
      if (prevPower <= 0.001 && power > 0.001) {
        flickerTimer = 0.65;
      }
      prevPower = power;

      let flicker = 1.0;
      if (flickerTimer > 0) {
        flickerTimer -= dt;
        flicker = Math.sin(flickerTimer * 42.0) > 0.1 ? 1.0 : 0.25;
      }

      const visible = power > 0.001;
      group.visible = visible;
      if (!visible) return;

      reliefUniforms.uTime.value = now;
      reliefUniforms.uPower.value = power;
      reliefUniforms.uWaveR.value = waveR;
      reliefUniforms.uFlicker.value = flicker;

      // Sparkles rise and drift
      const posAttr = sparkleGeo.attributes.position as THREE.BufferAttribute;
      const pArr = sparklePositions;
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const idx = i * 3;
        let y = pArr[idx + 1]! + sparkleSpeeds[i]! * dt;
        if (y > DEFAULT_BASE_Y + 0.28) {
          y = DEFAULT_BASE_Y - 0.08 + Math.random() * 0.04;
        }
        pArr[idx + 1] = y;

        const baseA = sparkleAngles[i]!;
        const r = sparkleRadii[i]!;
        pArr[idx] = Math.cos(baseA + Math.sin(now * 1.5 + i) * 0.08) * r;
        pArr[idx + 2] = Math.sin(baseA + Math.cos(now * 1.5 + i) * 0.08) * r;
      }
      posAttr.needsUpdate = true;
      sparkleMat.opacity = power * flicker;

      syncMarkers(now);
    },

    debug: () => ({
      visible: group.visible && currentPower > 0.05,
      machines: machineCount,
    }),

    warm(renderer, camera) {
      if (reliefMesh) {
        renderer.compile(group, camera);
      }
    },

    dispose() {
      if (reliefGeo) reliefGeo.dispose();
      reliefMat.dispose();
      pinGeo.dispose();
      markerMat.dispose();
      sparkleGeo.dispose();
      sparkleMat.dispose();
    },
  };
}
