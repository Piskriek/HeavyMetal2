export type Vec3 = [number, number, number];

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    errors.push("Invalid JSON");
    return { manifest: null, errors };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push("Manifest must be an object");
    return { manifest: null, errors };
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.length === 0) {
    errors.push("name must be a non-empty string");
  }
  if (typeof obj.license !== "string" || obj.license.length === 0) {
    errors.push("license must be a non-empty string");
  }
  if (typeof obj.source !== "string" || obj.source.length === 0) {
    errors.push("source must be a non-empty string");
  }

  if (typeof obj.chunkSize !== "number" || !Number.isInteger(obj.chunkSize)) {
    errors.push("chunkSize must be an integer");
  } else if (obj.chunkSize < 8 || obj.chunkSize > 64) {
    errors.push("chunkSize must be between 8 and 64");
  }

  if (!Array.isArray(obj.spawn) || obj.spawn.length !== 3) {
    errors.push("spawn must be an array of 3 numbers");
  } else {
    for (let i = 0; i < 3; i++) {
      const v = obj.spawn[i];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        errors.push(`spawn[${i}] must be a finite number`);
      }
    }
  }

  if (obj.chunks === null || typeof obj.chunks !== "object" || Array.isArray(obj.chunks)) {
    errors.push("chunks must be an object");
  } else {
    const chunksObj = obj.chunks as Record<string, unknown>;
    const keys = Object.keys(chunksObj);
    if (keys.length > 100000) {
      errors.push("Too many chunks (max 100000)");
    }
    for (const k of keys) {
      if (!/^-?\d+,-?\d+$/.test(k)) {
        errors.push(`Invalid chunk key: ${k}`);
      }
      const val = chunksObj[k];
      if (typeof val !== "string" || val.length === 0) {
        errors.push(`Chunk URL must be a non-empty string for key ${k}`);
      } else if (!val.startsWith("http://") && !val.startsWith("https://")) {
        errors.push(`Chunk URL must start with http(s) for key ${k}`);
      }
    }
  }

  if (errors.length > 0) {
    return { manifest: null, errors };
  }

  return {
    manifest: {
      name: obj.name as string,
      license: obj.license as string,
      source: obj.source as string,
      chunkSize: obj.chunkSize as number,
      spawn: obj.spawn as [number, number, number],
      chunks: obj.chunks as { [key: string]: string },
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

export type ChunkState = "wanted" | "loading" | "ready" | "failed";

export class ChunkStreamer {
  private manifest: Manifest;
  private limits: StreamLimits;
  private x: number = 0;
  private z: number = 0;
  private yaw: number = 0;
  private states = new Map<string, ChunkState>();
  private failures = new Map<string, number>();

  constructor(manifest: Manifest, limits: StreamLimits) {
    this.manifest = manifest;
    this.limits = limits;
  }

  setView(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
  }

  private getCamChunk(): [number, number] {
    return [
      Math.floor(this.x / this.manifest.chunkSize),
      Math.floor(this.z / this.manifest.chunkSize),
    ];
  }

  private isInFront(cx: number, cz: number, camCx: number, camCz: number, yaw: number): boolean {
    const dx = cx - camCx;
    const dz = cz - camCz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist === 0) return true;
    const yawRad = (yaw * Math.PI) / 180;
    const dX = Math.sin(yawRad);
    const dZ = Math.cos(yawRad);
    const dot = dx * dX + dz * dZ;
    return dot / dist >= 0.5;
  }

  next(): string[] {
    const [camCx, camCz] = this.getCamChunk();
    const radius = this.limits.radius;
    const loadingCount = this.countLoading();
    const maxFetch = Math.max(0, this.limits.maxInFlight - loadingCount);

    if (maxFetch <= 0) return [];

    const rInt = Math.ceil(radius);
    const candidates: string[] = [];

    for (let cx = camCx - rInt; cx <= camCx + rInt; cx++) {
      for (let cz = camCz - rInt; cz <= camCz + rInt; cz++) {
        const key = `${cx},${cz}`;
        if (!Object.prototype.hasOwnProperty.call(this.manifest.chunks, key)) {
          continue;
        }
        const state = this.states.get(key);
        if (state === "loading" || state === "ready" || state === "failed") {
          continue;
        }
        const dx = cx - camCx;
        const dz = cz - camCz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > radius + 1e-6) {
          continue;
        }
        candidates.push(key);
      }
    }

    candidates.sort((a, b) => {
      const [axStr, azStr] = a.split(",");
      const [bxStr, bzStr] = b.split(",");
      const ax = parseInt(axStr!, 10);
      const az = parseInt(azStr!, 10);
      const bx = parseInt(bxStr!, 10);
      const bz = parseInt(bzStr!, 10);
      const distA = Math.sqrt((ax - camCx) * (ax - camCx) + (az - camCz) * (az - camCz));
      const distB = Math.sqrt((bx - camCx) * (bx - camCx) + (bz - camCz) * (bz - camCz));
      if (distA < distB) return -1;
      if (distA > distB) return 1;
      const frontA = this.isInFront(ax, az, camCx, camCz, this.yaw);
      const frontB = this.isInFront(bx, bz, camCx, camCz, this.yaw);
      if (frontA && !frontB) return -1;
      if (!frontA && frontB) return 1;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    const selected = candidates.slice(0, maxFetch);
    for (const key of selected) {
      this.states.set(key, "loading");
    }
    return selected;
  }

  private countLoading(): number {
    let count = 0;
    for (const [, state] of this.states) {
      if (state === "loading") {
        count++;
      }
    }
    return count;
  }

  done(key: string, bytes: Uint8Array | null): void {
    if (!Object.prototype.hasOwnProperty.call(this.manifest.chunks, key)) {
      return;
    }
    if (bytes !== null) {
      this.states.set(key, "ready");
      this.failures.set(key, 0);
    } else {
      const current = this.failures.get(key) ?? 0;
      const nextVal = current + 1;
      this.failures.set(key, nextVal);
      if (nextVal >= 3) {
        this.states.set(key, "failed");
      } else {
        this.states.set(key, "wanted");
      }
    }
  }

  evict(): string[] {
    const [camCx, camCz] = this.getCamChunk();
    const radius = this.limits.radius;
    const readyKeys: string[] = [];
    for (const [key, state] of this.states) {
      if (state === "ready") {
        readyKeys.push(key);
      }
    }
    if (readyKeys.length <= this.limits.maxLoaded) {
      return [];
    }
    const outside: string[] = [];
    for (const key of readyKeys) {
      const [cxStr, czStr] = key.split(",");
      const cx = parseInt(cxStr!, 10);
      const cz = parseInt(czStr!, 10);
      const dist = Math.sqrt((cx - camCx) * (cx - camCx) + (cz - camCz) * (cz - camCz));
      if (dist > radius + 1e-6) {
        outside.push(key);
      }
    }
    outside.sort((a, b) => {
      const [axStr, azStr] = a.split(",");
      const [bxStr, bzStr] = b.split(",");
      const ax = parseInt(axStr!, 10);
      const az = parseInt(azStr!, 10);
      const bx = parseInt(bxStr!, 10);
      const bz = parseInt(bzStr!, 10);
      const distA = Math.sqrt((ax - camCx) * (ax - camCx) + (az - camCz) * (az - camCz));
      const distB = Math.sqrt((bx - camCx) * (bx - camCx) + (bz - camCz) * (bz - camCz));
      if (distA > distB) return -1;
      if (distA < distB) return 1;
      return a.localeCompare(b);
    });
    const toDropCount = readyKeys.length - this.limits.maxLoaded;
    const toDrop = outside.slice(0, toDropCount);
    for (const key of toDrop) {
      this.states.delete(key);
      this.failures.delete(key);
    }
    return toDrop;
  }

  state(key: string): ChunkState | null {
    return this.states.get(key) ?? null;
  }

  get loaded(): number {
    let count = 0;
    for (const [, state] of this.states) {
      if (state === "ready") {
        count++;
      }
    }
    return count;
  }
}

export function decodeChunk(bytes: Uint8Array): {
  size: number;
  height: number;
  cells: Uint8Array | null;
  error: string | null;
} {
  if (bytes.length < 9) {
    return { size: 0, height: 0, cells: null, error: "Too short" };
  }
  if (bytes[0] !== 83 || bytes[1] !== 77 || bytes[2] !== 67 || bytes[3] !== 75) {
    return { size: 0, height: 0, cells: null, error: "Invalid header" };
  }
  if (bytes[4] !== 1) {
    return { size: 0, height: 0, cells: null, error: "Invalid version" };
  }
  const size = bytes[5] | (bytes[6] << 8);
  const height = bytes[7] | (bytes[8] << 8);
  if (size < 0 || height < 0) {
    return { size, height, cells: null, error: "Invalid size or height" };
  }
  const totalCells = size * height * size;
  if (totalCells < 0) {
    return { size, height, cells: null, error: "Invalid dimensions" };
  }
  const data = bytes.subarray(9);
  const cells = new Uint8Array(totalCells);
  let cellIndex = 0;
  let byteIndex = 0;
  while (byteIndex < data.length) {
    if (byteIndex + 1 >= data.length) {
      return { size, height, cells: null, error: "Truncated RLE data" };
    }
    const value = data[byteIndex];
    const count = data[byteIndex + 1];
    if (count === 0) {
      return { size, height, cells: null, error: "Invalid RLE count 0" };
    }
    if (cellIndex + count > totalCells) {
      return { size, height, cells: null, error: "RLE data overflows cell array" };
    }
    for (let i = 0; i < count; i++) {
      cells[cellIndex + i] = value;
    }
    cellIndex += count;
    byteIndex += 2;
  }
  if (cellIndex !== totalCells) {
    return { size, height, cells: null, error: "RLE data length mismatch" };
  }
  return { size, height, cells, error: null };
}

export function encodeChunk(size: number, height: number, cells: Uint8Array): Uint8Array {
  const pairs: number[] = [];
  let i = 0;
  while (i < cells.length) {
    const value = cells[i];
    let count = 1;
    i++;
    while (i < cells.length && cells[i] === value && count < 255) {
      count++;
      i++;
    }
    pairs.push(value, count);
  }
  const result = new Uint8Array(9 + pairs.length);
  result[0] = 83; // S
  result[1] = 77; // M
  result[2] = 67; // C
  result[3] = 75; // K
  result[4] = 1;
  result[5] = size & 0xff;
  result[6] = (size >> 8) & 0xff;
  result[7] = height & 0xff;
  result[8] = (height >> 8) & 0xff;
  for (let j = 0; j < pairs.length; j++) {
    result[9 + j] = pairs[j];
  }
  return result;
}

export function visibleFaces(size: number, height: number, cells: Uint8Array): [number, number, number, number, number, number] {
  const get = (i: number): number => (i >= 0 && i < cells.length) ? cells[i]! : 0;
  let plusX = 0;
  let minusX = 0;
  let plusY = 0;
  let minusY = 0;
  let plusZ = 0;
  let minusZ = 0;

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < size; x++) {
        const idx = x + size * (y + height * z);
        const val = get(idx);
        if (val === 0) {
          continue;
        }
        if (x + 1 >= size || get(idx + 1) === 0) {
          plusX++;
        }
        if (x - 1 < 0 || get(idx - 1) === 0) {
          minusX++;
        }
        if (y + 1 >= height || get(idx + size) === 0) {
          plusY++;
        }
        if (y - 1 < 0 || get(idx - size) === 0) {
          minusY++;
        }
        if (z + 1 >= size || get(idx + size * height) === 0) {
          plusZ++;
        }
        if (z - 1 < 0 || get(idx - size * height) === 0) {
          minusZ++;
        }
      }
    }
  }
  return [plusX, minusX, plusY, minusY, plusZ, minusZ];
}