// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// assembler.ts
// Voxel character assembler. Pure, deterministic, dependency-free.

export type V3 = [number, number, number];

export type Slot =
  | 'head' | 'ears' | 'nose' | 'eyes' | 'mouth' | 'hair' | 'hat' | 'face-extra'
  | 'torso' | 'shirt' | 'arms' | 'hands' | 'belt' | 'legs' | 'boots' | 'back'
  | 'handheld';

export type PaletteSlot =
  | 'skin' | 'skinDark' | 'skinLight' | 'cloth1' | 'cloth2' | 'metal'
  | 'leather' | 'glow' | 'hair' | 'teeth' | 'eyeWhite' | 'pupil' | 'accent';

export interface Part {
  id: string;
  slot: Slot;
  name: string;
  doc: string;
  size: V3;
  palette: PaletteSlot[];
  cells: number[];
  anchors: Record<string, V3>;
  attachTo: string;
  tags: string[];
}

export interface VModel {
  size: V3;
  pivot: V3;
  palette: {
    name: string;
    color: [number, number, number];
    alpha: number;
    roughness: number;
    metalness: number;
    emissive: number;
  }[];
  cells: Uint8Array;
}

export interface AvatarSpec {
  name: string;
  parts: Partial<Record<Slot, string>>;
  palette: string;
  overrides?: Partial<Record<PaletteSlot, string>>;
  scale?: { height?: number; headSize?: number };
  mirrorPairs?: boolean;
}

export interface AssembleReport {
  placed: string[];
  skipped: { slot: Slot; reason: string }[];
  bounds: { min: V3; max: V3 };
  voxels: number;
}

export const ALL_SLOTS: Slot[] = [
  'head', 'ears', 'nose', 'eyes', 'mouth', 'hair', 'hat', 'face-extra',
  'torso', 'shirt', 'arms', 'hands', 'belt', 'legs', 'boots', 'back', 'handheld',
];

export const PALETTE_ORDER: PaletteSlot[] = [
  'skin', 'skinDark', 'skinLight', 'cloth1', 'cloth2', 'metal', 'leather',
  'glow', 'hair', 'teeth', 'eyeWhite', 'pupil', 'accent',
];

const PARENT: Record<Slot, Slot | null> = {
  torso: null,
  head: 'torso', shirt: 'torso', belt: 'torso', arms: 'torso', legs: 'torso', back: 'torso',
  hands: 'arms', boots: 'legs', handheld: 'hands',
  ears: 'head', nose: 'head', eyes: 'head', mouth: 'head', 'face-extra': 'head',
  hair: 'head', hat: 'head',
};

const DEFAULT_ANCHOR: Record<Slot, string> = {
  torso: 'root', head: 'neck', shirt: 'root', belt: 'waist', arms: 'shoulderL',
  legs: 'hipL', back: 'backMount', hands: 'wrist', boots: 'ankle', handheld: 'grip',
  ears: 'earL', nose: 'noseBase', eyes: 'eyeL', mouth: 'mouthSeat',
  'face-extra': 'noseBase', hair: 'hatSeat', hat: 'hatSeat',
};

export const BUILD_ORDER: Slot[] = [
  'torso', 'shirt', 'belt', 'back', 'arms', 'hands', 'handheld', 'legs', 'boots',
  'head', 'ears', 'nose', 'eyes', 'mouth', 'face-extra', 'hair', 'hat',
];

export const DRAW_ORDER: Slot[] = [
  'legs', 'boots', 'torso', 'shirt', 'belt', 'arms', 'hands', 'back', 'head',
  'face-extra', 'mouth', 'nose', 'eyes', 'ears', 'hair', 'hat', 'handheld',
];

export const DEFAULT_SCHEMES: Record<string, Record<PaletteSlot, string>> = {
  goblin: {
    skin: '#6f9b3f', skinDark: '#4d6e2c', skinLight: '#8fc258', cloth1: '#7a4b2a',
    cloth2: '#4a3b6a', metal: '#b9bcc4', leather: '#5b3a1e', glow: '#66ffcc',
    hair: '#2b2118', teeth: '#f2e9d0', eyeWhite: '#fdfdfd', pupil: '#101014',
    accent: '#d8a425',
  },
  human: {
    skin: '#d9a37a', skinDark: '#a9754f', skinLight: '#f0c8a4', cloth1: '#2f5fa0',
    cloth2: '#8a2b2b', metal: '#c8cbd2', leather: '#6b4423', glow: '#ffd27f',
    hair: '#3a2a1a', teeth: '#fffaf0', eyeWhite: '#ffffff', pupil: '#1a2030',
    accent: '#e0b23c',
  },
};

/* ---------------------------------------------------------------- utils */

function at3(v: readonly number[] | undefined, i: number): number {
  if (!v) return 0;
  const n = v[i];
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function toV3(v: unknown): V3 {
  const a = Array.isArray(v) ? (v as unknown[]) : [];
  const n = (i: number): number => {
    const x = a[i];
    return typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : 0;
  };
  return [n(0), n(1), n(2)];
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(typeof hex === 'string' ? hex.trim() : '');
  if (!m) return [1, 0, 1];
  const h = m[1] as string;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

export function materialFor(slot: PaletteSlot): {
  alpha: number; roughness: number; metalness: number; emissive: number;
} {
  switch (slot) {
    case 'skin': case 'skinDark': case 'skinLight':
      return { alpha: 1, roughness: 0.75, metalness: 0, emissive: 0 };
    case 'metal':
      return { alpha: 1, roughness: 0.3, metalness: 0.9, emissive: 0 };
    case 'leather':
      return { alpha: 1, roughness: 0.8, metalness: 0, emissive: 0 };
    case 'glow':
      return { alpha: 1, roughness: 0.5, metalness: 0, emissive: 1 };
    case 'hair':
      return { alpha: 1, roughness: 0.85, metalness: 0, emissive: 0 };
    case 'teeth':
      return { alpha: 1, roughness: 0.4, metalness: 0, emissive: 0 };
    case 'eyeWhite':
      return { alpha: 1, roughness: 0.3, metalness: 0, emissive: 0 };
    case 'pupil':
      return { alpha: 1, roughness: 0.35, metalness: 0, emissive: 0 };
    case 'cloth1': case 'cloth2':
      return { alpha: 1, roughness: 0.9, metalness: 0, emissive: 0 };
    case 'accent':
      return { alpha: 1, roughness: 0.5, metalness: 0, emissive: 0 };
  }
}

function clampScale(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  return Math.min(1.25, Math.max(0.8, v));
}

function mirrorName(n: string): string {
  if (n.endsWith('L')) return n.slice(0, -1) + 'R';
  if (n.endsWith('R')) return n.slice(0, -1) + 'L';
  return n;
}

function isPair(p: Part): boolean {
  return Array.isArray(p.tags) && p.tags.indexOf('pair') >= 0;
}

function partValid(p: Part): boolean {
  if (!p || !Array.isArray(p.size) || !Array.isArray(p.cells)) return false;
  const [sx, sy, sz] = [at3(p.size, 0), at3(p.size, 1), at3(p.size, 2)];
  if (sx <= 0 || sy <= 0 || sz <= 0) return false;
  return p.cells.length === sx * sy * sz;
}

/* ------------------------------------------------------- part resampling */

export function resamplePart(part: Part, s: number): Part {
  const f = clampScale(s);
  if (f === 1) return part;
  const sx = at3(part.size, 0), sy = at3(part.size, 1), sz = at3(part.size, 2);
  const nx = Math.max(1, Math.round(sx * f));
  const ny = Math.max(1, Math.round(sy * f));
  const nz = Math.max(1, Math.round(sz * f));
  const cells: number[] = new Array<number>(nx * ny * nz).fill(0);
  for (let z = 0; z < nz; z++) {
    const oz = Math.min(sz - 1, Math.floor((z * sz) / nz));
    for (let y = 0; y < ny; y++) {
      const oy = Math.min(sy - 1, Math.floor((y * sy) / ny));
      for (let x = 0; x < nx; x++) {
        const ox = Math.min(sx - 1, Math.floor((x * sx) / nx));
        cells[x + y * nx + z * nx * ny] = part.cells[ox + oy * sx + oz * sx * sy] ?? 0;
      }
    }
  }
  const anchors: Record<string, V3> = {};
  for (const k of Object.keys(part.anchors ?? {})) {
    const a = part.anchors[k] as V3 | undefined;
    anchors[k] = [
      Math.round(at3(a, 0) * (nx / sx)),
      Math.round(at3(a, 1) * (ny / sy)),
      Math.round(at3(a, 2) * (nz / sz)),
    ];
  }
  return { ...part, size: [nx, ny, nz], cells, anchors };
}

/* --------------------------------------------------------------- assemble */

interface Inst { part: Part; off: V3; mirror: boolean }

function anchorWorld(inst: Inst, name: string): V3 | null {
  const a = inst.part.anchors ? inst.part.anchors[name] : undefined;
  if (!a) return null;
  const x = inst.mirror ? -(inst.off[0] + at3(a, 0)) : inst.off[0] + at3(a, 0);
  return [x, inst.off[1] + at3(a, 1), inst.off[2] + at3(a, 2)];
}

function offsetFor(root: V3, target: V3, mirror: boolean): V3 {
  return mirror
    ? [-target[0] - at3(root, 0), target[1] - at3(root, 1), target[2] - at3(root, 2)]
    : [target[0] - at3(root, 0), target[1] - at3(root, 1), target[2] - at3(root, 2)];
}

export function assemble(
  spec: AvatarSpec,
  library: Part[],
  schemes: Record<string, Record<PaletteSlot, string>>,
): { model: VModel; report: AssembleReport } {
  const placed: string[] = [];
  const skipped: { slot: Slot; reason: string }[] = [];
  const byId = new Map<string, Part>();
  for (const p of Array.isArray(library) ? library : []) {
    if (p && typeof p.id === 'string' && !byId.has(p.id)) byId.set(p.id, p);
  }
  const parts: Partial<Record<Slot, string>> =
    spec && typeof spec === 'object' && spec.parts && typeof spec.parts === 'object'
      ? spec.parts : {};
  const mirrorPairs = spec && spec.mirrorPairs === false ? false : true;
  const headSize = clampScale(spec?.scale?.headSize);

  const instances = new Map<Slot, Inst[]>();

  for (const slot of BUILD_ORDER) {
    const id = parts[slot];
    if (typeof id !== 'string' || id.length === 0) continue;
    const raw = byId.get(id);
    if (!raw) { skipped.push({ slot, reason: `unknown part id "${id}" for slot ${slot}` }); continue; }
    if (raw.slot !== slot) {
      skipped.push({ slot, reason: `part "${id}" declares slot ${String(raw.slot)} but was used as ${slot}` });
      continue;
    }
    if (!partValid(raw)) {
      skipped.push({ slot, reason: `part "${id}" has invalid size/cells` });
      continue;
    }
    const part = slot === 'head' ? resamplePart(raw, headSize) : raw;
    const root = part.anchors ? part.anchors['root'] : undefined;
    if (!root) { skipped.push({ slot, reason: `part "${id}" has no 'root' anchor` }); continue; }

    const parentSlot = PARENT[slot];
    const pair = isPair(part);
    const made: Inst[] = [];

    if (parentSlot === null) {
      made.push({ part, off: offsetFor(root, [0, 0, 0], false), mirror: false });
    } else {
      const pInsts = instances.get(parentSlot);
      const pLeft = pInsts && pInsts.length > 0 ? pInsts[0] : undefined;
      if (!pLeft) {
        skipped.push({ slot, reason: `parent slot ${parentSlot} is missing, cannot attach ${slot} "${id}"` });
        continue;
      }
      const anchorName = typeof part.attachTo === 'string' && part.attachTo.length > 0
        ? part.attachTo : DEFAULT_ANCHOR[slot];
      const t = anchorWorld(pLeft, anchorName);
      if (!t) {
        skipped.push({ slot, reason: `anchor "${anchorName}" not found on parent part "${pLeft.part.id}" for ${slot} "${id}"` });
        continue;
      }
      made.push({ part, off: offsetFor(root, t, false), mirror: false });
      if (pair && mirrorPairs) {
        const parentPair = isPair(pLeft.part);
        let mt: V3 | null = null;
        if (parentPair) {
          const pRight = pInsts && pInsts.length > 1 ? pInsts[1] : undefined;
          if (pRight) mt = anchorWorld(pRight, anchorName);
        } else {
          mt = anchorWorld(pLeft, mirrorName(anchorName));
          if (!mt) mt = [-t[0], t[1], t[2]];
        }
        if (mt) made.push({ part, off: offsetFor(root, mt, true), mirror: true });
      }
    }
    instances.set(slot, made);
    placed.push(part.id);
  }

  // rasterise
  const grid = new Map<string, PaletteSlot>();
  let minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0, any = false;

  for (const slot of DRAW_ORDER) {
    const insts = instances.get(slot);
    if (!insts) continue;
    for (const inst of insts) {
      const p = inst.part;
      const sx = at3(p.size, 0), sy = at3(p.size, 1), sz = at3(p.size, 2);
      for (let z = 0; z < sz; z++) {
        for (let y = 0; y < sy; y++) {
          for (let x = 0; x < sx; x++) {
            const v = p.cells[x + y * sx + z * sx * sy] ?? 0;
            if (v <= 0) continue;
            const ps = p.palette[v - 1];
            if (!ps || PALETTE_ORDER.indexOf(ps) < 0) continue;
            const wx = inst.mirror ? -(inst.off[0] + x) : inst.off[0] + x;
            const wy = inst.off[1] + y;
            const wz = inst.off[2] + z;
            grid.set(`${wx},${wy},${wz}`, ps);
            if (!any) {
              minX = maxX = wx; minY = maxY = wy; minZ = maxZ = wz; any = true;
            } else {
              if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
              if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
              if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
            }
          }
        }
      }
    }
  }

  // palette
  const schemeName = typeof spec?.palette === 'string' ? spec.palette : '';
  const table = (schemes && schemes[schemeName]) || DEFAULT_SCHEMES['goblin'] as Record<PaletteSlot, string>;
  const used = new Set<PaletteSlot>();
  for (const v of grid.values()) used.add(v);
  const order = PALETTE_ORDER.filter((s) => used.has(s));
  const index = new Map<PaletteSlot, number>();
  const palette: VModel['palette'] = [];
  for (let i = 0; i < order.length; i++) {
    const s = order[i] as PaletteSlot;
    index.set(s, i + 1);
    const ov = spec?.overrides ? spec.overrides[s] : undefined;
    const hex = typeof ov === 'string' ? ov : (table ? table[s] : '#ff00ff');
    const m = materialFor(s);
    palette.push({ name: s, color: hexToRgb(hex ?? '#ff00ff'), ...m });
  }

  if (!any) {
    const empty: VModel = { size: [1, 1, 1], pivot: [0, 0, 0], palette, cells: new Uint8Array(1) };
    return {
      model: empty,
      report: { placed, skipped, bounds: { min: [0, 0, 0], max: [0, 0, 0] }, voxels: 0 },
    };
  }

  const sx = maxX - minX + 3, sy = maxY - minY + 3, sz = maxZ - minZ + 3;
  const cells = new Uint8Array(sx * sy * sz);
  let voxels = 0;
  for (const [k, ps] of grid) {
    const bits = k.split(',');
    const x = Number(bits[0]) - minX + 1;
    const y = Number(bits[1]) - minY + 1;
    const z = Number(bits[2]) - minZ + 1;
    cells[x + y * sx + z * sx * sy] = index.get(ps) ?? 0;
    voxels++;
  }
  let model: VModel = {
    size: [sx, sy, sz],
    pivot: [Math.floor(sx / 2), 1, Math.floor(sz / 2)],
    palette,
    cells,
  };
  const h = clampScale(spec?.scale?.height);
  if (h !== 1) model = bakeScale(model, { height: h });

  return {
    model,
    report: {
      placed, skipped,
      bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      voxels,
    },
  };
}

/* ------------------------------------------------------------- bakeScale */

export function bakeScale(model: VModel, scale: { height?: number; headSize?: number }): VModel {
  const h = clampScale(scale?.height);
  const sx = at3(model.size, 0), sy = at3(model.size, 1), sz = at3(model.size, 2);
  if (h === 1 || sx <= 0 || sy <= 0 || sz <= 0) return model;
  const ny = Math.max(1, Math.round(sy * h));
  const cells = new Uint8Array(sx * ny * sz);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < ny; y++) {
      const oy = Math.min(sy - 1, Math.floor((y * sy) / ny));
      for (let x = 0; x < sx; x++) {
        cells[x + y * sx + z * sx * ny] = model.cells[x + oy * sx + z * sx * sy] ?? 0;
      }
    }
  }
  return {
    size: [sx, ny, sz],
    pivot: [Math.floor(sx / 2), Math.min(1, ny - 1), Math.floor(sz / 2)],
    palette: model.palette.map((p) => ({ ...p, color: [...p.color] as [number, number, number] })),
    cells,
  };
}

/* ----------------------------------------------------------------- specs */

const DEFAULT_SLOTS: Slot[] = [
  'torso', 'head', 'legs', 'arms', 'hands', 'boots', 'shirt', 'belt',
  'eyes', 'mouth', 'nose', 'ears',
];

export function defaultGoblinSpec(library: Part[]): AvatarSpec {
  const parts: Partial<Record<Slot, string>> = {};
  for (const slot of DEFAULT_SLOTS) {
    const found = (Array.isArray(library) ? library : []).find((p) => p && p.slot === slot);
    if (found) parts[slot] = found.id;
  }
  return { name: 'Goblin', parts, palette: 'goblin', mirrorPairs: true };
}

export function makeRng(seed: number): () => number {
  let a = (Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSpec(
  seed: number,
  library: Part[],
  schemes: Record<string, Record<PaletteSlot, string>>,
): AvatarSpec {
  const rng = makeRng(seed);
  const lib = Array.isArray(library) ? library.filter((p) => !!p && typeof p.id === 'string') : [];
  const pick = (slot: Slot): string | undefined => {
    const cands = lib.filter((p) => p.slot === slot);
    if (cands.length === 0) return undefined;
    const i = Math.min(cands.length - 1, Math.floor(rng() * cands.length));
    return (cands[i] as Part).id;
  };
  const parts: Partial<Record<Slot, string>> = {};
  for (const slot of ALL_SLOTS) {
    const required = slot === 'head' || slot === 'torso' || slot === 'legs';
    const roll = rng();
    if (!required && roll >= 0.7) continue;
    const id = pick(slot);
    if (id) parts[slot] = id;
  }
  const names = Object.keys(schemes ?? {}).sort();
  const scheme = names.length > 0
    ? (names[Math.min(names.length - 1, Math.floor(rng() * names.length))] as string)
    : 'goblin';
  return { name: `Random #${Math.floor(Number.isFinite(seed) ? seed : 0)}`, parts, palette: scheme, mirrorPairs: true };
}

export function validateSpec(spec: AvatarSpec, library: Part[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!spec || typeof spec !== 'object') return { ok: false, errors: ['spec is not an object'] };
  if (typeof spec.name !== 'string' || spec.name.length === 0) errors.push('spec.name must be a non-empty string');
  const byId = new Map<string, Part>();
  for (const p of Array.isArray(library) ? library : []) if (p) byId.set(p.id, p);
  const parts = spec.parts && typeof spec.parts === 'object' ? spec.parts : {};
  for (const slot of ALL_SLOTS) {
    const id = parts[slot];
    if (id === undefined) continue;
    if (typeof id !== 'string') { errors.push(`slot ${slot}: part id must be a string`); continue; }
    const p = byId.get(id);
    if (!p) { errors.push(`slot ${slot}: unknown part id "${id}"`); continue; }
    if (p.slot !== slot) errors.push(`slot ${slot}: part "${id}" belongs to slot ${String(p.slot)}`);
    if (!partValid(p)) errors.push(`slot ${slot}: part "${id}" has invalid geometry`);
  }
  for (const k of Object.keys(parts)) {
    if (ALL_SLOTS.indexOf(k as Slot) < 0) errors.push(`unknown slot "${k}"`);
  }
  if (!parts.torso) errors.push('a torso is required (it is the skeleton root)');
  const h = spec.scale?.height, hs = spec.scale?.headSize;
  if (h !== undefined && (typeof h !== 'number' || !Number.isFinite(h) || h < 0.8 || h > 1.25)) {
    errors.push('scale.height must be between 0.8 and 1.25');
  }
  if (hs !== undefined && (typeof hs !== 'number' || !Number.isFinite(hs) || hs < 0.8 || hs > 1.25)) {
    errors.push('scale.headSize must be between 0.8 and 1.25');
  }
  if (typeof spec.palette !== 'string' || spec.palette.length === 0) errors.push('spec.palette must be a scheme name');
  if (spec.overrides) {
    for (const k of Object.keys(spec.overrides)) {
      const v = spec.overrides[k as PaletteSlot];
      if (PALETTE_ORDER.indexOf(k as PaletteSlot) < 0) errors.push(`unknown palette slot "${k}"`);
      else if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) errors.push(`override ${k} must be #rrggbb`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function label(slot: Slot): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function diffSpecs(a: AvatarSpec, b: AvatarSpec): string[] {
  const out: string[] = [];
  const pa = a?.parts ?? {}, pb = b?.parts ?? {};
  for (const slot of ALL_SLOTS) {
    const x = pa[slot], y = pb[slot];
    if (x === y) continue;
    out.push(`${label(slot)}: ${x ?? 'none'} -> ${y ?? 'none'}`);
  }
  if ((a?.palette ?? '') !== (b?.palette ?? '')) {
    out.push(`Palette: ${a?.palette ?? 'none'} -> ${b?.palette ?? 'none'}`);
  }
  const ah = a?.scale?.height ?? 1, bh = b?.scale?.height ?? 1;
  if (ah !== bh) out.push(`Height: ${ah} -> ${bh}`);
  const ahs = a?.scale?.headSize ?? 1, bhs = b?.scale?.headSize ?? 1;
  if (ahs !== bhs) out.push(`HeadSize: ${ahs} -> ${bhs}`);
  for (const k of PALETTE_ORDER) {
    const x = a?.overrides?.[k], y = b?.overrides?.[k];
    if (x !== y) out.push(`Override ${k}: ${x ?? 'none'} -> ${y ?? 'none'}`);
  }
  if ((a?.name ?? '') !== (b?.name ?? '')) out.push(`Name: ${a?.name ?? ''} -> ${b?.name ?? ''}`);
  return out;
}

export function describeSpec(spec: AvatarSpec, library: Part[]): string {
  const byId = new Map<string, Part>();
  for (const p of Array.isArray(library) ? library : []) if (p) byId.set(p.id, p);
  const lines: string[] = [];
  lines.push(`${spec?.name ?? 'Unnamed'} [${spec?.palette ?? 'no palette'}]`);
  for (const slot of ALL_SLOTS) {
    const id = spec?.parts?.[slot];
    if (typeof id !== 'string') continue;
    const p = byId.get(id);
    lines.push(`  ${label(slot)}: ${p ? p.name : `${id} (unknown)`}`);
  }
  const h = spec?.scale?.height ?? 1, hs = spec?.scale?.headSize ?? 1;
  lines.push(`  Scale: height ${h}, head ${hs}`);
  lines.push(`  Mirror pairs: ${spec?.mirrorPairs === false ? 'no' : 'yes'}`);
  return lines.join('\n');
}

function canonical(spec: AvatarSpec): string {
  const parts: string[] = [];
  for (const slot of ALL_SLOTS) {
    const id = spec?.parts?.[slot];
    if (typeof id === 'string' && id.length > 0) parts.push(`${slot}=${id}`);
  }
  const ovs: string[] = [];
  for (const k of PALETTE_ORDER) {
    const v = spec?.overrides?.[k];
    if (typeof v === 'string') ovs.push(`${k}=${v.toLowerCase()}`);
  }
  return [
    `n:${spec?.name ?? ''}`,
    `p:${spec?.palette ?? ''}`,
    `parts:${parts.join(',')}`,
    `ov:${ovs.join(',')}`,
    `h:${clampScale(spec?.scale?.height)}`,
    `hs:${clampScale(spec?.scale?.headSize)}`,
    `m:${spec?.mirrorPairs === false ? 0 : 1}`,
  ].join('|');
}

export function cacheKey(spec: AvatarSpec): string {
  const s = canonical(spec);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
  }
  return `v1-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function specToJSON(spec: AvatarSpec): string {
  const out: Record<string, unknown> = {
    name: typeof spec?.name === 'string' ? spec.name : 'Unnamed',
    palette: typeof spec?.palette === 'string' ? spec.palette : 'goblin',
    parts: {} as Record<string, string>,
    mirrorPairs: spec?.mirrorPairs === false ? false : true,
  };
  const parts = out['parts'] as Record<string, string>;
  for (const slot of ALL_SLOTS) {
    const id = spec?.parts?.[slot];
    if (typeof id === 'string' && id.length > 0) parts[slot] = id;
  }
  const ov: Record<string, string> = {};
  for (const k of PALETTE_ORDER) {
    const v = spec?.overrides?.[k];
    if (typeof v === 'string') ov[k] = v;
  }
  if (Object.keys(ov).length > 0) out['overrides'] = ov;
  out['scale'] = { height: clampScale(spec?.scale?.height), headSize: clampScale(spec?.scale?.headSize) };
  return JSON.stringify(out);
}

export function specFromJSON(text: string): AvatarSpec {
  let raw: unknown = null;
  if (typeof text === 'string') {
    try { raw = JSON.parse(text); } catch { raw = null; }
  }
  const o: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const spec: AvatarSpec = {
    name: typeof o['name'] === 'string' ? (o['name'] as string) : 'Unnamed',
    palette: typeof o['palette'] === 'string' ? (o['palette'] as string) : 'goblin',
    parts: {},
    mirrorPairs: o['mirrorPairs'] === false ? false : true,
  };
  const rp = o['parts'];
  if (rp && typeof rp === 'object' && !Array.isArray(rp)) {
    const m = rp as Record<string, unknown>;
    for (const slot of ALL_SLOTS) {
      const v = m[slot];
      if (typeof v === 'string' && v.length > 0) spec.parts[slot] = v;
    }
  }
  const ro = o['overrides'];
  if (ro && typeof ro === 'object' && !Array.isArray(ro)) {
    const m = ro as Record<string, unknown>;
    const ov: Partial<Record<PaletteSlot, string>> = {};
    for (const k of PALETTE_ORDER) {
      const v = m[k];
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ov[k] = v;
    }
    if (Object.keys(ov).length > 0) spec.overrides = ov;
  }
  const rs = o['scale'];
  if (rs && typeof rs === 'object' && !Array.isArray(rs)) {
    const m = rs as Record<string, unknown>;
    spec.scale = {
      height: clampScale(typeof m['height'] === 'number' ? (m['height'] as number) : undefined),
      headSize: clampScale(typeof m['headSize'] === 'number' ? (m['headSize'] as number) : undefined),
    };
  }
  return spec;
}

export function makeAnchor(v: unknown): V3 { return toV3(v); }