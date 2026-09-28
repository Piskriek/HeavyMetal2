/**
 * NewRoads · Phase 1.2 / 2.1 / 2.3 — the painted surface on the road you drive.
 *
 * **Why an overlay ribbon and not a change to the road's own material.** The road is swept by
 * `sweepProfile` into one mesh per stage run, and each shares its `MeshStandardMaterial` with the walls
 * and verges of that stage (`materials.dirt` is also the alpine bank). Patching those shaders would
 * paint the walls too, or fork a material per mesh. `lane-paint.ts` already solved this the other way:
 * a lifted ribbon over the road with its own material. This file does the same for surfaces — with the
 * important difference that *this* ribbon is invisible wherever nothing is painted, so an unpainted
 * course renders exactly as it does today (plan §1.2, "surface 0 unchanged").
 *
 * **Authored UVs** (§2.1): every vertex carries `aSurfUv = (u across 0‥1, s along in world units)`. That
 * is the mask coordinate, the tiling coordinate, and — because the same values are also written to the
 * geometry's `uv` attribute — what `Raycaster` hands the brush as `intersection.uv`. No inverse mapping
 * on the CPU. The cross-section is `[curb | road | curb]`: two extra columns per edge, lifted a few
 * units, so the paint has a bevel and reads as a road rather than a sticker.
 *
 * **The shader** (§1.2) is the standard material plus:
 *   mask → (id0, id1, w, flags);  albedo = mix(sampleSurface(id0), sampleSurface(id1), w)
 *   roughness = mix(rough(id0), rough(id1), w);  alpha = 1 − share of surface 0;  discard if ~0
 * then the cheap detail of §2.3: procedural lane markings gated by the flags byte, tyre-track wear from
 * two gaussians per lane, a per-cell hash so fills are never flat, and global wetness/dust uniforms.
 *
 * `RoadSurfacePaint.update()` runs once per frame and costs nothing unless the mask is dirty (one
 * `needsUpdate` upload of ≤130 KB) or the atlas is still filling.
 */
import * as THREE from 'three';
import { lateralFromLaneZ, type TrackSpaceMap } from '../track-space';
import { ATLAS_GRID, ATLAS_PAD, SurfaceAtlas, type SurfaceSources } from './surface-atlas';
import { RoadMask, ROAD_MASK_ACROSS, ROAD_MASK_STEP } from './road-mask';
import { readRoadMask, writeRoadMask, type SurfaceWriteResult } from './surface-storage';

/** How far above the road the paint floats. Below the lane paint (8) so lane paint stays on top. */
export const SURFACE_PAINT_LIFT = 3;
/** Curb bevel: lateral extent (fraction of the ribbon) and height (world units; a lane is 240 ≈ 3.5 m). */
export const SURFACE_CURB_U = 0.012;
export const SURFACE_CURB_HEIGHT = 2;
/** Rows of track samples per ribbon row (samples are 50 units apart). */
export const SURFACE_PAINT_STRIDE = 2;
/** Ribbon rows per mesh chunk; chunks are frustum-culled independently. */
export const SURFACE_CHUNK_ROWS = 48;
/** World units per tile repeat — the same 480 the road's own `sweepProfile` uses, so scales match. */
export const SURFACE_TILE_REPEAT = 480;
/** Dash period of lane markings in world units (480 on, 480 off). */
export const SURFACE_DASH_PERIOD = 960;

/** The four columns of the cross-section: lateral fraction and height. */
const PROFILE: readonly { u: number; h: number }[] = [
  { u: 0, h: SURFACE_CURB_HEIGHT },
  { u: SURFACE_CURB_U, h: 0 },
  { u: 1 - SURFACE_CURB_U, h: 0 },
  { u: 1, h: SURFACE_CURB_HEIGHT },
];

export interface RoadPaintChunk {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  halfWidths: Float32Array;
  indices: number[];
  /** Arc-length span, for tests and for the tool's marking segment. */
  s0: number;
  s1: number;
}

/**
 * The ribbon geometry, as plain arrays. Pure: a node test can check that every vertex sits on the road's
 * own frame (`pos + right·lateral + up·(height + lift)`) and that `u` spans 0‥1 while `v` is `dist`.
 */
export function buildRoadPaintChunks(
  map: TrackSpaceMap, stride = SURFACE_PAINT_STRIDE, rowsPerChunk = SURFACE_CHUNK_ROWS, lift = SURFACE_PAINT_LIFT,
): RoadPaintChunk[] {
  const samples = map.samples;
  const rows: number[] = [];
  for (let i = 0; i < samples.length; i += stride) rows.push(i);
  if (rows[rows.length - 1] !== samples.length - 1) rows.push(samples.length - 1);

  const chunks: RoadPaintChunk[] = [];
  const cols = PROFILE.length;
  for (let start = 0; start < rows.length - 1; start += rowsPerChunk) {
    const end = Math.min(rows.length - 1, start + rowsPerChunk);
    const count = end - start + 1;
    const positions = new Float32Array(count * cols * 3);
    const normals = new Float32Array(count * cols * 3);
    const uvs = new Float32Array(count * cols * 2);
    const halfWidths = new Float32Array(count * cols);
    const indices: number[] = [];
    for (let r = 0; r < count; r++) {
      const s = samples[rows[start + r]];
      for (let c = 0; c < cols; c++) {
        const p = PROFILE[c];
        const lateral = (p.u * 2 - 1) * s.halfWidth;
        const height = p.h + lift;
        const at = (r * cols + c);
        positions[at * 3] = s.pos.x + s.right.x * lateral + s.up.x * height;
        positions[at * 3 + 1] = s.pos.y + s.right.y * lateral + s.up.y * height;
        positions[at * 3 + 2] = s.pos.z + s.right.z * lateral + s.up.z * height;
        normals[at * 3] = s.up.x; normals[at * 3 + 1] = s.up.y; normals[at * 3 + 2] = s.up.z;
        uvs[at * 2] = p.u; uvs[at * 2 + 1] = s.dist;
        halfWidths[at] = s.halfWidth;
      }
      if (r === 0) continue;
      for (let c = 0; c < cols - 1; c++) {
        const a = (r - 1) * cols + c, b = a + 1, d = r * cols + c, e = d + 1;
        indices.push(a, b, d, b, e, d);
      }
    }
    chunks.push({ positions, normals, uvs, halfWidths, indices, s0: samples[rows[start]].dist, s1: samples[rows[end]].dist });
  }
  return chunks;
}

/* -----------------------------------------------------------------------------
   GLSL — injected into MeshStandardMaterial with onBeforeCompile. GLSL ES 1.0 compatible (no bitwise
   ops, no dynamic uniform-array indexing), which is why per-surface parameters live in a texture.
   -------------------------------------------------------------------------- */
export const SURFACE_VERTEX_HEAD = /* glsl */`
attribute vec2 aSurfUv;
attribute float aSurfHalf;
varying vec2 vSurfUv;
varying float vSurfHalf;
`;

export const SURFACE_VERTEX_BODY = /* glsl */`
vSurfUv = aSurfUv;
vSurfHalf = aSurfHalf;
`;

export const SURFACE_FRAGMENT_HEAD = /* glsl */`
uniform sampler2D uSurfMask;
uniform sampler2D uSurfAtlas;
uniform sampler2D uSurfParams;
uniform vec2 uMaskSize;
uniform float uMaskStepInv;
uniform float uSurfRepeat;
uniform float uDashPeriod;
uniform float uWetness;
uniform float uDust;
uniform vec3 uDustColor;
uniform vec3 uMarkColor;
uniform vec3 uCentreColor;
varying vec2 vSurfUv;
varying float vSurfHalf;

const float SURF_GRID = ${ATLAS_GRID}.0;
const float SURF_PAD = ${ATLAS_PAD};
const float SURF_SLOTS = 16.0;

bool surfIs(float a, float b) { return abs(a - b) < 0.5; }
vec4 maskTexel(vec2 cell) {
  cell = clamp(cell, vec2(0.0), uMaskSize - 1.0);
  return texture2D(uSurfMask, (cell + 0.5) / uMaskSize);
}
/** How much of surface \`id\` a texel holds: its id1 share, its id0 share, or both when solid. */
float surfPresence(vec4 t, float id) {
  float p = 0.0;
  if (surfIs(t.g * 255.0, id)) p += t.b;
  if (surfIs(t.r * 255.0, id)) p += 1.0 - t.b;
  return p;
}
/** One function for every surface: an atlas cell today, a texture-array layer in Phase 5. */
vec3 sampleSurface(float id, vec2 world) {
  float col = mod(id, SURF_GRID);
  float row = floor(id / SURF_GRID);
  vec2 t = fract(world / uSurfRepeat);
  vec2 uv = (vec2(col, row) + SURF_PAD + t * (1.0 - 2.0 * SURF_PAD)) / SURF_GRID;
  return texture2D(uSurfAtlas, uv).rgb;
}
vec4 surfaceParams(float id) { return texture2D(uSurfParams, vec2((id + 0.5) / SURF_SLOTS, 0.5)); }
float surfBit(float flags, float k) { return mod(floor(flags / pow(2.0, k)), 2.0); }
float surfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float surfGauss(float x) { return exp(-x * x / (2.0 * 0.014 * 0.014)); }
/** Tyre tracks: two gaussians per lane, four lanes. Zero textures (plan §2.3). */
float surfWear(float u) {
  float w = 0.0;
  for (int i = 0; i < 4; i++) {
    float c = (float(i) + 0.5) * 0.25;
    w += surfGauss(u - (c - 0.045)) + surfGauss(u - (c + 0.045));
  }
  return 1.0 - 0.15 * min(w, 1.0);
}
/** A painted line centred at lateral fraction \`c\`, \`halfW\` world units wide, with a 3-unit soft edge. */
float surfLine(float u, float c, float halfW, float roadHalf) {
  float d = abs(u - c) * 2.0 * roadHalf;
  return 1.0 - smoothstep(halfW - 3.0, halfW + 3.0, d);
}
`;

export const SURFACE_FRAGMENT_BODY = /* glsl */`
// ---- NewRoads: mask → two surfaces → one blend --------------------------------
vec2 mcoord = vec2(vSurfUv.x * uMaskSize.x, vSurfUv.y * uMaskStepInv);
vec4 mc = maskTexel(floor(mcoord));
float id0 = mc.r * 255.0;
float id1 = mc.g * 255.0;
// Weight: bilinear over the four nearest texels' share of id1, so a 60-unit texel does not show as a
// step while the IDs themselves are never interpolated.
vec2 mp = mcoord - 0.5;
vec2 mi = floor(mp);
vec2 mf = mp - mi;
float w = mix(
  mix(surfPresence(maskTexel(mi), id1), surfPresence(maskTexel(mi + vec2(1.0, 0.0)), id1), mf.x),
  mix(surfPresence(maskTexel(mi + vec2(0.0, 1.0)), id1), surfPresence(maskTexel(mi + vec2(1.0, 1.0)), id1), mf.x),
  mf.y);
if (surfIs(id0, id1)) w = 1.0;

vec2 surfWorld = vec2(vSurfUv.x * 2.0 * vSurfHalf, vSurfUv.y);
vec3 surfAlbedo = mix(sampleSurface(id0, surfWorld), sampleSurface(id1, surfWorld), w);
vec4 sp0 = surfaceParams(id0);
vec4 sp1 = surfaceParams(id1);
float surfRough = mix(sp0.r, sp1.r, w);
float surfWet = mix(sp0.g, sp1.g, w);
// Surface 0 is the road underneath: wherever it dominates, the overlay lets it through.
float surfDirt = 0.0;
if (surfIs(id0, 0.0) && surfIs(id1, 0.0)) surfDirt = 1.0;
else if (surfIs(id0, 0.0)) surfDirt = 1.0 - w;
else if (surfIs(id1, 0.0)) surfDirt = w;
float surfAlpha = 1.0 - surfDirt;

// ---- §2.3 cheap detail ----------------------------------------------------------
surfAlbedo *= surfWear(vSurfUv.x);
surfAlbedo *= 0.94 + 0.12 * surfHash(floor(surfWorld / 97.0));

float flags = floor(mc.a * 255.0 + 0.5);
float dash = step(0.5, fract(vSurfUv.y / uDashPeriod));
float mWhite = 0.0;
float mYellow = 0.0;
if (surfBit(flags, 0.0) > 0.5) {
  mWhite = max(mWhite, dash * (surfLine(vSurfUv.x, 0.25, 8.0, vSurfHalf) + surfLine(vSurfUv.x, 0.75, 8.0, vSurfHalf)));
  if (surfBit(flags, 1.0) < 0.5) mWhite = max(mWhite, dash * surfLine(vSurfUv.x, 0.5, 8.0, vSurfHalf));
}
if (surfBit(flags, 1.0) > 0.5) {
  float gap = 9.0 / (2.0 * vSurfHalf);
  mYellow = surfLine(vSurfUv.x, 0.5 - gap, 5.0, vSurfHalf) + surfLine(vSurfUv.x, 0.5 + gap, 5.0, vSurfHalf);
}
if (surfBit(flags, 2.0) > 0.5) {
  float inset = 0.6 / uMaskSize.x;
  mWhite = max(mWhite, surfLine(vSurfUv.x, inset, 7.0, vSurfHalf) + surfLine(vSurfUv.x, 1.0 - inset, 7.0, vSurfHalf));
}
mWhite = clamp(mWhite, 0.0, 1.0);
mYellow = clamp(mYellow, 0.0, 1.0);
float mark = max(mWhite, mYellow);
surfAlbedo = mix(surfAlbedo, uMarkColor, mWhite * 0.9);
surfAlbedo = mix(surfAlbedo, uCentreColor, mYellow * 0.9);
surfRough = mix(surfRough, 0.6, mark);
surfAlpha = max(surfAlpha, mark);

surfAlbedo *= 1.0 - 0.32 * uWetness * surfWet;
surfRough = mix(surfRough, 0.18, uWetness * surfWet);
surfAlbedo = mix(surfAlbedo, uDustColor, 0.28 * uDust);
surfRough = mix(surfRough, 1.0, 0.5 * uDust);

diffuseColor.rgb *= surfAlbedo;
diffuseColor.a *= surfAlpha;
if (diffuseColor.a < 0.004) discard;
`;

/* -----------------------------------------------------------------------------
   The layer
   -------------------------------------------------------------------------- */
export interface RoadSurfacePaintOptions {
  /** A mask to adopt (tests, imports). Otherwise the course's saved mask is loaded, or a blank one made. */
  mask?: RoadMask;
  storage?: Storage;
  /** Skip the canvas atlas (node tests: no DOM). The material still compiles; nothing is sampled. */
  noAtlas?: boolean;
}

export interface RoadSurfacePaintStats {
  chunks: number;
  vertices: number;
  /** Mask uploads since construction: one per frame in which something was painted, never otherwise. */
  uploads: number;
}

export class RoadSurfacePaint {
  readonly root = new THREE.Group();
  readonly meshes: THREE.Mesh[] = [];
  readonly mask: RoadMask;
  readonly material: THREE.MeshStandardMaterial;
  readonly stats: RoadSurfacePaintStats = { chunks: 0, vertices: 0, uploads: 0 };
  readonly uniforms: {
    uSurfMask: THREE.IUniform<THREE.Texture | null>;
    uSurfAtlas: THREE.IUniform<THREE.Texture | null>;
    uSurfParams: THREE.IUniform<THREE.Texture | null>;
    uMaskSize: THREE.IUniform<THREE.Vector2>;
    uMaskStepInv: THREE.IUniform<number>;
    uSurfRepeat: THREE.IUniform<number>;
    uDashPeriod: THREE.IUniform<number>;
    uWetness: THREE.IUniform<number>;
    uDust: THREE.IUniform<number>;
    uDustColor: THREE.IUniform<THREE.Color>;
    uMarkColor: THREE.IUniform<THREE.Color>;
    uCentreColor: THREE.IUniform<THREE.Color>;
  };
  private readonly maskTexture: THREE.DataTexture;
  private readonly atlas: SurfaceAtlas | null;
  private readonly storage?: Storage;
  private disposed = false;

  constructor(
    private readonly parent: THREE.Object3D,
    readonly map: TrackSpaceMap,
    sources: SurfaceSources,
    readonly courseId: string,
    opts: RoadSurfacePaintOptions = {},
  ) {
    this.storage = opts.storage;
    this.mask = opts.mask
      ?? readRoadMask(courseId, map.length, opts.storage)
      ?? new RoadMask(map.length, ROAD_MASK_ACROSS, ROAD_MASK_STEP);

    this.maskTexture = new THREE.DataTexture(this.mask.bytes, this.mask.across, this.mask.rows, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.maskTexture.minFilter = this.maskTexture.magFilter = THREE.NearestFilter;
    this.maskTexture.wrapS = this.maskTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.maskTexture.generateMipmaps = false;
    this.maskTexture.needsUpdate = true;

    this.atlas = opts.noAtlas || typeof document === 'undefined' ? null : new SurfaceAtlas(sources);

    this.uniforms = {
      uSurfMask: { value: this.maskTexture },
      uSurfAtlas: { value: this.atlas?.texture ?? null },
      uSurfParams: { value: this.atlas?.params ?? null },
      uMaskSize: { value: new THREE.Vector2(this.mask.across, this.mask.rows) },
      uMaskStepInv: { value: 1 / this.mask.step },
      uSurfRepeat: { value: SURFACE_TILE_REPEAT },
      uDashPeriod: { value: SURFACE_DASH_PERIOD },
      uWetness: { value: 0 },
      uDust: { value: 0 },
      uDustColor: { value: new THREE.Color(0xb9a98a) },
      uMarkColor: { value: new THREE.Color(0xf4ecd8) },
      uCentreColor: { value: new THREE.Color(0xe8c04a) },
    };

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const uniforms = this.uniforms;
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${SURFACE_VERTEX_HEAD}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SURFACE_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SURFACE_FRAGMENT_HEAD}`)
        .replace('#include <map_fragment>', SURFACE_FRAGMENT_BODY)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = surfRough;');
    };
    this.material.customProgramCacheKey = () => 'newroads-surface-paint';

    this.root.name = 'RoadSurfacePaint';
    for (const chunk of buildRoadPaintChunks(map)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(chunk.normals, 3));
      geometry.setAttribute('aSurfUv', new THREE.BufferAttribute(chunk.uvs, 2));
      // The same values as `uv`, so Raycaster reports (u, s) directly to the brush.
      geometry.setAttribute('uv', new THREE.BufferAttribute(chunk.uvs, 2));
      geometry.setAttribute('aSurfHalf', new THREE.BufferAttribute(chunk.halfWidths, 1));
      geometry.setIndex(chunk.indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `RoadSurfacePaint:${Math.round(chunk.s0)}-${Math.round(chunk.s1)}`;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 0;
      mesh.userData.s0 = chunk.s0;
      mesh.userData.s1 = chunk.s1;
      this.meshes.push(mesh);
      this.root.add(mesh);
      this.stats.vertices += chunk.positions.length / 3;
    }
    this.stats.chunks = this.meshes.length;
    parent.add(this.root);
  }

  /** Once per frame. Uploads the mask if the brush touched it; fills atlas cells as PNGs decode. */
  update(): void {
    if (this.disposed) return;
    if (this.atlas && !this.atlas.complete) this.atlas.update();
    if (this.mask.mask.takeDirty()) {
      this.maskTexture.needsUpdate = true;
      this.stats.uploads += 1;
    }
  }

  /** Global weather (plan §2.3): 0‥1 each. */
  setWeather(wetness: number, dust: number): void {
    this.uniforms.uWetness.value = Math.max(0, Math.min(1, wetness));
    this.uniforms.uDust.value = Math.max(0, Math.min(1, dust));
  }

  /**
   * Phase 4 hook: the surface under a contact, from the physics' own (s, laneZ). O(1): a lateral scale
   * and one array index. Callers multiply their friction/rolling terms by `SURFACE_TABLE[id]`.
   */
  surfaceIdAt(s: number, laneZ: number): number {
    const sc = Math.max(0, Math.min(this.map.length, s));
    const u = RoadMask.lateralFraction(lateralFromLaneZ(this.map, sc, laneZ), this.map.halfWidthAt(sc));
    return this.mask.surfaceIdAt(sc, u);
  }

  /** Persist the mask (content-hashed; a no-op when nothing changed). */
  save(): SurfaceWriteResult {
    return writeRoadMask(this.courseId, this.mask, this.storage);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.meshes) { this.root.remove(mesh); mesh.geometry.dispose(); }
    this.meshes.length = 0;
    this.material.dispose();
    this.maskTexture.dispose();
    this.atlas?.dispose();
    this.parent.remove(this.root);
  }
}

/** `?paint=1` turns the brush on in a race, the way `?fp=1` forces the cockpit (the T0 spike pattern). */
export function surfacePaintFlag(): boolean {
  if (typeof location === 'undefined') return false;
  try { return new URLSearchParams(location.search).get('paint') === '1'; } catch { return false; }
}
