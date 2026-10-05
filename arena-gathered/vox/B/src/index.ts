/**
 * vox — a defensive reader/writer for MagicaVoxel .vox files.
 *
 * Nothing about the input is trusted: every field is bounds checked, every loop
 * is limited by the bytes that are really there, and anything wrong is reported
 * through `errors` / `warnings` instead of being thrown.
 *
 * Coordinate systems
 *   .vox : z is up                (x, y, z)
 *   game : y is up                game (x, y, z) = vox (x, z, y)
 *   cells: index = x + size[0] * (y + size[1] * z)
 *          0 = empty, v = palette[v - 1]
 */

export type Vec3 = [number, number, number];

export interface PaletteEntry {
  name: string;
  color: Vec3;
  roughness: number;
  metalness: number;
  emissive: number;
  alpha: number;
}

export interface VoxelModel {
  id: string;
  name: string;
  size: Vec3;
  pivot: Vec3;
  palette: PaletteEntry[];
  cells: Uint8Array;
}

export interface VoxResult {
  models: VoxelModel[];
  offsets: Vec3[];
  errors: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ *
 * limits
 * ------------------------------------------------------------------ */

const MAGIC = 'VOX ';
const WRITE_VERSION = 150;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_VOXELS = 16_000_000;
const MAX_PALETTE = 255;
const MAX_GRAPH_DEPTH = 64;
const MAX_CHUNK_STEPS = 8_000_000;
const MAX_HALVINGS = 256;
const DEFAULT_ROUGHNESS = 0.8;
const NOTHING = new Uint8Array(0);

/* ------------------------------------------------------------------ *
 * byte level helpers
 * ------------------------------------------------------------------ */

function fits(offset: number, size: number, length: number): boolean {
  return (
    Number.isInteger(offset) &&
    offset >= 0 &&
    Number.isInteger(size) &&
    size >= 0 &&
    offset + size <= length
  );
}

/** Read-only view over untrusted bytes; every access returns null past the end. */
class ByteSource {
  readonly data: Uint8Array;
  readonly length: number;
  private readonly view: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.length = data.byteLength;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  byte(offset: number): number | null {
    if (!fits(offset, 1, this.length)) return null;
    return this.data[offset] ?? 0;
  }

  int32(offset: number): number | null {
    if (!fits(offset, 4, this.length)) return null;
    return this.view.getInt32(offset, true);
  }

  bytes(offset: number, count: number): Uint8Array | null {
    if (!fits(offset, count, this.length)) return null;
    return this.data.subarray(offset, offset + count);
  }

  tag(offset: number): string | null {
    if (!fits(offset, 4, this.length)) return null;
    return (
      String.fromCharCode(this.data[offset] ?? 0) +
      String.fromCharCode(this.data[offset + 1] ?? 0) +
      String.fromCharCode(this.data[offset + 2] ?? 0) +
      String.fromCharCode(this.data[offset + 3] ?? 0)
    );
  }
}

/** Sequential reader confined to one chunk's content range. */
class Cursor {
  at: number;
  private readonly src: ByteSource;
  private readonly end: number;

  constructor(src: ByteSource, end: number, at: number) {
    this.src = src;
    this.end = end;
    this.at = at;
  }

  get remaining(): number {
    return Math.max(0, this.end - this.at);
  }

  byte(): number | null {
    if (this.remaining < 1) return null;
    const value = this.src.byte(this.at);
    if (value === null) return null;
    this.at += 1;
    return value;
  }

  int32(): number | null {
    if (this.remaining < 4) return null;
    const value = this.src.int32(this.at);
    if (value === null) return null;
    this.at += 4;
    return value;
  }

  text(): string | null {
    const length = this.int32();
    if (length === null || length < 0 || length > this.remaining) return null;
    const raw = this.src.bytes(this.at, length);
    if (raw === null) return null;
    this.at += length;
    return decodeText(raw);
  }

  /** DICT: int32 pair count, then STRING/STRING pairs. */
  dict(): Map<string, string> | null {
    const pairs = this.int32();
    if (pairs === null || pairs < 0) return null;
    if (pairs * 8 > this.remaining) return null; // two length prefixes per pair, at least
    const map = new Map<string, string>();
    for (let i = 0; i < pairs; i++) {
      const key = this.text();
      if (key === null) return null;
      const value = this.text();
      if (value === null) return null;
      map.set(key, value);
    }
    return map;
  }

  bytes(count: number): Uint8Array | null {
    if (count < 0 || count > this.remaining) return null;
    const raw = this.src.bytes(this.at, count);
    if (raw === null) return null;
    this.at += count;
    return raw;
  }
}

let utf8: TextDecoder | null = null;

function decodeText(raw: Uint8Array): string {
  try {
    if (utf8 === null) utf8 = new TextDecoder('utf-8');
    return utf8.decode(raw);
  } catch {
    let text = '';
    for (let i = 0; i < raw.length; i++) text += String.fromCharCode(raw[i] ?? 0);
    return text;
  }
}

function explain(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------------ *
 * internal shapes
 * ------------------------------------------------------------------ */

interface RawModel {
  /** vox space, z up */
  sx: number;
  sy: number;
  sz: number;
  /** game space, y up, already renumbered */
  cells: Uint8Array;
  /** colour index (1..255) -> renumbered value, 0 = not used yet */
  slots: Int32Array;
  /** original colour indices in order of first use */
  used: number[];
  filled: boolean;
  outside: number;
  badColour: number;
}

interface Material {
  roughness: number | null;
  metalness: number | null;
  emissive: number | null;
  glass: boolean;
  transmission: number | null;
}

interface SceneNode {
  kind: 'nTRN' | 'nSHP' | 'nGRP';
  /** already converted to y-up */
  translation: Vec3 | null;
  child: number;
  children: number[];
  models: number[];
}

/* ------------------------------------------------------------------ *
 * readVox
 * ------------------------------------------------------------------ */

export function readVox(bytes: Uint8Array, name?: string): VoxResult {
  const out: VoxResult = { models: [], offsets: [], errors: [], warnings: [] };
  try {
    parseVox(bytes, name, out);
  } catch (error) {
    out.errors.push(`readVox stopped: ${explain(error)}`);
  }
  // offsets and models always line up, whatever happened above
  while (out.offsets.length < out.models.length) out.offsets.push([0, 0, 0]);
  if (out.offsets.length > out.models.length) out.offsets.length = out.models.length;
  return out;
}

function parseVox(bytes: Uint8Array, name: string | undefined, out: VoxResult): void {
  const errors = out.errors;
  const warnings = out.warnings;

  if (!(bytes instanceof Uint8Array)) {
    errors.push('input is not a Uint8Array');
    return;
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    errors.push(`file is ${bytes.byteLength} bytes; the limit is ${MAX_FILE_BYTES}`);
    return;
  }
  const src = new ByteSource(bytes);
  if (src.length < 8) {
    errors.push(`file is ${src.length} bytes; a VOX header needs 8`);
    return;
  }
  if (src.tag(0) !== MAGIC) {
    errors.push('file does not start with "VOX "');
    return;
  }
  const version = src.int32(4);
  if (version === null) {
    errors.push('file ends inside the version field');
    return;
  }
  if (version !== 150 && version !== 200) {
    warnings.push(`version ${version} is not 150 or 200; reading it anyway`);
  }

  // where the children of MAIN live
  let regionStart: number;
  let regionEnd: number;
  const firstTag = src.tag(8);
  if (firstTag === 'MAIN') {
    const content = src.int32(12);
    const children = src.int32(16);
    if (content === null || children === null || content < 0 || children < 0) {
      errors.push('MAIN has unusable chunk sizes');
      return;
    }
    const contentEnd = 20 + content;
    const declaredEnd = contentEnd + children;
    if (declaredEnd > src.length) {
      errors.push(`MAIN claims ${declaredEnd} bytes but the file holds ${src.length}`);
    }
    regionStart = Math.min(contentEnd, src.length);
    regionEnd = Math.min(Math.max(declaredEnd, regionStart), src.length);
  } else {
    errors.push(`the first chunk is "${firstTag ?? 'unreadable'}", not MAIN`);
    regionStart = 8;
    regionEnd = src.length;
  }

  const rawModels: RawModel[] = [];
  const nodes = new Map<number, SceneNode>();
  const materials = new Map<number, Material>();
  let rgba: Uint8Array | null = null;
  let packCount: number | null = null;
  let totalVoxels = 0;

  let at = regionStart;
  let steps = 0;
  while (at + 12 <= regionEnd && steps++ < MAX_CHUNK_STEPS) {
    const id = src.tag(at) ?? '????';
    const contentSize = src.int32(at + 4);
    const childSize = src.int32(at + 8);
    if (contentSize === null || childSize === null) {
      errors.push(`chunk "${id}" has unreadable sizes`);
      break;
    }
    if (contentSize < 0 || childSize < 0) {
      errors.push(`chunk "${id}" has a negative size`);
      break;
    }
    const contentStart = at + 12;
    const contentEnd = contentStart + contentSize;
    const chunkEnd = contentEnd + childSize;
    if (contentEnd > regionEnd || chunkEnd > regionEnd) {
      errors.push(
        `chunk "${id}" is truncated: it claims ${chunkSizeText(contentEnd, chunkEnd)} bytes but the region ends at ${regionEnd}`,
      );
      break;
    }

    const cursor = new Cursor(src, contentEnd, contentStart);
    switch (id) {
      case 'PACK': {
        const count = cursor.int32();
        if (count !== null && count >= 0) packCount = count;
        break;
      }

      case 'SIZE': {
        const x = cursor.int32();
        const y = cursor.int32();
        const z = cursor.int32();
        if (x === null || y === null || z === null) {
          errors.push(`SIZE ${rawModels.length} is truncated`);
          break;
        }
        if (x <= 0 || y <= 0 || z <= 0) {
          errors.push(`SIZE ${rawModels.length} is ${x}x${y}x${z}; every axis must be positive`);
          break;
        }
        const claimed = x * y * z;
        if (claimed > MAX_VOXELS || totalVoxels + claimed > MAX_VOXELS) {
          errors.push(
            `model ${rawModels.length} claims ${claimed} voxels; the limit is ${MAX_VOXELS}`,
          );
          break;
        }
        totalVoxels += claimed;
        rawModels.push({
          sx: x,
          sy: y,
          sz: z,
          cells: new Uint8Array(claimed),
          slots: new Int32Array(256),
          used: [],
          filled: false,
          outside: 0,
          badColour: 0,
        });
        break;
      }

      case 'XYZI': {
        const count = cursor.int32();
        if (count === null) {
          errors.push('XYZI is truncated');
          break;
        }
        if (count < 0) {
          errors.push(`XYZI has a negative voxel count ${count}`);
          break;
        }
        if (count > MAX_VOXELS) {
          errors.push(`XYZI claims ${count} voxels; the limit is ${MAX_VOXELS}`);
          break;
        }
        if (count * 4 > cursor.remaining) {
          errors.push(
            `XYZI claims ${count} voxels but the chunk holds ${Math.floor(cursor.remaining / 4)}`,
          );
          break;
        }
        const raw = rawModels[rawModels.length - 1];
        if (raw === undefined || raw.filled) {
          errors.push('XYZI has no SIZE chunk of its own to fill');
          break;
        }
        raw.filled = true;
        const data = src.data;
        let pos = cursor.at;
        for (let i = 0; i < count; i++) {
          const vx = data[pos] ?? 0;
          const vy = data[pos + 1] ?? 0;
          const vz = data[pos + 2] ?? 0;
          const colour = data[pos + 3] ?? 0;
          pos += 4;
          if (colour === 0) {
            raw.badColour++;
            continue;
          }
          if (vx >= raw.sx || vy >= raw.sy || vz >= raw.sz) {
            raw.outside++;
            continue;
          }
          let value = raw.slots[colour] ?? 0;
          if (value === 0) {
            value = raw.used.length + 1;
            raw.slots[colour] = value;
            raw.used.push(colour);
          }
          // vox (vx, vy, vz) -> game (vx, vz, vy)
          raw.cells[vx + raw.sx * (vz + raw.sz * vy)] = value;
        }
        cursor.at = pos;
        break;
      }

      case 'RGBA': {
        if (cursor.remaining < 1024) {
          errors.push(`RGBA is ${cursor.remaining} bytes; it needs 1024`);
          break;
        }
        if (rgba !== null) {
          warnings.push('more than one RGBA chunk; keeping the first');
          break;
        }
        const table = new Uint8Array(1024);
        table.set(src.data.subarray(contentStart, contentStart + 1024));
        rgba = table;
        break;
      }

      case 'MATL': {
        const index = cursor.int32();
        const dict = cursor.dict();
        if (index === null || dict === null) {
          errors.push('MATL is truncated');
          break;
        }
        if (index >= 1 && index <= MAX_PALETTE) {
          materials.set(index, readMaterial(index, dict, warnings));
        } else {
          warnings.push(`MATL refers to colour ${index}, which is outside 1..255`);
        }
        break;
      }

      case 'nTRN': {
        const nodeId = cursor.int32();
        const attrs = cursor.dict();
        const childId = cursor.int32();
        const reserved = cursor.int32();
        const layerId = cursor.int32();
        const frames = cursor.int32();
        if (
          nodeId === null ||
          attrs === null ||
          childId === null ||
          reserved === null ||
          layerId === null ||
          frames === null
        ) {
          errors.push('nTRN is truncated');
          break;
        }
        if (frames < 0 || frames * 4 > cursor.remaining) {
          errors.push(`nTRN ${nodeId} claims ${frames} frames the chunk cannot hold`);
          break;
        }
        let translation: Vec3 | null = null;
        for (let f = 0; f < frames; f++) {
          const frame = cursor.dict();
          if (frame === null) {
            errors.push(`nTRN ${nodeId} frame ${f} is truncated`);
            break;
          }
          if (f === 0) {
            const text = frame.get('_t');
            if (text !== undefined) {
              const vox = parseVecText(text);
              // vox (x, y, z) z-up -> game (x, z, y) y-up
              translation = vox === null ? null : [vox[0], vox[2], vox[1]];
            }
          }
        }
        nodes.set(nodeId, {
          kind: 'nTRN',
          translation,
          child: childId,
          children: [],
          models: [],
        });
        break;
      }

      case 'nSHP': {
        const nodeId = cursor.int32();
        const attrs = cursor.dict();
        const shapes = cursor.int32();
        if (nodeId === null || attrs === null || shapes === null) {
          errors.push('nSHP is truncated');
          break;
        }
        if (shapes < 0 || shapes * 8 > cursor.remaining) {
          errors.push(`nSHP ${nodeId} claims ${shapes} shapes the chunk cannot hold`);
          break;
        }
        const models: number[] = [];
        for (let s = 0; s < shapes; s++) {
          const modelIndex = cursor.int32();
          const modelAttrs = cursor.dict();
          if (modelIndex === null || modelAttrs === null) {
            errors.push(`nSHP ${nodeId} shape ${s} is truncated`);
            break;
          }
          models.push(modelIndex);
        }
        nodes.set(nodeId, { kind: 'nSHP', translation: null, child: -1, children: [], models });
        break;
      }

      case 'nGRP': {
        const nodeId = cursor.int32();
        const attrs = cursor.dict();
        const count = cursor.int32();
        if (nodeId === null || attrs === null || count === null) {
          errors.push('nGRP is truncated');
          break;
        }
        if (count < 0 || count * 4 > cursor.remaining) {
          errors.push(`nGRP ${nodeId} claims ${count} children the chunk cannot hold`);
          break;
        }
        const children: number[] = [];
        for (let c = 0; c < count; c++) {
          const child = cursor.int32();
          if (child === null) {
            errors.push(`nGRP ${nodeId} child ${c} is truncated`);
            break;
          }
          children.push(child);
        }
        nodes.set(nodeId, { kind: 'nGRP', translation: null, child: -1, children, models: [] });
        break;
      }

      default:
        break; // unknown chunks are skipped by their sizes
    }

    at = chunkEnd;
  }
  if (steps >= MAX_CHUNK_STEPS) errors.push('the chunk list never ended; giving up');

  if (packCount !== null && packCount !== rawModels.length) {
    warnings.push(`PACK promises ${packCount} models but the file holds ${rawModels.length}`);
  }
  if (rawModels.length === 0 && errors.length === 0) {
    errors.push('no model found: the file has no SIZE chunk');
  }
  if (rgba === null && rawModels.some((model) => model.used.length > 0)) {
    warnings.push('default palette');
  }

  // some exporters number shape models from 1; only shift when 0-based finds nothing
  const shapeRefs: number[] = [];
  for (const node of nodes.values()) if (node.kind === 'nSHP') shapeRefs.push(...node.models);
  if (shapeRefs.length > 0) {
    const zeroBased = shapeRefs.filter((i) => i >= 0 && i < rawModels.length).length;
    const oneBased = shapeRefs.every((i) => i >= 1 && i <= rawModels.length);
    if (zeroBased === 0 && oneBased) {
      warnings.push('scene graph model indices look 1-based; shifted them down by one');
      for (const node of nodes.values()) {
        if (node.kind === 'nSHP') node.models = node.models.map((i) => i - 1);
      }
    }
  }
  const resolved = resolveOffsets(nodes, rawModels.length, warnings);

  const base = typeof name === 'string' && name.length > 0 ? name : 'vox';
  let emitted = 0;
  for (let i = 0; i < rawModels.length; i++) {
    const raw = rawModels[i];
    if (raw === undefined) continue;
    if (!raw.filled) {
      errors.push(`model ${i} has a SIZE but no XYZI; it was skipped`);
      continue;
    }
    if (raw.outside > 0) {
      warnings.push(
        `model ${i}: ${raw.outside} voxels fell outside ${raw.sx}x${raw.sy}x${raw.sz} and were dropped`,
      );
    }
    if (raw.badColour > 0) {
      warnings.push(`model ${i}: ${raw.badColour} voxels had colour index 0 and were dropped`);
    }

    const palette: PaletteEntry[] = [];
    for (let k = 0; k < raw.used.length && k < MAX_PALETTE; k++) {
      const original = raw.used[k];
      if (original === undefined) continue;
      palette.push(paletteEntryFor(original, rgba, materials));
    }

    // game size: [vox x, vox z, vox y]
    const size: Vec3 = [raw.sx, raw.sz, raw.sy];
    out.models.push({
      id: `${base}-${emitted}`,
      name: `${base}-${emitted}`,
      size,
      pivot: [Math.floor(size[0] / 2), 0, Math.floor(size[2] / 2)],
      palette,
      cells: raw.cells,
    });
    const offset = resolved.get(i);
    if (offset === undefined) {
      out.offsets.push([0, 0, 0]);
      if (nodes.size > 0) {
        warnings.push(`model ${i} is not reached by the scene graph; offset [0,0,0]`);
      }
    } else {
      out.offsets.push(offset);
    }
    emitted++;
  }
  if (nodes.size === 0 && out.models.length > 0) {
    warnings.push('the file has no scene graph; offsets are [0,0,0]');
  }
}

function chunkSizeText(contentEnd: number, chunkEnd: number): string {
  return contentEnd === chunkEnd ? `${chunkEnd}` : `${contentEnd}+${chunkEnd - contentEnd}`;
}

function readMaterial(index: number, dict: Map<string, string>, warnings: string[]): Material {
  const number = (key: string): number | null => {
    const text = dict.get(key);
    if (text === undefined) return null;
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value)) {
      warnings.push(`MATL ${index} has a ${key} that is not a number: "${text}"`);
      return null;
    }
    return value;
  };
  const type = dict.get('_type');
  return {
    roughness: number('_rough'),
    metalness: number('_metal'),
    emissive: number('_emit'),
    glass: type === '_glass',
    transmission: number('_trans'),
  };
}

function parseVecText(text: string): Vec3 | null {
  const parts = text.trim().split(/[\s,]+/);
  if (parts.length < 3) return null;
  const values: number[] = [];
  for (let i = 0; i < 3; i++) {
    const value = Number.parseFloat(parts[i] ?? '');
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

function paletteEntryFor(
  original: number,
  rgba: Uint8Array | null,
  materials: Map<number, Material>,
): PaletteEntry {
  const at = (original - 1) * 4;
  let color: Vec3;
  let alpha = 1;
  if (rgba !== null && at >= 0 && at + 4 <= rgba.length) {
    color = [(rgba[at] ?? 0) / 255, (rgba[at + 1] ?? 0) / 255, (rgba[at + 2] ?? 0) / 255];
    alpha = (rgba[at + 3] ?? 255) / 255;
  } else {
    const grey = ((original - 1) % 16) / 15;
    color = [grey, grey, grey];
  }

  let roughness = DEFAULT_ROUGHNESS;
  let metalness = 0;
  let emissive = 0;
  const material = materials.get(original);
  if (material !== undefined) {
    if (material.roughness !== null) roughness = clamp01(material.roughness);
    if (material.metalness !== null) metalness = clamp01(material.metalness);
    if (material.emissive !== null) emissive = clamp01(material.emissive);
    if (material.glass) {
      alpha = material.transmission === null ? 0.5 : clamp01(1 - material.transmission);
    }
  }
  return { name: `Colour ${original}`, color, roughness, metalness, emissive, alpha };
}

/** Walk the scene graph, accumulating nTRN `_t` translations onto shape models. */
function resolveOffsets(
  nodes: Map<number, SceneNode>,
  modelCount: number,
  warnings: string[],
): Map<number, Vec3> {
  const resolved = new Map<number, Vec3>();
  if (nodes.size === 0) return resolved;

  const referenced = new Set<number>();
  for (const node of nodes.values()) {
    if (node.child >= 0) referenced.add(node.child);
    for (const child of node.children) referenced.add(child);
  }
  const roots: number[] = [];
  for (const id of nodes.keys()) if (!referenced.has(id)) roots.push(id);
  if (roots.length === 0) {
    for (const id of nodes.keys()) {
      roots.push(id);
      break; // cyclic graph: start anywhere
    }
  }

  const visited = new Set<number>();
  const stack: Array<[number, Vec3, number]> = [];
  for (const root of roots) stack.push([root, [0, 0, 0], 0]);

  let steps = 0;
  const budget = nodes.size * 4 + 64;
  while (stack.length > 0) {
    if (steps++ > budget) {
      warnings.push('the scene graph is too tangled to follow; some offsets are [0,0,0]');
      break;
    }
    const top = stack.pop();
    if (top === undefined) break;
    const id = top[0];
    const inherited = top[1];
    const depth = top[2];
    if (visited.has(id) || depth > MAX_GRAPH_DEPTH) continue;
    visited.add(id);
    const node = nodes.get(id);
    if (node === undefined) continue;

    const t = node.translation;
    const here: Vec3 =
      t === null
        ? inherited
        : [inherited[0] + t[0], inherited[1] + t[1], inherited[2] + t[2]];

    for (const modelIndex of node.models) {
      if (modelIndex >= 0 && modelIndex < modelCount) {
        if (!resolved.has(modelIndex)) resolved.set(modelIndex, here);
      } else {
        warnings.push(`the scene graph points at model ${modelIndex}, which does not exist`);
      }
    }
    if (node.child >= 0) stack.push([node.child, here, depth + 1]);
    for (const child of node.children) stack.push([child, here, depth + 1]);
  }
  return resolved;
}

/* ------------------------------------------------------------------ *
 * writeVox
 * ------------------------------------------------------------------ */

/** Growable little-endian byte writer. */
class Writer {
  length = 0;
  private buf: Uint8Array;
  private view: DataView;

  constructor(capacity = 1024) {
    const size = Math.max(16, Math.ceil(capacity));
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer);
  }

  private ensure(extra: number): void {
    const needed = this.length + extra;
    if (needed <= this.buf.length) return;
    let capacity = this.buf.length;
    while (capacity < needed) capacity *= 2;
    const grown = new Uint8Array(capacity);
    grown.set(this.buf.subarray(0, this.length));
    this.buf = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(value: number): void {
    this.ensure(1);
    this.buf[this.length] = value & 255;
    this.length += 1;
  }

  i32(value: number): void {
    this.ensure(4);
    const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
    this.view.setInt32(this.length, safe, true);
    this.length += 4;
  }

  bytes(data: Uint8Array): void {
    if (data.length === 0) return;
    this.ensure(data.length);
    this.buf.set(data, this.length);
    this.length += data.length;
  }

  tag(id: string): void {
    for (let i = 0; i < id.length; i++) this.u8(id.charCodeAt(i));
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

function writeChunk(w: Writer, id: string, content: Uint8Array, children: Uint8Array): void {
  w.tag(id);
  w.i32(content.length);
  w.i32(children.length);
  w.bytes(content);
  w.bytes(children);
}

export function writeVox(model: VoxelModel): Uint8Array {
  const size = sanitizeSize(model.size);
  const gx = size[0];
  const gy = size[1];
  const gz = size[2];
  const palette = Array.isArray(model.palette) ? model.palette.slice(0, MAX_PALETTE) : [];
  const cells = model.cells instanceof Uint8Array ? model.cells : NOTHING;
  const total = gx * gy * gz;
  const limit = Number.isFinite(total) ? Math.min(total, cells.length) : 0;

  // First occurrence of every colour, so the reader renumbers the palette 1,2,3…
  const firstAt = new Int32Array(MAX_PALETTE + 1).fill(-1);
  for (let index = 0; index < limit; index++) {
    const value = cells[index] ?? 0;
    if (value < 1 || value > palette.length) continue;
    if ((firstAt[value] ?? -1) === -1) firstAt[value] = index;
  }

  const voxels = new Writer(1024);
  let count = 0;
  const emit = (index: number, value: number): void => {
    const x = index % gx;
    const rest = Math.floor(index / gx);
    const y = rest % gy;
    const z = Math.floor(rest / gy);
    // game (x, y, z) -> vox (x, z, y)
    voxels.u8(x);
    voxels.u8(z);
    voxels.u8(y);
    voxels.u8(value);
    count += 1;
  };
  for (let value = 1; value <= palette.length; value++) {
    const index = firstAt[value] ?? -1;
    if (index >= 0) emit(index, value);
  }
  for (let index = 0; index < limit; index++) {
    const value = cells[index] ?? 0;
    if (value < 1 || value > palette.length) continue;
    if ((firstAt[value] ?? -1) === index) continue;
    emit(index, value);
  }

  const sizeBody = new Writer(12);
  sizeBody.i32(gx); // vox x
  sizeBody.i32(gz); // vox y = game z
  sizeBody.i32(gy); // vox z = game y

  const xyziBody = new Writer(4 + voxels.length);
  xyziBody.i32(count);
  xyziBody.bytes(voxels.finish());

  const rgbaBody = new Writer(1024);
  for (let i = 0; i < 256; i++) {
    const entry = palette[i];
    if (entry === undefined) {
      rgbaBody.u8(0);
      rgbaBody.u8(0);
      rgbaBody.u8(0);
      rgbaBody.u8(255);
    } else {
      const color = entry.color;
      rgbaBody.u8(toByte(color === undefined ? 0 : color[0]));
      rgbaBody.u8(toByte(color === undefined ? 0 : color[1]));
      rgbaBody.u8(toByte(color === undefined ? 0 : color[2]));
      rgbaBody.u8(toByte(entry.alpha));
    }
  }

  const children = new Writer(2048);
  writeChunk(children, 'SIZE', sizeBody.finish(), NOTHING);
  writeChunk(children, 'XYZI', xyziBody.finish(), NOTHING);
  writeChunk(children, 'RGBA', rgbaBody.finish(), NOTHING);

  const out = new Writer(20 + children.length);
  out.tag(MAGIC);
  out.i32(WRITE_VERSION);
  writeChunk(out, 'MAIN', NOTHING, children.finish());
  return out.finish();
}

/* ------------------------------------------------------------------ *
 * fitTo
 * ------------------------------------------------------------------ */

export function fitTo(model: VoxelModel, max: number): VoxelModel {
  const limit = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 1;
  let size = sanitizeSize(model === undefined ? undefined : model.size);

  // keep the declared volume inside the reader's budget before allocating
  let shrink = 0;
  while (volume(size) > MAX_VOXELS && shrink++ < MAX_HALVINGS) size = halveSize(size);

  const source = model !== undefined && model.cells instanceof Uint8Array ? model.cells : NOTHING;
  let cells = new Uint8Array(volume(size));
  cells.set(source.subarray(0, Math.min(cells.length, source.length)));

  let passes = 0;
  while (!fitsWithin(size, limit) && passes++ < MAX_HALVINGS) {
    const next = halveSize(size);
    const reduced = new Uint8Array(volume(next));
    const block: number[] = [];
    for (let z = 0; z < next[2]; z++) {
      for (let y = 0; y < next[1]; y++) {
        for (let x = 0; x < next[0]; x++) {
          block.length = 0;
          for (let dz = 0; dz < 2; dz++) {
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const value = readCell(cells, size, x * 2 + dx, y * 2 + dy, z * 2 + dz);
                if (value > 0) block.push(value);
              }
            }
          }
          reduced[x + next[0] * (y + next[1] * z)] = busiest(block);
        }
      }
    }
    size = next;
    cells = reduced;
  }

  const palette: PaletteEntry[] = [];
  if (model !== undefined && Array.isArray(model.palette)) {
    for (const entry of model.palette) palette.push(cloneEntry(entry));
  }
  return {
    id: model === undefined ? 'vox' : model.id,
    name: model === undefined ? 'vox' : model.name,
    size,
    pivot: [Math.floor(size[0] / 2), 0, Math.floor(size[2] / 2)],
    palette,
    cells,
  };
}

function readCell(cells: Uint8Array, size: Vec3, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= size[0] || y >= size[1] || z >= size[2]) return 0;
  const index = x + size[0] * (y + size[1] * z);
  if (index < 0 || index >= cells.length) return 0;
  return cells[index] ?? 0;
}

/** Most common non-empty value; ties go to the smaller index. */
function busiest(block: number[]): number {
  let best = 0;
  let bestCount = 0;
  for (const value of block) {
    let count = 0;
    for (const other of block) if (other === value) count++;
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function fitsWithin(size: Vec3, limit: number): boolean {
  return size[0] <= limit && size[1] <= limit && size[2] <= limit;
}

function halveSize(size: Vec3): Vec3 {
  return [Math.ceil(size[0] / 2), Math.ceil(size[1] / 2), Math.ceil(size[2] / 2)];
}

function volume(size: Vec3): number {
  const total = size[0] * size[1] * size[2];
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

function sanitizeSize(size: Vec3 | undefined): Vec3 {
  const axis = (value: number | undefined): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(1073741824, Math.floor(value)));
  };
  if (size === undefined || size === null) return [1, 1, 1];
  return [axis(size[0]), axis(size[1]), axis(size[2])];
}

function cloneEntry(entry: PaletteEntry | undefined): PaletteEntry {
  if (entry === undefined) {
    return { name: 'Colour 0', color: [0, 0, 0], roughness: DEFAULT_ROUGHNESS, metalness: 0, emissive: 0, alpha: 1 };
  }
  const color = entry.color;
  return {
    name: entry.name,
    color: [color === undefined ? 0 : color[0], color === undefined ? 0 : color[1], color === undefined ? 0 : color[2]],
    roughness: entry.roughness,
    metalness: entry.metalness,
    emissive: entry.emissive,
    alpha: entry.alpha,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function toByte(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const scaled = Math.round(value * 255);
  return scaled < 0 ? 0 : scaled > 255 ? 255 : scaled;
}