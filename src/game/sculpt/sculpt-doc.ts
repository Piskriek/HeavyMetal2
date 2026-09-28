/**
 * NewSculpt — what a sculpt looks like in a save.
 *
 * The scenery is generated from code on every load and the Meshy models are shared between copies,
 * so a sculpt can never be "the mesh": it is a **sparse displacement layer** over the generated shape,
 * re-applied when the object exists again. Per mesh: the indices that moved (sorted, delta-varint
 * coded), their local-space offsets as int16 multiples of `quantum` (0.25 units → ±8 000 units of
 * reach at 0.125 precision; a lane is 240), and optionally the vertices that were painted with their
 * RGB. Everything base64, so it rides inside a `PlacedProp` (`prop.sculpt`) through the normal save.
 *
 * Sizes: a 5 000-vertex hill sculpt is ~40 KB; the whole alpine heightfield (4 800 vertices) fully
 * reshaped is ~45 KB. localStorage is 5 MB, and the disk backups have no such limit.
 *
 * No three.js, no DOM (`btoa`/`atob` are globals in browsers and Node ≥ 16).
 */

export const SCULPT_DOC_VERSION = 1;
/** Local units per int16 step of a stored offset. */
export const SCULPT_QUANTUM = 0.25;

export interface SculptMeshDoc {
  /** Which mesh under the object: traversal index, name and vertex count. */
  readonly key: string;
  /** Vertex count when written; a mesh that changed size refuses the doc instead of misplacing it. */
  readonly n: number;
  /**
   * Local units per stored step for this mesh, when not the doc's `quantum`: a quarter of a world unit
   * divided by the mesh's scale, so a unit-sized model scaled up (the island terrain is 1 unit wide at
   * 50 000×) keeps its strokes instead of rounding every offset to zero.
   */
  readonly q?: number;
  readonly shape?: { readonly idx: string; readonly d: string };
  readonly paint?: { readonly idx: string; readonly c: string };
}

export interface SculptDoc {
  readonly version: typeof SCULPT_DOC_VERSION;
  readonly quantum: number;
  readonly meshes: readonly SculptMeshDoc[];
  readonly hash: string;
}

/* -----------------------------------------------------------------------------
   base64
   -------------------------------------------------------------------------- */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/* -----------------------------------------------------------------------------
   Codecs
   -------------------------------------------------------------------------- */
/** Sorted vertex indices as LEB128 deltas (a run of neighbours costs one byte each). */
export function encodeIndices(sorted: ArrayLike<number>): string {
  const out: number[] = [];
  let prev = -1;
  for (let k = 0; k < sorted.length; k++) {
    let v = sorted[k] - prev - 1;
    prev = sorted[k];
    while (v >= 0x80) { out.push((v & 0x7f) | 0x80); v >>>= 7; }
    out.push(v);
  }
  return bytesToBase64(Uint8Array.from(out));
}

export function decodeIndices(text: string): Uint32Array {
  const bytes = base64ToBytes(text);
  const out: number[] = [];
  let prev = -1, v = 0, shift = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    v |= (b & 0x7f) << shift;
    if (b & 0x80) { shift += 7; continue; }
    prev = prev + v + 1;
    out.push(prev);
    v = 0; shift = 0;
  }
  return Uint32Array.from(out);
}

export function encodeInt16(values: ArrayLike<number>): string {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(values[i]))), true);
  return bytesToBase64(bytes);
}

export function decodeInt16(text: string): Int16Array {
  const bytes = base64ToBytes(text);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Int16Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true);
  return out;
}

export const encodeBytes = (bytes: Uint8Array) => bytesToBase64(bytes);
export const decodeBytes = (text: string) => base64ToBytes(text);

/* -----------------------------------------------------------------------------
   The document
   -------------------------------------------------------------------------- */
export function sculptHash(meshes: readonly SculptMeshDoc[], quantum: number): string {
  let h = 2166136261;
  const feed = (text: string) => { for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } };
  feed(String(quantum));
  for (const m of meshes) {
    feed(m.key); feed(String(m.n));
    if (m.shape) { feed(m.shape.idx); feed(m.shape.d); }
    if (m.paint) { feed(m.paint.idx); feed(m.paint.c); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** A document from per-mesh parts, or null when nothing moved or was painted. */
export function makeSculptDoc(meshes: readonly SculptMeshDoc[], quantum = SCULPT_QUANTUM): SculptDoc | null {
  const kept = meshes.filter((m) => m.shape || m.paint);
  if (!kept.length) return null;
  return { version: SCULPT_DOC_VERSION, quantum, meshes: kept, hash: sculptHash(kept, quantum) };
}

export function isSculptDoc(value: unknown): value is SculptDoc {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<SculptDoc>;
  return d.version === SCULPT_DOC_VERSION && typeof d.quantum === 'number' && Array.isArray(d.meshes) && typeof d.hash === 'string';
}

/** Rough size of a document in a JSON save (the base64 dominates). */
export function sculptDocBytes(doc: SculptDoc): number {
  let n = 64;
  for (const m of doc.meshes) {
    n += m.key.length + 24;
    if (m.shape) n += m.shape.idx.length + m.shape.d.length;
    if (m.paint) n += m.paint.idx.length + m.paint.c.length;
  }
  return n;
}
