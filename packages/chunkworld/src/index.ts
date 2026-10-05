export type Vec3 = [number, number, number];

/** A world manifest (JSON a portal links to). */
export interface Manifest {
  name: string;
  license: string;
  source: string;
  chunkSize: number;
  spawn: Vec3;
  chunks: { [key: string]: string };
}

export function parseManifest(text: string): { manifest: Manifest | null; errors: string[] } {
  const errors: string[] = [];
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return { manifest: null, errors: ['invalid JSON'] };
  }

  if (!isRecord(value)) {
    return { manifest: null, errors: ['manifest must be an object'] };
  }

  const name = value.name;
  const license = value.license;
  const source = value.source;
  const chunkSize = value.chunkSize;
  const spawn = value.spawn;
  const chunks = value.chunks;

  if (!isNonEmptyString(name)) errors.push('name must be a non-empty string');
  if (!isNonEmptyString(license)) errors.push('license must be a non-empty string');
  if (!isNonEmptyString(source)) errors.push('source must be a non-empty string');
  if (!isInteger(chunkSize) || chunkSize < 8 || chunkSize > 64) {
    errors.push('chunkSize must be an integer 8..64');
  }
  if (!isVec3(spawn)) errors.push('spawn must be three finite numbers');

  let chunkMap: { [key: string]: string } | null = null;
  if (!isRecord(chunks) || Array.isArray(chunks)) {
    errors.push('chunks must be an object');
  } else {
    const keys = Object.keys(chunks);
    if (keys.length > 100000) errors.push('at most 100000 chunks');
    chunkMap = {};
    for (const key of keys) {
      if (!/^-?\d+,-?\d+$/.test(key)) {
        errors.push(`invalid chunk key: ${key}`);
        continue;
      }
      const url = chunks[key];
      if (!isHttpUrl(url)) {
        errors.push(`invalid chunk url for ${key}`);
        continue;
      }
      chunkMap[key] = url;
    }
  }

  if (
    errors.length > 0 ||
    !isNonEmptyString(name) ||
    !isNonEmptyString(license) ||
    !isNonEmptyString(source) ||
    !isInteger(chunkSize) ||
    !isVec3(spawn) ||
    chunkMap === null
  ) {
    return { manifest: null, errors };
  }

  const manifest: Manifest = {
    name,
    license,
    source,
    chunkSize,
    spawn,
    chunks: chunkMap,
  };
  return { manifest, errors: [] };
}

export interface StreamLimits {
  radius: number;
  maxLoaded: number;
  maxInFlight: number;
}

export const LIMITS: { low: StreamLimits; high: StreamLimits } = {
  low: { radius: 4, maxLoaded: 96, maxInFlight: 4 },
  high: { radius: 8, maxLoaded: 400, maxInFlight: 8 },
};

export type ChunkState = 'wanted' | 'loading' | 'ready' | 'failed';

type InternalState = ChunkState | null;

interface ChunkMeta {
  state: InternalState;
  retries: number;
  size: number | null;
  height: number | null;
  cells: Uint8Array | null;
}

interface Candidate {
  key: string;
  distance2: number;
  front: number;
  angleRank: number;
}

interface EvictCandidate {
  key: string;
  distance2: number;
}

export class ChunkStreamer {
  private readonly manifest: Manifest;
  private readonly limits: StreamLimits;
  private viewX: number;
  private viewZ: number;
  private yaw: number;
  private readonly chunks: Map<string, ChunkMeta>;

  constructor(manifest: Manifest, limits: StreamLimits) {
    this.manifest = manifest;
    this.limits = {
      radius: toNonNegativeInteger(limits.radius),
      maxLoaded: toNonNegativeInteger(limits.maxLoaded),
      maxInFlight: toNonNegativeInteger(limits.maxInFlight),
    };
    this.viewX = manifest.spawn[0];
    this.viewZ = manifest.spawn[2];
    this.yaw = 0;
    this.chunks = new Map<string, ChunkMeta>();
  }

  setView(x: number, z: number, yaw: number): void {
    this.viewX = Number.isFinite(x) ? x : 0;
    this.viewZ = Number.isFinite(z) ? z : 0;
    this.yaw = Number.isFinite(yaw) ? yaw : 0;
  }

  next(): string[] {
    const inFlight = this.countState('loading');
    const room = this.limits.maxInFlight - inFlight;
    if (room <= 0) return [];

    const candidates: Candidate[] = [];
    const currentCx = worldToChunk(this.viewX, this.manifest.chunkSize);
    const currentCz = worldToChunk(this.viewZ, this.manifest.chunkSize);
    const radius = this.limits.radius;
    const yawIndex = normalizedYawIndex(this.yaw);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const key = `${currentCx + dx},${currentCz + dz}`;
        if (!(key in this.manifest.chunks)) continue;
        const meta = this.getMeta(key);
        if (meta.state === 'ready' || meta.state === 'loading' || meta.state === 'failed') continue;
        const distance2 = dx * dx + dz * dz;
        const angleRank = directionRank(dx, dz, yawIndex);
        const front = angleRank <= 1 ? 0 : 1;
        candidates.push({ key, distance2, front, angleRank });
      }
    }

    candidates.sort(compareCandidates);

    const result: string[] = [];
    const count = room < candidates.length ? room : candidates.length;
    for (let i = 0; i < count; i++) {
      const candidate = candidates[i];
      if (!candidate) break;
      const meta = this.getMeta(candidate.key);
      meta.state = 'loading';
      result.push(candidate.key);
    }
    return result;
  }

  done(key: string, bytes: Uint8Array | null): void {
    if (!(key in this.manifest.chunks)) return;
    const meta = this.getMeta(key);

    if (bytes === null) {
      this.markFailure(meta);
      return;
    }

    const decoded = decodeChunk(bytes);
    if (decoded.error !== null || decoded.cells === null) {
      this.markFailure(meta);
      return;
    }

    meta.state = 'ready';
    meta.retries = 0;
    meta.size = decoded.size;
    meta.height = decoded.height;
    meta.cells = decoded.cells;
  }

  evict(): string[] {
    const loaded = this.loaded;
    if (loaded <= this.limits.maxLoaded) return [];

    const readyKeys: EvictCandidate[] = [];
    const currentCx = worldToChunk(this.viewX, this.manifest.chunkSize);
    const currentCz = worldToChunk(this.viewZ, this.manifest.chunkSize);

    for (const [key, meta] of this.chunks.entries()) {
      if (meta.state !== 'ready') continue;
      const parsed = parseKey(key);
      if (parsed === null) continue;
      const dx = parsed[0] - currentCx;
      const dz = parsed[1] - currentCz;
      if (absInt(dx) <= this.limits.radius && absInt(dz) <= this.limits.radius) continue;
      readyKeys.push({ key, distance2: dx * dx + dz * dz });
    }

    readyKeys.sort((a, b) => b.distance2 - a.distance2 || compareKey(a.key, b.key));

    const need = loaded - this.limits.maxLoaded;
    const count = need < readyKeys.length ? need : readyKeys.length;
    const evicted: string[] = [];

    for (let i = 0; i < count; i++) {
      const candidate = readyKeys[i];
      if (!candidate) break;
      const meta = this.getMeta(candidate.key);
      meta.state = null;
      meta.size = null;
      meta.height = null;
      meta.cells = null;
      evicted.push(candidate.key);
    }

    return evicted;
  }

  state(key: string): ChunkState | null {
    if (!(key in this.manifest.chunks)) return null;
    return this.getMeta(key).state;
  }

  get loaded(): number {
    return this.countState('ready');
  }

  private getMeta(key: string): ChunkMeta {
    const found = this.chunks.get(key);
    if (found) return found;
    const created: ChunkMeta = { state: null, retries: 0, size: null, height: null, cells: null };
    this.chunks.set(key, created);
    return created;
  }

  private countState(state: ChunkState): number {
    let count = 0;
    for (const meta of this.chunks.values()) {
      if (meta.state === state) count += 1;
    }
    return count;
  }

  private markFailure(meta: ChunkMeta): void {
    if (meta.retries < 2) {
      meta.retries += 1;
      meta.state = null;
      meta.size = null;
      meta.height = null;
      meta.cells = null;
      return;
    }
    meta.state = 'failed';
    meta.size = null;
    meta.height = null;
    meta.cells = null;
  }
}

/** Chunk bytes format (ours): 4 bytes "SMCK", uint8 version 1, uint16 size, uint16 height (little-endian), then size*height*size cells (index x + size*(y + height*z)) run-length coded as pairs (uint8 value, uint8 count 1..255). Returns the cells or an error. */
export function decodeChunk(bytes: Uint8Array): { size: number; height: number; cells: Uint8Array | null; error: string | null } {
  try {
    if (bytes.length < 9) return { size: 0, height: 0, cells: null, error: 'truncated header' };
    if (bytes[0] !== 83 || bytes[1] !== 77 || bytes[2] !== 67 || bytes[3] !== 75) {
      return { size: 0, height: 0, cells: null, error: 'bad magic' };
    }
    if (bytes[4] !== 1) return { size: 0, height: 0, cells: null, error: 'unsupported version' };

    const size = bytes[5]! | (bytes[6]! << 8);
    const height = bytes[7]! | (bytes[8]! << 8);
    if (size <= 0 || height <= 0) {
      return { size, height, cells: null, error: 'invalid dimensions' };
    }

    const total = size * height * size;
    const cells = new Uint8Array(total);
    let out = 0;
    let i = 9;

    while (i < bytes.length) {
      const value = bytes[i];
      const count = bytes[i + 1];
      if (value === undefined || count === undefined) {
        return { size, height, cells: null, error: 'truncated rle pair' };
      }
      if (count === 0) return { size, height, cells: null, error: 'invalid rle count' };
      if (out + count > total) return { size, height, cells: null, error: 'rle overflow' };
      cells.fill(value, out, out + count);
      out += count;
      i += 2;
    }

    if (out !== total) return { size, height, cells: null, error: 'truncated cells' };
    return { size, height, cells, error: null };
  } catch {
    return { size: 0, height: 0, cells: null, error: 'decode failed' };
  }
}

export function encodeChunk(size: number, height: number, cells: Uint8Array): Uint8Array {
  const s = toNonNegativeInteger(size);
  const h = toNonNegativeInteger(height);
  const expected = s * h * s;
  const source = normalizeCells(expected, cells);

  const out: number[] = [83, 77, 67, 75, 1, s & 255, (s >> 8) & 255, h & 255, (h >> 8) & 255];
  let i = 0;
  while (i < source.length) {
    const value = source[i] ?? 0;
    let count = 1;
    while (i + count < source.length && source[i + count] === value && count < 255) {
      count += 1;
    }
    out.push(value, count);
    i += count;
  }
  return Uint8Array.from(out);
}

/** The visible faces of a chunk's cells (a cell's face is visible when the neighbour in that direction is 0 or outside the chunk): count per direction +x -x +y -y +z -z. */
export function visibleFaces(size: number, height: number, cells: Uint8Array): [number, number, number, number, number, number] {
  const s = toNonNegativeInteger(size);
  const h = toNonNegativeInteger(height);
  const result: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  for (let z = 0; z < s; z++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < s; x++) {
        if (cellAt(s, h, cells, x, y, z) === 0) continue;
        if (x + 1 >= s || cellAt(s, h, cells, x + 1, y, z) === 0) result[0] += 1;
        if (x === 0 || cellAt(s, h, cells, x - 1, y, z) === 0) result[1] += 1;
        if (y + 1 >= h || cellAt(s, h, cells, x, y + 1, z) === 0) result[2] += 1;
        if (y === 0 || cellAt(s, h, cells, x, y - 1, z) === 0) result[3] += 1;
        if (z + 1 >= s || cellAt(s, h, cells, x, y, z + 1) === 0) result[4] += 1;
        if (z === 0 || cellAt(s, h, cells, x, y, z - 1) === 0) result[5] += 1;
      }
    }
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) &&
    value.length === 3 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2]);
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function worldToChunk(coord: number, chunkSize: number): number {
  return Math.floor(coord / chunkSize);
}

function parseKey(key: string): [number, number] | null {
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const x = Number(m[1]);
  const z = Number(m[2]);
  if (!Number.isInteger(x) || !Number.isInteger(z)) return null;
  return [x, z];
}

function absInt(value: number): number {
  return value < 0 ? -value : value;
}

function compareKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return a.distance2 - b.distance2 || a.front - b.front || a.angleRank - b.angleRank || compareKey(a.key, b.key);
}

function normalizedYawIndex(yaw: number): number {
  let y = yaw % 360;
  if (y < 0) y += 360;
  return Math.floor((y + 22.5) / 45) % 8;
}

function directionRank(dx: number, dz: number, yawIndex: number): number {
  if (dx === 0 && dz === 0) return 0;
  const dir = octantIndex(dx, dz);
  let diff = dir - yawIndex;
  if (diff < 0) diff += 8;
  const wrapped = diff <= 4 ? diff : 8 - diff;
  return wrapped;
}

function octantIndex(dx: number, dz: number): number {
  if (dx === 0) return dz >= 0 ? 0 : 4;
  if (dz === 0) return dx > 0 ? 2 : 6;

  const adx = absInt(dx);
  const adz = absInt(dz);

  if (dz > 0) {
    if (dx > 0) return adx > adz ? 2 : 1;
    return adx > adz ? 6 : 7;
  }

  if (dx > 0) return adx > adz ? 2 : 3;
  return adx > adz ? 6 : 5;
}

function normalizeCells(expected: number, cells: Uint8Array): Uint8Array {
  const out = new Uint8Array(expected);
  const count = expected < cells.length ? expected : cells.length;
  out.set(cells.subarray(0, count));
  return out;
}

function cellAt(size: number, height: number, cells: Uint8Array, x: number, y: number, z: number): number {
  const index = x + size * (y + height * z);
  return cells[index] ?? 0;
}