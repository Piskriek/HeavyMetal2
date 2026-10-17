// ============================================================================
// File: apps/web/src/play/outcrops.ts
// TICKET-05 (OPUS_NOTE_12 Item F — STAGE-03):
// Grounded mineral outcrops (<= 300 triangles each, partly buried root skirt so
// they never float on slopes, deterministic from seed, compatible with InstancedMesh):
//  - 'dither': speckled grey 1-bit angular rock cluster
//  - 'fold':   tilted layered sedimentary strata slabs
//  - 'chroma': dark basalt boulder split by vivid coloured crystal veins
//  - 'spire':  terminated hexagonal quartz column cluster
// ============================================================================

import * as THREE from 'three';
import type * as F from '@hm/substrate';

export type OutcropKind = F.Kind;

/** Per-kind readable mineral accent colours matching the HUD & substrate items. */
export const OUTCROP_TINTS: Readonly<Record<OutcropKind, string>> = {
  dither: '#d9d9d9',
  fold: '#7dd3fc',
  chroma: '#ff4fd8',
  spire: '#22d3ee',
};

function seededUnit(seed: number, idx: number): number {
  let h = (Math.imul(seed | 0, 374761393) ^ Math.imul(idx | 0, 668265263) ^ 0x5bf03635) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

interface MeshBuilder {
  readonly positions: number[];
  readonly normals: number[];
  readonly colors: number[];
  readonly indices: number[];
}

function createBuilder(): MeshBuilder {
  return { positions: [], normals: [], colors: [], indices: [] };
}

function pushFaceTri(
  b: MeshBuilder,
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
  rgb: readonly [number, number, number]
): void {
  const ux = p1[0] - p0[0];
  const uy = p1[1] - p0[1];
  const uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0];
  const vy = p2[1] - p0[1];
  const vz = p2[2] - p0[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;

  const base = b.positions.length / 3;
  b.positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  b.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  b.colors.push(rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2]);
  b.indices.push(base, base + 1, base + 2);
}

function pushFaceQuad(
  b: MeshBuilder,
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
  p3: readonly [number, number, number],
  rgb: readonly [number, number, number]
): void {
  pushFaceTri(b, p0, p1, p2, rgb);
  pushFaceTri(b, p0, p2, p3, rgb);
}

/**
 * Appends a tapered polygonal rock/crystal column with `sides` facets, buried root at `yBottom`,
 * shoulder at `yShoulder`, and terminated apex at `yTop`, tilted by `(tiltX, tiltZ)`.
 */
function appendTaperedColumn(
  b: MeshBuilder,
  opts: {
    readonly sides: number;
    readonly cx: number;
    readonly cz: number;
    readonly yBottom: number;
    readonly yShoulder: number;
    readonly yApex: number;
    readonly rBottom: number;
    readonly rShoulder: number;
    readonly tiltX: number;
    readonly tiltZ: number;
    readonly rotY: number;
    readonly seed: number;
    readonly jitter: number;
    readonly sideColor: (ring: number, sector: number) => readonly [number, number, number];
    readonly capColor: (sector: number) => readonly [number, number, number];
  }
): void {
  const {
    sides,
    cx,
    cz,
    yBottom,
    yShoulder,
    yApex,
    rBottom,
    rShoulder,
    tiltX,
    tiltZ,
    rotY,
    seed,
    jitter,
  } = opts;

  const ringPts = (y: number, r: number, ringIdx: number): [number, number, number][] => {
    const hFrac = (y - yBottom) / Math.max(0.01, yApex - yBottom);
    const ox = cx + tiltX * hFrac;
    const oz = cz + tiltZ * hFrac;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const a = rotY + (i / sides) * Math.PI * 2;
      const radScale = 1 + (seededUnit(seed, ringIdx * 31 + i * 7) - 0.5) * jitter;
      pts.push([ox + Math.cos(a) * r * radScale, y, oz + Math.sin(a) * r * radScale]);
    }
    return pts;
  };

  const botRing = ringPts(yBottom, rBottom, 0);
  const midRing = ringPts(yShoulder, rShoulder, 1);
  const apexPt: [number, number, number] = [cx + tiltX, yApex, cz + tiltZ];

  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const b0 = botRing[i]!;
    const b1 = botRing[next]!;
    const m0 = midRing[i]!;
    const m1 = midRing[next]!;
    // Counter-clockwise outward side quad (viewed from outside: b0 -> b1 -> m1 -> m0)
    pushFaceQuad(b, b0, b1, m1, m0, opts.sideColor(0, i));
    // Terminated top facet triangle
    pushFaceTri(b, m0, m1, apexPt, opts.capColor(i));
  }
}

/**
 * Builds a deterministic, grounded mineral outcrop BufferGeometry (`<= 300` triangles)
 * with a deep buried base skirt (`minY <= -0.60 m`) so it never floats on slopes or when
 * offset by `play-scene.ts`'s node height placement.
 */
export function outcropGeometry(kind: OutcropKind, seed = 1): THREE.BufferGeometry {
  const b = createBuilder();
  const s = Number.isFinite(seed) ? Math.floor(seed) : 1;

  if (kind === 'dither') {
    // Speckled grey 1-bit angular rock cluster: 5 blocky flat-faceted crags on a buried plinth
    const blocks = [
      { cx: 0.0, cz: 0.0, yb: -0.68, ys: 0.36, ya: 0.62, rb: 0.72, rs: 0.56, tx: 0.04, tz: -0.03 },
      { cx: -0.34, cz: 0.22, yb: -0.65, ys: 0.22, ya: 0.44, rb: 0.48, rs: 0.38, tx: -0.08, tz: 0.05 },
      { cx: 0.36, cz: -0.18, yb: -0.65, ys: 0.28, ya: 0.50, rb: 0.46, rs: 0.35, tx: 0.09, tz: -0.06 },
      { cx: -0.16, cz: -0.36, yb: -0.65, ys: 0.16, ya: 0.34, rb: 0.44, rs: 0.34, tx: -0.04, tz: -0.08 },
      { cx: 0.22, cz: 0.32, yb: -0.65, ys: 0.18, ya: 0.38, rb: 0.42, rs: 0.32, tx: 0.06, tz: 0.07 },
    ];
    blocks.forEach((blk, idx) => {
      const rotY = seededUnit(s, idx * 19 + 3) * Math.PI * 2;
      appendTaperedColumn(b, {
        sides: 6,
        cx: blk.cx,
        cz: blk.cz,
        yBottom: blk.yb,
        yShoulder: blk.ys,
        yApex: blk.ya,
        rBottom: blk.rb,
        rShoulder: blk.rs,
        tiltX: blk.tx,
        tiltZ: blk.tz,
        rotY,
        seed: s + idx * 97,
        jitter: 0.24,
        // 1-bit speckled high-contrast light/dark facets
        sideColor: (_ring, sec) =>
          (sec + idx) % 2 === 0 ? [0.92, 0.94, 0.96] : [0.36, 0.40, 0.46],
        capColor: (sec) =>
          sec % 2 === 0 ? [0.98, 0.99, 1.0] : [0.48, 0.52, 0.58],
      });
    });
  } else if (kind === 'fold') {
    // Layered strata: 5 tilted stepped sedimentary plates dipping at ~16 degrees
    const tiers = [
      { y0: -0.68, y1: -0.15, rx: 0.82, rz: 0.76, ox: -0.06, oz: 0.0, seam: false },
      { y0: -0.18, y1: 0.08, rx: 0.74, rz: 0.68, ox: 0.02, oz: 0.03, seam: true },
      { y0: 0.05, y1: 0.28, rx: 0.64, rz: 0.58, ox: 0.10, oz: -0.02, seam: false },
      { y0: 0.25, y1: 0.46, rx: 0.52, rz: 0.48, ox: 0.18, oz: 0.02, seam: true },
      { y0: 0.43, y1: 0.64, rx: 0.38, rz: 0.35, ox: 0.24, oz: -0.01, seam: false },
    ];
    tiers.forEach((t, idx) => {
      const rotY = 0.25 + seededUnit(s, idx * 23 + 5) * 0.35;
      appendTaperedColumn(b, {
        sides: 7,
        cx: t.ox,
        cz: t.oz,
        yBottom: t.y0,
        yShoulder: t.y1 - 0.03,
        yApex: t.y1 + 0.04,
        rBottom: t.rx,
        rShoulder: t.rz,
        tiltX: 0.12,
        tiltZ: 0.03,
        rotY,
        seed: s + idx * 131,
        jitter: 0.18,
        sideColor: () => (t.seam ? [0.68, 0.92, 1.0] : [0.38, 0.48, 0.58]),
        capColor: (sec) => (sec % 2 === 0 ? [0.82, 0.95, 1.0] : [0.46, 0.58, 0.68]),
      });
    });
  } else if (kind === 'chroma') {
    // Dark host boulder split by 5 vivid coloured crystal vein blades
    appendTaperedColumn(b, {
      sides: 7,
      cx: 0,
      cz: 0,
      yBottom: -0.68,
      yShoulder: 0.22,
      yApex: 0.42,
      rBottom: 0.76,
      rShoulder: 0.60,
      tiltX: -0.04,
      tiltZ: 0.03,
      rotY: seededUnit(s, 11) * Math.PI,
      seed: s + 17,
      jitter: 0.22,
      sideColor: () => [0.34, 0.28, 0.38],
      capColor: () => [0.42, 0.34, 0.48],
    });

    const veins = [
      { cx: 0.02, cz: 0.0, yb: -0.50, ys: 0.52, ya: 0.78, rb: 0.24, rs: 0.18, tx: 0.06, tz: 0.02 },
      { cx: -0.26, cz: 0.14, yb: -0.52, ys: 0.38, ya: 0.60, rb: 0.20, rs: 0.15, tx: -0.18, tz: 0.10 },
      { cx: 0.28, cz: -0.12, yb: -0.52, ys: 0.42, ya: 0.64, rb: 0.20, rs: 0.15, tx: 0.20, tz: -0.08 },
      { cx: -0.12, cz: -0.26, yb: -0.52, ys: 0.32, ya: 0.52, rb: 0.18, rs: 0.14, tx: -0.08, tz: -0.18 },
      { cx: 0.14, cz: 0.26, yb: -0.52, ys: 0.35, ya: 0.55, rb: 0.18, rs: 0.14, tx: 0.10, tz: 0.18 },
    ];
    veins.forEach((v, idx) => {
      appendTaperedColumn(b, {
        sides: 5,
        cx: v.cx,
        cz: v.cz,
        yBottom: v.yb,
        yShoulder: v.ys,
        yApex: v.ya,
        rBottom: v.rb,
        rShoulder: v.rs,
        tiltX: v.tx,
        tiltZ: v.tz,
        rotY: idx * 1.1 + seededUnit(s, idx * 41) * 0.5,
        seed: s + 300 + idx * 53,
        jitter: 0.10,
        sideColor: (_r, sec) => (sec % 2 === 0 ? [1.0, 0.45, 0.88] : [0.85, 0.25, 0.72]),
        capColor: () => [1.0, 0.75, 0.96],
      });
    });
  } else {
    // 'spire': Grounded base bed + 6 splayed hexagonal quartz columns (minY <= -0.92 so even at +0.7 offset it's buried)
    appendTaperedColumn(b, {
      sides: 6,
      cx: 0,
      cz: 0,
      yBottom: -0.95,
      yShoulder: -0.12,
      yApex: 0.08,
      rBottom: 0.68,
      rShoulder: 0.52,
      tiltX: 0,
      tiltZ: 0,
      rotY: 0.3,
      seed: s + 7,
      jitter: 0.16,
      sideColor: () => [0.32, 0.46, 0.54],
      capColor: () => [0.45, 0.62, 0.70],
    });

    const spires = [
      { cx: 0.0, cz: 0.0, yb: -0.90, ys: 0.68, ya: 1.05, rb: 0.22, rs: 0.17, tx: 0.02, tz: -0.02 },
      { cx: -0.22, cz: 0.12, yb: -0.88, ys: 0.42, ya: 0.72, rb: 0.17, rs: 0.13, tx: -0.16, tz: 0.09 },
      { cx: 0.22, cz: 0.10, yb: -0.88, ys: 0.48, ya: 0.78, rb: 0.17, rs: 0.13, tx: 0.16, tz: 0.08 },
      { cx: 0.0, cz: -0.24, yb: -0.88, ys: 0.38, ya: 0.66, rb: 0.16, rs: 0.12, tx: 0.0, tz: -0.18 },
      { cx: -0.18, cz: -0.16, yb: -0.88, ys: 0.26, ya: 0.48, rb: 0.14, rs: 0.11, tx: -0.14, tz: -0.12 },
      { cx: 0.18, cz: -0.15, yb: -0.88, ys: 0.30, ya: 0.52, rb: 0.14, rs: 0.11, tx: 0.14, tz: -0.12 },
    ];
    spires.forEach((sp, idx) => {
      appendTaperedColumn(b, {
        sides: 6,
        cx: sp.cx,
        cz: sp.cz,
        yBottom: sp.yb,
        yShoulder: sp.ys,
        yApex: sp.ya,
        rBottom: sp.rb,
        rShoulder: sp.rs,
        tiltX: sp.tx,
        tiltZ: sp.tz,
        rotY: idx * 0.52 + seededUnit(s, idx * 29) * 0.25,
        seed: s + 500 + idx * 61,
        jitter: 0.06,
        sideColor: (_r, sec) => (sec % 2 === 0 ? [0.62, 0.94, 1.0] : [0.38, 0.78, 0.90]),
        capColor: () => [0.90, 0.99, 1.0],
      });
    });
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  geom.setIndex(b.indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Returns the grounded mineral material for `kind` (works with InstancedMesh `instanceColor`
 * and per-vertex mineral vein/strata/speckle colours).
 */
export function outcropMaterial(kind: OutcropKind): THREE.MeshStandardMaterial {
  switch (kind) {
    case 'dither':
      return new THREE.MeshStandardMaterial({
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.84,
        metalness: 0.12,
        emissive: '#1e293b',
        emissiveIntensity: 0.35,
        flatShading: true,
      });
    case 'fold':
      return new THREE.MeshStandardMaterial({
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.62,
        metalness: 0.24,
        emissive: '#0c3b5e',
        emissiveIntensity: 0.45,
        flatShading: true,
      });
    case 'chroma':
      return new THREE.MeshStandardMaterial({
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.38,
        metalness: 0.32,
        emissive: '#4a1238',
        emissiveIntensity: 0.55,
        flatShading: true,
      });
    case 'spire':
      return new THREE.MeshStandardMaterial({
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.18,
        metalness: 0.58,
        emissive: '#083a47',
        emissiveIntensity: 0.6,
        flatShading: true,
      });
  }
}
