/* =============================================================================
   HEAVY METAL GP 2 — THREE.JS 3D BASE RENDERER
   Direct WebGL 3D track from Arena AI with rich hand-painted PNG cutout details,
   3D goblin marble racers, dynamic camera rig, and atmospheric transitions.
   ============================================================================= */
import * as THREE from 'three';
import type { GameAssets } from './assets';
import type { SceneFrame } from './scene';
import { RADIUS, TRACK_DISTANCE, LANE_WIDTH, courseY } from './scene';

/* -----------------------------------------------------------------------------
   0. CONFIG & CONSTANTS
   -------------------------------------------------------------------------- */
const TRACK_HALF_WIDTH = LANE_WIDTH * 2; // 480 → 960 wide
const SAMPLE_SPACING = 50;

const LAVA_Y = -7200;
const VALLEY_Y = -3500;
const ARENA_FLOOR_Y = -210;
const CAVE = { xMin: -47500, xMax: -12500, zMin: 26000, zMax: 44000, floorY: -9000, ceilY: 4000, topY: 4600 };
const ALPINE = { x0: -16000, x1: 14000, z0: -14000, z1: 25000, nx: 60, nz: 78 };
const TERRAIN_DROP = 100;
const RIVER_X = -7000;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bump = (x: number, a: number, b: number, feather: number) =>
  smoothstep(a - feather, a, x) * (1 - smoothstep(b, b + feather, x));

function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRandom(1337);
const randRange = (a: number, b: number) => lerp(a, b, rand());

function grounded<T extends THREE.Object3D>(obj: T, name: string): T {
  obj.name = name;
  obj.userData.grounded = true;
  return obj;
}

/* -----------------------------------------------------------------------------
   1. TEXTURES & MATERIALS
   -------------------------------------------------------------------------- */
type TexKey = 'dirt' | 'cliff' | 'cave' | 'lava' | 'wood' | 'grass' | 'cobble' | 'iron' | 'bark' | 'water' | 'grassFringe';
const TEXTURE_FILES: Record<TexKey, string> = {
  dirt: '/textures/dirt.png',
  cliff: '/textures/cliff.png',
  cave: '/textures/caverock.png',
  lava: '/textures/lava.png',
  wood: '/textures/wood.png',
  grass: '/textures/grass.png',
  cobble: '/textures/cobble.png',
  iron: '/textures/iron.png',
  bark: '/textures/bark.png',
  water: '/textures/water.png',
  grassFringe: '/textures/grass-fringe.png',
};

function loadTextures(manager: THREE.LoadingManager) {
  const loader = new THREE.TextureLoader(manager);
  const out = {} as Record<TexKey, THREE.Texture>;
  (Object.keys(TEXTURE_FILES) as TexKey[]).forEach((key) => {
    const t = loader.load(TEXTURE_FILES[key]);
    if (key === 'grassFringe') {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
    } else {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    out[key] = t;
  });
  return out;
}

function makeSeamlessMaterial(
  texture: THREE.Texture,
  extra: THREE.MeshStandardMaterialParameters = {},
  { breakUpRoadRepeat = false }: { breakUpRoadRepeat?: boolean } = {},
) {
  // The tiles are painted to repeat on their own. Sampling one clear image keeps
  // their large value groups legible at race speed. Dirt gets one deliberately
  // restrained alternate sample: it prevents a single tile motif marching down
  // the road without returning to the old noisy multi-tap material treatment.
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    ...extra,
  });
  if (!breakUpRoadRepeat) return material;

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_pars_vertex>',
      `#include <uv_pars_vertex>
      varying vec3 vRoadWorldPos;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <uv_pars_fragment>',
      `#include <uv_pars_fragment>
      varying vec3 vRoadWorldPos;

      float roadHash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float roadPatch(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(roadHash(cell), roadHash(cell + vec2(1.0, 0.0)), local.x),
          mix(roadHash(cell + vec2(0.0, 1.0)), roadHash(cell + vec2(1.0, 1.0)), local.x),
          local.y
        );
      }`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 primaryDirt = texture2D(map, vMapUv);
        // The rotated, offset sample is only a low-strength partner. It preserves
        // the low-contrast brushwork while changing the motif over broad road patches.
        vec2 alternateUv = vec2(-vMapUv.y, vMapUv.x) + vec2(0.371, 0.619);
        vec4 alternateDirt = texture2D(map, alternateUv);
        float broadPatch = smoothstep(0.26, 0.74, roadPatch(vRoadWorldPos.xz * 0.00034));
        diffuseColor *= mix(primaryDirt, alternateDirt, broadPatch * 0.42);
      #endif`,
    );
  };
  return material;
}

function buildMaterials(T: Record<TexKey, THREE.Texture>) {
  const std = (map: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, ...extra });

  return {
    dirt: makeSeamlessMaterial(T.dirt, {}, { breakUpRoadRepeat: true }),
    cliff: makeSeamlessMaterial(T.cliff),
    cave: makeSeamlessMaterial(T.cave),
    wood: std(T.wood),
    grass: makeSeamlessMaterial(T.grass),
    cobble: makeSeamlessMaterial(T.cobble),
    grassFringe: new THREE.MeshStandardMaterial({
      map: T.grassFringe,
      transparent: true,
      alphaTest: 0.055,
      roughness: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    iron: std(T.iron, { metalness: 0.35, roughness: 0.7 }),
    bark: std(T.bark),
    boulder: std(T.cliff, { flatShading: true }),
    caveRock: std(T.cave, { flatShading: true }),
    lava: new THREE.MeshStandardMaterial({
      map: T.lava, emissive: 0xffa040, emissiveMap: T.lava, emissiveIntensity: 1.6, roughness: 1,
    }),
    water: new THREE.MeshStandardMaterial({
      map: T.water, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false,
      emissive: 0x3a7a8a, emissiveIntensity: 0.35, roughness: 0.4,
    }),
    chalk: new THREE.MeshStandardMaterial({
      color: 0xf4ecd8, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    torch: new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff7010, emissiveIntensity: 2.5 }),
    mist: new THREE.MeshStandardMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.18, depthWrite: false }),
  };
}
type Materials = ReturnType<typeof buildMaterials>;

/* -----------------------------------------------------------------------------
   2. TRACK CENTERLINE
   -------------------------------------------------------------------------- */
type Stage = 'alpine' | 'canyon' | 'zigzag' | 'cavern' | 'mine' | 'breakthrough' | 'stadium';

interface LoopDef {
  entry: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  radius: number;
  shift: number;
  fromIdx: number;
  toIdx: number;
  stage: Stage;
}

const waypoints: THREE.Vector3[] = [];
const waypointStage: Stage[] = [];
const labelIndex: Record<string, number> = {};
const loopDefs: LoopDef[] = [];

function wp(x: number, y: number, z: number, stage: Stage, label?: string) {
  if (label) labelIndex[label] = waypoints.length;
  waypoints.push(new THREE.Vector3(x, y, z));
  waypointStage.push(stage);
}

function loop(stage: Stage, entry: THREE.Vector3, forward: THREE.Vector3, radius: number, shift: number, label: string) {
  const fwd = forward.clone().normalize();
  const right = new THREE.Vector3().crossVectors(fwd, WORLD_UP).normalize();
  const fromIdx = waypoints.length;
  const SEGMENTS = 12;
  for (let k = 0; k <= SEGMENTS; k++) {
    const a = (k / SEGMENTS) * Math.PI * 2;
    const p = entry.clone()
      .addScaledVector(fwd, Math.sin(a) * radius)
      .addScaledVector(WORLD_UP, (1 - Math.cos(a)) * radius)
      .addScaledVector(right, (k / SEGMENTS) * shift);
    wp(p.x, p.y, p.z, stage, k === 0 ? label : undefined);
  }
  loopDefs.push({ entry: entry.clone(), forward: fwd, right, radius, shift, fromIdx, toIdx: waypoints.length - 1, stage });
}

function defineCenterline() {
  if (waypoints.length > 0) return; // already defined

  // 1. ALPINE DOWNHILL
  wp(0, 18000, -2400, 'alpine', 'start');
  wp(0, 18000, -1000, 'alpine', 'startRamp');
  wp(0, 17950, 400, 'alpine', 'launchEdge');
  wp(500, 17550, 3000, 'alpine');
  wp(1600, 17000, 5600, 'alpine', 'ramp1');
  wp(1000, 16450, 8200, 'alpine');
  wp(-700, 15950, 10800, 'alpine');
  wp(-1200, 15450, 13200, 'alpine');
  wp(-1200, 15250, 14200, 'alpine');
  loop('alpine', new THREE.Vector3(-1200, 15150, 15200), new THREE.Vector3(0, 0, 1), 1400, 1100, 'alpineLoop');
  wp(-2300, 14950, 16400, 'alpine');
  wp(-1800, 14650, 18400, 'alpine', 'ramp2');
  wp(-800, 14250, 20600, 'alpine');
  wp(-200, 13850, 22800, 'alpine');
  wp(-300, 13650, 24300, 'alpine', 'alpineEnd');

  // 2. CANYON LIP
  wp(-700, 13500, 25300, 'canyon', 'canyonStart');
  wp(-1500, 13350, 26100, 'canyon', 'canyonApex');
  wp(-2500, 13250, 26500, 'canyon');
  wp(-3600, 13150, 26600, 'canyon');

  // 3. WATERFALL CLIFF ZIGZAG
  wp(-6100, 11850, 26650, 'zigzag', 'zigzagStart');
  wp(-8600, 10550, 26700, 'zigzag');
  wp(-10000, 10250, 27300, 'zigzag');
  wp(-10500, 10000, 27900, 'zigzag', 'hairpin1');
  wp(-10000, 9750, 28500, 'zigzag');
  wp(-8600, 9450, 29100, 'zigzag', 'bridge1a');
  wp(-6100, 8150, 29200, 'zigzag', 'bridge1b');
  wp(-3600, 6850, 29200, 'zigzag');
  wp(-2200, 6550, 29800, 'zigzag');
  wp(-1700, 6300, 30400, 'zigzag', 'hairpin2');
  wp(-2200, 6050, 31000, 'zigzag');
  wp(-3600, 5750, 31700, 'zigzag');
  wp(-6100, 4450, 31800, 'zigzag', 'boulders');
  wp(-8600, 3150, 31800, 'zigzag');
  wp(-10000, 2850, 32400, 'zigzag');
  wp(-10500, 2600, 33000, 'zigzag', 'hairpin3');
  wp(-10000, 2350, 33600, 'zigzag');
  wp(-8600, 2050, 34300, 'zigzag', 'bridge2a');
  wp(-6100, 750, 34400, 'zigzag', 'bridge2b');
  wp(-3600, -550, 34400, 'zigzag');
  wp(-2200, -850, 35000, 'zigzag');
  wp(-1700, -1100, 35600, 'zigzag', 'hairpin4');
  wp(-2200, -1350, 36200, 'zigzag');
  wp(-3600, -1650, 36900, 'zigzag');
  wp(-6100, -2200, 37000, 'zigzag');

  // 4. CAVERN ENTRANCE
  wp(-8500, -2700, 37000, 'cavern', 'cavernStart');
  wp(-10500, -3000, 37000, 'cavern');
  wp(-12500, -3300, 37000, 'cavern', 'caveEnter');
  wp(-14500, -3600, 37050, 'cavern');

  // 5. MINE ROLLER COASTER
  wp(-17000, -4200, 37300, 'mine', 'mineStart');
  wp(-19500, -3300, 37800, 'mine');
  wp(-21500, -4700, 37400, 'mine');
  wp(-23300, -4400, 36900, 'mine');
  loop('mine', new THREE.Vector3(-24700, -4500, 36800), new THREE.Vector3(-1, 0, 0), 1600, 1100, 'lavaLoop1');
  wp(-26500, -4700, 35500, 'mine');
  wp(-29000, -3700, 35700, 'mine');
  wp(-31500, -5300, 36200, 'mine');
  wp(-34000, -4800, 36600, 'mine');
  wp(-35700, -5000, 36700, 'mine');
  loop('mine', new THREE.Vector3(-37100, -5100, 36700), new THREE.Vector3(-1, 0, 0), 1500, 1100, 'lavaLoop2');
  wp(-39000, -5500, 35500, 'mine');
  wp(-41000, -5900, 35600, 'mine');
  wp(-43000, -5600, 35400, 'mine');

  // 6. WATERFALL BREAKTHROUGH
  wp(-44300, -5100, 35200, 'breakthrough', 'breakStart');
  wp(-45300, -3700, 35100, 'breakthrough');
  wp(-46200, -2200, 35000, 'breakthrough');
  wp(-47000, -600, 35000, 'breakthrough');
  wp(-47500, -150, 35000, 'breakthrough', 'caveExit');

  // 7. STADIUM FINISH
  wp(-48300, -80, 35000, 'stadium', 'stadiumStart');
  wp(-49500, 0, 35000, 'stadium');
  wp(-51500, 0, 35000, 'stadium', 'grandstand');
  wp(-53200, 0, 35000, 'stadium', 'finish');
  wp(-54300, 0, 35000, 'stadium', 'end');
}

/* -----------------------------------------------------------------------------
   3. FRAME SAMPLING
   -------------------------------------------------------------------------- */
export interface TrackSample {
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  dist: number;
  stage: Stage;
  halfWidth: number;
  turnRate: number;
  inLoop: boolean;
  onBridge: boolean;
}

export interface TrackData {
  curve: THREE.CatmullRomCurve3;
  length: number;
  samples: TrackSample[];
  distOf: (label: string) => number;
  stageStart: Record<Stage, number>;
  stageEnd: Record<Stage, number>;
  loops: { start: number; end: number; def: LoopDef }[];
  bridges: { start: number; end: number }[];
  sampleAt: (dist: number) => TrackSample;
}

function buildTrack(): TrackData {
  defineCenterline();
  const curve = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal');
  curve.arcLengthDivisions = 6000;
  const lengths = curve.getLengths(6000);
  const length = lengths[lengths.length - 1];

  const distAtWaypoint = (i: number) => {
    const t = i / (waypoints.length - 1);
    const f = t * 6000;
    const k = Math.min(5999, Math.floor(f));
    return lerp(lengths[k], lengths[k + 1], f - k);
  };
  const distOf = (label: string) => distAtWaypoint(labelIndex[label]);

  const stageStart = {} as Record<Stage, number>;
  const stageEnd = {} as Record<Stage, number>;
  waypointStage.forEach((s, i) => {
    if (stageStart[s] === undefined) stageStart[s] = distAtWaypoint(i);
    stageEnd[s] = i + 1 < waypoints.length ? distAtWaypoint(i + 1) : length;
  });

  const loops = loopDefs.map((def) => ({ start: distAtWaypoint(def.fromIdx), end: distAtWaypoint(def.toIdx), def }));
  const bridges = [
    { start: distOf('bridge1a'), end: distOf('bridge1b') },
    { start: distOf('bridge2a'), end: distOf('bridge2b') },
  ];

  const halfWidthAt = (d: number) => {
    let hw = TRACK_HALF_WIDTH;
    hw = lerp(hw, 400, bump(d, stageStart.canyon, stageEnd.canyon, 700));
    bridges.forEach((b) => (hw = lerp(hw, 420, bump(d, b.start, b.end, 300))));
    hw = lerp(hw, 660, smoothstep(stageStart.stadium - 300, stageStart.stadium + 1200, d));
    return hw;
  };

  const count = Math.ceil(length / SAMPLE_SPACING);
  const samples: TrackSample[] = [];
  const transportUp = new THREE.Vector3(0, 1, 0);
  const prevTangent = new THREE.Vector3(0, 0, 1);
  let bank = 0;
  const BANK_GAIN = 7;

  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const dist = u * length;
    const pos = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();

    transportUp.addScaledVector(tangent, -transportUp.dot(tangent)).normalize();
    const gravityUp = WORLD_UP.clone().addScaledVector(tangent, -tangent.y);
    if (gravityUp.lengthSq() > 0.04) {
      gravityUp.normalize();
      transportUp.lerp(gravityUp, 0.12 * clamp(transportUp.y, 0, 1)).normalize();
    }
    const turn = i === 0 ? 0 : new THREE.Vector3().crossVectors(prevTangent, tangent).dot(transportUp);
    bank = lerp(bank, clamp(-turn * BANK_GAIN, -0.35, 0.35), 0.15);
    const up = transportUp.clone().applyAxisAngle(tangent, bank).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    prevTangent.copy(tangent);

    let stage: Stage = 'stadium';
    for (const s of Object.keys(stageStart) as Stage[]) if (dist >= stageStart[s] && dist < stageEnd[s]) stage = s;

    samples.push({
      pos, tangent, up, right, dist, stage,
      halfWidth: halfWidthAt(dist),
      turnRate: turn / SAMPLE_SPACING,
      inLoop: loops.some((l) => dist >= l.start - 60 && dist <= l.end + 60),
      onBridge: bridges.some((b) => dist >= b.start && dist <= b.end),
    });
  }

  const sampleAt = (dist: number) => samples[clamp(Math.round(dist / length * count), 0, count)];
  return { curve, length, samples, distOf, stageStart, stageEnd, loops, bridges, sampleAt };
}

function trackYAtX(samples: TrackSample[], x: number, pred: (s: TrackSample) => boolean) {
  let best: TrackSample | null = null;
  let bestD = Infinity;
  for (const s of samples) {
    if (!pred(s)) continue;
    const d = Math.abs(s.pos.x - x);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best ? best.pos.y : 0;
}

/* -----------------------------------------------------------------------------
   4. GEOMETRY BUILDERS
   -------------------------------------------------------------------------- */
interface ProfilePoint { side: number; offset: number; height: number }
const P = (side: number, offset: number, height: number): ProfilePoint => ({ side, offset, height });
const mirror = (profile: ProfilePoint[]) =>
  profile.map((p) => P(-p.side, -p.offset, p.height)).reverse();

type ProfileSource = ProfilePoint[] | ((s: TrackSample) => ProfilePoint[]);
const profileAt = (src: ProfileSource, s: TrackSample) => (typeof src === 'function' ? src(s) : src);

function sweepProfile(
  samples: TrackSample[], i0: number, i1: number, profile: ProfileSource, material: THREE.Material,
  opts: { texScale?: number; stride?: number; uvMode?: 'standard' | 'fringe' } = {},
) {
  const texScale = opts.texScale ?? 480;
  const stride = opts.stride ?? 1;
  const rows: TrackSample[] = [];
  for (let i = i0; i < i1; i += stride) rows.push(samples[i]);
  rows.push(samples[i1]);

  const cols = profileAt(profile, rows[0]).length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();

  rows.forEach((s) => {
    const pts = profileAt(profile, s);
    let uAcc = 0;
    for (let c = 0; c < cols; c++) {
      const p = pts[c];
      const x = p.side * s.halfWidth + p.offset;
      if (c > 0) {
        const q = pts[c - 1];
        uAcc += Math.hypot(x - (q.side * s.halfWidth + q.offset), p.height - q.height);
      }
      v.copy(s.pos).addScaledVector(s.right, x).addScaledVector(s.up, p.height);
      positions.push(v.x, v.y, v.z);
      if (opts.uvMode === 'fringe') {
        const vCoord = cols > 1 ? c / (cols - 1) : 0;
        uvs.push(s.dist / texScale, vCoord);
      } else {
        uvs.push(uAcc / texScale, s.dist / texScale);
      }
    }
  });
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, c2 = a + cols, d = c2 + 1;
      indices.push(a, b, c2, b, d, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function capWall(s: TrackSample, chain: ProfilePoint[], material: THREE.Material, texScale = 1400) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  chain.forEach((p) => {
    const x = p.side * s.halfWidth + p.offset;
    const v = s.pos.clone().addScaledVector(s.right, x).addScaledVector(s.up, p.height);
    positions.push(v.x, v.y, v.z);
    uvs.push(x / texScale, p.height / texScale);
  });
  for (let i = 1; i < chain.length - 1; i++) indices.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function rangesWhere(samples: TrackSample[], pred: (s: TrackSample) => boolean, extend = 1) {
  const out: [number, number][] = [];
  let start = -1;
  samples.forEach((s, i) => {
    const ok = pred(s);
    if (ok && start < 0) start = i;
    if ((!ok || i === samples.length - 1) && start >= 0) {
      const end = Math.min(samples.length - 1, (ok ? i : i - 1) + extend);
      if (end > start) out.push([start, end]);
      start = -1;
    }
  });
  return out;
}

function buildHeightfield(
  x0: number, x1: number, z0: number, z1: number, nx: number, nz: number,
  heightAt: (x: number, z: number) => number,
  grassMat: THREE.Material, rockMat: THREE.Material,
  opts: { texScale?: number; rockSlope?: number; skirtY?: number } = {},
) {
  const texScale = opts.texScale ?? 1500;
  const rockSlope = opts.rockSlope ?? 0.55;
  const group = new THREE.Group();

  const H: number[] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let iz = 0; iz <= nz; iz++) {
    for (let ix = 0; ix <= nx; ix++) {
      const x = lerp(x0, x1, ix / nx), z = lerp(z0, z1, iz / nz);
      const y = heightAt(x, z);
      H.push(y);
      positions.push(x, y, z);
      uvs.push(x / texScale, z / texScale);
    }
  }
  const cellX = (x1 - x0) / nx, cellZ = (z1 - z0) / nz;
  const grassIdx: number[] = [];
  const rockIdx: number[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, d = c + 1;
      const sx = (H[b] - H[a] + H[d] - H[c]) / (2 * cellX);
      const sz = (H[c] - H[a] + H[d] - H[b]) / (2 * cellZ);
      const target = Math.hypot(sx, sz) > rockSlope ? rockIdx : grassIdx;
      target.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex([...grassIdx, ...rockIdx]);
  geo.addGroup(0, grassIdx.length, 0);
  geo.addGroup(grassIdx.length, rockIdx.length, 1);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, [grassMat, rockMat]);
  mesh.name = 'Terrain';
  group.add(mesh);

  if (opts.skirtY !== undefined) {
    const edge = (pts: THREE.Vector3[]) => group.add(skirtStrip(pts, opts.skirtY!, rockMat));
    const row = (iz: number) => Array.from({ length: nx + 1 }, (_, ix) => new THREE.Vector3(lerp(x0, x1, ix / nx), H[iz * (nx + 1) + ix], lerp(z0, z1, iz / nz)));
    const col = (ix: number) => Array.from({ length: nz + 1 }, (_, iz) => new THREE.Vector3(lerp(x0, x1, ix / nx), H[iz * (nx + 1) + ix], lerp(z0, z1, iz / nz)));
    edge(row(0)); edge(row(nz)); edge(col(0)); edge(col(nx));
  }
  return group;
}

function skirtStrip(points: THREE.Vector3[], bottomY: number, material: THREE.Material, texScale = 1600) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let along = 0;
  points.forEach((p, i) => {
    if (i > 0) along += p.distanceTo(points[i - 1]);
    positions.push(p.x, p.y, p.z, p.x, bottomY, p.z);
    uvs.push(along / texScale, p.y / texScale, along / texScale, bottomY / texScale);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function boxMesh(w: number, h: number, d: number, material: THREE.Material, texScale = 600) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const faceDims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [fu, fv] = faceDims[Math.floor(i / 4)];
    uv.setXY(i, uv.getX(i) * fu / texScale, uv.getY(i) * fv / texScale);
  }
  return new THREE.Mesh(geo, material);
}

function slabMesh(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: THREE.Material, texScale = 1200) {
  const m = boxMesh(x1 - x0, y1 - y0, z1 - z0, material, texScale);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

function moundMesh(
  top: { x0: number; x1: number; z0: number; z1: number }, topY: number,
  base: { x0: number; x1: number; z0: number; z1: number }, baseY: number,
  material: THREE.Material, texScale = 2000,
) {
  const v = [
    base.x0, baseY, base.z0, base.x1, baseY, base.z0, base.x1, baseY, base.z1, base.x0, baseY, base.z1,
    top.x0, topY, top.z0, top.x1, topY, top.z0, top.x1, topY, top.z1, top.x0, topY, top.z1,
  ];
  const idx = [
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
  ];
  const uv: number[] = [];
  for (let i = 0; i < 8; i++) uv.push(v[i * 3] / texScale, (v[i * 3 + 2] + v[i * 3 + 1]) / texScale);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function axisWall(
  plane: 'x' | 'z', at: number, aMin: number, aMax: number, yMin: number, yMax: number,
  facing: 1 | -1, material: THREE.Material, texScale = 1400,
) {
  const w = aMax - aMin, h = yMax - yMin;
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / texScale, uv.getY(i) * h / texScale);
  const mesh = new THREE.Mesh(geo, material);
  if (plane === 'x') {
    mesh.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(at, (yMin + yMax) / 2, (aMin + aMax) / 2);
  } else {
    mesh.rotation.y = facing > 0 ? 0 : Math.PI;
    mesh.position.set((aMin + aMax) / 2, (yMin + yMax) / 2, at);
  }
  return mesh;
}

function axisWallWithHole(
  plane: 'x' | 'z', at: number, aMin: number, aMax: number, yMin: number, yMax: number,
  hole: { aMin: number; aMax: number; yMin: number; yMax: number }, facing: 1 | -1, material: THREE.Material,
) {
  const g = new THREE.Group();
  g.add(axisWall(plane, at, aMin, hole.aMin, yMin, yMax, facing, material));
  g.add(axisWall(plane, at, hole.aMax, aMax, yMin, yMax, facing, material));
  g.add(axisWall(plane, at, hole.aMin, hole.aMax, hole.yMax, yMax, facing, material));
  if (hole.yMin > yMin) g.add(axisWall(plane, at, hole.aMin, hole.aMax, yMin, hole.yMin, facing, material));
  return g;
}

function groundPatch(x0: number, x1: number, z0: number, z1: number, y: number, material: THREE.Material, texScale = 1800) {
  const w = x1 - x0, d = z1 - z0;
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / texScale, uv.getY(i) * d / texScale);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  return mesh;
}

function beamBetween(a: THREE.Vector3, b: THREE.Vector3, thickness: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = boxMesh(thickness, len, thickness, material, 600);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(WORLD_UP, dir.normalize());
  return mesh;
}

function frameMatrix(s: TrackSample, lateral = 0, height = 0, forward = 0) {
  const m = new THREE.Matrix4().makeBasis(s.right.clone().negate(), s.up, s.tangent);
  m.setPosition(s.pos.clone().addScaledVector(s.right, lateral).addScaledVector(s.up, height).addScaledVector(s.tangent, forward));
  return m;
}

export function wedgeMesh(width: number, length: number, height: number, material: THREE.Material) {
  const hw = width / 2;
  const verts = [
    -hw, 0, 0, hw, 0, 0, hw, 0, length, -hw, 0, length,
    hw, height, length, -hw, height, length,
  ];
  const idx = [
    0, 4, 1, 0, 5, 4,
    1, 4, 2,
    0, 3, 5,
    3, 2, 4, 3, 4, 5,
    0, 1, 2, 0, 2, 3,
  ];
  const uv = [0, 0, width / 480, 0, width / 480, length / 480, 0, length / 480, width / 480, length / 480, 0, length / 480];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function createSlingshotMesh(scale = 1, materials?: any): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Slingshot3DModel';

  const woodMat = materials?.wood ?? new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.78,
  });
  const ironMat = materials?.iron ?? new THREE.MeshStandardMaterial({
    color: 0x2e3236,
    metalness: 0.65,
    roughness: 0.45,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a034,
    metalness: 0.8,
    roughness: 0.35,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xd45d1e,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const pouchMat = new THREE.MeshStandardMaterial({
    color: 0x823b14,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });

  const addBox = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  const addCyl = (rt: number, rb: number, h: number, seg: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const geom = new THREE.CylinderGeometry(rt, rb, h, seg);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  // 1. BASE PLATFORM (Heavy timber deck with iron brackets)
  addBox(290, 22, 330, woodMat, 0, 11, -20);
  addBox(32, 34, 350, woodMat, -115, 17, -20);
  addBox(32, 34, 350, woodMat, 115, 17, -20);
  addBox(260, 28, 30, woodMat, 0, 24, 80);
  addBox(260, 28, 30, woodMat, 0, 24, -120);

  // 4 Corner iron brackets & bollard posts
  const corners = [
    [-115, 17, -180],
    [115, 17, -180],
    [-115, 17, 140],
    [115, 17, 140],
  ];
  for (const [cx, cy, cz] of corners) {
    addBox(42, 38, 42, ironMat, cx, cy, cz);
    addCyl(15, 17, 75, 8, woodMat, cx, cy + 45, cz);
    addCyl(18, 18, 12, 8, ironMat, cx, cy + 70, cz);
    addCyl(0, 14, 18, 4, ironMat, cx, cy + 85, cz, 0, Math.PI / 4, 0);
  }

  // 2. CENTRAL Y-FORK TRUNK
  addCyl(30, 36, 120, 8, woodMat, 0, 82, 35);
  addCyl(38, 38, 18, 8, ironMat, 0, 50, 35);
  addCyl(35, 35, 20, 8, ironMat, 0, 115, 35);
  addBox(42, 42, 10, ironMat, 0, 115, 68, 0, 0, Math.PI / 4);
  addCyl(12, 12, 14, 8, brassMat, 0, 115, 72, Math.PI / 2, 0, 0);

  // 3. LEFT & RIGHT Y-FORK PRONGS
  // Left fork arm
  addCyl(24, 28, 140, 8, woodMat, -35, 190, 32, -0.04, 0, 0.48);
  addCyl(21, 24, 135, 8, woodMat, -90, 305, 25, -0.07, 0, 0.38);
  addCyl(28, 28, 18, 8, ironMat, -48, 215, 31, -0.04, 0, 0.48);
  addCyl(26, 26, 24, 8, ironMat, -112, 350, 21, -0.07, 0, 0.38);
  addCyl(12, 12, 16, 8, brassMat, -125, 350, 21, 0, 0, Math.PI / 2);

  // Right fork arm
  addCyl(24, 28, 140, 8, woodMat, 35, 190, 32, -0.04, 0, -0.48);
  addCyl(21, 24, 135, 8, woodMat, 90, 305, 25, -0.07, 0, -0.38);
  addCyl(28, 28, 18, 8, ironMat, 48, 215, 31, -0.04, 0, -0.48);
  addCyl(26, 26, 24, 8, ironMat, 112, 350, 21, -0.07, 0, -0.38);
  addCyl(12, 12, 16, 8, brassMat, 125, 350, 21, 0, 0, Math.PI / 2);

  // 4. DIAGONAL REAR TIMBER BRACES
  addCyl(14, 16, 210, 6, woodMat, -70, 95, -55, 0.82, 0, -0.32);
  addCyl(14, 16, 210, 6, woodMat, 70, 95, -55, 0.82, 0, 0.32);

  // 5. MECHANICAL WINCH & BRASS COGS
  addCyl(24, 24, 110, 12, woodMat, 0, 52, -50, 0, 0, Math.PI / 2);
  addCyl(26, 26, 70, 12, bandMat, 0, 52, -50, 0, 0, Math.PI / 2);
  addBox(18, 55, 38, ironMat, -60, 48, -50);
  addBox(18, 55, 38, ironMat, 60, 48, -50);
  addCyl(38, 38, 10, 12, brassMat, 72, 52, -50, 0, 0, Math.PI / 2);
  addCyl(10, 10, 16, 8, ironMat, 75, 52, -50, 0, 0, Math.PI / 2);
  addBox(6, 32, 8, ironMat, 80, 70, -45, 0.3, 0, -0.2);

  // Boiler smokestack pipe
  addCyl(11, 14, 45, 8, ironMat, -88, 45, -50);
  addCyl(13, 11, 30, 8, ironMat, -88, 75, -56, -0.4, 0, 0);
  addCyl(15, 11, 12, 8, brassMat, -88, 88, -63, -0.4, 0, 0);

  // 6. ELASTIC LAUNCH BANDS & LEATHER CRADLE POUCH
  const pouchGeom = new THREE.CylinderGeometry(38, 32, 45, 12, 1, true, -Math.PI / 2, Math.PI);
  const pouchMesh = new THREE.Mesh(pouchGeom, pouchMat);
  pouchMesh.position.set(0, 165, -120);
  pouchMesh.rotation.set(0.35, 0, Math.PI / 2);
  g.add(pouchMesh);

  addBox(65, 34, 12, pouchMat, 0, 165, -135, 0.35, 0, 0);
  addCyl(8, 8, 8, 8, brassMat, -34, 168, -132, 0, 0, Math.PI / 2);
  addCyl(8, 8, 8, 8, brassMat, 34, 168, -132, 0, 0, Math.PI / 2);

  const leftBandVec = new THREE.Vector3(86, -182, -153);
  const leftBandLen = leftBandVec.length();
  const leftBand = addCyl(6, 6, leftBandLen, 8, bandMat, -77, 259, -55);
  leftBand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), leftBandVec.clone().normalize());

  const rightBandVec = new THREE.Vector3(-86, -182, -153);
  const rightBandLen = rightBandVec.length();
  const rightBand = addCyl(6, 6, rightBandLen, 8, bandMat, 77, 259, -55);
  rightBand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rightBandVec.clone().normalize());

  addBox(6, 65, 14, bandMat, -132, 305, 21, 0, 0, 0.15);
  addBox(6, 55, 12, bandMat, 132, 310, 21, 0, 0, -0.15);

  if (scale !== 1) {
    g.scale.set(scale, scale, scale);
  }

  return g;
}

function archMesh(center: THREE.Vector3, axis: THREE.Vector3, radius: number, tube: number, material: THREE.Material) {
  const geo = new THREE.TorusGeometry(radius, tube, 6, 16, Math.PI);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(center);
  const flat = new THREE.Vector3(axis.x, 0, axis.z).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(ZERO, flat, WORLD_UP));
  return mesh;
}

function rockCone(x: number, baseY: number, z: number, radius: number, height: number, material: THREE.Material, segments = 7) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments, 1), material);
  cone.position.set(x, baseY + height / 2, z);
  cone.rotation.y = rand() * Math.PI;
  return cone;
}

function waterCurtain(x: number, z: number, yTop: number, yBot: number, width: number, backDepth: number, frontDepth: number, material: THREE.Material) {
  const g = new THREE.Group();
  g.add(axisWall('z', z, x - width / 2, x + width / 2, yBot, yTop, 1, material, 1000));
  g.add(axisWall('x', x, z - backDepth, z + frontDepth, yBot, yTop, 1, material, 1000));
  return g;
}

/* -----------------------------------------------------------------------------
   5. STAGE BUILDERS
   -------------------------------------------------------------------------- */
const SURFACE = [P(-1, 0, 0), P(1, 0, 0)];
const ROCK_SKIRT_L = [P(-1, -340, -1000), P(-1, -240, -100), P(-1, 0, 0)];
const EDGE_BEAM_L = [P(-1, 0, -180), P(-1, 0, 0)];
const SHOULDER_L = [P(-1, -420, -170), P(-1, -140, -40), P(-1, 0, 0)];

function buildTrackSurface(track: TrackData, M: Materials, scene: THREE.Scene) {
  const { samples } = track;
  const surfaceKey = (s: TrackSample): keyof Materials => {
    if (s.onBridge) return 'wood';
    switch (s.stage) {
      case 'alpine': case 'canyon': case 'zigzag': return 'dirt';
      case 'cavern': case 'breakthrough': return 'cave';
      case 'mine': return 'wood';
      case 'stadium': return 'cobble';
    }
  };
  let runStart = 0;
  for (let i = 1; i <= samples.length; i++) {
    if (i === samples.length || surfaceKey(samples[i]) !== surfaceKey(samples[runStart])) {
      const key = surfaceKey(samples[runStart]);
      // The dirt road uses a deliberately broad UV scale: it reads as soft,
      // irregular earth instead of a series of texture-sized road stripes.
      scene.add(sweepProfile(samples, runStart, Math.min(i, samples.length - 1), SURFACE, M[key],
        key === 'dirt' ? { texScale: 1500 } : undefined));
      runStart = i;
    }
  }

  // Natural grass fringe along the road shoulders: breaks up hard geometric edges
  const grassFringeStage = (s: TrackSample) => !s.onBridge && !s.inLoop && s.stage === 'alpine';
  // The outer half of this strip sits on the grass-covered drop, while its inner
  // half overlaps the dirt road. Its texture is authored in that same order.
  const FRINGE_L = [P(-1, -175, -9), P(-1, 70, 4)];
  const FRINGE_R = [P(1, 175, -9), P(1, -70, 4)];

  rangesWhere(samples, grassFringeStage).forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, FRINGE_L, M.grassFringe, { texScale: 1100, stride: 2, uvMode: 'fringe' }));
    scene.add(sweepProfile(samples, a, b, FRINGE_R, M.grassFringe, { texScale: 1100, stride: 2, uvMode: 'fringe' }));
  });
}

function makeAlpineTerrain(track: TrackData) {
  const corridor = track.samples.filter((s, i) => (s.stage === 'alpine' || s.stage === 'canyon') && !s.inLoop && i % 2 === 0);
  return (x: number, z: number) => {
    let best = corridor[0], bestD2 = Infinity;
    for (const s of corridor) {
      const dx = x - s.pos.x, dz = z - s.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = s; }
    }
    const rx = best.right.x, rz = best.right.z;
    const rl = Math.hypot(rx, rz) || 1;
    const lat = ((x - best.pos.x) * rx + (z - best.pos.z) * rz) / rl;
    const a = Math.abs(lat);
    const base = best.pos.y - TERRAIN_DROP;
    const flat = best.halfWidth + 260;
    let h: number;
    if (lat > 0) {
      h = base + 320 * smoothstep(flat, 2400, a) + 5200 * smoothstep(2400, 9500, a) + 2500 * smoothstep(9500, 15000, a);
    } else {
      h = base - 260 * smoothstep(flat, 2600, a) - (base - 260 - (VALLEY_Y + 350)) * smoothstep(2600, 11000, a);
    }
    const hummock = Math.sin(x * 0.00071 + z * 0.00043) * Math.sin(z * 0.00097 - x * 0.00031);
    h += hummock * 200 * smoothstep(flat, flat + 900, a);
    h += 5000 * smoothstep(-3000, -13000, z);
    return h;
  };
}

function buildAlpine(track: TrackData, M: Materials, scene: THREE.Scene, terrain: (x: number, z: number) => number) {
  const { samples, sampleAt, distOf } = track;
  const alpineEndD = distOf('alpineEnd');

  scene.add(buildHeightfield(ALPINE.x0, ALPINE.x1, ALPINE.z0, ALPINE.z1, ALPINE.nx, ALPINE.nz, terrain, M.grass, M.cliff,
    { texScale: 1500, rockSlope: 0.55, skirtY: VALLEY_Y - 250 }));

  const deepInLoop = (d: number) => track.loops.some((l) => d > l.start + 350 && d < l.end - 350);
  rangesWhere(samples, (s) => s.stage === 'alpine' && !deepInLoop(s.dist) && s.dist < alpineEndD - 400).forEach(([a, b]) => {
    // The tapering faces of the raised road mound are grass-covered terrain,
    // not more road. The road/grass fringe above bridges this slope cleanly.
    scene.add(sweepProfile(samples, a, b, SHOULDER_L, M.grass, { texScale: 1500, stride: 2 }));
    scene.add(sweepProfile(samples, a, b, mirror(SHOULDER_L), M.grass, { texScale: 1500, stride: 2 }));
  });

  const gate = sampleAt(distOf('launchEdge'));
  for (const side of [-1, 1]) {
    const pillar = grounded(boxMesh(260, 1700, 260, M.cobble, 500), 'StartPillar');
    pillar.applyMatrix4(frameMatrix(gate, side * (gate.halfWidth + 260), 600));
    scene.add(pillar);
  }
  const header = boxMesh(gate.halfWidth * 2 + 780, 220, 260, M.wood, 500);
  header.applyMatrix4(frameMatrix(gate, 0, 1400));
  scene.add(header);

  // Ramps are now independent props in TrackBuilder3D with full collision and positioning!

  // Pine tree trunks removed per user request (cylindrical wood posts on either side of the track)

  for (let i = 0; i < 46; i++) {
    const s = sampleAt(randRange(track.stageStart.alpine + 300, track.stageEnd.alpine - 300));
    if (s.inLoop) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const lateral = side > 0 ? randRange(1400, 6000) : randRange(1400, 8500);
    const x = s.pos.x + s.right.x * side * lateral, z = s.pos.z + s.right.z * side * lateral;
    const r = randRange(160, 480);
    const rock = grounded(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.boulder), 'Boulder');
    rock.position.set(x, terrain(x, z) + r * 0.35, z);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    scene.add(rock);
  }

  buildLoopRings(track, scene, 'alpine', M.wood);
}

function buildLoopRings(track: TrackData, scene: THREE.Scene, stage: Stage, material: THREE.Material) {
  track.loops.filter((l) => l.def.stage === stage).forEach(({ def }) => {
    const center = def.entry.clone().addScaledVector(WORLD_UP, def.radius).addScaledVector(def.right, def.shift / 2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(def.radius + 560, 110, 6, 28), material);
    ring.position.copy(center);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), def.right);
    scene.add(ring);
    const groundY = stage === 'mine' ? LAVA_Y - 200 : def.entry.y - 900;
    for (const sgn of [-1, 1]) {
      const top = center.clone().addScaledVector(def.forward, sgn * (def.radius + 560) * 0.7).addScaledVector(WORLD_UP, -(def.radius + 560) * 0.7);
      const bottom = new THREE.Vector3(top.x, groundY, top.z);
      scene.add(beamBetween(top, bottom, 120, material));
    }
  });
}

function buildCliffs(track: TrackData, M: Materials, scene: THREE.Scene, terrain: (x: number, z: number) => number) {
  const { samples, sampleAt, distOf } = track;
  const canyonStartD = distOf('canyonStart'), canyonApexD = distOf('canyonApex');
  const zigStartD = distOf('zigzagStart'), cavStartD = distOf('cavernStart');
  const alpineEndD = distOf('alpineEnd');

  const ledgeWidth = (d: number) => {
    const w = lerp(380, 1000, smoothstep(canyonApexD, zigStartD + 600, d));
    return lerp(w, 340, smoothstep(cavStartD - 1800, cavStartD, d));
  };
  const plungeTo = (s: TrackSample) => (s.stage === 'cavern' ? -1000 : VALLEY_Y - 150 - s.pos.y);
  const innerLimit = (s: TrackSample) => Math.max(140, 1 / Math.max(1e-6, Math.abs(s.turnRate)) - s.halfWidth - 100);
  const ledgeL = (s: TrackSample) => (s.turnRate > 0 ? Math.min(ledgeWidth(s.dist), innerLimit(s)) : ledgeWidth(s.dist));
  const ledgeR = (s: TrackSample) => (s.turnRate < 0 ? Math.min(ledgeWidth(s.dist), innerLimit(s)) : ledgeWidth(s.dist));

  const leftCliff = (s: TrackSample) => {
    const w = ledgeL(s);
    return [P(-1, -w, plungeTo(s)), P(-1, -w * 0.92, -240), P(-1, -w * 0.5, -120), P(-1, 0, 0)];
  };
  const rightCliff = (s: TrackSample) => {
    const k = smoothstep(canyonStartD, zigStartD, s.dist);
    const rise = smoothstep(canyonStartD - 200, canyonStartD + 700, s.dist);
    const w = ledgeR(s);
    const wall = [P(1, 0, 0), P(1, 250, lerp(-110, 120, rise)), P(1, 900, lerp(-110, 600, rise)), P(1, 1800, lerp(-110, 900, rise))];
    const ledge = [P(1, 0, 0), P(1, w * 0.5, -120), P(1, w * 0.92, -240), P(1, w, plungeTo(s))];
    return wall.map((p, i) => P(1, lerp(p.offset, ledge[i].offset, k), lerp(p.height, ledge[i].height, k)));
  };

  const outdoor = (s: TrackSample) =>
    (s.stage === 'canyon' || s.stage === 'zigzag' || (s.stage === 'alpine' && s.dist > alpineEndD - 400)) && !s.onBridge;
  rangesWhere(samples, outdoor).forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, leftCliff, M.cliff, { texScale: 1400 }));
    scene.add(sweepProfile(samples, a, b, rightCliff, M.cliff, { texScale: 1400 }));
  });
  rangesWhere(samples, (s) => s.stage === 'cavern').forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, leftCliff, M.cave, { texScale: 1400 }));
    scene.add(sweepProfile(samples, a, b, rightCliff, M.cave, { texScale: 1400 }));
  });

  rangesWhere(samples, (s) => s.onBridge, 0).forEach(([a, b]) => {
    for (const i of [a, Math.min(b + 1, samples.length - 1)]) {
      const s = samples[i];
      scene.add(capWall(s, [...leftCliff(s), ...rightCliff(s).slice(1)], M.cliff));
    }
  });

  rangesWhere(samples, (s) => s.stage === 'canyon').forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, [P(-1, -60, 0), P(-1, -60, 220), P(-1, 60, 220), P(-1, 60, 0)], M.cobble, { texScale: 500 }));
  });

  rangesWhere(samples, (s) => s.onBridge).forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, EDGE_BEAM_L, M.wood, { texScale: 400 }));
    scene.add(sweepProfile(samples, a, b, mirror(EDGE_BEAM_L), M.wood, { texScale: 400 }));
    for (const side of [-1, 1]) {
      scene.add(sweepProfile(samples, a, b, [P(side, side * 30, 260), P(side, side * 30, 320)], M.wood, { texScale: 300, stride: 2 }));
    }
    for (let i = a; i <= b; i += 6) {
      const s = samples[i];
      const tie = boxMesh(s.halfWidth * 2 + 240, 110, 110, M.wood, 400);
      tie.applyMatrix4(frameMatrix(s, 0, -230));
      scene.add(tie);
      for (const side of [-1, 1]) {
        const post = boxMesh(60, 460, 60, M.wood, 300);
        post.applyMatrix4(frameMatrix(s, side * (s.halfWidth + 30), 30));
        scene.add(post);
      }
    }
  });

  for (const label of ['hairpin1', 'hairpin2', 'hairpin3', 'hairpin4']) {
    const s = sampleAt(distOf(label));
    const inward = s.turnRate > 0 ? -1 : 1;
    const ledge = inward < 0 ? ledgeL(s) : ledgeR(s);
    const c = s.pos.clone().addScaledVector(s.right, inward * (s.halfWidth + ledge * 0.55));
    const radius = clamp(ledge * 0.42, 120, 420);
    scene.add(grounded(rockCone(c.x, s.pos.y - 600, c.z, radius, 1500, M.boulder), 'HairpinPinnacle'));
  }

  const boulderD = distOf('boulders');
  [[-900, -260], [-200, 240], [700, 40], [1600, -300]].forEach(([dd, lat]) => {
    const s = sampleAt(boulderD + dd);
    const r = randRange(200, 330);
    const rock = grounded(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.boulder), 'TrackBoulder');
    rock.position.copy(s.pos).addScaledVector(s.right, lat).addScaledVector(s.up, r * 0.45);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    scene.add(rock);
  });

  const trackYAtRiver = (zMin: number, zMax: number) => {
    const hit = samples.find((s) => s.pos.z > zMin && s.pos.z < zMax && Math.abs(s.pos.x - RIVER_X) < 60);
    return hit ? hit.pos.y : 0;
  };
  const straight1 = samples.find((s) => s.pos.z > 26000 && s.pos.z < 27500 && Math.abs(s.pos.x - RIVER_X) < 60)!;
  const straight3 = samples.find((s) => s.pos.z > 31000 && s.pos.z < 32500 && Math.abs(s.pos.x - RIVER_X) < 60)!;
  const ledge1 = trackYAtRiver(26000, 27500) - 240;
  const ledge3 = trackYAtRiver(31000, 32500) - 240;
  const lip1North = straight1.pos.z - straight1.halfWidth - ledgeWidth(straight1.dist);
  const lip1South = straight1.pos.z + straight1.halfWidth + ledgeWidth(straight1.dist);
  const lip3South = straight3.pos.z + straight3.halfWidth + ledgeWidth(straight3.dist);
  const cliffTop = terrain(RIVER_X, ALPINE.z1) - 150;
  const pool = VALLEY_Y - 100;
  scene.add(waterCurtain(RIVER_X, lip1North + 150, cliffTop, ledge1, 1400, 450, 500, M.water));
  scene.add(waterCurtain(RIVER_X, lip1South + 30, ledge1, pool, 1400, 250, 250, M.water));
  scene.add(waterCurtain(RIVER_X, lip3South + 30, ledge3, pool, 1400, 250, 250, M.water));

  samples.forEach((s, i) => {
    if (i === 0 || s.stage !== 'zigzag' || s.pos.z > 35000) return;
    const prev = samples[i - 1];
    if ((prev.pos.x - RIVER_X) * (s.pos.x - RIVER_X) > 0) return;
    const zone = boxMesh(s.halfWidth * 2 + 400, 500, 900, M.mist, 900);
    zone.name = 'MistZone';
    zone.applyMatrix4(frameMatrix(s, 0, 250));
    scene.add(zone);
  });
}

function buildCavern(track: TrackData, M: Materials, scene: THREE.Scene) {
  const { samples } = track;
  const enterHole = { aMin: 35400, aMax: 38600, yMin: -4300, yMax: -1300 };
  const exitHole = { aMin: 33500, aMax: 36500, yMin: -1600, yMax: 1400 };

  scene.add(axisWallWithHole('x', CAVE.xMax, CAVE.zMin, CAVE.zMax, VALLEY_Y, CAVE.topY, enterHole, 1, M.cliff));
  scene.add(axisWallWithHole('x', CAVE.xMin, CAVE.zMin, CAVE.zMax, VALLEY_Y, CAVE.topY, exitHole, -1, M.cliff));
  scene.add(axisWall('z', CAVE.zMin, CAVE.xMin, CAVE.xMax, VALLEY_Y, CAVE.topY, -1, M.cliff, 2200));
  scene.add(axisWall('z', CAVE.zMax, CAVE.xMin, CAVE.xMax, VALLEY_Y, CAVE.topY, 1, M.cliff, 2200));
  scene.add(groundPatch(CAVE.xMin, CAVE.xMax, CAVE.zMin, CAVE.zMax, CAVE.topY, M.cliff, 2600));

  [[-18000, 36000, 2600], [-27000, 31000, 3600], [-36000, 39000, 3200], [-44000, 33000, 2200], [-22000, 42000, 2800], [-40000, 28500, 2400]]
    .forEach(([x, z, h]) => scene.add(grounded(rockCone(x, CAVE.topY - 40, z, h * 1.4, h, M.boulder), 'MountainPeak')));

  scene.add(axisWallWithHole('x', CAVE.xMax - 200, CAVE.zMin, CAVE.zMax, CAVE.floorY, CAVE.ceilY, enterHole, -1, M.cave));
  scene.add(axisWallWithHole('x', CAVE.xMin + 200, CAVE.zMin, CAVE.zMax, CAVE.floorY, CAVE.ceilY, exitHole, 1, M.cave));
  scene.add(axisWall('z', CAVE.zMin + 200, CAVE.xMin, CAVE.xMax, CAVE.floorY, CAVE.ceilY, 1, M.cave, 2200));
  scene.add(axisWall('z', CAVE.zMax - 200, CAVE.xMin, CAVE.xMax, CAVE.floorY, CAVE.ceilY, -1, M.cave, 2200));
  const ceiling = groundPatch(CAVE.xMin, CAVE.xMax, CAVE.zMin, CAVE.zMax, CAVE.ceilY, M.cave, 2600);
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  const mawX = CAVE.xMax - 100;
  scene.add(archMesh(new THREE.Vector3(mawX, -2900, 37000), new THREE.Vector3(1, 0, 0), 1600, 400, M.cliff));
  for (const z of [enterHole.aMin, enterHole.aMax]) {
    scene.add(slabMesh(mawX - 350, mawX + 350, LAVA_Y - 100, enterHole.yMax, z - 400, z + 400, M.cliff, 900));
  }
  scene.add(slabMesh(mawX - 450, mawX + 450, -1250, -550, 36400, 37600, M.cliff, 900));

  const cavernOrMine = (s: TrackSample) => s.stage === 'cavern' || s.stage === 'mine';
  const rampOrArena = (s: TrackSample) => s.stage === 'breakthrough' || s.stage === 'stadium' || (s.stage === 'mine' && s.pos.x < -43000);
  const step = (x0: number, x1: number, top: number, z0: number, z1: number) =>
    scene.add(slabMesh(x0, x1, LAVA_Y - 100, top, z0, z1, M.cave, 1200));

  step(-12800, -12200, -3520, 35300, 38700);
  step(-14600, -12800, trackYAtX(samples, -14600, cavernOrMine) - 150, 35300, 38700);
  step(-17000, -14600, trackYAtX(samples, -17000, cavernOrMine) - 150, 35600, 38400);

  for (let x = -47700; x < -44100; x += 450) {
    step(x, x + 450, trackYAtX(samples, x + 450, rampOrArena) - 150, 33600, 36400);
  }

  const exitX = CAVE.xMin + 100;
  scene.add(archMesh(new THREE.Vector3(exitX, -200, 35000), new THREE.Vector3(1, 0, 0), 1500, 420, M.cliff));
  for (const z of [exitHole.aMin, exitHole.aMax]) {
    scene.add(slabMesh(exitX - 350, exitX + 350, LAVA_Y - 100, exitHole.yMax, z - 500, z + 500, M.cliff, 900));
  }

  for (let i = 0; i < 90; i++) {
    const h = randRange(400, 1400);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(randRange(90, 240), h, 5, 1), M.caveRock);
    cone.position.set(randRange(CAVE.xMin + 800, CAVE.xMax - 800), CAVE.ceilY - h / 2 + 10, randRange(CAVE.zMin + 800, CAVE.zMax - 800));
    cone.rotation.x = Math.PI;
    scene.add(cone);
  }
}

function buildMine(track: TrackData, M: Materials, scene: THREE.Scene) {
  const { samples, sampleAt } = track;
  const open = (s: TrackSample) => s.stage === 'mine' && !s.inLoop;
  const lavaFoot = LAVA_Y - 200;

  scene.add(groundPatch(CAVE.xMin, CAVE.xMax, CAVE.zMin, CAVE.zMax, LAVA_Y, M.lava, 2400));

  rangesWhere(samples, (s) => s.stage === 'mine').forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, EDGE_BEAM_L, M.wood, { texScale: 400 }));
    scene.add(sweepProfile(samples, a, b, mirror(EDGE_BEAM_L), M.wood, { texScale: 400 }));
  });

  rangesWhere(samples, open).forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, [P(1, 0, -40), P(1, 380, -40)], M.wood, { texScale: 400, stride: 2 }));
    for (const off of [90, 260]) {
      scene.add(sweepProfile(samples, a, b, [P(1, off, -40), P(1, off, 20), P(1, off + 40, 20), P(1, off + 40, -40)], M.iron, { texScale: 300, stride: 2 }));
    }
  });
  for (let d = track.stageStart.mine; d < track.stageEnd.mine; d += 320) {
    const s = sampleAt(d);
    if (s.inLoop) continue;
    const tie = boxMesh(330, 30, 90, M.wood, 300);
    tie.applyMatrix4(frameMatrix(s, s.halfWidth + 190, -25));
    scene.add(tie);
  }

  for (let d = track.stageStart.mine; d < track.stageEnd.mine; d += 600) {
    const s = sampleAt(d);
    if (s.inLoop || s.up.y < 0.6) continue;
    const topL = s.pos.clone().addScaledVector(s.right, -(s.halfWidth - 60)).addScaledVector(s.up, -160);
    const topR = s.pos.clone().addScaledVector(s.right, s.halfWidth - 60).addScaledVector(s.up, -160);
    const footL = new THREE.Vector3(topL.x, lavaFoot, topL.z);
    const footR = new THREE.Vector3(topR.x, lavaFoot, topR.z);
    scene.add(beamBetween(topL, footL, 110, M.wood));
    scene.add(beamBetween(topR, footR, 110, M.wood));
    const band = Math.min(1400, topL.y - LAVA_Y - 200);
    const midL = topL.clone().setY(topL.y - band);
    const midR = topR.clone().setY(topR.y - band);
    scene.add(beamBetween(midL, midR, 80, M.wood));
    scene.add(beamBetween(topL, midR, 70, M.wood));
    scene.add(beamBetween(topR, midL, 70, M.wood));
  }

  for (let d = track.stageStart.mine + 1200; d < track.stageEnd.mine - 600; d += 2600) {
    const s = sampleAt(d);
    if (s.inLoop || Math.abs(d - track.distOf('lavaLoop1')) < 2600 || Math.abs(d - track.distOf('lavaLoop2')) < 2600) continue;
    scene.add(archMesh(s.pos.clone(), s.tangent, 1500, 190, M.cave));
    for (const side of [-1, 1]) {
      const legTop = s.pos.clone().addScaledVector(s.right, side * 1500);
      const legBottom = new THREE.Vector3(legTop.x, lavaFoot, legTop.z);
      scene.add(beamBetween(legTop, legBottom, 360, M.cave));
      addTorch(scene, M, legTop.clone().addScaledVector(WORLD_UP, 700).addScaledVector(s.right, -side * 220), s.right.clone().multiplyScalar(-side));
    }
  }

  for (let x = CAVE.xMax - 3000; x > CAVE.xMin + 2000; x -= 3200) {
    addTorch(scene, M, new THREE.Vector3(x, -1600, CAVE.zMin + 200), new THREE.Vector3(0, 0, 1));
    addTorch(scene, M, new THREE.Vector3(x, -1600, CAVE.zMax - 200), new THREE.Vector3(0, 0, -1));
  }

  const clearOfTrack = (x: number, z: number, margin: number) =>
    !samples.some((s) => s.stage === 'mine' && Math.abs(s.pos.x - x) < margin && Math.abs(s.pos.z - z) < margin);

  const columns = [[-16500, 30000], [-22000, 41500], [-28500, 29500], [-33000, 41000], [-39500, 30500], [-44500, 40500], [-20000, 33500], [-36000, 40000]];
  columns.forEach(([x, z]) => {
    if (!clearOfTrack(x, z, 2600)) return;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(randRange(600, 900), randRange(1100, 1500), CAVE.ceilY - LAVA_Y + 400, 7, 1), M.caveRock);
    col.position.set(x, (CAVE.ceilY + LAVA_Y) / 2, z);
    scene.add(col);
  });

  for (let i = 0; i < 70; i++) {
    const x = randRange(CAVE.xMin + 1200, CAVE.xMax - 1200), z = randRange(CAVE.zMin + 1200, CAVE.zMax - 1200);
    if (!clearOfTrack(x, z, 1500)) continue;
    scene.add(grounded(rockCone(x, LAVA_Y - 200, z, randRange(250, 650), randRange(900, 3200), M.caveRock, 5), 'Stalagmite'));
  }

  for (let i = 0; i < 44; i++) {
    const x = randRange(CAVE.xMin + 1500, CAVE.xMax - 1500);
    const z = rand() < 0.5 ? CAVE.zMin + randRange(300, 1400) : CAVE.zMax - randRange(300, 1400);
    const r = randRange(700, 1600);
    const rock = grounded(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.caveRock), 'WallBoulder');
    rock.position.set(x, LAVA_Y - 100 + r * randRange(0.1, 0.55), z);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    scene.add(rock);
  }

  buildLoopRings(track, scene, 'mine', M.iron);
}

function addTorch(scene: THREE.Scene, M: Materials, at: THREE.Vector3, outDir: THREE.Vector3) {
  const dir = outDir.clone().normalize();
  const arm = boxMesh(70, 70, 260, M.iron, 300);
  arm.position.copy(at).addScaledVector(dir, 130);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const cup = new THREE.Mesh(new THREE.BoxGeometry(110, 110, 110), M.torch);
  cup.name = 'Torch';
  cup.position.copy(at).addScaledVector(dir, 250).addScaledVector(WORLD_UP, 80);
  scene.add(arm, cup);
}

function buildBreakthrough(track: TrackData, M: Materials, scene: THREE.Scene) {
  const { samples } = track;
  rangesWhere(samples, (s) => s.stage === 'breakthrough').forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, ROCK_SKIRT_L, M.cave, { texScale: 900 }));
    scene.add(sweepProfile(samples, a, b, mirror(ROCK_SKIRT_L), M.cave, { texScale: 900 }));
  });
  scene.add(axisWall('x', CAVE.xMin - 260, 33900, 36100, ARENA_FLOOR_Y - 40, CAVE.topY + 200, -1, M.water, 1100));
  scene.add(axisWall('x', CAVE.xMin - 120, 33300, 36700, ARENA_FLOOR_Y - 40, CAVE.topY, -1, M.water, 1500));
  const s = track.sampleAt(track.distOf('caveExit') - 200);
  const zone = boxMesh(s.halfWidth * 2 + 600, 900, 900, M.mist, 900);
  zone.name = 'MistZone';
  zone.applyMatrix4(frameMatrix(s, 0, 300));
  scene.add(zone);
}

function buildStadium(track: TrackData, M: Materials, scene: THREE.Scene) {
  const { samples, sampleAt, distOf } = track;
  const FLOOR = ARENA_FLOOR_Y;

  const apron = [P(-1, -1000, FLOOR - 70), P(-1, -900, 0), P(-1, 0, 0)];
  rangesWhere(samples, (s) => s.stage === 'stadium').forEach(([a, b]) => {
    scene.add(sweepProfile(samples, a, b, apron, M.cobble, { texScale: 600 }));
    scene.add(sweepProfile(samples, a, b, mirror(apron), M.cobble, { texScale: 600 }));
  });

  const top = { x0: -56400, x1: -47450, z0: 30800, z1: 39200 };
  const base = { x0: -61500, x1: -47450, z0: 26000, z1: 44000 };
  scene.add(moundMesh(top, FLOOR - 10, base, VALLEY_Y - 100, M.cliff, 2400));
  scene.add(groundPatch(top.x0, top.x1, top.z0, top.z1, FLOOR, M.cobble, 900));

  const center = sampleAt(distOf('grandstand'));
  const TIERS = 6;
  const footing = FLOOR - 20;
  for (const side of [-1, 1]) {
    for (let t = 0; t < TIERS; t++) {
      const tierH = 320 + t * 20;
      const tier = grounded(boxMesh(4200, tierH, 460, M.cobble, 700), 'GrandstandTier');
      tier.applyMatrix4(frameMatrix(center, side * (center.halfWidth + 1000 + t * 460 + 230), footing + t * 300 + tierH / 2));
      scene.add(tier);
    }
    const wallH = 2400 - footing;
    const wall = grounded(boxMesh(4400, wallH, 300, M.cobble, 900), 'GrandstandWall');
    wall.applyMatrix4(frameMatrix(center, side * (center.halfWidth + 1000 + TIERS * 460 + 150), footing + wallH / 2));
    scene.add(wall);
    for (const fwd of [-2300, 2300]) {
      const towerH = 3200 - footing;
      const tower = grounded(boxMesh(520, towerH, 520, M.cobble, 700), 'GrandstandTower');
      tower.applyMatrix4(frameMatrix(center, side * (center.halfWidth + 1000 + TIERS * 460 + 150), footing + towerH / 2, fwd));
      scene.add(tower);
    }
  }

  const f = sampleAt(distOf('finish'));
  const fi = samples.indexOf(f);
  scene.add(sweepProfile(samples, fi - 2, fi + 2, [P(-1, 0, 5), P(1, 0, 5)], M.chalk));
  for (const side of [-1, 1]) {
    const foot = f.pos.clone().addScaledVector(f.right, side * (f.halfWidth + 260)).addScaledVector(f.up, -300);
    const head = foot.clone().addScaledVector(f.up, 2000);
    scene.add(beamBetween(foot, head, 220, M.iron));
  }
  const crossbar = boxMesh(f.halfWidth * 2 + 740, 220, 220, M.iron, 500);
  crossbar.applyMatrix4(frameMatrix(f, 0, 1600));
  scene.add(crossbar);
  const banner = boxMesh(f.halfWidth * 2 + 300, 520, 40, M.chalk, 500);
  banner.applyMatrix4(frameMatrix(f, 0, 1230));
  scene.add(banner);

  const gateX = -55600;
  scene.add(axisWall('x', gateX, 31200, 38800, footing, 2600, 1, M.cobble, 900));
  scene.add(archMesh(new THREE.Vector3(gateX - 200, footing, 35000), new THREE.Vector3(1, 0, 0), 1500, 300, M.cobble));
  for (const z of [31400, 38600]) {
    scene.add(grounded(slabMesh(gateX - 350, gateX + 350, footing, 3700, z - 350, z + 350, M.cobble, 700), 'GateTower'));
  }
}

/* -----------------------------------------------------------------------------
   6. WORLD (Sky & Distant Mountains)
   -------------------------------------------------------------------------- */
export interface SkyPreset {
  id: string;
  name: string;
  url: string;
  fogColor: number;
  ambientColor: number;
  sunColor: number;
  sunIntensity: number;
  zenithColor: number;
}

export const SKY_PRESETS: Record<string, SkyPreset> = {
  ridge: {
    id: 'ridge',
    name: 'Copperwood Golden Hour',
    url: '/art/tracks/sky_copperwood_ridge.png',
    fogColor: 0xd3a459,
    ambientColor: 0x715d31,
    sunColor: 0xf8c860,
    sunIntensity: 2.4,
    zenithColor: 0xb08040,
  },
  copperwood_dawn: {
    id: 'copperwood_dawn',
    name: 'Copperwood Misty Dawn',
    url: '/art/tracks/sky_copperwood_misty_dawn.png',
    fogColor: 0xccc995,
    ambientColor: 0x646245,
    sunColor: 0xf0e0a0,
    sunIntensity: 2.0,
    zenithColor: 0x798d6d,
  },
  copperwood_dusk: {
    id: 'copperwood_dusk',
    name: 'Copperwood Autumn Dusk',
    url: '/art/tracks/sky_copperwood_autumn_dusk.png',
    fogColor: 0xbf6d45,
    ambientColor: 0x4a2f29,
    sunColor: 0xff9950,
    sunIntensity: 2.4,
    zenithColor: 0x263340,
  },
  copperwood_frost: {
    id: 'copperwood_frost',
    name: 'Copperwood Frost Morning',
    url: '/art/tracks/sky_copperwood_frost_morning.png',
    fogColor: 0xa7c5de,
    ambientColor: 0x405468,
    sunColor: 0xe8f0f8,
    sunIntensity: 2.2,
    zenithColor: 0x4c7cb6,
  },
  boomtown: {
    id: 'boomtown',
    name: 'Boomtown Forge Dusk',
    url: '/art/tracks/sky_boomtown_quarry.png',
    fogColor: 0xa8402a,
    ambientColor: 0x40171a,
    sunColor: 0xff8833,
    sunIntensity: 2.6,
    zenithColor: 0x451d34,
  },
  boomtown_embers: {
    id: 'boomtown_embers',
    name: 'Boomtown Ember Storm',
    url: '/art/tracks/sky_boomtown_ember_storm.png',
    fogColor: 0x7a2a14,
    ambientColor: 0x250d07,
    sunColor: 0xff6622,
    sunIntensity: 2.6,
    zenithColor: 0x341812,
  },
  boomtown_night: {
    id: 'boomtown_night',
    name: 'Boomtown Night Furnace',
    url: '/art/tracks/sky_boomtown_night_furnace.png',
    fogColor: 0x29242d,
    ambientColor: 0x0d131f,
    sunColor: 0xff8844,
    sunIntensity: 1.6,
    zenithColor: 0x0a1323,
  },
  sheep: {
    id: 'sheep',
    name: 'Woolly Storm Downs',
    url: '/art/tracks/sky_woolly_wasteland.png',
    fogColor: 0x8aa294,
    ambientColor: 0x41504a,
    sunColor: 0xd8e8c8,
    sunIntensity: 2.1,
    zenithColor: 0x304346,
  },
  woolly_sunbeams: {
    id: 'woolly_sunbeams',
    name: 'Woolly Sunbeam Break',
    url: '/art/tracks/sky_woolly_sunbeam_break.png',
    fogColor: 0x7f9a68,
    ambientColor: 0x3c4630,
    sunColor: 0xe4f0c0,
    sunIntensity: 2.3,
    zenithColor: 0x39403c,
  },
  woolly_dusk: {
    id: 'woolly_dusk',
    name: 'Woolly Dusk Zeppelins',
    url: '/art/tracks/sky_woolly_dusk_zeppelins.png',
    fogColor: 0x865787,
    ambientColor: 0x2f2545,
    sunColor: 0xffb070,
    sunIntensity: 1.9,
    zenithColor: 0x1f183f,
  },
  vista: {
    id: 'vista',
    name: 'Scrapdome Golden Sunset',
    url: '/art/menu-vista.png',
    fogColor: 0xb07040,
    ambientColor: 0x503025,
    sunColor: 0xffa050,
    sunIntensity: 2.5,
    zenithColor: 0x382848,
  },
};

const SKY = {
  topDay: new THREE.Color(0x4f7fb4), goldDay: new THREE.Color(0xe9c98c),
  fogDay: new THREE.Color(0xb8a77a), fogCave: new THREE.Color(0x160a06),
  ambientDay: new THREE.Color(0x6b5f3f), ambientCave: new THREE.Color(0x3a1c0c),
};

function buildSky(preset: SkyPreset, loader: THREE.TextureLoader) {
  const tex = loader.load(preset.url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      skyMap: { value: tex },
      hasTexture: { value: 1.0 },
      horizonColor: { value: new THREE.Color(preset.fogColor) },
      zenithColor: { value: new THREE.Color(preset.zenithColor) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vDir;
      void main() {
        vUv = uv;
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D skyMap;
      uniform float hasTexture;
      uniform vec3 horizonColor;
      uniform vec3 zenithColor;
      varying vec2 vUv;
      varying vec3 vDir;

      void main() {
        // Map uvY so the painting spans from just below the horizon up to the zenith
        float uvY = clamp((vUv.y - 0.32) / 0.68, 0.0, 1.0);
        vec2 uv = vec2(1.0 - vUv.x, uvY);
        vec4 tex = texture2D(skyMap, uv);

        float h = vDir.y;
        // Fade smoothly into horizon/fog color below horizon
        float groundBlend = smoothstep(-0.25, 0.03, h);
        float zenithBlend = smoothstep(0.40, 0.95, h);

        vec3 color = mix(horizonColor, tex.rgb, groundBlend);
        color = mix(color, zenithColor, zenithBlend * 0.22);

        if (hasTexture < 0.5) {
          color = mix(horizonColor, zenithColor, smoothstep(-0.1, 0.7, h));
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(120000, 64, 32), mat);
  sky.name = 'Sky';
  sky.renderOrder = -1000;
  return sky;
}

function buildWorld(M: Materials, scene: THREE.Scene) {
  scene.add(groundPatch(CAVE.xMax, 30000, CAVE.zMin, 110000, VALLEY_Y, M.grass, 2400));
  scene.add(groundPatch(-90000, CAVE.xMax, CAVE.zMax, 110000, VALLEY_Y, M.grass, 2400));
  scene.add(groundPatch(-90000, CAVE.xMin, -30000, CAVE.zMax, VALLEY_Y, M.grass, 2400));
  scene.add(groundPatch(CAVE.xMin, 30000, -30000, CAVE.zMin, VALLEY_Y, M.grass, 2400));

  const peaks = [
    [30000, 5000, 14000, 15000], [34000, 30000, 12000, 12000], [26000, 55000, 15000, 14000], [0, 70000, 18000, 16000],
    [-30000, 68000, 14000, 13000], [-62000, 60000, 16000, 15000], [-80000, 35000, 15000, 17000], [-75000, 5000, 14000, 14000],
    [-50000, -15000, 16000, 15000], [-25000, -25000, 14000, 12000], [12000, 82000, 13000, 11000], [-88000, 50000, 12000, 11000],
  ];
  peaks.forEach(([x, z, r, h]) => scene.add(grounded(rockCone(x, VALLEY_Y - 300, z, r, h, M.boulder, 7), 'DistantPeak')));
}

/* -----------------------------------------------------------------------------
   7. CAMERA RIG
   -------------------------------------------------------------------------- */
function cameraRigAt(track: TrackData, d: number) {
  const rig = { back: 950, height: 430, side: 0, lookAhead: 1500 };
  const canyon = bump(d, track.stageStart.canyon - 1800, track.stageEnd.canyon + 300, 1400);
  rig.back += 1500 * canyon; rig.height += 900 * canyon; rig.side -= 1500 * canyon;
  track.loops.forEach((l) => {
    const w = bump(d, l.start - 2600, l.end, 1600) * (l.def.stage === 'mine' ? 1 : 0.7);
    rig.back += 1400 * w; rig.height += 650 * w; rig.side += 1400 * w;
  });
  const arena = smoothstep(track.stageStart.stadium, track.stageStart.stadium + 1800, d);
  rig.back += 500 * arena; rig.height += 450 * arena;
  return rig;
}

import { TrackBuilder3D } from './track-builder-3d';

/* -----------------------------------------------------------------------------
   9. RACER 3D MESHES & OBSTACLES
   -------------------------------------------------------------------------- */
interface Racer3DMesh {
  group: THREE.Group;
  sphere: THREE.Mesh;
  shadow: THREE.Mesh;
  shield: THREE.Mesh;
}

function createRacerMeshes(scene: THREE.Scene, assets: GameAssets): Racer3DMesh[] {
  const out: Racer3DMesh[] = [];
  const sphereGeo = new THREE.SphereGeometry(RADIUS, 24, 16);
  const shadowGeo = new THREE.PlaneGeometry(RADIUS * 2.2, RADIUS * 2.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const shieldGeo = new THREE.SphereGeometry(RADIUS * 1.35, 16, 12);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x44ddff, transparent: true, opacity: 0.45, wireframe: true,
  });

  const colors = [0xff7700, 0x33cc66, 0x3399ff, 0xcc33ff];

  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group();
    group.name = `Racer_${i}`;

    let mat: THREE.Material;
    if (assets.raceBalls?.[i]) {
      const canvas = assets.raceBalls[i] as HTMLCanvasElement;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.2 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0.2 });
    }

    const sphere = new THREE.Mesh(sphereGeo, mat);
    sphere.castShadow = true;
    group.add(sphere);

    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -RADIUS + 2;
    group.add(shadow);

    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.visible = false;
    group.add(shield);

    scene.add(group);
    out.push({ group, sphere, shadow, shield });
  }

  return out;
}

/* -----------------------------------------------------------------------------
   10. MAIN 3D RENDERER CLASS
   -------------------------------------------------------------------------- */
export class Renderer3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly track: TrackData;
  private readonly materials: Materials;
  private readonly sky: THREE.Mesh;
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly lavaGlow: THREE.HemisphereLight;
  private readonly racers3D: Racer3DMesh[];
  private readonly camUp = new THREE.Vector3(0, 1, 0);
  readonly trackBuilder: TrackBuilder3D;
  private readonly D_START = 1100;
  private readonly D_END: number;
  private readonly enterD: number;
  private readonly exitD: number;
  private currentSkyPreset: SkyPreset;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, assets: GameAssets, initialSky: string = 'ridge') {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth || 1440, canvas.clientHeight || 620, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const storedSky = typeof localStorage !== 'undefined' ? localStorage.getItem('hm2-3d-track-sky') : null;
    const skyKey = (storedSky && SKY_PRESETS[storedSky]) ? storedSky : (SKY_PRESETS[initialSky] ? initialSky : 'ridge');
    this.currentSkyPreset = SKY_PRESETS[skyKey] ?? SKY_PRESETS.ridge;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(new THREE.Color(this.currentSkyPreset.fogColor), 6000, 48000);

    const aspect = (canvas.clientWidth || 1440) / (canvas.clientHeight || 620);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 30, 200000);

    // Lights
    this.sun = new THREE.DirectionalLight(this.currentSkyPreset.sunColor, this.currentSkyPreset.sunIntensity);
    this.sun.position.set(6000, 10000, -4000);
    this.ambient = new THREE.AmbientLight(this.currentSkyPreset.ambientColor, 1.6);
    this.lavaGlow = new THREE.HemisphereLight(0x1a0c06, 0xff5a1a, 0);
    this.scene.add(this.sun, this.ambient, this.lavaGlow);

    // Sky Dome
    const textureLoader = new THREE.TextureLoader();
    this.sky = buildSky(this.currentSkyPreset, textureLoader);
    this.scene.add(this.sky);

    // Build materials & Track
    const manager = new THREE.LoadingManager();
    const textures = loadTextures(manager);
    this.materials = buildMaterials(textures);

    this.track = buildTrack();
    this.D_END = this.track.distOf('finish') + 350;
    this.enterD = this.track.distOf('caveEnter');
    this.exitD = this.track.distOf('caveExit');

    const terrain = makeAlpineTerrain(this.track);
    buildTrackSurface(this.track, this.materials, this.scene);
    buildAlpine(this.track, this.materials, this.scene, terrain);
    buildCliffs(this.track, this.materials, this.scene, terrain);
    buildCavern(this.track, this.materials, this.scene);
    buildMine(this.track, this.materials, this.scene);
    buildBreakthrough(this.track, this.materials, this.scene);
    buildStadium(this.track, this.materials, this.scene);
    buildWorld(this.materials, this.scene);

    // 3D Track Builder (handles placed props, free-fly, and surface snapping)
    this.trackBuilder = new TrackBuilder3D(this.scene, this.camera, this.track, this.materials);
    this.trackBuilder.setInitialSky(skyKey);
    this.trackBuilder.onSkyboxChange((newSky) => this.setSkybox(newSky));

    // Racers
    this.racers3D = createRacerMeshes(this.scene, assets);

    this.placeCamera(this.D_START, 0.1);
  }

  setSkybox(skyId: string) {
    const preset = SKY_PRESETS[skyId];
    if (!preset) return;
    this.currentSkyPreset = preset;

    const loader = new THREE.TextureLoader();
    const tex = loader.load(preset.url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const mat = this.sky.material as THREE.ShaderMaterial;
    if (mat && mat.uniforms) {
      if (mat.uniforms.skyMap) mat.uniforms.skyMap.value = tex;
      if (mat.uniforms.horizonColor) mat.uniforms.horizonColor.value.setHex(preset.fogColor);
      if (mat.uniforms.zenithColor) mat.uniforms.zenithColor.value.setHex(preset.zenithColor);
      if (mat.uniforms.hasTexture) mat.uniforms.hasTexture.value = 1.0;
    }

    this.sun.color.setHex(preset.sunColor);
    this.sun.intensity = preset.sunIntensity;
    this.ambient.color.setHex(preset.ambientColor);
    (this.scene.fog as THREE.Fog).color.setHex(preset.fogColor);
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** Maps linear race distance (0..TRACK_DISTANCE) to 3D track spline distance */
  trackDistFromDistance(dist: number) {
    const p = clamp(dist / TRACK_DISTANCE, 0, 1);
    return lerp(this.D_START, this.D_END, p);
  }

  private placeCamera(d: number, dt: number) {
    const rig = cameraRigAt(this.track, d);
    const at = this.track.sampleAt(clamp(d - rig.back, 0, this.track.length));
    const look = this.track.sampleAt(clamp(d + rig.lookAhead, 0, this.track.length));
    this.camera.position.copy(at.pos).addScaledVector(at.up, rig.height).addScaledVector(at.right, rig.side);
    const target = look.pos.clone().addScaledVector(look.up, 140);
    this.camUp.lerp(at.up, 1 - Math.exp(-dt * 5)).normalize();
    this.camera.up.copy(this.camUp);
    this.camera.lookAt(target);
  }

  private updateAtmosphere(d: number) {
    const under = smoothstep(this.enterD - 900, this.enterD + 700, d) * (1 - smoothstep(this.exitD - 600, this.exitD + 900, d));
    const dayFog = new THREE.Color(this.currentSkyPreset.fogColor);
    const dayAmbient = new THREE.Color(this.currentSkyPreset.ambientColor);
    (this.scene.fog as THREE.Fog).color.copy(dayFog).lerp(SKY.fogCave, under);
    (this.scene.fog as THREE.Fog).near = lerp(6000, 1500, under);
    (this.scene.fog as THREE.Fog).far = lerp(48000, 17000, under);
    this.ambient.color.copy(dayAmbient).lerp(SKY.ambientCave, under);
    this.ambient.intensity = lerp(1.6, 1.1, under);
    this.sun.intensity = lerp(this.currentSkyPreset.sunIntensity, 0.15, under);
    this.lavaGlow.intensity = under * 2.8;

    const skyMat = this.sky.material as THREE.ShaderMaterial;
    if (skyMat && skyMat.uniforms?.horizonColor) {
      skyMat.uniforms.horizonColor.value.copy(dayFog).lerp(SKY.fogCave, under);
    }
  }

  render(frame: SceneFrame, intervalMs = 16.67) {
    if (this.destroyed) return;
    const dt = intervalMs / 1000;

    // 1. Update racers along the 3D spline
    const playerDistance = (frame.ball as any).distance ?? clamp((frame.ball.x - 190) / 2, 0, TRACK_DISTANCE);
    const playerDist = this.trackDistFromDistance(playerDistance);

    for (let i = 0; i < frame.racers.length; i++) {
      const racer = frame.racers[i];
      const mesh = this.racers3D[i];
      if (!mesh) continue;

      const dist = racer.distance ?? clamp((racer.x - 190) / 2, 0, TRACK_DISTANCE);
      const d = this.trackDistFromDistance(dist);
      const sample = this.track.sampleAt(d);

      // Lateral offset across the 4 lanes (-480..+480)
      const lateral = (racer.z / 480) * (sample.halfWidth - RADIUS * 1.2);
      
      // Altitude above surface: follows ramp elevation and airborne physics
      const engineElev = Math.max(0, courseY(racer.x, 'ridge') - racer.y);
      const airborneElev = racer.grounded ? 0 : Math.max(0, 478 - RADIUS - racer.y);
      const ramp3DElev = this.get3DRampElevation(d, lateral);
      const altitude = Math.max(engineElev, airborneElev, ramp3DElev);

      const pos = sample.pos.clone()
        .addScaledVector(sample.right, lateral)
        .addScaledVector(sample.up, RADIUS + altitude);

      mesh.group.position.copy(pos);

      // Sphere rolling rotation along track tangent
      mesh.sphere.rotation.x += (racer.vx * dt) / RADIUS;

      // Shield effect
      mesh.shield.visible = (racer.shieldUntil ?? 0) > frame.runTime;
      if (mesh.shield.visible) {
        mesh.shield.rotation.y += dt * 4;
      }
    }

    // 2. Position camera (skip if free-fly camera is active in track builder)
    if (!this.trackBuilder.freeFly.active) {
      this.placeCamera(playerDist, dt);
      this.updateAtmosphere(playerDist);
    }
    this.sky.position.copy(this.camera.position);
    this.sky.rotation.y += dt * 0.0012;

    // 3. Texture scrolls
    const raw = frame.time;
    if (this.materials.water.map) this.materials.water.map.offset.y = raw * 0.55;
    if (this.materials.lava.map) {
      this.materials.lava.map.offset.x = raw * 0.004;
      this.materials.lava.map.offset.y = raw * 0.0025;
    }

    // 4. Render 3D WebGL scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Calculates dynamic 3D ramp elevation and launch trajectory for any placed ramp props.
   */
  private get3DRampElevation(d: number, lateral: number): number {
    const ramps = this.trackBuilder.getPlacedRamps();
    if (ramps.length === 0) return 0;

    let maxElev = 0;
    for (const ramp of ramps) {
      const rampDist = ramp.trackDist ?? this.track.samples.reduce((closest, s) => {
        const d2 = (s.pos.x - ramp.x) ** 2 + (s.pos.z - ramp.z) ** 2;
        return d2 < closest.d2 ? { dist: s.dist, d2 } : closest;
      }, { dist: 0, d2: Infinity }).dist;

      const rampLength = 1100 * ramp.scale;
      const rampHeight = 260 * ramp.scale;
      const rampHalfWidth = (960 / 2) * ramp.scale;

      // Check lateral overlap with ramp
      const sample = this.track.sampleAt(rampDist);
      const rampLateral = (ramp.x - sample.pos.x) * sample.right.x + (ramp.z - sample.pos.z) * sample.right.z;
      if (Math.abs(lateral - rampLateral) > rampHalfWidth + RADIUS) continue;

      // Check longitudinal position along the ramp
      const delta = d - (rampDist - rampLength);
      if (delta >= 0 && delta <= rampLength) {
        // Riding UP the ramp incline: smooth curved rise
        const progress = delta / rampLength;
        const h = rampHeight * Math.pow(progress, 1.4);
        if (h > maxElev) maxElev = h;
      } else if (delta > rampLength && delta < rampLength + 750) {
        // Airborne jump arc launching off the ramp crest!
        const launchProgress = (delta - rampLength) / 750;
        const arc = rampHeight * (1 - launchProgress) + 180 * Math.sin(launchProgress * Math.PI);
        if (arc > maxElev) maxElev = arc;
      }
    }

    return maxElev;
  }

  destroy() {
    this.destroyed = true;
    this.trackBuilder.destroy();
    this.renderer.dispose();
  }
}
