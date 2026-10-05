// NBT reader + Minecraft build (.schem / .schematic / structure .nbt) -> flat-colour voxel model.
// No textures, no DOM, no Node APIs, no imports. Input is untrusted; exported readers never throw.

export type Vec3 = [number, number, number];
export interface PaletteEntry { name: string; color: Vec3; roughness: number; metalness: number; emissive: number; alpha: number }
export interface VoxelModel { id: string; name: string; size: Vec3; pivot: Vec3; palette: PaletteEntry[]; cells: Uint8Array }

export type Nbt =
  | { type: 'byte' | 'short' | 'int' | 'long' | 'float' | 'double'; value: number | bigint }
  | { type: 'string'; value: string }
  | { type: 'byteArray'; value: Int8Array }
  | { type: 'intArray'; value: Int32Array }
  | { type: 'longArray'; value: BigInt64Array }
  | { type: 'list'; value: Nbt[] }
  | { type: 'compound'; value: Record<string, Nbt> };

export interface BuildResult { model: VoxelModel | null; format: 'sponge' | 'mcedit' | 'structure' | null; blocks: number; unknown: string[]; errors: string[] }

const MAX_LEN = 50_000_000;
const MAX_DEPTH = 64;
const MAX_BLOCKS = 16_000_000;
const MAX_PALETTE = 255;

// ---------------------------------------------------------------- NBT reader

class NbtError extends Error {}
const utf8 = new TextDecoder('utf-8');

class Reader {
  pos = 0;
  private readonly view: DataView;
  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  private need(n: number): void {
    if (n < 0 || this.pos + n > this.bytes.length) throw new NbtError(`unexpected end of data at byte ${this.pos}`);
  }
  u8(): number { this.need(1); const v = this.bytes[this.pos] ?? 0; this.pos += 1; return v; }
  i8(): number { this.need(1); const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
  i16(): number { this.need(2); const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
  u16(): number { this.need(2); const v = this.view.getUint16(this.pos); this.pos += 2; return v; }
  i32(): number { this.need(4); const v = this.view.getInt32(this.pos); this.pos += 4; return v; }
  i64(): bigint { this.need(8); const v = this.view.getBigInt64(this.pos); this.pos += 8; return v; }
  f32(): number { this.need(4); const v = this.view.getFloat32(this.pos); this.pos += 4; return v; }
  f64(): number { this.need(8); const v = this.view.getFloat64(this.pos); this.pos += 8; return v; }
  str(): string {
    const n = this.u16();
    this.need(n);
    const s = utf8.decode(this.bytes.subarray(this.pos, this.pos + n));
    this.pos += n;
    return s;
  }
  private len(what: string): number {
    const n = this.i32();
    if (n < 0) return 0;
    if (n > MAX_LEN) throw new NbtError(`${what} length ${n} exceeds limit`);
    return n;
  }
  payload(type: number, depth: number): Nbt {
    if (depth > MAX_DEPTH) throw new NbtError('nesting too deep');
    switch (type) {
      case 1: return { type: 'byte', value: this.i8() };
      case 2: return { type: 'short', value: this.i16() };
      case 3: return { type: 'int', value: this.i32() };
      case 4: return { type: 'long', value: this.i64() };
      case 5: return { type: 'float', value: this.f32() };
      case 6: return { type: 'double', value: this.f64() };
      case 7: {
        const n = this.len('byte array');
        this.need(n);
        const v = new Int8Array(this.bytes.slice(this.pos, this.pos + n).buffer);
        this.pos += n;
        return { type: 'byteArray', value: v };
      }
      case 8: return { type: 'string', value: this.str() };
      case 9: {
        const elem = this.u8();
        const n = this.len('list');
        if (n > 0 && (elem === 0 || elem > 12)) throw new NbtError(`invalid list element type ${elem}`);
        const out: Nbt[] = [];
        for (let i = 0; i < n; i++) out.push(this.payload(elem, depth + 1));
        return { type: 'list', value: out };
      }
      case 10: {
        const out: Record<string, Nbt> = {};
        for (;;) {
          const t = this.u8();
          if (t === 0) break;
          if (t > 12) throw new NbtError(`invalid tag type ${t}`);
          const key = this.str();
          out[key] = this.payload(t, depth + 1);
        }
        return { type: 'compound', value: out };
      }
      case 11: {
        const n = this.len('int array');
        this.need(n * 4);
        const v = new Int32Array(n);
        for (let i = 0; i < n; i++) v[i] = this.i32();
        return { type: 'intArray', value: v };
      }
      case 12: {
        const n = this.len('long array');
        this.need(n * 8);
        const v = new BigInt64Array(n);
        for (let i = 0; i < n; i++) v[i] = this.i64();
        return { type: 'longArray', value: v };
      }
      default: throw new NbtError(`invalid tag type ${type}`);
    }
  }
}

/** Big-endian NBT (Java edition): returns the root compound and its name, or an error. */
export function readNbt(bytes: Uint8Array): { name: string; root: Nbt | null; error: string | null } {
  try {
    if (bytes.length === 0) return { name: '', root: null, error: 'empty input' };
    if (isGzip(bytes)) return { name: '', root: null, error: 'input is gzip-compressed; decompress it first' };
    const r = new Reader(bytes);
    const type = r.u8();
    if (type !== 10) return { name: '', root: null, error: `root tag is type ${type}, expected compound (10)` };
    const name = r.str();
    const root = r.payload(10, 1);
    return { name, root, error: null };
  } catch (e) {
    return { name: '', root: null, error: e instanceof Error ? e.message : 'NBT read failed' };
  }
}

export const isGzip = (bytes: Uint8Array): boolean => bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

// ---------------------------------------------------------------- colours

type Colour = { color: Vec3; alpha: number; emissive: number; known: boolean };
const c = (r: number, g: number, b: number, alpha = 1, emissive = 0): Colour => ({ color: [r, g, b], alpha, emissive, known: true });

const EXACT: Record<string, Colour> = {
  stone: c(0.49, 0.49, 0.49), cobblestone: c(0.44, 0.44, 0.44), stone_bricks: c(0.47, 0.47, 0.47),
  dirt: c(0.53, 0.38, 0.26), coarse_dirt: c(0.47, 0.33, 0.23), grass_block: c(0.36, 0.6, 0.24),
  sand: c(0.86, 0.82, 0.62), red_sand: c(0.75, 0.4, 0.15), gravel: c(0.5, 0.48, 0.47), clay: c(0.63, 0.65, 0.7),
  oak_planks: c(0.69, 0.55, 0.34), spruce_planks: c(0.45, 0.33, 0.19), birch_planks: c(0.8, 0.73, 0.5),
  jungle_planks: c(0.63, 0.45, 0.32), acacia_planks: c(0.66, 0.36, 0.2), dark_oak_planks: c(0.26, 0.17, 0.08),
  oak_log: c(0.42, 0.33, 0.2), spruce_log: c(0.23, 0.15, 0.07), birch_log: c(0.85, 0.85, 0.8),
  jungle_log: c(0.35, 0.27, 0.12), acacia_log: c(0.4, 0.38, 0.33), dark_oak_log: c(0.2, 0.14, 0.07),
  oak_leaves: c(0.3, 0.55, 0.2), spruce_leaves: c(0.24, 0.4, 0.24), birch_leaves: c(0.45, 0.6, 0.3),
  jungle_leaves: c(0.3, 0.6, 0.2), acacia_leaves: c(0.4, 0.6, 0.2), dark_oak_leaves: c(0.25, 0.45, 0.15),
  glass: c(0.75, 0.88, 0.95, 0.35), water: c(0.25, 0.45, 0.85, 0.6), lava: c(1, 0.45, 0.1, 1, 1),
  glowstone: c(0.95, 0.8, 0.45, 1, 1), sea_lantern: c(0.75, 0.9, 0.85, 1, 1),
  bricks: c(0.6, 0.35, 0.3), sandstone: c(0.85, 0.8, 0.6), obsidian: c(0.1, 0.07, 0.15), netherrack: c(0.45, 0.2, 0.2),
  snow: c(0.95, 0.97, 0.98), snow_block: c(0.95, 0.97, 0.98), ice: c(0.65, 0.8, 0.95, 0.8),
  quartz: c(0.93, 0.9, 0.87), quartz_block: c(0.93, 0.9, 0.87), terracotta: c(0.6, 0.37, 0.26),
  iron_block: c(0.85, 0.85, 0.85), gold_block: c(0.95, 0.8, 0.3), diamond_block: c(0.45, 0.9, 0.85), emerald_block: c(0.3, 0.8, 0.4),
};

const DYES: [string, Vec3][] = [
  ['light_blue', [0.3, 0.6, 0.85]], ['light_gray', [0.6, 0.6, 0.58]],
  ['white', [0.92, 0.92, 0.92]], ['orange', [0.95, 0.5, 0.1]], ['magenta', [0.75, 0.3, 0.75]], ['yellow', [0.95, 0.85, 0.2]],
  ['lime', [0.5, 0.8, 0.1]], ['pink', [0.95, 0.55, 0.7]], ['gray', [0.3, 0.3, 0.32]], ['cyan', [0.1, 0.55, 0.6]],
  ['purple', [0.5, 0.2, 0.7]], ['blue', [0.2, 0.25, 0.7]], ['brown', [0.45, 0.28, 0.15]],
  ['green', [0.35, 0.5, 0.15]], ['red', [0.7, 0.15, 0.15]], ['black', [0.08, 0.08, 0.1]],
];

/** Strip namespace and [properties]. */
function baseName(name: string): string {
  const br = name.indexOf('[');
  const n = br >= 0 ? name.slice(0, br) : name;
  const col = n.indexOf(':');
  return (col >= 0 ? n.slice(col + 1) : n).toLowerCase();
}

/** The flat colour (0..1) and alpha for a block name like "minecraft:oak_planks[axis=y]" (properties ignored). */
export function blockColour(name: string): Colour {
  const base = baseName(String(name));
  const exact = EXACT[base];
  if (exact) return { color: [...exact.color], alpha: exact.alpha, emissive: exact.emissive, known: true };
  const padded = `_${base}_`;
  for (const [dye, rgb] of DYES) {
    if (padded.includes(`_${dye}_`)) {
      const dark = base.includes('terracotta') ? 0.75 : 1;
      const alpha = base.includes('stained_glass') ? 0.5 : 1;
      return { color: [rgb[0] * dark, rgb[1] * dark, rgb[2] * dark], alpha, emissive: 0, known: true };
    }
  }
  if (/wood|plank|log/.test(base)) return c(0.55, 0.4, 0.25);
  if (/stone|brick|deepslate/.test(base)) return c(0.45, 0.45, 0.45);
  if (/leaves|grass|vine|moss/.test(base)) return c(0.3, 0.6, 0.25);
  return { color: [0.5, 0.5, 0.5], alpha: 1, emissive: 0, known: false };
}

// ---------------------------------------------------------------- palette building

const AIR = new Set(['air', 'cave_air', 'void_air', 'structure_void']);
const isAir = (name: string): boolean => AIR.has(baseName(name));

const q = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Turns block names into palette indices (1-based; 0 = air/empty). Equal colours are merged; if more than 255
 * distinct colours appear, later ones are merged into the nearest existing entry. `colourOf` is overridable for tests.
 */
export function buildPalette(names: string[], colourOf: (name: string) => Colour = blockColour): { palette: PaletteEntry[]; indices: number[]; unknown: string[] } {
  const palette: PaletteEntry[] = [];
  const keys = new Map<string, number>();
  const unknown = new Set<string>();
  const indices = names.map((name) => {
    if (isAir(name)) return 0;
    const col = colourOf(name);
    if (!col.known) unknown.add(name);
    const base = baseName(name);
    const metalness = base === 'iron_block' || base === 'gold_block' ? 0.5 : 0;
    const entry: PaletteEntry = {
      name, color: [q(col.color[0]), q(col.color[1]), q(col.color[2])], roughness: 0.8, metalness, emissive: q(col.emissive), alpha: q(col.alpha),
    };
    const key = `${entry.color.join(',')}|${entry.alpha}|${entry.emissive}|${entry.metalness}`;
    const existing = keys.get(key);
    if (existing !== undefined) return existing;
    if (palette.length < MAX_PALETTE) {
      palette.push(entry);
      keys.set(key, palette.length);
      return palette.length;
    }
    // Full: merge into nearest colour.
    let best = 1;
    let bestD = Infinity;
    palette.forEach((p, i) => {
      const d = (p.color[0] - entry.color[0]) ** 2 + (p.color[1] - entry.color[1]) ** 2 + (p.color[2] - entry.color[2]) ** 2 + (p.alpha - entry.alpha) ** 2 + (p.emissive - entry.emissive) ** 2;
      if (d < bestD) { bestD = d; best = i + 1; }
    });
    keys.set(key, best);
    return best;
  });
  return { palette, indices, unknown: [...unknown].sort() };
}

// ---------------------------------------------------------------- build readers

type Compound = Record<string, Nbt>;
class BuildError extends Error {}

function num(tag: Nbt | undefined): number | null {
  if (!tag) return null;
  switch (tag.type) {
    case 'byte': case 'short': case 'int': case 'float': case 'double': return Number(tag.value);
    case 'long': return Number(tag.value);
    default: return null;
  }
}
function requireNum(c: Compound, key: string): number {
  const v = num(c[key]);
  if (v === null || !Number.isFinite(v)) throw new BuildError(`missing or invalid ${key}`);
  return v;
}
function compound(tag: Nbt | undefined): Compound | null { return tag && tag.type === 'compound' ? tag.value : null; }
function list(tag: Nbt | undefined): Nbt[] | null { return tag && tag.type === 'list' ? tag.value : null; }

function checkSize(w: number, h: number, l: number): Vec3 {
  if (![w, h, l].every((v) => Number.isInteger(v) && v > 0 && v <= MAX_BLOCKS)) throw new BuildError(`invalid size ${w}x${h}x${l}`);
  if (w * h * l > MAX_BLOCKS) throw new BuildError(`build has ${w * h * l} blocks, over the ${MAX_BLOCKS} limit`);
  return [w, h, l];
}

interface Partial { size: Vec3; states: string[]; cells: Uint8Array; blocks: number; palette: PaletteEntry[]; unknown: string[] }

function finish(size: Vec3, states: string[], fill: (stateToPal: number[], cells: Uint8Array) => number): Partial {
  const { palette, indices, unknown } = buildPalette(states);
  const cells = new Uint8Array(size[0] * size[1] * size[2]);
  const blocks = fill(indices, cells);
  return { size, states, cells, blocks, palette, unknown };
}

function readSponge(root: Compound): Partial {
  const size = checkSize(requireNum(root, 'Width'), requireNum(root, 'Height'), requireNum(root, 'Length'));
  const blocksC = compound(root['Blocks']);
  const paletteC = compound(root['Palette']) ?? (blocksC ? compound(blocksC['Palette']) : null);
  const dataT = root['BlockData'] ?? blocksC?.['Data'];
  if (!paletteC) throw new BuildError('missing Palette');
  if (!dataT || dataT.type !== 'byteArray') throw new BuildError('missing BlockData');
  const ids = new Map<number, string>();
  let maxId = -1;
  for (const [name, tag] of Object.entries(paletteC)) {
    const id = num(tag);
    if (id === null || !Number.isInteger(id) || id < 0 || id > 1_000_000) throw new BuildError(`invalid palette id for ${name}`);
    ids.set(id, name);
    if (id > maxId) maxId = id;
  }
  const states: string[] = [];
  for (let i = 0; i <= maxId; i++) states.push(ids.get(i) ?? 'minecraft:air');
  const data = dataT.value;
  const [w, h, l] = size;
  return finish(size, states, (toPal, cells) => {
    let pos = 0;
    let count = 0;
    const total = w * h * l;
    for (let i = 0; i < total; i++) {
      let value = 0;
      let shift = 0;
      for (;;) {
        if (pos >= data.length) throw new BuildError('BlockData is shorter than Width*Height*Length');
        const b = (data[pos] ?? 0) & 255;
        pos += 1;
        value |= (b & 127) << shift;
        if ((b & 128) === 0) break;
        shift += 7;
        if (shift > 35) throw new BuildError('malformed varint in BlockData');
      }
      const pal = toPal[value];
      if (pal === undefined) throw new BuildError(`block id ${value} not in Palette`);
      if (pal === 0) continue;
      const x = i % w;
      const z = Math.floor(i / w) % l;
      const y = Math.floor(i / (w * l));
      cells[x + w * (y + h * z)] = pal;
      count += 1;
    }
    return count;
  });
}

const LEGACY: Record<number, string> = {
  0: 'minecraft:air', 1: 'minecraft:stone', 2: 'minecraft:grass_block', 3: 'minecraft:dirt', 4: 'minecraft:cobblestone',
  5: 'minecraft:oak_planks', 8: 'minecraft:water', 9: 'minecraft:water', 10: 'minecraft:lava', 11: 'minecraft:lava',
  12: 'minecraft:sand', 13: 'minecraft:gravel', 17: 'minecraft:oak_log', 18: 'minecraft:oak_leaves', 20: 'minecraft:glass',
  24: 'minecraft:sandstone', 35: 'minecraft:white_wool', 45: 'minecraft:bricks', 49: 'minecraft:obsidian', 98: 'minecraft:stone_bricks',
};

function readMcedit(root: Compound): Partial {
  const size = checkSize(requireNum(root, 'Width'), requireNum(root, 'Height'), requireNum(root, 'Length'));
  const blocksT = root['Blocks'];
  if (!blocksT || blocksT.type !== 'byteArray') throw new BuildError('missing Blocks');
  const [w, h, l] = size;
  const total = w * h * l;
  if (blocksT.value.length < total) throw new BuildError('Blocks is shorter than Width*Height*Length');
  const states: string[] = [];
  for (let i = 0; i < 256; i++) states.push(LEGACY[i] ?? `legacy:${i}`);
  const data = blocksT.value;
  return finish(size, states, (toPal, cells) => {
    let count = 0;
    for (let i = 0; i < total; i++) {
      const pal = toPal[(data[i] ?? 0) & 255] ?? 0;
      if (pal === 0) continue;
      const x = i % w;
      const z = Math.floor(i / w) % l;
      const y = Math.floor(i / (w * l));
      cells[x + w * (y + h * z)] = pal;
      count += 1;
    }
    return count;
  });
}

function int3(tag: Nbt | undefined): Vec3 | null {
  const l = list(tag);
  if (!l || l.length !== 3) return null;
  const a = num(l[0]); const b = num(l[1]); const d = num(l[2]);
  if (a === null || b === null || d === null) return null;
  return [a, b, d];
}

function readStructure(root: Compound): Partial {
  const sz = int3(root['size']);
  if (!sz) throw new BuildError('missing or invalid size');
  const size = checkSize(sz[0], sz[1], sz[2]);
  let paletteL = list(root['palette']);
  if (!paletteL) {
    const palettes = list(root['palettes']);
    paletteL = palettes ? list(palettes[0]) : null;
  }
  if (!paletteL) throw new BuildError('missing palette');
  const blocksL = list(root['blocks']);
  if (!blocksL) throw new BuildError('missing blocks');
  const states = paletteL.map((p) => {
    const nm = compound(p)?.['Name'];
    return nm && nm.type === 'string' ? nm.value : 'minecraft:air';
  });
  const [w, h, l] = size;
  return finish(size, states, (toPal, cells) => {
    let count = 0;
    for (const b of blocksL) {
      const bc = compound(b);
      if (!bc) continue;
      const pos = int3(bc['pos']);
      const state = num(bc['state']);
      if (!pos || state === null) continue;
      const [x, y, z] = pos;
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= l) continue;
      const pal = toPal[state] ?? 0;
      const idx = x + w * (y + h * z);
      if (pal === 0) { if (cells[idx] !== 0) count -= 1; cells[idx] = 0; continue; }
      if (cells[idx] === 0) count += 1;
      cells[idx] = pal;
    }
    return count;
  });
}

/** Detect the format from the root and read it. Air (minecraft:air, cave_air, void_air, structure_void) is empty. */
export function readBuild(bytes: Uint8Array, name = 'build'): BuildResult {
  const fail = (msg: string, format: BuildResult['format'] = null): BuildResult => ({ model: null, format, blocks: 0, unknown: [], errors: [msg] });
  try {
    const nbt = readNbt(bytes);
    if (!nbt.root || nbt.root.type !== 'compound') return fail(nbt.error ?? 'no root compound');
    let root = nbt.root.value;
    const inner = compound(root['Schematic']);
    if (inner) root = inner;
    let format: BuildResult['format'] = null;
    let part: Partial;
    if (list(root['blocks']) && root['size']) {
      format = 'structure';
      part = readStructure(root);
    } else if (root['Blocks']?.type === 'byteArray') {
      format = 'mcedit';
      part = readMcedit(root);
    } else if (root['Blocks']?.type === 'compound' || root['Palette']?.type === 'compound') {
      format = 'sponge';
      part = readSponge(root);
    } else {
      return fail('unrecognised build format: no Sponge, MCEdit or structure tags found');
    }
    const id = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'build';
    const model: VoxelModel = {
      id,
      name: String(name),
      size: part.size,
      pivot: [Math.floor(part.size[0] / 2), 0, Math.floor(part.size[2] / 2)],
      palette: part.palette,
      cells: part.cells,
    };
    return { model, format, blocks: part.blocks, unknown: part.unknown, errors: [] };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'build read failed');
  }
}