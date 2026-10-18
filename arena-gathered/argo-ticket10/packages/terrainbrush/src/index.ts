/**
 * @hm/terrainbrush — the rules behind a terraforming game's handheld
 * "extraction beam" when it sculpts and paints the ground.
 *
 * Pure functions only. No DOM, no Date, no Math.random, no imports.
 * Strict TypeScript with noUncheckedIndexedAccess; no `any`; never -0.
 */

export interface Field {
  readonly size: number;
  readonly cell: number;
  readonly delta: readonly number[];
  readonly paint: readonly string[];
  readonly amount: readonly number[];
}

export interface Rules {
  readonly maxDepth: number;
  readonly maxHeight: number;
  readonly orePerCubicMetre: number;
  readonly ratePerSecond: number;
}

export type BrushKind = 'carve' | 'raise' | 'smooth' | 'flatten' | 'paint' | 'erase';

export interface BrushOp {
  readonly kind: BrushKind;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
  readonly dt: number;
  readonly preset?: string;
  readonly level?: number;
}

/** The previous values of the changed cells. */
export interface Patch {
  readonly cells: readonly number[];
  readonly delta: readonly number[];
  readonly paint: readonly string[];
  readonly amount: readonly number[];
}

export interface Result {
  readonly field: Field;
  readonly ore: number;
  readonly changed: readonly number[];
  readonly undo: Patch;
}

/** Kill negative zero so it never leaks into a result. */
const nz = (v: number): number => (v === 0 ? 0 : v);

export function emptyField(size: number, cell: number): Field {
  if (!Number.isInteger(size) || size < 1) throw new Error('bad field size');
  if (!Number.isFinite(cell) || cell <= 0) throw new Error('bad cell size');
  const n = size * size;
  const delta: number[] = new Array<number>(n).fill(0);
  const paint: string[] = new Array<string>(n).fill('');
  const amount: number[] = new Array<number>(n).fill(0);
  return { size, cell, delta, paint, amount };
}

function validate(op: BrushOp): void {
  if (!Number.isFinite(op.radius) || op.radius <= 0) throw new Error('bad op: radius must be > 0');
  if (!Number.isFinite(op.strength) || op.strength < 0 || op.strength > 1) {
    throw new Error('bad op: strength must be within 0..1');
  }
  if (!Number.isFinite(op.dt) || op.dt < 0) throw new Error('bad op: dt must be >= 0');
  if (!Number.isFinite(op.x) || !Number.isFinite(op.z)) throw new Error('bad op: position');
  if (op.kind === 'paint' && (op.preset === undefined || op.preset === '')) {
    throw new Error('bad op: paint needs a preset');
  }
  if (op.kind === 'flatten' && (op.level === undefined || !Number.isFinite(op.level))) {
    throw new Error('bad op: flatten needs a level');
  }
}

interface Touch {
  readonly cells: number[]; // cell indices, ascending
  readonly weights: number[]; // cos falloff weight per cell
}

/** Cells whose centre lies within the brush radius, minus protected ones. */
function touched(
  field: Field,
  op: BrushOp,
  protect: ((cellIndex: number) => boolean) | undefined
): Touch {
  const { size, cell } = field;
  const r = op.radius;
  const x0 = Math.max(0, Math.floor((op.x - r) / cell - 0.5));
  const x1 = Math.min(size - 1, Math.ceil((op.x + r) / cell - 0.5));
  const z0 = Math.max(0, Math.floor((op.z - r) / cell - 0.5));
  const z1 = Math.min(size - 1, Math.ceil((op.z + r) / cell - 0.5));
  const cells: number[] = [];
  const weights: number[] = [];
  for (let z = z0; z <= z1; z++) {
    const cz = (z + 0.5) * cell - op.z;
    for (let x = x0; x <= x1; x++) {
      const cx = (x + 0.5) * cell - op.x;
      const d = Math.sqrt(cx * cx + cz * cz);
      if (d >= r) continue;
      const i = z * size + x;
      if (protect !== undefined && protect(i)) continue;
      cells.push(i);
      weights.push(0.5 * (1 + Math.cos((Math.PI * d) / r)));
    }
  }
  return { cells, weights };
}

const cellCentreX = (field: Field, i: number): number =>
  ((i % field.size) + 0.5) * field.cell;
const cellCentreZ = (field: Field, i: number): number =>
  (Math.floor(i / field.size) + 0.5) * field.cell;

export function apply(
  field: Field,
  base: (x: number, z: number) => number,
  op: BrushOp,
  rules: Rules,
  ore: number,
  protect?: (cellIndex: number) => boolean
): Result {
  validate(op);
  const { cells, weights } = touched(field, op, protect);
  const area = field.cell * field.cell;
  const price = rules.orePerCubicMetre;
  const k = rules.ratePerSecond * op.strength * op.dt;

  // Proposed per-touched-cell height changes (delta metres) for sculpt ops.
  const changes: number[] = new Array<number>(cells.length).fill(0);
  let oreOut = 0;
  let paintMode = false;
  const newPaint: string[] = [];
  const newAmount: number[] = [];

  if (op.kind === 'carve') {
    let removed = 0;
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      const old = field.delta[i]!;
      const floor = -rules.maxDepth;
      if (old <= floor) continue;
      const nd = Math.max(old - k * weights[t]!, floor);
      const ch = nd - old;
      changes[t] = ch;
      removed -= ch;
    }
    oreOut = removed * area * price;
  } else if (op.kind === 'raise') {
    let added = 0;
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      const old = field.delta[i]!;
      const roof = rules.maxHeight;
      if (old >= roof) continue;
      const nd = Math.min(old + k * weights[t]!, roof);
      changes[t] = nd - old;
      added += nd - old;
    }
    const cost = added * area * price;
    const budget = Math.max(0, ore);
    if (cost > budget) {
      const s = cost > 0 ? budget / cost : 0;
      let spent = 0;
      for (let t = 0; t < changes.length; t++) {
        changes[t] = changes[t]! * s;
        spent += changes[t]!;
      }
      oreOut = -(spent * area * price);
    } else {
      oreOut = -cost;
    }
  } else if (op.kind === 'smooth') {
    const size = field.size;
    let total = 0;
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      const cx = i % size;
      const cz = Math.floor(i / size);
      let sum = 0;
      let count = 0;
      for (let dz = -1; dz <= 1; dz++) {
        const z = cz + dz;
        if (z < 0 || z >= size) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          if (x < 0 || x >= size) continue;
          const j = z * size + x;
          sum += base((x + 0.5) * field.cell, (z + 0.5) * field.cell) + field.delta[j]!;
          count++;
        }
      }
      const avg = sum / count;
      const h = base(cellCentreX(field, i), cellCentreZ(field, i)) + field.delta[i]!;
      const diff = avg - h;
      const step = k * weights[t]!;
      const ch = diff > step ? step : diff < -step ? -step : diff;
      changes[t] = ch;
      total += ch;
    }
    // Spread the leftover back so the total volume is conserved.
    if (cells.length > 0 && total !== 0) {
      const corr = total / cells.length;
      for (let t = 0; t < changes.length; t++) changes[t] = changes[t]! - corr;
    }
    oreOut = 0;
  } else if (op.kind === 'flatten') {
    const level = op.level!;
    let net = 0; // positive = net fill volume (costs ore)
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      const old = field.delta[i]!;
      const h = base(cellCentreX(field, i), cellCentreZ(field, i)) + old;
      const diff = level - h;
      const step = k * weights[t]!;
      let ch = diff > step ? step : diff < -step ? -step : diff;
      const nd = Math.min(rules.maxHeight, Math.max(-rules.maxDepth, old + ch));
      ch = nd - old;
      changes[t] = ch;
      net += ch;
    }
    let netOre = -(net * area * price); // > 0 gained, < 0 spent
    const budget = Math.max(0, ore);
    if (netOre < -budget) {
      const s = budget / -netOre; // 0..1
      net = 0;
      for (let t = 0; t < changes.length; t++) {
        changes[t] = changes[t]! * s;
        net += changes[t]!;
      }
      netOre = -(net * area * price);
    }
    oreOut = netOre;
  } else {
    // paint / erase
    paintMode = true;
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      const inc = op.strength * op.dt * weights[t]!;
      const oldP = field.paint[i]!;
      const oldA = field.amount[i]!;
      if (op.kind === 'paint') {
        if (inc <= 0) {
          newPaint.push(oldP);
          newAmount.push(oldA);
          continue;
        }
        const preset = op.preset!;
        newPaint.push(preset);
        newAmount.push(Math.min(1, oldA + inc));
      } else {
        const a = Math.max(0, oldA - inc);
        newAmount.push(a);
        newPaint.push(a === 0 ? '' : oldP);
      }
    }
    oreOut = 0;
  }

  // Collect the cells whose state actually changed.
  const changed: number[] = [];
  const undoCells: number[] = [];
  const undoDelta: number[] = [];
  const undoPaint: string[] = [];
  const undoAmount: number[] = [];
  for (let t = 0; t < cells.length; t++) {
    const i = cells[t]!;
    let dirty: boolean;
    if (paintMode) {
      dirty = newPaint[t]! !== field.paint[i]! || newAmount[t]! !== field.amount[i]!;
    } else {
      dirty = changes[t]! !== 0;
    }
    if (!dirty) continue;
    changed.push(i);
    undoCells.push(i);
    undoDelta.push(field.delta[i]!);
    undoPaint.push(field.paint[i]!);
    undoAmount.push(field.amount[i]!);
  }

  const undo: Patch = { cells: undoCells, delta: undoDelta, paint: undoPaint, amount: undoAmount };

  if (changed.length === 0) {
    return { field, ore: nz(oreOut), changed, undo };
  }

  let outField: Field;
  if (paintMode) {
    const paint = field.paint.slice();
    const amount = field.amount.slice();
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      paint[i] = newPaint[t]!;
      amount[i] = nz(newAmount[t]!);
    }
    outField = { size: field.size, cell: field.cell, delta: field.delta, paint, amount };
  } else {
    const delta = field.delta.slice();
    for (let t = 0; t < cells.length; t++) {
      const i = cells[t]!;
      delta[i] = nz(field.delta[i]! + changes[t]!);
    }
    outField = { size: field.size, cell: field.cell, delta, paint: field.paint, amount: field.amount };
  }

  return { field: outField, ore: nz(oreOut), changed, undo };
}

export function revert(field: Field, patch: Patch): Field {
  const delta = field.delta.slice();
  const paint = field.paint.slice();
  const amount = field.amount.slice();
  for (let t = 0; t < patch.cells.length; t++) {
    const i = patch.cells[t]!;
    if (i < 0 || i >= delta.length) continue;
    delta[i] = nz(patch.delta[t] ?? 0);
    paint[i] = patch.paint[t] ?? '';
    amount[i] = nz(patch.amount[t] ?? 0);
  }
  return { size: field.size, cell: field.cell, delta, paint, amount };
}

export function heightAt(
  field: Field,
  base: (x: number, z: number) => number,
  x: number,
  z: number
): number {
  const { size, cell, delta } = field;
  const clampG = (v: number): number => Math.min(size - 1, Math.max(0, v / cell - 0.5));
  const gx = clampG(x);
  const gz = clampG(z);
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(size - 1, x0 + 1);
  const z1 = Math.min(size - 1, z0 + 1);
  const fx = gx - x0;
  const fz = gz - z0;
  const d00 = delta[z0 * size + x0]!;
  const d10 = delta[z0 * size + x1]!;
  const d01 = delta[z1 * size + x0]!;
  const d11 = delta[z1 * size + x1]!;
  const top = d00 + (d10 - d00) * fx;
  const bot = d01 + (d11 - d01) * fx;
  return nz(base(x, z) + top + (bot - top) * fz);
}

/* ------------------------------------------------------------------ */
/* Encoding: magic + version, size, cell, delta (cm, zero runs        */
/* collapsed), then paint ids and amounts as runs — all base64url.    */
/* ------------------------------------------------------------------ */

const MAGIC_0 = 0x54; // 'T' — non-zero on purpose
const MAGIC_1 = 0x42; // 'B'
const VERSION = 1;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function pushVarint(out: number[], value: number): void {
  let v = Math.floor(value);
  if (v < 0) v = 0;
  for (;;) {
    const b = v % 128;
    v = Math.floor(v / 128);
    if (v > 0) out.push(b | 0x80);
    else {
      out.push(b);
      return;
    }
  }
}

/** ZigZag: 0, -1, 1, -2, 2 ... -> 0, 1, 2, 3, 4 ... */
function pushZig(out: number[], value: number): void {
  pushVarint(out, value >= 0 ? value * 2 : -value * 2 - 1);
}

function toBase64url(bytes: readonly number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : -1;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : -1;
    s += B64.charAt(a >> 2);
    if (b < 0) {
      s += B64.charAt((a & 3) << 4);
    } else {
      s += B64.charAt(((a & 3) << 4) | (b >> 4));
      if (c < 0) {
        s += B64.charAt((b & 15) << 2);
      } else {
        s += B64.charAt(((b & 15) << 2) | (c >> 6));
        s += B64.charAt(c & 63);
      }
    }
  }
  return s;
}

function fromBase64url(text: string): number[] | null {
  const rem = text.length % 4;
  if (rem === 1) return null;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    const v = B64.indexOf(text.charAt(i));
    if (v < 0) return null;
    buffer = ((buffer << 6) | v) & 0x3fff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  // Leftover bits must be zero padding.
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return null;
  return out;
}

export function encodeField(field: Field): string {
  const out: number[] = [MAGIC_0, MAGIC_1, VERSION];
  const total = field.size * field.size;
  pushVarint(out, field.size);
  pushVarint(out, Math.max(1, Math.round(field.cell * 1e6))); // cell in micrometres

  // Delta in centimetres, runs of zero cells collapsed: (zeros, literals, values...)*
  const q: number[] = new Array<number>(total);
  for (let i = 0; i < total; i++) q[i] = Math.round(field.delta[i]! * 100);
  let i = 0;
  while (i < total) {
    let zeros = 0;
    while (i + zeros < total && q[i + zeros]! === 0) zeros++;
    i += zeros;
    let lits = 0;
    while (i + lits < total && q[i + lits]! !== 0) lits++;
    pushVarint(out, zeros);
    pushVarint(out, lits);
    for (let t = 0; t < lits; t++) pushZig(out, q[i + t]!);
    i += lits;
  }

  // Paint ids and amounts as runs: (runLength, idCodePointCount, codepoints..., amountByte)*
  i = 0;
  while (i < total) {
    const p = field.paint[i]!;
    const aB = Math.max(0, Math.min(255, Math.round(field.amount[i]! * 255)));
    let run = 1;
    while (
      i + run < total &&
      field.paint[i + run]! === p &&
      Math.max(0, Math.min(255, Math.round(field.amount[i + run]! * 255))) === aB
    ) {
      run++;
    }
    pushVarint(out, run);
    const codes: number[] = [];
    for (const ch of p) codes.push(ch.codePointAt(0) ?? 0);
    pushVarint(out, codes.length);
    for (const cp of codes) pushVarint(out, cp);
    out.push(aB);
    i += run;
  }

  return toBase64url(out);
}

export function decodeField(text: string): Field | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  const bytes = fromBase64url(text);
  if (bytes === null) return null;

  let pos = 0;
  const readByte = (): number | null => (pos < bytes.length ? bytes[pos++]! : null);
  const readVarint = (): number | null => {
    let value = 0;
    let factor = 1;
    for (let n = 0; n < 8; n++) {
      const b = readByte();
      if (b === null) return null;
      value += (b & 0x7f) * factor;
      if ((b & 0x80) === 0) return value;
      factor *= 128;
    }
    return null; // too long
  };

  if (readByte() !== MAGIC_0 || readByte() !== MAGIC_1 || readByte() !== VERSION) return null;

  const size = readVarint();
  if (size === null || size < 1 || size > 8192) return null;
  const cellRaw = readVarint();
  if (cellRaw === null || cellRaw < 1) return null;
  const cell = cellRaw / 1e6;
  const total = size * size;

  const delta: number[] = new Array<number>(total).fill(0);
  let filled = 0;
  while (filled < total) {
    const zeros = readVarint();
    if (zeros === null) return null;
    const lits = readVarint();
    if (lits === null) return null;
    if (zeros + lits === 0) return null; // no progress -> malformed
    if (filled + zeros + lits > total) return null;
    filled += zeros;
    for (let t = 0; t < lits; t++) {
      const u = readVarint();
      if (u === null) return null;
      const v = u % 2 === 0 ? u / 2 : -(u + 1) / 2;
      delta[filled++] = nz(v / 100);
    }
  }

  const paint: string[] = new Array<string>(total).fill('');
  const amount: number[] = new Array<number>(total).fill(0);
  filled = 0;
  while (filled < total) {
    const run = readVarint();
    if (run === null || run < 1 || filled + run > total) return null;
    const len = readVarint();
    if (len === null || len > 256) return null;
    let id = '';
    for (let t = 0; t < len; t++) {
      const cp = readVarint();
      if (cp === null || cp > 0x10ffff) return null;
      id += String.fromCodePoint(cp);
    }
    const aB = readByte();
    if (aB === null) return null;
    const a = aB / 255;
    for (let t = 0; t < run; t++) {
      paint[filled] = id;
      amount[filled] = a;
      filled++;
    }
  }

  if (pos !== bytes.length) return null; // trailing data
  return { size, cell, delta, paint, amount };
}

export {
  snapBorderHeights,
  stitchChunkBorder,
  stitchChunkCandidates,
  type BorderEdge,
  type ChunkMeshCandidate,
  type NeighbourStrides,
} from './seam-stitch';
