/**
 * Pure TypeScript Quake 1 MDL reader (format version 6, "IDPO"). No I/O and no Three.js:
 * the caller passes the bytes (for example from `readPakEntry` on a LibreQuake pak).
 *
 * What it gives:
 *  - the palette-indexed skin (first image, or the first image of an animated skin);
 *  - texture coordinates with the back-facing seam shift applied by `layoutMdlMesh`;
 *  - the triangles and every frame, decoded to model space (Quake axes: x forward, y left, z up);
 *  - normals: computed from the faces (`computeVertexNormals`), not the anorm table.
 *
 * The file layout (all little-endian):
 *   header (84 bytes), skins, texcoords (12 bytes each), triangles (16 bytes each), frames.
 *   A vertex is 4 bytes: three position bytes and a normal index byte. The position is v * scale + origin.
 */

export const MDL_IDENT = 0x4f504449; // "IDPO"
export const MDL_VERSION = 6;
const HEADER_BYTES = 84;
const TRIVERT_BYTES = 4;
const FRAME_NAME_BYTES = 16;
/** Quake plays model animation at 10 frames per second unless a group gives its own intervals. */
const DEFAULT_FRAME_INTERVAL = 0.1;

export interface MdlTexCoord {
  readonly onSeam: boolean;
  readonly s: number;
  readonly t: number;
}

export interface MdlTriangle {
  readonly facesFront: boolean;
  /** Indices into the model's vertex list. */
  readonly v: readonly [number, number, number];
}

export interface MdlFrame {
  readonly name: string;
  /** Seconds this frame stays on screen (a group's interval, else 0.1). */
  readonly interval: number;
  /** Decoded positions in model space, x0 y0 z0 x1 y1 z1 ... */
  readonly positions: Float32Array;
}

export interface MdlModel {
  readonly scale: readonly [number, number, number];
  readonly origin: readonly [number, number, number];
  readonly boundingRadius: number;
  readonly skinWidth: number;
  readonly skinHeight: number;
  /** Palette indices of the first skin image, row by row, skinWidth * skinHeight bytes. */
  readonly skin: Uint8Array;
  /** How many skin images the file holds (more than 1 means an animated skin; only the first is read). */
  readonly skinCount: number;
  readonly texCoords: readonly MdlTexCoord[];
  readonly triangles: readonly MdlTriangle[];
  readonly frames: readonly MdlFrame[];
  readonly syncType: number;
  readonly flags: number;
}

class Reader {
  private readonly view: DataView;
  private pos: number;

  constructor(buffer: ArrayBuffer, pos: number) {
    this.view = new DataView(buffer);
    this.pos = pos;
  }

  private need(bytes: number): void {
    if (this.pos + bytes > this.view.byteLength) {
      throw new Error('MDL data ends early');
    }
  }

  int32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  float32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  uint8(): number {
    this.need(1);
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  bytes(count: number): Uint8Array {
    this.need(count);
    const out = new Uint8Array(this.view.buffer, this.pos, count);
    this.pos += count;
    return out;
  }

  skip(count: number): void {
    this.need(count);
    this.pos += count;
  }

  name16(): string {
    this.need(FRAME_NAME_BYTES);
    let name = '';
    for (let c = 0; c < FRAME_NAME_BYTES; c++) {
      const code = this.view.getUint8(this.pos + c);
      if (code === 0) break;
      name += String.fromCharCode(code);
    }
    this.pos += FRAME_NAME_BYTES;
    return name;
  }
}

/** Reads one trivertx (3 position bytes and a normal index) and returns the raw bytes. */
function readVertexBytes(r: Reader, numVerts: number): Uint8Array {
  return r.bytes(numVerts * TRIVERT_BYTES);
}

function decodeFrame(
  raw: Uint8Array,
  numVerts: number,
  scale: readonly [number, number, number],
  origin: readonly [number, number, number]
): Float32Array {
  const out = new Float32Array(numVerts * 3);
  for (let i = 0; i < numVerts; i++) {
    for (let k = 0; k < 3; k++) {
      out[i * 3 + k] = raw[i * TRIVERT_BYTES + k]! * scale[k]! + origin[k]!;
    }
  }
  return out;
}

/** Parses a Quake 1 MDL file. Throws on a wrong ident or version, or on truncated data. */
export function parseMdl(buffer: ArrayBuffer): MdlModel {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error('Buffer too small to be a Quake MDL');
  }
  const h = new Reader(buffer, 0);
  const ident = h.int32();
  if (ident !== MDL_IDENT) {
    throw new Error(`Invalid MDL ident: 0x${(ident >>> 0).toString(16)}`);
  }
  const version = h.int32();
  if (version !== MDL_VERSION) {
    throw new Error(`Unsupported MDL version ${version} (need ${MDL_VERSION})`);
  }
  const scale: [number, number, number] = [h.float32(), h.float32(), h.float32()];
  const origin: [number, number, number] = [h.float32(), h.float32(), h.float32()];
  const boundingRadius = h.float32();
  h.skip(12); // eye position
  const numSkins = h.int32();
  const skinWidth = h.int32();
  const skinHeight = h.int32();
  const numVerts = h.int32();
  const numTris = h.int32();
  const numFrames = h.int32();
  const syncType = h.int32();
  const flags = h.int32();
  h.float32(); // size

  if (numSkins < 0 || skinWidth <= 0 || skinHeight <= 0 || numVerts <= 0 || numTris <= 0 || numFrames <= 0) {
    throw new Error('MDL header has an impossible size');
  }

  const r = new Reader(buffer, HEADER_BYTES);
  const skinBytes = skinWidth * skinHeight;
  let firstSkin: Uint8Array | undefined;
  let skinCount = 0;
  for (let s = 0; s < numSkins; s++) {
    const group = r.int32();
    if (group === 0) {
      const img = r.bytes(skinBytes);
      firstSkin ??= img;
      skinCount++;
    } else {
      const n = r.int32();
      if (n <= 0) throw new Error('MDL skin group is empty');
      r.skip(n * 4); // intervals
      for (let k = 0; k < n; k++) {
        const img = r.bytes(skinBytes);
        firstSkin ??= img;
        skinCount++;
      }
    }
  }
  if (!firstSkin) {
    throw new Error('MDL has no skin');
  }

  const texCoords: MdlTexCoord[] = [];
  for (let i = 0; i < numVerts; i++) {
    const onSeam = r.int32() !== 0;
    const s = r.int32();
    const t = r.int32();
    texCoords.push({ onSeam, s, t });
  }

  const triangles: MdlTriangle[] = [];
  for (let i = 0; i < numTris; i++) {
    const facesFront = r.int32() !== 0;
    const a = r.int32();
    const b = r.int32();
    const c = r.int32();
    for (const idx of [a, b, c]) {
      if (idx < 0 || idx >= numVerts) throw new Error('MDL triangle indexes a missing vertex');
    }
    triangles.push({ facesFront, v: [a, b, c] });
  }

  const frames: MdlFrame[] = [];
  for (let f = 0; f < numFrames; f++) {
    const type = r.int32();
    if (type === 0) {
      r.skip(8); // bounding box
      const name = r.name16();
      const raw = readVertexBytes(r, numVerts);
      frames.push({
        name,
        interval: DEFAULT_FRAME_INTERVAL,
        positions: decodeFrame(raw, numVerts, scale, origin),
      });
    } else {
      const n = r.int32();
      if (n <= 0) throw new Error('MDL frame group is empty');
      r.skip(8); // group bounding box
      const intervals: number[] = [];
      for (let k = 0; k < n; k++) intervals.push(r.float32());
      for (let k = 0; k < n; k++) {
        r.skip(8);
        const name = r.name16();
        const raw = readVertexBytes(r, numVerts);
        frames.push({
          name,
          interval: intervals[k] && intervals[k]! > 0 ? intervals[k]! : DEFAULT_FRAME_INTERVAL,
          positions: decodeFrame(raw, numVerts, scale, origin),
        });
      }
    }
  }

  return {
    scale,
    origin,
    boundingRadius,
    skinWidth,
    skinHeight,
    skin: firstSkin,
    skinCount,
    texCoords,
    triangles,
    frames,
    syncType,
    flags,
  };
}

/**
 * Expands the mesh so each unique (vertex, seam side) pair is one GPU vertex.
 * Back-facing triangles on a seam sample the right half of the skin (s + skinWidth / 2), as Quake does.
 * `sourceIndex` maps each expanded vertex back to its model vertex, so every frame's positions gather from it.
 */
export interface MdlMeshLayout {
  /** For each expanded vertex, the model vertex it copies (length: vertex count). */
  readonly sourceIndex: Uint32Array;
  /** Per expanded vertex, [u, v] in 0 to 1 (length: 2 per vertex). */
  readonly uv: Float32Array;
  /** Triangle indices into the expanded vertices (length: 3 per triangle). */
  readonly indices: Uint32Array;
}

export function layoutMdlMesh(model: MdlModel): MdlMeshLayout {
  const keyToOut = new Map<number, number>();
  const sourceIndex: number[] = [];
  const uv: number[] = [];
  const indices = new Uint32Array(model.triangles.length * 3);
  const halfWidth = model.skinWidth / 2;

  model.triangles.forEach((tri, t) => {
    for (let c = 0; c < 3; c++) {
      const vi = tri.v[c]!;
      const tc = model.texCoords[vi]!;
      const back = !tri.facesFront && tc.onSeam;
      const key = vi * 2 + (back ? 1 : 0);
      let out = keyToOut.get(key);
      if (out === undefined) {
        out = sourceIndex.length;
        keyToOut.set(key, out);
        sourceIndex.push(vi);
        const s = back ? tc.s + halfWidth : tc.s;
        uv.push((s + 0.5) / model.skinWidth, (tc.t + 0.5) / model.skinHeight);
      }
      indices[t * 3 + c] = out;
    }
  });

  return {
    sourceIndex: Uint32Array.from(sourceIndex),
    uv: Float32Array.from(uv),
    indices,
  };
}

/** The signed volume of a closed mesh. Positive means the triangles wind outward (counter-clockwise from outside). */
export function mdlSignedVolume(positions: Float32Array, indices: ArrayLike<number>): number {
  let v = 0;
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i]! * 3;
    const b = indices[i + 1]! * 3;
    const c = indices[i + 2]! * 3;
    const ax = positions[a]!, ay = positions[a + 1]!, az = positions[a + 2]!;
    const bx = positions[b]!, by = positions[b + 1]!, bz = positions[b + 2]!;
    const cx = positions[c]!, cy = positions[c + 1]!, cz = positions[c + 2]!;
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

/**
 * Smooth vertex normals from the faces, one per position, normalised.
 * `positions` holds one entry per vertex (3 floats); `indices` are triangles into those vertices.
 */
export function mdlVertexNormals(positions: Float32Array, indices: ArrayLike<number>): Float32Array {
  const count = positions.length / 3;
  const normals = new Float32Array(count * 3);
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i]! * 3;
    const b = indices[i + 1]! * 3;
    const c = indices[i + 2]! * 3;
    const e1x = positions[b]! - positions[a]!, e1y = positions[b + 1]! - positions[a + 1]!, e1z = positions[b + 2]! - positions[a + 2]!;
    const e2x = positions[c]! - positions[a]!, e2y = positions[c + 1]! - positions[a + 1]!, e2z = positions[c + 2]! - positions[a + 2]!;
    // area-weighted face normal (the cross product is not normalised)
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const k of [a, b, c]) {
      normals[k] = normals[k]! + nx;
      normals[k + 1] = normals[k + 1]! + ny;
      normals[k + 2] = normals[k + 2]! + nz;
    }
  }
  for (let i = 0; i < count; i++) {
    const x = normals[i * 3]!, y = normals[i * 3 + 1]!, z = normals[i * 3 + 2]!;
    const len = Math.hypot(x, y, z);
    if (len > 0) {
      normals[i * 3] = x / len;
      normals[i * 3 + 1] = y / len;
      normals[i * 3 + 2] = z / len;
    } else {
      normals[i * 3 + 2] = 1;
    }
  }
  return normals;
}

/** Quake axes to glTF axes: right is +x, up is +y, forward is -z (a proper rotation, so windings stay). */
export function mdlQuakeToGltf(x: number, y: number, z: number): [number, number, number] {
  // 0 - v rather than -v: a negated zero would print as -0
  return [0 - y, z, 0 - x];
}

/**
 * Converts a 768-byte RGB palette and a palette-indexed skin to RGBA (alpha 255 everywhere).
 * Quake model skins have no transparent index.
 */
export function mdlSkinRgba(indices: Uint8Array, palette: Uint8Array): Uint8Array {
  if (palette.length < 768) {
    throw new Error('Palette must be 768 bytes (256 RGB triples)');
  }
  const out = new Uint8Array(indices.length * 4);
  for (let i = 0; i < indices.length; i++) {
    const p = indices[i]! * 3;
    out[i * 4] = palette[p]!;
    out[i * 4 + 1] = palette[p + 1]!;
    out[i * 4 + 2] = palette[p + 2]!;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** The frame indices whose names start with `prefix` (for example "walk" gives walk1, walk2 ...), in file order. */
export function framesWithPrefix(model: MdlModel, prefix: string): number[] {
  const lower = prefix.toLowerCase();
  const out: number[] = [];
  model.frames.forEach((f, i) => {
    if (f.name.toLowerCase().startsWith(lower)) out.push(i);
  });
  return out;
}
