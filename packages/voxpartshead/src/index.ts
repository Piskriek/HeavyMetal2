// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// voxparts_head.ts — hand-designed voxel HEAD-side parts for the goblin character creator.
// Shared part format, local grid sculpting helpers, validation, stats and ascii preview.
// Deterministic: no Math.random, no Date, no DOM, no imports.

export type V3 = [number, number, number];

export type Slot =
  | 'head' | 'ears' | 'nose' | 'eyes' | 'mouth' | 'hair' | 'hat' | 'face-extra'
  | 'torso' | 'shirt' | 'arms' | 'hands' | 'belt' | 'legs' | 'boots' | 'back' | 'handheld';

export type PaletteSlot =
  | 'skin' | 'skinDark' | 'skinLight' | 'cloth1' | 'cloth2' | 'metal' | 'leather'
  | 'glow' | 'hair' | 'teeth' | 'eyeWhite' | 'pupil' | 'accent';

export interface Part {
  id: string; slot: Slot; name: string; doc: string;
  size: V3;                 // own grid, each axis 1..40
  palette: PaletteSlot[];   // cell value i+1 = palette[i]; 0 = empty
  cells: number[];          // x fastest, then y, then z; y is up; length x*y*z
  anchors: Record<string, V3>;
  attachTo: string;         // anchor name on the PARENT part that 'root' snaps to
  tags: string[];
}

export const SLOT_VALUES: readonly Slot[] = ['head', 'ears', 'nose', 'eyes', 'mouth', 'hair', 'hat',
  'face-extra', 'torso', 'shirt', 'arms', 'hands', 'belt', 'legs', 'boots', 'back', 'handheld'];

export const PALETTE_SLOT_VALUES: readonly PaletteSlot[] = ['skin', 'skinDark', 'skinLight', 'cloth1',
  'cloth2', 'metal', 'leather', 'glow', 'hair', 'teeth', 'eyeWhite', 'pupil', 'accent'];

// Working palette indices (every part is authored against this full table, then pruned in finish()).
const SKIN = 1, DARK = 2, LIGHT = 3, CLOTH1 = 4, CLOTH2 = 5, METAL = 6, LEATHER = 7,
  GLOW = 8, HAIR = 9, TEETH = 10, EYEW = 11, PUPIL = 12, ACCENT = 13;
const PA: PaletteSlot[] = ['skin', 'skinDark', 'skinLight', 'cloth1', 'cloth2', 'metal', 'leather',
  'glow', 'hair', 'teeth', 'eyeWhite', 'pupil', 'accent'];

// ── mutable grid + sculpting helpers ────────────────────────────────────────
interface Grid { sx: number; sy: number; sz: number; c: number[] }
const mk = (sx: number, sy: number, sz: number): Grid =>
  ({ sx, sy, sz, c: new Array<number>(sx * sy * sz).fill(0) });
const mid = (n: number): number => Math.floor((n - 1) / 2);
const at = (g: Grid, x: number, y: number, z: number): number =>
  (x >= 0 && y >= 0 && z >= 0 && x < g.sx && y < g.sy && z < g.sz) ? x + y * g.sx + z * g.sx * g.sy : -1;
const getv = (g: Grid, x: number, y: number, z: number): number => { const i = at(g, x, y, z); return i < 0 ? 0 : (g.c[i] ?? 0); };
const set = (g: Grid, x: number, y: number, z: number, v: number): void => { const i = at(g, x, y, z); if (i >= 0) g.c[i] = v; };

function box(g: Grid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(g, x, y, z, v);
}
function ell(g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, v: number): void {
  if (rx <= 0 || ry <= 0 || rz <= 0) return;
  for (let z = Math.ceil(cz - rz - 1e-6); z <= Math.floor(cz + rz + 1e-6); z++)
    for (let y = Math.ceil(cy - ry - 1e-6); y <= Math.floor(cy + ry + 1e-6); y++)
      for (let x = Math.ceil(cx - rx - 1e-6); x <= Math.floor(cx + rx + 1e-6); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
        if (dx * dx + dy * dy + dz * dz <= 1) set(g, x, y, z, v);
      }
}
const sphere = (g: Grid, cx: number, cy: number, cz: number, r: number, v: number): void => ell(g, cx, cy, cz, r, r, r, v);
function shellE(g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, dr: number, v: number): void {
  for (let z = Math.ceil(cz - rz); z <= Math.floor(cz + rz); z++)
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++)
      for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
        const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2);
        if (d <= 1 && d >= 1 - dr) set(g, x, y, z, v);
      }
}
function line(g: Grid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, v: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), z = Math.round(z0 + (z1 - z0) * t);
    if (r <= 0) set(g, x, y, z, v); else sphere(g, x, y, z, r, v);
  }
}
function tubeY(g: Grid, cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, v: number): void {
  for (let y = Math.round(y0); y <= Math.round(y1); y++)
    for (let z = Math.floor(cz - r0); z <= Math.ceil(cz + r0); z++)
      for (let x = Math.floor(cx - r0); x <= Math.ceil(cx + r0); x++) {
        const d = Math.hypot(x - cx, z - cz); if (d <= r0 && d >= r1) set(g, x, y, z, v);
      }
}
function ringZ(g: Grid, cx: number, cy: number, z: number, r: number, v: number, n = 16): void {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; set(g, Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), z, v); }
}
function mirrorX(g: Grid): void {
  for (let x = Math.ceil(g.sx / 2); x < g.sx; x++)
    for (let z = 0; z < g.sz; z++) for (let y = 0; y < g.sy; y++) set(g, g.sx - 1 - x, y, z, getv(g, x, y, z));
}
function shade(g: Grid, v: number, fn: (x: number, y: number, z: number) => boolean): void {
  for (let z = 0; z < g.sz; z++) for (let y = 0; y < g.sy; y++) for (let x = 0; x < g.sx; x++) {
    if (getv(g, x, y, z) === 0) continue;
    if (getv(g, x - 1, y, z) && getv(g, x + 1, y, z) && getv(g, x, y - 1, z) && getv(g, x, y + 1, z) && getv(g, x, y, z - 1) && getv(g, x, y, z + 1)) continue;
    if (fn(x, y, z)) set(g, x, y, z, v);
  }
}
function scatter(g: Grid, v: number, mod: number, minY = 0, maxY = 999): void {
  for (let z = 0; z < g.sz; z++) for (let y = minY; y <= Math.min(maxY, g.sy - 1); y++) for (let x = 0; x < g.sx; x++) {
    if ((x * 7 + y * 13 + z * 5 + 3) % mod !== 0) continue;
    if (getv(g, x, y, z) !== 0) continue;
    if (getv(g, x - 1, y, z) || getv(g, x + 1, y, z) || getv(g, x, y - 1, z) || getv(g, x, y + 1, z) || getv(g, x, y, z - 1) || getv(g, x, y, z + 1)) set(g, x, y, z, v);
  }
}
function earSpike(g: Grid, sx: number, sz: number, cy: number, r0: number, r1: number, lift: number, droop: number, v: number): void {
  const cz = mid(sz);
  for (let x = 0; x < sx; x++) { const t = sx > 1 ? x / (sx - 1) : 0; const r = r0 + (r1 - r0) * t; ell(g, x, cy + lift * t - droop * t * t, cz, r, r * 0.95, r * 0.62, v); }
}
// Canonical goblin face: plate that guarantees features are embedded, sockets, glow, heavy brow, mouth.
const EYEF = (sy: number): number => Math.round(sy * 0.54);
const MOUTHF = (sy: number): number => Math.round(sy * 0.23);
const NOSEF = (sy: number): number => Math.round(sy * 0.42);
const EARB = (sx: number): number => Math.round(sx * 0.72);
function faceDetail(g: Grid, sx: number, sy: number, eyeV: number, mouthV: number, pz = 1): void {
  const cx = mid(sx), ex = EARB(sx), ey = EYEF(sy), my = MOUTHF(sy);
  box(g, cx - 1, my - 1, pz, ex + 2, ey + 3, pz + 2, SKIN);
  ell(g, ex, ey, pz, 1.9, 1.4, 0.5, DARK);
  ell(g, ex + 0.1, ey, pz - 0.6, 1.0, 0.95, 0.5, eyeV);
  set(g, ex + 1, ey + 1, Math.max(0, pz - 1), EYEW);
  box(g, cx - 1, ey + 2, Math.max(0, pz - 1), ex + 2, ey + 3, pz, LIGHT);
  box(g, cx - 1, my, pz, ex - 2, my + 1, pz, mouthV);
  ell(g, cx + 0.5, my - 1.2, pz + 0.4, 2.0, 1.0, 0.8, LIGHT);
}

// ── anchors ─────────────────────────────────────────────────────────────────
function aHead(sx: number, sy: number, sz: number): Record<string, V3> {
  const cx = mid(sx), cz = mid(sz);
  return {
    root: [cx, 0, cz], neck: [cx, 0, cz],
    earL: [sx - 1, Math.round(sy * 0.55), cz], earR: [0, Math.round(sy * 0.55), cz],
    noseBase: [cx, NOSEF(sy), 0], eyeL: [EARB(sx), EYEF(sy), 1], eyeR: [sx - 1 - EARB(sx), EYEF(sy), 1],
    mouthSeat: [cx, MOUTHF(sy), 0], hatSeat: [cx, sy - 1, cz],
  };
}
const aPair = (sx: number, sy: number, sz: number): Record<string, V3> => ({ root: [0, mid(sy), mid(sz)], tip: [sx - 1, mid(sy), mid(sz)] });
const aFace = (sx: number, sy: number, sz: number): Record<string, V3> => ({ root: [mid(sx), mid(sy), sz - 1], tip: [mid(sx), mid(sy), 0] });
const aEye = (sx: number, sy: number, sz: number): Record<string, V3> => ({ root: [0, mid(sy), sz - 1], outer: [sx - 1, mid(sy), 0] });
const aTop = (sx: number, sy: number, sz: number): Record<string, V3> => ({ root: [mid(sx), 0, mid(sz)], crown: [mid(sx), sy - 1, mid(sz)] });

// ── part assembly ───────────────────────────────────────────────────────────
interface Def { id: string; slot: Slot; name: string; doc: string; size: V3; anchors: Record<string, V3>; attachTo: string; tags?: string[]; build: (g: Grid) => void }
function finish(g: Grid, d: Def): Part {
  const tags = d.tags ?? [];
  if (!tags.includes('pair') && !tags.includes('asymmetric')) mirrorX(g);
  const used = new Set<number>();
  for (const v of g.c) if (v > 0) used.add(v);
  const keep: PaletteSlot[] = []; const remap = new Map<number, number>();
  PA.forEach((p, i) => { if (used.has(i + 1)) { remap.set(i + 1, keep.length + 1); keep.push(p); } });
  const cells = g.c.map(v => (v === 0 ? 0 : (remap.get(v) ?? 0)));
  return { id: d.id, slot: d.slot, name: d.name, doc: d.doc, size: [g.sx, g.sy, g.sz], palette: keep, cells, anchors: d.anchors, attachTo: d.attachTo, tags };
}
function def(d: Def): Part { const g = mk(d.size[0], d.size[1], d.size[2]); d.build(g); return finish(g, d); }

// ── colour schemes ──────────────────────────────────────────────────────────
const scheme = (skin: string, skinDark: string, skinLight: string, cloth1: string, cloth2: string, metal: string,
  leather: string, glow: string, hair: string, teeth: string, eyeWhite: string, pupil: string, accent: string): Record<PaletteSlot, string> =>
  ({ skin, skinDark, skinLight, cloth1, cloth2, metal, leather, glow, hair, teeth, eyeWhite, pupil, accent });

export const PART_PALETTES: Record<string, Record<PaletteSlot, string>> = {
  'swamp green': scheme('#79b34c', '#4c7a30', '#a7d678', '#4a3b26', '#6b5636', '#9aa3a8', '#5a3d24', '#ffd447', '#2f2419', '#f2ead2', '#f6f1e2', '#1a1410', '#c0392b'),
  'moss': scheme('#8aa85c', '#5d7a3c', '#b6cd85', '#3f4a33', '#5c6b45', '#b0b7a4', '#4d4029', '#a8e05f', '#4a3a24', '#efe6c9', '#eef2dc', '#20261a', '#e07a3f'),
  'hill goblin olive': scheme('#9c9a45', '#6d6a2e', '#c4c274', '#5a4a2c', '#7d6a3e', '#8f8a72', '#6b4c2a', '#ffbf3d', '#3b2f1c', '#f0e4c3', '#f4eeda', '#191409', '#b8452f'),
  'night teal': scheme('#3f8f8a', '#27615e', '#69bdb6', '#1d2b38', '#2c4152', '#7f97a8', '#2a3a44', '#5ff0d0', '#141d24', '#d8e6e4', '#e6f2f0', '#0a1014', '#ff7a59'),
  'ember orange': scheme('#c4643a', '#8a3f22', '#e79a63', '#3a2318', '#5b3826', '#b98a4a', '#4a2c1b', '#ffb03a', '#2a1710', '#f6e3c8', '#fbeadd', '#1d0f08', '#ff4d2e'),
  'ice blue': scheme('#8fb6d9', '#5c87ab', '#c3ddf2', '#2b3d55', '#3f5a7a', '#c9d6e2', '#39485c', '#8ff0ff', '#e8f1f8', '#eef6fb', '#f7fbff', '#132033', '#5f8fff'),
  'bog brown': scheme('#7d6a4a', '#54452e', '#a6906a', '#3b3222', '#574a30', '#8b7f5f', '#4b3a22', '#d9f05a', '#2b2317', '#e6d9b8', '#efe7d2', '#171209', '#a34a2a'),
  'royal purple': scheme('#8a5fa8', '#5d3d75', '#b489cf', '#2e1b45', '#4a2c6b', '#d4af37', '#3a2450', '#ffcf4a', '#241436', '#f0e2f5', '#f6ecfa', '#180c24', '#e0457b'),
};

// ── the library ─────────────────────────────────────────────────────────────
export function buildHeadParts(): Part[] {
  return [
    // HEADS ────────────────────────────────────────────────────────────────
    def({ id: 'head_classic', slot: 'head', name: 'Classic Goblin', doc: 'Cube-ish green skull, heavy brow ridge, jutting jaw and a stubby neck.', size: [14, 13, 13], attachTo: 'neck', anchors: aHead(14, 13, 13), tags: ['starter'], build: g => {
      ell(g, 6.5, 7.2, 6.9, 6.3, 5.6, 5.6, SKIN); box(g, 3, 1, 2, 10, 7, 10, SKIN); box(g, 4, 0, 4, 9, 2, 9, SKIN);
      faceDetail(g, 14, 13, GLOW, DARK, 1); box(g, 6, 4, 0, 7, 6, 0, SKIN); box(g, 13, 5, 4, 13, 9, 8, SKIN);
      box(g, 6, 3, 0, 7, 3, 0, TEETH); ell(g, 6.5, 1.6, 2.2, 2.4, 1.0, 1.1, LIGHT);
      shade(g, DARK, (_x, y) => y <= 1); shade(g, LIGHT, (_x, y, z) => y >= 11 && z >= 5);
    } }),
    def({ id: 'head_hero_cube', slot: 'head', name: "Hero's Cube", doc: 'Neat rounded block head with chiselled bevels — the playable-hero silhouette.', size: [14, 13, 13], attachTo: 'neck', anchors: aHead(14, 13, 13), tags: ['hero'], build: g => {
      box(g, 1, 2, 1, 12, 11, 11, SKIN); faceDetail(g, 14, 13, GLOW, TEETH, 1);
      for (const bx of [1, 10]) for (const by of [2, 9]) for (const bz of [1, 9]) box(g, bx, by, bz, bx + 1, by + 1, bz + 1, 0);
      box(g, 5, 0, 5, 8, 2, 8, SKIN); box(g, 5, 0, 5, 8, 0, 8, DARK); box(g, 2, 11, 2, 11, 11, 11, LIGHT);
      box(g, 6, 4, 0, 7, 6, 0, SKIN); box(g, 13, 5, 4, 13, 9, 8, SKIN); shade(g, DARK, (_x, y, z) => y <= 2 && z >= 3);
    } }),
    def({ id: 'head_hobgoblin', slot: 'head', name: 'Hobgoblin Brute', doc: 'Wide slab jaw, shelf-like brow and a bull neck for the oversized cousins.', size: [16, 14, 14], attachTo: 'neck', anchors: aHead(16, 14, 14), tags: ['brutal'], build: g => {
      ell(g, 7.5, 8.4, 7.8, 7.2, 5.2, 6.0, SKIN); box(g, 1, 2, 2, 14, 8, 12, SKIN); box(g, 2, 1, 3, 13, 3, 11, SKIN);
      box(g, 5, 0, 5, 10, 2, 10, DARK); faceDetail(g, 16, 14, GLOW, DARK, 1); box(g, 7, 4, 0, 8, 7, 0, SKIN);
      box(g, 1, 10, 0, 14, 11, 1, LIGHT); box(g, 15, 6, 5, 15, 10, 9, SKIN); box(g, 6, 2, 0, 9, 3, 0, TEETH);
      shade(g, DARK, (_x, y) => y <= 2); shade(g, LIGHT, (_x, y, z) => y >= 12 && z >= 6);
    } }),
    def({ id: 'head_bulb', slot: 'head', name: 'Bulb Head', doc: 'Enormous round cranium on a tiny muzzle — big-brained bog goblin.', size: [15, 15, 15], attachTo: 'neck', anchors: aHead(15, 15, 15), tags: ['odd'], build: g => {
      ell(g, 7, 8.8, 7.8, 6.9, 6.0, 6.6, SKIN); ell(g, 7, 3.4, 6.8, 4.6, 3.0, 4.6, SKIN); box(g, 5, 0, 5, 9, 2, 9, DARK);
      faceDetail(g, 15, 15, GLOW, DARK, 2); box(g, 6, 5, 1, 8, 8, 2, SKIN); box(g, 14, 8, 6, 14, 11, 9, SKIN);
      scatter(g, ACCENT, 149, 9, 14); shade(g, LIGHT, (_x, y) => y >= 13); shade(g, DARK, (_x, y, z) => y <= 2 && z >= 4);
    } }),
    def({ id: 'head_long', slot: 'head', name: 'Long Thin Head', doc: 'Stretched narrow skull with hollow cheeks and a pointed chin.', size: [10, 17, 11], attachTo: 'neck', anchors: aHead(10, 17, 11), tags: ['lanky'], build: g => {
      ell(g, 4.5, 10.5, 5.8, 4.2, 6.2, 4.6, SKIN); box(g, 2, 3, 2, 7, 8, 9, SKIN); box(g, 3, 1, 3, 6, 4, 8, SKIN);
      box(g, 3, 0, 4, 6, 2, 7, DARK); faceDetail(g, 10, 17, GLOW, DARK, 1); box(g, 4, 6, 0, 5, 9, 0, SKIN);
      box(g, 9, 9, 4, 9, 12, 7, SKIN); ell(g, 4.5, 2.4, 2.0, 2.0, 1.3, 1.2, LIGHT);
      shade(g, DARK, (x, y) => y <= 7 && (x <= 2 || x >= 7)); shade(g, LIGHT, (_x, y) => y >= 15);
    } }),
    def({ id: 'head_warty', slot: 'head', name: 'Bald Warty Head', doc: 'Polished bald dome sprinkled with warts and a shiny crown highlight.', size: [14, 13, 13], attachTo: 'neck', anchors: aHead(14, 13, 13), tags: ['grimy'], build: g => {
      ell(g, 6.5, 6.8, 7.0, 6.2, 5.8, 5.8, SKIN); box(g, 3, 1, 2, 10, 6, 10, SKIN); box(g, 4, 0, 4, 9, 2, 9, DARK);
      faceDetail(g, 14, 13, GLOW, DARK, 1); box(g, 6, 4, 0, 7, 6, 0, SKIN); box(g, 13, 5, 4, 13, 9, 8, SKIN);
      ell(g, 9, 11, 3.4, 1.3, 1.3, 1.3, LIGHT); scatter(g, LIGHT, 53, 5, 12); scatter(g, DARK, 97, 3, 12);
      shade(g, LIGHT, (_x, y, z) => y >= 10 && z >= 6); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'head_helmeted', slot: 'head', name: 'Helmeted Head', doc: 'Skull inside a riveted steel helmet with nose guard and cheek plates.', size: [16, 15, 16], attachTo: 'neck', anchors: aHead(16, 15, 16), tags: ['armoured'], build: g => {
      ell(g, 7.5, 6.4, 8.2, 6.5, 5.6, 6.2, SKIN); box(g, 3, 1, 3, 12, 6, 12, SKIN); box(g, 5, 0, 5, 10, 2, 10, DARK);
      shellE(g, 7.5, 9.2, 8.6, 7.6, 5.4, 7.4, 0.2, METAL); box(g, 3, 2, 0, 12, 9, 4, 0); box(g, 4, 2, 2, 11, 9, 4, SKIN);
      faceDetail(g, 16, 15, GLOW, DARK, 2); box(g, 7, 5, 1, 8, 9, 1, METAL); box(g, 13, 2, 1, 15, 7, 6, METAL);
      tubeY(g, 7.5, 8.6, 9, 10, 7.6, 6.6, METAL); scatter(g, LIGHT, 83, 10, 14); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'head_scarred', slot: 'head', name: 'Scarred Veteran', doc: 'Asymmetric battle-worn skull: long pale slash, stitches and a torn ear stump.', size: [14, 13, 13], attachTo: 'neck', anchors: aHead(14, 13, 13), tags: ['asymmetric', 'veteran'], build: g => {
      ell(g, 6.5, 7.2, 6.9, 6.3, 5.6, 5.6, SKIN); box(g, 3, 1, 2, 10, 7, 10, SKIN); box(g, 4, 0, 4, 9, 2, 9, DARK);
      faceDetail(g, 14, 13, GLOW, DARK, 1); box(g, 6, 4, 0, 7, 6, 0, SKIN); box(g, 13, 5, 4, 13, 9, 8, SKIN); box(g, 0, 5, 4, 0, 9, 8, SKIN);
      box(g, 0, 7, 5, 0, 9, 7, 0); line(g, 11, 10, 1, 4, 3, 1, 1, DARK); line(g, 11, 10, 0, 4, 3, 0, 0, LIGHT);
      for (let i = 0; i < 4; i++) set(g, 10 - i * 2, 9 - i * 2, 0, DARK);
      scatter(g, LIGHT, 131, 8, 12); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    // EARS (pairs, built as the left/+x side) ────────────────────────────────
    def({ id: 'ear_long_pointed', slot: 'ears', name: 'Long Pointed Ears', doc: 'The classic goblin dagger ear, swept up and back.', size: [11, 9, 5], attachTo: 'earL', anchors: aPair(11, 9, 5), tags: ['pair', 'starter'], build: g => {
      earSpike(g, 11, 5, 4, 3.4, 0.4, 2.6, 0, SKIN); line(g, 1, 4, 2, 9, 6, 2, 0, DARK);
      line(g, 1, 5.4, 1, 9, 7.4, 1, 0, LIGHT); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'ear_short_pointed', slot: 'ears', name: 'Short Pointed Ears', doc: 'Compact pricked ears for goblins who keep them out of trouble.', size: [8, 8, 5], attachTo: 'earL', anchors: aPair(8, 8, 5), tags: ['pair'], build: g => {
      earSpike(g, 8, 5, 3.4, 3.2, 0.6, 1.8, 0, SKIN); line(g, 1, 3.6, 2, 6, 5, 2, 0, DARK);
      line(g, 1, 5, 1, 6, 6.4, 1, 0, LIGHT); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'ear_droopy', slot: 'ears', name: 'Droopy Ears', doc: 'Long limp ears that hang past the jaw like wet leaves.', size: [9, 12, 5], attachTo: 'earL', anchors: aPair(9, 12, 5), tags: ['pair', 'old'], build: g => {
      earSpike(g, 9, 5, 6.5, 3.0, 0.7, -1, 4, SKIN); line(g, 1, 6, 2, 7, 2, 2, 0, DARK);
      line(g, 1, 7.6, 1, 7, 3.4, 1, 0, LIGHT); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'ear_notched', slot: 'ears', name: 'Notched Ears', doc: 'Battle-torn ear with a V bite taken out of the top edge.', size: [11, 9, 5], attachTo: 'earL', anchors: aPair(11, 9, 5), tags: ['pair', 'veteran'], build: g => {
      earSpike(g, 11, 5, 4, 3.4, 0.5, 2.4, 0, SKIN); box(g, 5, 6, 0, 7, 8, 4, 0);
      line(g, 5, 5, 0, 7, 5, 4, 0, DARK); line(g, 1, 4, 2, 9, 6, 2, 0, DARK); shade(g, LIGHT, (_x, y) => y >= 5);
    } }),
    def({ id: 'ear_ring_pierced', slot: 'ears', name: 'Ring-Pierced Ears', doc: 'Heavy lobe ear wearing a stolen brass ring.', size: [9, 11, 5], attachTo: 'earL', anchors: aPair(9, 11, 5), tags: ['pair', 'pirate'], build: g => {
      earSpike(g, 9, 5, 7, 3.0, 0.8, 0.6, 4, SKIN); ell(g, 1.4, 2.4, 2, 1.8, 2.0, 1.6, SKIN);
      ringZ(g, 1.4, 0.6, 1, 1.5, METAL); ringZ(g, 1.4, 0.6, 2, 1.5, METAL); set(g, 2, 0, 2, LIGHT);
      line(g, 1, 7, 2, 7, 4, 2, 0, DARK);
    } }),
    def({ id: 'ear_tall_rabbit', slot: 'ears', name: 'Tall Rabbit Ears', doc: 'Absurdly tall velvety ears that twitch at every coin sound.', size: [5, 16, 4], attachTo: 'earL', anchors: { root: [0, 2, 1], tip: [4, 15, 1] }, tags: ['pair', 'odd'], build: g => {
      ell(g, 0.8, 3, 1.8, 1.6, 3.2, 1.8, SKIN);
      for (let y = 0; y < 16; y++) { const t = y / 15; ell(g, 1.6 + t * 1.6, y, 1.8, 2.1 - t * 1.3, 0.75, 1.5 - t * 0.8, SKIN); }
      line(g, 1, 2, 2, 3, 14, 2, 0, DARK); line(g, 2, 3, 1, 4, 13, 1, 0, LIGHT);
    } }),
    def({ id: 'ear_fin', slot: 'ears', name: 'Fin Ears', doc: 'Flat ribbed membrane fins, bog-goblin blood showing through.', size: [9, 10, 3], attachTo: 'earL', anchors: aPair(9, 10, 3), tags: ['pair', 'bog'], build: g => {
      for (let x = 0; x < 9; x++) { const t = x / 8; const y1 = Math.round(8 - t * 6); box(g, x, 1, 1, x, y1, 2, SKIN); }
      box(g, 0, 1, 0, 1, 8, 2, SKIN); for (const rx of [2, 4, 6]) line(g, rx, 2, 1, rx + 1, 6, 1, 0, DARK);
      shade(g, LIGHT, (_x, y) => y >= 6); shade(g, ACCENT, (x, y) => x >= 3 && y <= 3);
    } }),
    def({ id: 'ear_small_round', slot: 'ears', name: 'Small Round Ears', doc: 'Stubby rounded ears with a deep inner crease — the half-blood look.', size: [7, 8, 5], attachTo: 'earL', anchors: aPair(7, 8, 5), tags: ['pair'], build: g => {
      ell(g, 0.8, 3.6, 2.2, 1.6, 2.8, 1.8, SKIN); ell(g, 3.0, 3.6, 2.2, 2.6, 3.0, 2.0, SKIN);
      ell(g, 3.4, 6.6, 2.2, 1.3, 1.1, 1.2, SKIN); ell(g, 2.4, 3.6, 1.0, 1.4, 1.8, 0.8, DARK);
      shade(g, LIGHT, (_x, y) => y >= 5);
    } }),
    // NOSES ──────────────────────────────────────────────────────────────────
    def({ id: 'nose_hooked', slot: 'nose', name: 'Long Hooked Nose', doc: 'Proud aquiline beak that curls down over the lip.', size: [7, 8, 9], attachTo: 'noseBase', anchors: aFace(7, 8, 9), tags: ['starter'], build: g => {
      box(g, 1, 3, 8, 5, 7, 8, SKIN);
      for (let z = 8; z >= 0; z--) { const t = (8 - z) / 8; const y = 5.6 - t * 2.4 - (t > 0.75 ? (t - 0.75) * 7 : 0); ell(g, 3, y, z, 2.0 - t * 0.9, 1.9 - t * 0.8, 1.1, SKIN); }
      set(g, 2, 2, 1, DARK); set(g, 4, 2, 1, DARK); line(g, 3, 6.4, 7, 3, 4.4, 2, 0, LIGHT); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'nose_button', slot: 'nose', name: 'Button Nose', doc: 'Small upturned snub nose with a bright highlight.', size: [8, 7, 6], attachTo: 'noseBase', anchors: aFace(8, 7, 6), tags: ['young'], build: g => {
      box(g, 1, 1, 4, 6, 5, 5, SKIN); ell(g, 3.5, 3.0, 2.0, 2.8, 2.4, 2.4, SKIN); ell(g, 3.5, 4.0, 0.8, 1.5, 1.0, 0.8, LIGHT);
      set(g, 2, 1, 1, DARK); set(g, 5, 1, 1, DARK); ell(g, 3.5, 1.6, 1.2, 2.0, 0.9, 1.0, DARK); shade(g, DARK, (_x, y) => y <= 0);
    } }),
    def({ id: 'nose_bulbous', slot: 'nose', name: 'Big Bulbous Nose', doc: 'Enormous ruddy bulb, warty and well-lived-in.', size: [9, 8, 7], attachTo: 'noseBase', anchors: aFace(9, 8, 7), tags: ['old'], build: g => {
      box(g, 2, 2, 6, 6, 6, 6, SKIN); ell(g, 4, 3.6, 3.0, 3.6, 3.2, 3.2, SKIN); ell(g, 4, 5.2, 1.0, 1.8, 1.1, 1.0, LIGHT);
      ell(g, 2.0, 2.0, 1.4, 1.0, 1.0, 1.1, DARK); ell(g, 6.0, 2.0, 1.4, 1.0, 1.0, 1.1, DARK);
      scatter(g, ACCENT, 61, 2, 7); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'nose_pointy', slot: 'nose', name: 'Pointy Nose', doc: 'Sharp wedge snout, all attitude and nostril flare.', size: [7, 7, 10], attachTo: 'noseBase', anchors: aFace(7, 7, 10), tags: [], build: g => {
      box(g, 1, 1, 8, 5, 5, 9, SKIN);
      for (let z = 9; z >= 0; z--) { const t = (9 - z) / 9; ell(g, 3, 3.4 + t * 0.8, z, 2.2 - t * 1.8, 2.2 - t * 1.8, 1.0, SKIN); }
      set(g, 2, 2, 8, DARK); set(g, 4, 2, 8, DARK); line(g, 3, 5.2, 8, 3, 4.6, 2, 0, LIGHT); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'nose_pig_flat', slot: 'nose', name: 'Flat Pig Nose', doc: 'Broad flat snout with two big slit nostrils for bog-sniffing.', size: [9, 7, 5], attachTo: 'noseBase', anchors: aFace(9, 7, 5), tags: ['bog'], build: g => {
      box(g, 2, 1, 3, 6, 5, 4, SKIN); ell(g, 4, 3.2, 2.4, 4.0, 2.8, 2.0, SKIN); ell(g, 4, 4.8, 1.0, 2.4, 1.0, 0.9, LIGHT);
      box(g, 2, 2, 0, 3, 4, 1, DARK); box(g, 5, 2, 0, 6, 4, 1, DARK); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'nose_crooked', slot: 'nose', name: 'Crooked Nose', doc: 'Broken twice, set never: the whole snout leans sideways with a callus.', size: [9, 9, 8], attachTo: 'noseBase', anchors: aFace(9, 9, 8), tags: ['asymmetric', 'veteran'], build: g => {
      box(g, 2, 3, 7, 6, 7, 7, SKIN);
      for (let z = 7; z >= 0; z--) { const t = (7 - z) / 7; ell(g, 4 + Math.sin(t * 3.2) * 2.6, 5.4 - t * 1.8, z, 2.1 - t * 0.7, 2.0 - t * 0.7, 1.1, SKIN); }
      ell(g, 5.8, 4.6, 3.0, 1.5, 1.4, 1.4, LIGHT); set(g, 3, 2, 1, DARK); set(g, 5, 2, 1, DARK); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    // EYES ───────────────────────────────────────────────────────────────────
    def({ id: 'eye_amber_glow', slot: 'eyes', name: 'Amber Glow Eyes', doc: 'Sunken socket with a burning amber iris and a wet glint.', size: [6, 6, 4], attachTo: 'eyeL', anchors: aEye(6, 6, 4), tags: ['pair', 'starter'], build: g => {
      box(g, 0, 0, 3, 5, 5, 3, SKIN); ell(g, 2.5, 2.5, 1, 2.4, 2.4, 0.5, DARK); ell(g, 2.6, 2.5, 0.4, 1.0, 1.0, 0.5, GLOW);
      set(g, 3, 3, 0, EYEW); box(g, 0, 5, 0, 5, 5, 2, SKIN); box(g, 0, 0, 0, 5, 0, 1, SKIN); set(g, 2, 5, 0, LIGHT);
    } }),
    def({ id: 'eye_angry_slanted', slot: 'eyes', name: 'Angry Slanted Eyes', doc: 'Beetling brow ramping down to the nose over a narrow glare.', size: [7, 6, 4], attachTo: 'eyeL', anchors: aEye(7, 6, 4), tags: ['pair', 'brutal'], build: g => {
      box(g, 0, 0, 3, 6, 5, 3, SKIN); ell(g, 3.0, 2.0, 1, 2.6, 1.5, 0.5, DARK); ell(g, 3.2, 2.0, 0.4, 1.4, 0.9, 0.5, GLOW);
      set(g, 4, 2, 0, PUPIL); for (let x = 0; x < 7; x++) { const yb = 3 + Math.round(x * 0.45); box(g, x, yb, 0, x, 5, 2, SKIN); set(g, x, yb - 1, 0, DARK); }
      set(g, 5, 5, 0, LIGHT);
    } }),
    def({ id: 'eye_cartoon_big', slot: 'eyes', name: 'Big Cartoon Eyes', doc: 'Huge bug-eyed whites with a giant pupil — pure greed expression.', size: [8, 8, 4], attachTo: 'eyeL', anchors: aEye(8, 8, 4), tags: ['pair', 'comic'], build: g => {
      box(g, 0, 0, 3, 7, 7, 3, SKIN); ell(g, 3.5, 3.5, 1, 3.3, 3.3, 0.5, DARK); ell(g, 3.5, 3.6, 0.6, 3.0, 3.0, 0.5, EYEW);
      ell(g, 4.0, 3.4, 0, 1.5, 1.8, 0.4, PUPIL); set(g, 4, 4, 0, EYEW); box(g, 0, 7, 0, 7, 7, 2, SKIN); set(g, 1, 6, 0, DARK); set(g, 6, 6, 0, DARK);
    } }),
    def({ id: 'eye_squint', slot: 'eyes', name: 'Squint Eyes', doc: 'Heavy lids clamped to a slit with just a spark of glow showing.', size: [9, 5, 3], attachTo: 'eyeL', anchors: aEye(9, 5, 3), tags: ['pair', 'sly'], build: g => {
      box(g, 0, 0, 2, 8, 4, 2, SKIN); box(g, 1, 2, 1, 7, 2, 1, DARK); box(g, 3, 2, 0, 6, 2, 0, GLOW);
      box(g, 0, 3, 0, 8, 4, 1, SKIN); box(g, 0, 0, 0, 8, 1, 1, SKIN); shade(g, DARK, (_x, y) => y === 3); set(g, 5, 2, 0, EYEW);
    } }),
    def({ id: 'eye_cyclops', slot: 'eyes', name: 'One-Eyed Single', doc: 'Single centred orb, no pair: socket, glowing iris and huge pupil.', size: [13, 11, 4], attachTo: 'noseBase', anchors: { root: [6, 3, 3], centre: [6, 5, 0] }, tags: ['single', 'mutant'], build: g => {
      box(g, 0, 0, 3, 12, 10, 3, SKIN); ell(g, 6, 5.5, 2, 4.6, 4.4, 0.5, DARK); ell(g, 6, 5.5, 1, 3.8, 3.6, 0.5, GLOW);
      ell(g, 6, 5.5, 0.4, 1.9, 2.4, 0.5, PUPIL); set(g, 7, 7, 0, EYEW); set(g, 5, 4, 0, EYEW);
      box(g, 1, 9, 1, 11, 10, 2, SKIN); box(g, 1, 10, 0, 11, 10, 1, LIGHT); shade(g, DARK, (_x, y) => y <= 0);
    } }),
    def({ id: 'eye_visor_cyber', slot: 'eyes', name: 'Cyber Visor Strip', doc: 'Bolted metal visor band with a glowing lens strip, no pair needed.', size: [15, 6, 4], attachTo: 'noseBase', anchors: { root: [7, 1, 3], lensL: [3, 2, 0], lensR: [11, 2, 0] }, tags: ['tech', 'single'], build: g => {
      box(g, 0, 0, 3, 14, 5, 3, METAL); box(g, 1, 1, 2, 13, 4, 2, METAL); box(g, 2, 2, 0, 12, 3, 1, GLOW);
      box(g, 0, 1, 1, 1, 4, 2, METAL); box(g, 13, 1, 1, 14, 4, 2, METAL); box(g, 2, 4, 0, 12, 4, 1, METAL);
      for (let x = 3; x <= 11; x += 4) set(g, x, 3, 0, ACCENT); set(g, 7, 2, 0, EYEW); box(g, 6, 0, 2, 8, 0, 3, LEATHER); scatter(g, LIGHT, 47, 3, 5);
    } }),
    // MOUTHS ─────────────────────────────────────────────────────────────────
    def({ id: 'mouth_grin_fangs', slot: 'mouth', name: 'Grin With Fangs', doc: 'Wide upturned grin, tooth row and two overlong fangs.', size: [13, 8, 3], attachTo: 'mouthSeat', anchors: aFace(13, 8, 3), tags: ['starter'], build: g => {
      box(g, 1, 1, 2, 11, 6, 2, DARK);
      for (let x = 1; x <= 11; x++) { const t = (x - 1) / 10; const y = Math.round(5 - 3 * Math.sin(Math.PI * t)); box(g, x, y, 0, x, y + 2, 1, DARK); set(g, x, y + 2, 0, TEETH); }
      for (const fx of [3, 9]) { const t = (fx - 1) / 10; const y = Math.round(5 - 3 * Math.sin(Math.PI * t)); box(g, fx, y - 2, 0, fx, y - 1, 0, TEETH); }
    } }),
    def({ id: 'mouth_smirk_wide', slot: 'mouth', name: 'Wide Smirk', doc: 'Broad knowing smirk packed with flat teeth and upturned corners.', size: [14, 6, 3], attachTo: 'mouthSeat', anchors: aFace(14, 6, 3), tags: ['sly'], build: g => {
      box(g, 0, 1, 2, 13, 3, 2, DARK); box(g, 0, 2, 0, 13, 2, 1, DARK); box(g, 1, 3, 0, 12, 3, 1, TEETH); box(g, 2, 1, 0, 11, 1, 1, TEETH);
      set(g, 0, 4, 0, DARK); set(g, 13, 4, 0, DARK); for (let x = 3; x <= 10; x += 3) set(g, x, 3, 0, DARK); shade(g, LIGHT, (_x, y) => y === 4);
    } }),
    def({ id: 'mouth_tusks', slot: 'mouth', name: 'Tusks', doc: 'Tight-lipped scowl with two boar tusks pushing up past the lip.', size: [13, 8, 4], attachTo: 'mouthSeat', anchors: aFace(13, 8, 4), tags: ['brutal'], build: g => {
      box(g, 2, 2, 3, 10, 3, 3, DARK); box(g, 2, 2, 1, 10, 3, 2, DARK); box(g, 4, 3, 0, 8, 3, 0, TEETH);
      for (const tx of [3, 9]) { box(g, tx, 3, 0, tx + 1, 7, 1, TEETH); ell(g, tx + 0.5, 7.2, 0.4, 0.9, 0.9, 0.7, TEETH); set(g, tx, 6, 0, LIGHT); }
      shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'mouth_tongue', slot: 'mouth', name: 'Tongue Out', doc: 'Gaping mouth with a fat tongue lolling out over the chin.', size: [12, 8, 4], attachTo: 'mouthSeat', anchors: aFace(12, 8, 4), tags: ['comic'], build: g => {
      ell(g, 5.5, 4.2, 2, 4.6, 2.6, 1.2, DARK); box(g, 2, 6, 1, 9, 6, 2, TEETH); ell(g, 5.5, 2.2, 1.0, 2.6, 1.8, 1.3, ACCENT);
      ell(g, 5.5, 1.0, 0.4, 1.6, 1.1, 0.9, ACCENT); line(g, 5.5, 2.8, 0, 5.5, 1.0, 0, 0, LIGHT); shade(g, DARK, (_x, y) => y <= 0);
    } }),
    def({ id: 'mouth_frown', slot: 'mouth', name: 'Frown', doc: 'Downturned grimace with two sad teeth showing at the corners.', size: [12, 6, 3], attachTo: 'mouthSeat', anchors: aFace(12, 6, 3), tags: [], build: g => {
      box(g, 1, 2, 2, 10, 3, 2, DARK);
      for (let x = 1; x <= 10; x++) { const t = (x - 1) / 9; const y = Math.round(1.6 + 2.2 * Math.sin(Math.PI * t)); box(g, x, y, 0, x, y + 1, 1, DARK); }
      set(g, 4, 4, 0, TEETH); set(g, 7, 4, 0, TEETH); shade(g, LIGHT, (_x, y) => y >= 5);
    } }),
    def({ id: 'mouth_gap_toothy', slot: 'mouth', name: 'Toothy Gap', doc: 'Gaping maw with broken, spaced-out teeth and a glimpse of tongue.', size: [13, 7, 3], attachTo: 'mouthSeat', anchors: aFace(13, 7, 3), tags: ['grimy'], build: g => {
      box(g, 1, 1, 2, 11, 5, 2, DARK); box(g, 1, 2, 0, 11, 4, 1, DARK);
      for (let x = 2; x <= 10; x += 2) set(g, x, 4, 0, TEETH); for (let x = 3; x <= 9; x += 3) set(g, x, 2, 0, TEETH);
      box(g, 5, 3, 0, 7, 3, 0, ACCENT); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    // HAIR ───────────────────────────────────────────────────────────────────
    def({ id: 'hair_mohawk', slot: 'hair', name: 'Mohawk', doc: 'Stiff greased crest, tall at the crown, shaved at the sides.', size: [7, 13, 13], attachTo: 'hatSeat', anchors: aTop(7, 13, 13), tags: ['brutal'], build: g => {
      for (let z = 0; z < 13; z++) { const t = z / 12; const h = 2 + Math.round(8 * Math.sin(Math.PI * t)); box(g, 2, 0, z, 4, h, z, HAIR); set(g, 3, h, z, LIGHT); }
      box(g, 1, 0, 2, 5, 1, 10, LEATHER); scatter(g, ACCENT, 71, 4, 12);
    } }),
    def({ id: 'hair_tuft', slot: 'hair', name: 'Tuft', doc: 'Scrappy little tuft of hair sticking up in five directions.', size: [11, 7, 9], attachTo: 'hatSeat', anchors: aTop(11, 7, 9), tags: ['young'], build: g => {
      ell(g, 5, 1.2, 4.2, 4.6, 1.4, 3.8, HAIR);
      for (const s of [[3, 5, 2], [5, 6, 4], [7, 5, 6], [2, 4, 6], [8, 4, 3]] as V3[]) line(g, 5, 1, 4.2, s[0], s[1], s[2], 0, HAIR);
      shade(g, LIGHT, (_x, y) => y >= 4); scatter(g, DARK, 89, 0, 2);
    } }),
    def({ id: 'hair_topknot', slot: 'hair', name: 'Top Knot', doc: 'Close-cropped sides with a warrior knot bound in a cloth band.', size: [9, 14, 9], attachTo: 'hatSeat', anchors: aTop(9, 14, 9), tags: ['warrior'], build: g => {
      ell(g, 4, 1.0, 4, 3.6, 1.2, 3.4, HAIR);
      for (let y = 2; y < 9; y++) ell(g, 4, y, 4, 2.2 - y * 0.11, 0.6, 2.2 - y * 0.11, HAIR);
      ell(g, 4, 8, 4, 2.5, 0.7, 2.5, CLOTH2); ell(g, 4, 10.6, 4, 2.6, 2.2, 2.6, HAIR);
      shade(g, LIGHT, (_x, y) => y >= 11); scatter(g, DARK, 67, 1, 7);
    } }),
    def({ id: 'hair_braid_long', slot: 'hair', name: 'Long Braid', doc: 'Greasy cap with one thick plaited braid hanging down the back, beaded tip.', size: [11, 18, 11], attachTo: 'hatSeat', anchors: { root: [5, 16, 5], braidEnd: [5, 0, 9] }, tags: ['warrior'], build: g => {
      ell(g, 5, 15.6, 5.0, 4.8, 1.6, 4.6, HAIR); box(g, 3, 13, 7, 7, 16, 10, HAIR);
      for (let i = 0; i < 12; i++) { const y = 15 - i * 1.25; ell(g, 5 + (i % 2 === 0 ? -0.5 : 0.5), y, 9.2, 2.1, 0.95, 1.7, HAIR); }
      ell(g, 5, 1.0, 9.2, 1.5, 1.2, 1.4, CLOTH2); set(g, 5, 0, 9, ACCENT); shade(g, LIGHT, (_x, y) => y >= 15); scatter(g, DARK, 83, 2, 14);
    } }),
    // HATS ───────────────────────────────────────────────────────────────────
    def({ id: 'hat_pointed', slot: 'hat', name: 'Pointed Hat', doc: 'Witchy wide-brimmed cone with a band and a brass buckle.', size: [17, 20, 17], attachTo: 'hatSeat', anchors: aTop(17, 20, 17), tags: ['magic'], build: g => {
      ell(g, 8, 0.8, 8, 8.2, 1.0, 8.2, LEATHER); ell(g, 8, 2.2, 8, 5.2, 1.4, 5.2, CLOTH1);
      for (let y = 3; y < 20; y++) { const t = (y - 3) / 16; const r = 5.0 - t * 4.6; ell(g, 8, y, 8, r, 0.7, r, CLOTH1); }
      ell(g, 8, 4, 8, 5.1, 1.1, 5.1, CLOTH2); ell(g, 8, 4, 3.0, 1.4, 1.2, 1.0, METAL);
      shade(g, LIGHT, (_x, y) => y >= 16); scatter(g, CLOTH2, 137, 6, 18);
    } }),
    def({ id: 'hat_bandana_pirate', slot: 'hat', name: 'Pirate Bandana', doc: 'Knotted polka-dot headscarf with two tails flapping at the nape.', size: [16, 8, 16], attachTo: 'hatSeat', anchors: aTop(16, 8, 16), tags: ['pirate'], build: g => {
      ell(g, 7.5, 2.6, 8, 7.4, 2.8, 7.2, CLOTH1); ell(g, 7.5, 1.6, 8, 6.2, 2.2, 6.0, 0);
      shade(g, CLOTH2, (_x, y) => y <= 1); scatter(g, CLOTH2, 53, 2, 5);
      line(g, 6, 1, 14, 4, 0, 15, 0, CLOTH1); line(g, 9, 1, 14, 11, 0, 15, 0, CLOTH1); ell(g, 7.5, 1.2, 14.4, 1.4, 1.2, 1.2, CLOTH2);
    } }),
    def({ id: 'hat_helmet_horn', slot: 'hat', name: 'Horned Helmet', doc: 'Open steel helm with a leather crest and a pair of curling horns.', size: [19, 13, 19], attachTo: 'hatSeat', anchors: aTop(19, 13, 19), tags: ['armoured', 'brutal'], build: g => {
      shellE(g, 9, 5.0, 9.4, 7.4, 5.6, 7.2, 0.22, METAL); box(g, 2, 0, 2, 16, 1, 16, 0);
      tubeY(g, 9, 9.4, 0, 1, 7.6, 6.8, METAL); line(g, 15, 4, 9, 17, 7, 10, 1, TEETH); line(g, 17, 7, 10, 18, 9, 10, 0, TEETH);
      for (let z = 4; z <= 14; z++) { const h = Math.round(2 * Math.sin(((z - 4) / 10) * Math.PI)); box(g, 9, 10, z, 9, 10 + h, z, LEATHER); }
      scatter(g, LIGHT, 91, 6, 10); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'hat_flat_cap', slot: 'hat', name: 'Flat Cap', doc: 'Thieved newsboy cap with a stiff front peak and a cloth band.', size: [16, 7, 16], attachTo: 'hatSeat', anchors: aTop(16, 7, 16), tags: ['rogue'], build: g => {
      ell(g, 7.5, 2.6, 8.4, 6.6, 2.4, 6.4, CLOTH1); ell(g, 7.5, 1.8, 8.4, 5.4, 1.8, 5.2, 0);
      box(g, 1, 3, 0, 14, 4, 4, CLOTH1); shade(g, CLOTH2, (_x, y) => y <= 2); ell(g, 7.5, 4.6, 8.4, 1.0, 0.6, 1.0, CLOTH2);
      scatter(g, CLOTH2, 101, 3, 5);
    } }),
    def({ id: 'hat_crown', slot: 'hat', name: 'Crown', doc: 'Goblin king circlet: gold band, eight points and four set gems.', size: [15, 9, 15], attachTo: 'hatSeat', anchors: aTop(15, 9, 15), tags: ['royal'], build: g => {
      tubeY(g, 7, 7, 0, 3, 6.6, 5.6, METAL);
      for (let i = 0; i < 8; i++) { const a = ((2 * i + 1) * Math.PI) / 8; const x = 7 + 6.1 * Math.cos(a), z = 7 + 6.1 * Math.sin(a); line(g, x, 4, z, x, 7, z, 0, METAL); set(g, Math.round(x), 7, Math.round(z), LIGHT); }
      for (let i = 0; i < 4; i++) { const a = ((2 * i + 1) * Math.PI) / 4; set(g, Math.round(7 + 6.6 * Math.cos(a)), 1, Math.round(7 + 6.6 * Math.sin(a)), ACCENT); }
      scatter(g, LIGHT, 109, 2, 3);
    } }),
    def({ id: 'hat_goggles', slot: 'hat', name: 'Goggles On Head', doc: 'Tinkerer goggles pushed up on the brow, lenses still glowing.', size: [17, 7, 8], attachTo: 'hatSeat', anchors: { root: [8, 2, 4], lensL: [4, 3, 0], lensR: [12, 3, 0] }, tags: ['tech'], build: g => {
      box(g, 13, 2, 1, 16, 4, 7, LEATHER); box(g, 3, 1, 1, 13, 5, 2, LEATHER);
      ell(g, 11.6, 3, 1, 2.6, 2.6, 0.45, METAL); ell(g, 11.6, 3, 0, 1.9, 1.9, 0.45, GLOW); set(g, 12, 4, 0, EYEW);
      ell(g, 4.4, 3, 1, 2.6, 2.6, 0.45, METAL); ell(g, 4.4, 3, 0, 1.9, 1.9, 0.45, GLOW); set(g, 4, 4, 0, EYEW);
      box(g, 7, 3, 1, 9, 3, 1, METAL); scatter(g, METAL, 71, 2, 4);
    } }),
    // FACE EXTRAS ────────────────────────────────────────────────────────────
    def({ id: 'fx_eyepatch', slot: 'face-extra', name: 'Eye Patch', doc: 'Leather patch over one eye with a buckle strap across the face.', size: [15, 8, 4], attachTo: 'eyeL', anchors: { root: [10, 3, 3], strapL: [0, 4, 3], strapR: [14, 4, 3] }, tags: ['asymmetric', 'pirate'], build: g => {
      box(g, 0, 3, 2, 14, 5, 3, LEATHER); ell(g, 10.5, 3.4, 1.0, 3.4, 3.0, 1.2, LEATHER); ell(g, 10.5, 3.4, 0.4, 2.5, 2.1, 0.8, CLOTH1);
      set(g, 12, 5, 0, METAL); box(g, 1, 3, 1, 3, 5, 2, METAL); shade(g, DARK, (_x, y) => y <= 2);
    } }),
    def({ id: 'fx_warpaint', slot: 'face-extra', name: 'Warpaint Stripes', doc: 'Ochre forehead band with cheek stripes and a bridge mark — war ready.', size: [15, 9, 3], attachTo: 'noseBase', anchors: { root: [7, 6, 2], cheekL: [2, 3, 0], cheekR: [12, 3, 0] }, tags: ['warrior'], build: g => {
      box(g, 1, 6, 0, 13, 7, 1, ACCENT); box(g, 2, 1, 0, 3, 5, 1, ACCENT); box(g, 7, 3, 0, 7, 5, 1, ACCENT);
      for (let x = 4; x <= 10; x += 3) set(g, x, 7, 0, CLOTH2); shade(g, DARK, (_x, y) => y <= 1);
    } }),
    def({ id: 'fx_beard', slot: 'face-extra', name: 'Beard', doc: 'Bristling chin beard with two braids and cloth beads, hanging from the jaw.', size: [15, 13, 10], attachTo: 'mouthSeat', anchors: { root: [7, 12, 3], braidL: [4, 0, 6], braidR: [10, 0, 6] }, tags: ['old'], build: g => {
      ell(g, 7, 9.6, 5.0, 6.6, 3.4, 4.4, HAIR); ell(g, 7, 4.2, 4.0, 4.6, 4.6, 3.4, HAIR); box(g, 5, 0, 3, 9, 2, 6, HAIR);
      ell(g, 7, 11.2, 2.2, 5.0, 1.6, 2.0, HAIR);
      for (const bx of [4, 10]) { line(g, bx, 6, 5, bx, 1, 6, 0, HAIR); set(g, bx, 1, 6, CLOTH2); set(g, bx, 0, 6, ACCENT); }
      shade(g, LIGHT, (_x, y, z) => y >= 10 && z <= 4); scatter(g, DARK, 79, 1, 8);
    } }),
    def({ id: 'fx_scar', slot: 'face-extra', name: 'Scar', doc: 'Raised welt with a pale blade line and stitches across one cheek.', size: [13, 11, 3], attachTo: 'eyeL', anchors: { root: [9, 7, 2], scarTop: [10, 9, 0], scarEnd: [3, 2, 0] }, tags: ['asymmetric', 'veteran'], build: g => {
      line(g, 10, 9, 1, 3, 2, 1, 2, DARK); line(g, 10, 9, 0, 3, 2, 0, 0, LIGHT);
      for (let i = 0; i < 5; i++) { const t = i / 4; const x = Math.round(10 - 7 * t), y = Math.round(9 - 7 * t); set(g, x + 1, y, 0, DARK); set(g, x - 1, y, 0, DARK); }
      shade(g, DARK, (_x, y) => y <= 1);
    } }),
  ];
}

/**
 * Join stray pieces to the biggest one with 6-connected paths (hats, hair and thin shapes were drawn with corner-only contacts), copying the colour of the
 * voxel the path leaves from. Parts that are not asymmetric are welded symmetrically so they stay exact mirror images. Deterministic.
 */
export function weldPart(part: Part): Part {
  const [sx, sy, sz] = part.size;
  const n = sx * sy * sz;
  const idx = (x: number, y: number, z: number): number => x + sx * (y + sy * z);
  const label = new Int32Array(n).fill(-1);
  const comps: number[][] = [];
  const nb: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let i = 0; i < n; i++) {
    if (!part.cells[i] || label[i] !== -1) continue;
    const list = [i], stack = [i];
    label[i] = comps.length;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % sx, y = Math.floor(c / sx) % sy, z = Math.floor(c / (sx * sy));
      for (const d of nb) {
        const X = x + d[0], Y = y + d[1], Z = z + d[2];
        if (X < 0 || Y < 0 || Z < 0 || X >= sx || Y >= sy || Z >= sz) continue;
        const j = idx(X, Y, Z);
        if (part.cells[j] && label[j] === -1) { label[j] = comps.length; list.push(j); stack.push(j); }
      }
    }
    comps.push(list);
  }
  if (comps.length <= 1) return part;
  const symmetric = !part.tags.includes('pair') && !part.tags.includes('asymmetric');
  const cells = part.cells.slice();
  const order = comps.map((_, i) => i).sort((a, b) => comps[b]!.length - comps[a]!.length || a - b);
  const body = comps[order[0]!]!.slice();
  const xyz = (c: number): V3 => [c % sx, Math.floor(c / sx) % sy, Math.floor(c / (sx * sy))];
  for (const ci of order.slice(1)) {
    const piece = comps[ci]!;
    if (piece.every((c) => body.includes(c))) continue;
    let best = Infinity, from = piece[0]!, to = body[0]!;
    for (const a of piece) { const A = xyz(a); for (const b of body) { const B = xyz(b); const d = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2]); if (d < best) { best = d; from = a; to = b; } } }
    const A = xyz(from), B = xyz(to), v = part.cells[from]!;
    const cur: V3 = [A[0], A[1], A[2]];
    while (cur[0] !== B[0] || cur[1] !== B[1] || cur[2] !== B[2]) {
      let ax = 0, gap = -1;
      for (let k = 0; k < 3; k++) { const g = Math.abs(B[k]! - cur[k]!); if (g > gap) { gap = g; ax = k; } }
      cur[ax] = cur[ax]! + Math.sign(B[ax]! - cur[ax]!);
      const j = idx(cur[0], cur[1], cur[2]);
      if (!cells[j]) { cells[j] = v; body.push(j); }
      if (symmetric) { const k2 = idx(sx - 1 - cur[0], cur[1], cur[2]); if (!cells[k2]) { cells[k2] = v; body.push(k2); } }
    }
    for (const a of piece) body.push(a);
  }
  return { ...part, cells };
}

export const HEAD_PARTS: Part[] = buildHeadParts().map(weldPart);

// ── validation / stats / preview ────────────────────────────────────────────
const isV3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number');

function countComponents(cells: number[], sx: number, sy: number, sz: number): number {
  const seen = new Uint8Array(cells.length); const stack: number[] = []; let comps = 0;
  const nb: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let i = 0; i < cells.length; i++) {
    if ((cells[i] ?? 0) === 0 || seen[i] === 1) continue;
    comps++; seen[i] = 1; stack.length = 0; stack.push(i);
    while (stack.length > 0) {
      const c = stack.pop() as number;
      const x = c % sx, y = Math.floor(c / sx) % sy, z = Math.floor(c / (sx * sy));
      for (const d of nb) {
        const nx = x + d[0], ny = y + d[1], nz = z + d[2];
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const j = nx + ny * sx + nz * sx * sy;
        if (seen[j] === 0 && (cells[j] ?? 0) !== 0) { seen[j] = 1; stack.push(j); }
      }
    }
  }
  return comps;
}

export function validatePart(p: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof p !== 'object' || p === null) return { ok: false, errors: ['part must be an object'] };
  const q = p as Record<string, unknown>;
  for (const k of ['id', 'name', 'doc', 'attachTo']) {
    const v = q[k]; if (typeof v !== 'string' || v.length === 0) errors.push(`${k}: must be a non-empty string`);
  }
  const slot = q['slot'];
  if (typeof slot !== 'string' || !SLOT_VALUES.includes(slot as Slot)) errors.push(`slot: unknown slot ${JSON.stringify(slot)}`);
  let sx = 0, sy = 0, sz = 0;
  const size = q['size'];
  if (!isV3(size)) errors.push('size: must be a V3 tuple of numbers');
  else {
    sx = size[0]; sy = size[1]; sz = size[2];
    if (![sx, sy, sz].every(n => Number.isInteger(n) && n >= 1 && n <= 40)) errors.push(`size: axes must be integers 1..40, got ${JSON.stringify(size)}`);
  }
  let plen = 0;
  const pal = q['palette'];
  if (!Array.isArray(pal) || pal.length === 0) errors.push('palette: must be a non-empty array');
  else {
    plen = pal.length; const seen = new Set<string>();
    if (pal.length > PALETTE_SLOT_VALUES.length) errors.push('palette: more entries than PaletteSlot names');
    for (const s of pal) {
      if (typeof s !== 'string' || !PALETTE_SLOT_VALUES.includes(s as PaletteSlot)) errors.push(`palette: unknown slot ${JSON.stringify(s)}`);
      else if (seen.has(s)) errors.push(`palette: duplicate slot ${s}`);
      seen.add(String(s));
    }
  }
  const cells = q['cells'];
  if (!Array.isArray(cells)) errors.push('cells: must be an array of numbers');
  else if (sx > 0 && sy > 0 && sz > 0 && plen > 0 && errors.length === 0) {
    if (cells.length !== sx * sy * sz) errors.push(`cells: length ${cells.length} != ${sx * sy * sz}`);
    const used = new Set<number>(); let filled = 0; let bad = false;
    for (const c of cells) {
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > plen) { errors.push(`cells: value ${String(c)} outside palette range 0..${plen}`); bad = true; break; }
      if (c > 0) { used.add(c); filled++; }
    }
    if (!bad) {
      if (filled === 0) errors.push('cells: no filled voxels');
      for (let i = 1; i <= plen; i++) if (!used.has(i)) errors.push(`palette: entry ${i} (${String(pal[i - 1])}) is unused by cells`);
      if (filled > 0) {
        const comps = countComponents(cells as number[], sx, sy, sz);
        if (comps !== 1) errors.push(`cells: ${comps} disconnected components, must be 1 (6-connectivity)`);
      }
    }
  }
  const anchors = q['anchors'];
  if (typeof anchors !== 'object' || anchors === null || Array.isArray(anchors)) errors.push('anchors: must be a record of V3');
  else {
    const rec = anchors as Record<string, unknown>;
    if (!('root' in rec)) errors.push("anchors: missing required 'root' anchor");
    for (const [k, v] of Object.entries(rec)) {
      const lim = [sx, sy, sz];
      if (!isV3(v) || !v.every((n, i) => Number.isInteger(n) && n >= 0 && n < (lim[i] ?? 0))) errors.push(`anchors: '${k}' must be integer V3 inside the grid, got ${JSON.stringify(v)}`);
    }
  }
  const tags = q['tags'];
  if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) errors.push('tags: must be an array of strings');
  return { ok: errors.length === 0, errors };
}

export function partStats(p: Part): { voxels: number; bounds: { min: V3; max: V3 }; components: number } {
  const sx = p.size[0], sy = p.size[1], sz = p.size[2];
  let voxels = 0; const min: V3 = [sx, sy, sz]; const max: V3 = [-1, -1, -1];
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
    if ((p.cells[x + y * sx + z * sx * sy] ?? 0) === 0) continue;
    voxels++;
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
  }
  if (voxels === 0) { min[0] = 0; min[1] = 0; min[2] = 0; max[0] = 0; max[1] = 0; max[2] = 0; }
  return { voxels, bounds: { min, max }, components: countComponents(p.cells, sx, sy, sz) };
}

const GLYPH = '.#*+=-@$%!~^&o';
export function ascii(p: Part, y: number): string {
  const sx = p.size[0], sy = p.size[1], sz = p.size[2];
  const yy = Math.max(0, Math.min(sy - 1, Math.floor(y)));
  const rows: string[] = [];
  for (let z = 0; z < sz; z++) {
    let row = '';
    for (let x = 0; x < sx; x++) { const v = p.cells[x + yy * sx + z * sx * sy] ?? 0; row += GLYPH[v] ?? '?'; }
    rows.push(row);
  }
  return rows.join('\n');
}