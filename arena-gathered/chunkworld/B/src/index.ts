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

type UnknownRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUrl(value: string): boolean {
  return /^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(value);
}

/** Validate a manifest without allowing malformed JSON or values to escape as exceptions. */
export function parseManifest(text: string): { manifest: Manifest | null; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { manifest: null, errors: ['Invalid JSON'] };
  }

  if (!isRecord(parsed)) return { manifest: null, errors: ['Manifest must be an object'] };

  const name = parsed['name'];
  const license = parsed['license'];
  const source = parsed['source'];
  const chunkSize = parsed['chunkSize'];
  const spawn = parsed['spawn'];
  const chunks = parsed['chunks'];

  if (typeof name !== 'string' || name.trim() === '') errors.push('name must be a non-empty string');
  if (typeof license !== 'string' || license.trim() === '') errors.push('license must be a non-empty string');
  if (typeof source !== 'string' || source.trim() === '') errors.push('source must be a non-empty string');
  if (typeof chunkSize !== 'number' || !Number.isInteger(chunkSize) || chunkSize < 8 || chunkSize > 64) {
    errors.push('chunkSize must be an integer from 8 to 64');
  }

  const validSpawn = Array.isArray(spawn)
    && spawn.length === 3
    && spawn.every((part: unknown) => typeof part === 'number' && Number.isFinite(part));
  if (!validSpawn) errors.push('spawn must contain three finite numbers');

  if (!isRecord(chunks)) {
    errors.push('chunks must be an object');
  } else {
    const entries = Object.entries(chunks);
    if (entries.length > 100000) errors.push('chunks must contain at most 100000 entries');
    for (const [key, value] of entries) {
      if (!/^-?\d+,-?\d+$/.test(key)) {
        errors.push(`Invalid chunk key: ${key}`);
        continue;
      }
      const comma = key.indexOf(',');
      const cx = Number(key.slice(0, comma));
      const cz = Number(key.slice(comma + 1));
      if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cz)) errors.push(`Invalid chunk key: ${key}`);
      if (typeof value !== 'string' || !validUrl(value)) errors.push(`Invalid chunk URL: ${key}`);
    }
  }

  if (errors.length > 0 || typeof name !== 'string' || typeof license !== 'string'
    || typeof source !== 'string' || typeof chunkSize !== 'number' || !validSpawn || !isRecord(chunks)) {
    return { manifest: null, errors };
  }

  return {
    manifest: {
      name,
      license,
      source,
      chunkSize,
      spawn: [spawn[0] as number, spawn[1] as number, spawn[2] as number],
      chunks: chunks as { [key: string]: string },
    },
    errors,
  };
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

interface ChunkPosition {
  key: string;
  x: number;
  z: number;
}

export class ChunkStreamer {
  private readonly manifest: Manifest;
  private readonly limits: StreamLimits;
  private readonly positions: ChunkPosition[];
  private readonly states = new Map<string, ChunkState>();
  private readonly failures = new Map<string, number>();
  private viewX = 0;
  private viewZ = 0;
  private yaw = 0;

  constructor(manifest: Manifest, limits: StreamLimits) {
    this.manifest = manifest;
    this.limits = {
      radius: Number.isFinite(limits.radius) ? Math.max(0, limits.radius) : 0,
      maxLoaded: Number.isFinite(limits.maxLoaded) ? Math.max(0, Math.floor(limits.maxLoaded)) : 0,
      maxInFlight: Number.isFinite(limits.maxInFlight) ? Math.max(0, Math.floor(limits.maxInFlight)) : 0,
    };
    this.positions = Object.keys(manifest.chunks).flatMap((key): ChunkPosition[] => {
      const comma = key.indexOf(',');
      if (comma < 1) return [];
      const x = Number(key.slice(0, comma));
      const z = Number(key.slice(comma + 1));
      return Number.isSafeInteger(x) && Number.isSafeInteger(z) ? [{ key, x, z }] : [];
    });
    this.refreshWanted();
  }

  setView(x: number, z: number, yaw: number): void {
    if (Number.isFinite(x)) this.viewX = x;
    if (Number.isFinite(z)) this.viewZ = z;
    if (Number.isFinite(yaw)) this.yaw = yaw;
    this.refreshWanted();
  }

  next(): string[] {
    const loading = this.countState('loading');
    const available = Math.max(0, this.limits.maxInFlight - loading);
    if (available === 0) return [];

    const candidates = this.positions
      .filter((position) => this.states.get(position.key) === 'wanted')
      .sort((a, b) => this.compareForFetch(a, b));
    const selected = candidates.slice(0, available).map((position) => position.key);
    for (const key of selected) this.states.set(key, 'loading');
    return selected;
  }

  done(key: string, bytes: Uint8Array | null): void {
    if (this.states.get(key) !== 'loading') return;
    const decoded = bytes === null ? null : decodeChunk(bytes);
    if (decoded !== null && decoded.error === null) {
      this.states.set(key, 'ready');
      this.failures.delete(key);
      return;
    }

    const failures = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, failures);
    if (failures >= 3) {
      this.states.set(key, 'failed');
    } else if (this.insideRadius(key)) {
      this.states.set(key, 'wanted');
    } else {
      this.states.delete(key);
    }
  }

  evict(): string[] {
    const excess = this.loaded - this.limits.maxLoaded;
    if (excess <= 0) return [];
    const outside = this.positions
      .filter((position) => this.states.get(position.key) === 'ready' && !this.isInside(position))
      .sort((a, b) => this.distanceSquared(b) - this.distanceSquared(a) || a.key.localeCompare(b.key));
    const evicted = outside.slice(0, excess).map((position) => position.key);
    for (const key of evicted) {
      this.states.delete(key);
      this.failures.delete(key);
    }
    return evicted;
  }

  state(key: string): ChunkState | null {
    return this.states.get(key) ?? null;
  }

  get loaded(): number {
    return this.countState('ready');
  }

  private countState(state: ChunkState): number {
    let count = 0;
    for (const value of this.states.values()) if (value === state) count++;
    return count;
  }

  private cameraChunkX(): number {
    return Math.floor(this.viewX / this.manifest.chunkSize);
  }

  private cameraChunkZ(): number {
    return Math.floor(this.viewZ / this.manifest.chunkSize);
  }

  private distanceSquared(position: ChunkPosition): number {
    const dx = position.x - this.cameraChunkX();
    const dz = position.z - this.cameraChunkZ();
    return dx * dx + dz * dz;
  }

  private isInside(position: ChunkPosition): boolean {
    return this.distanceSquared(position) <= this.limits.radius * this.limits.radius;
  }

  private insideRadius(key: string): boolean {
    const position = this.positions.find((candidate) => candidate.key === key);
    return position !== undefined && this.isInside(position);
  }

  private refreshWanted(): void {
    for (const [key, state] of this.states) {
      if (state === 'wanted' && !this.insideRadius(key)) this.states.delete(key);
    }
    for (const position of this.positions) {
      if (this.isInside(position) && !this.states.has(position.key)) this.states.set(position.key, 'wanted');
    }
  }

  private inFront(position: ChunkPosition): boolean {
    const dx = position.x - this.cameraChunkX();
    const dz = position.z - this.cameraChunkZ();
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length === 0) return true;
    const radians = this.yaw * Math.PI / 180;
    const dot = dx * Math.sin(radians) + dz * Math.cos(radians);
    return dot / length >= 0.5;
  }

  private compareForFetch(a: ChunkPosition, b: ChunkPosition): number {
    const distance = this.distanceSquared(a) - this.distanceSquared(b);
    if (distance !== 0) return distance;
    const front = Number(this.inFront(b)) - Number(this.inFront(a));
    return front !== 0 ? front : a.key.localeCompare(b.key);
  }
}

export function decodeChunk(bytes: Uint8Array): { size: number; height: number; cells: Uint8Array | null; error: string | null } {
  const failure = (error: string, size = 0, height = 0) => ({ size, height, cells: null, error });
  try {
    if (bytes.length < 9) return failure('Truncated chunk header');
    if (bytes[0] !== 83 || bytes[1] !== 77 || bytes[2] !== 67 || bytes[3] !== 75) return failure('Invalid chunk magic');
    if (bytes[4] !== 1) return failure('Unsupported chunk version');
    const size = (bytes[5] ?? 0) | ((bytes[6] ?? 0) << 8);
    const height = (bytes[7] ?? 0) | ((bytes[8] ?? 0) << 8);
    if (size === 0 || height === 0) return failure('Invalid chunk dimensions', size, height);
    const cellCount = size * height * size;
    const pairBytes = bytes.length - 9;
    if (pairBytes % 2 !== 0) return failure('Truncated RLE pair', size, height);
    if (cellCount > (pairBytes / 2) * 255) return failure('Truncated chunk data', size, height);

    const cells = new Uint8Array(cellCount);
    let output = 0;
    for (let offset = 9; offset < bytes.length; offset += 2) {
      const value = bytes[offset];
      const count = bytes[offset + 1];
      if (value === undefined || count === undefined) return failure('Truncated RLE pair', size, height);
      if (count === 0) return failure('Invalid zero-length RLE run', size, height);
      if (output + count > cellCount) return failure('RLE data exceeds chunk dimensions', size, height);
      cells.fill(value, output, output + count);
      output += count;
    }
    if (output !== cellCount) return failure('Truncated chunk data', size, height);
    return { size, height, cells, error: null };
  } catch {
    return failure('Invalid chunk data');
  }
}

export function encodeChunk(size: number, height: number, cells: Uint8Array): Uint8Array {
  if (!Number.isInteger(size) || !Number.isInteger(height) || size < 1 || size > 65535
    || height < 1 || height > 65535 || cells.length !== size * height * size) return new Uint8Array(0);
  try {
    const runs: number[] = [];
    for (let index = 0; index < cells.length;) {
      const value = cells[index];
      if (value === undefined) return new Uint8Array(0);
      let count = 1;
      while (count < 255 && index + count < cells.length && cells[index + count] === value) count++;
      runs.push(value, count);
      index += count;
    }
    const bytes = new Uint8Array(9 + runs.length);
    bytes.set([83, 77, 67, 75, 1]);
    bytes[5] = size & 255;
    bytes[6] = (size >>> 8) & 255;
    bytes[7] = height & 255;
    bytes[8] = (height >>> 8) & 255;
    bytes.set(runs, 9);
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

/** Count exposed cell faces in +x, -x, +y, -y, +z, -z order. */
export function visibleFaces(size: number, height: number, cells: Uint8Array): [number, number, number, number, number, number] {
  const faces: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  if (!Number.isInteger(size) || !Number.isInteger(height) || size < 1 || height < 1
    || cells.length !== size * height * size) return faces;
  const index = (x: number, y: number, z: number) => x + size * (y + height * z);
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < size; x++) {
        if (cells[index(x, y, z)] === 0) continue;
        if (x === size - 1 || cells[index(x + 1, y, z)] === 0) faces[0]++;
        if (x === 0 || cells[index(x - 1, y, z)] === 0) faces[1]++;
        if (y === height - 1 || cells[index(x, y + 1, z)] === 0) faces[2]++;
        if (y === 0 || cells[index(x, y - 1, z)] === 0) faces[3]++;
        if (z === size - 1 || cells[index(x, y, z + 1)] === 0) faces[4]++;
        if (z === 0 || cells[index(x, y, z - 1)] === 0) faces[5]++;
      }
    }
  }
  return faces;
}