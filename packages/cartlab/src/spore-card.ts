/** Standard PNG zTXt Spore Cards. Pixel data is never decoded by the importer. */
import { Inflate, zlibSync } from 'fflate';
import { canonicalJson } from '@hm/gamepreset';
import { SporeCardSchema, auditSporeCreation, type SporeCard } from './spore-schema';
export * from './spore-schema';

export const SPORE_KEYWORD = 'hm2:preset:v1';
export const MAX_SPORE_PAYLOAD_BYTES = 256 * 1024;
export const MAX_SPORE_PNG_BYTES = 16 * 1024 * 1024;
export const SPORE_CARD_SIZE = 512;
const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const encoder = new TextEncoder();
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  return c >>> 0;
});
export function pngCrc32(data: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const b of data) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 255]!;
  return (crc ^ 0xffff_ffff) >>> 0;
}
export type SporeCardErrorCode = 'png' | 'crc' | 'missing-preset' | 'payload-limit' | 'compression' | 'schema' | 'audit';
export class SporeCardError extends Error {
  constructor(readonly code: SporeCardErrorCode, message: string) { super(message); this.name = 'SporeCardError'; }
}
function refuse(code: SporeCardErrorCode, message: string): never { throw new SporeCardError(code, message); }
const uint32 = (b: Uint8Array, p: number): number => new DataView(b.buffer, b.byteOffset + p, 4).getUint32(0);
const put32 = (b: Uint8Array, p: number, n: number): void => new DataView(b.buffer, b.byteOffset + p, 4).setUint32(0, n);
const ascii = (b: Uint8Array): string => String.fromCharCode(...b);

export function pngChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z]{4}$/.test(type)) refuse('png', 'Invalid PNG chunk type');
  const out = new Uint8Array(data.length + 12);
  put32(out, 0, data.length); out.set(encoder.encode(type), 4); out.set(data, 8);
  put32(out, data.length + 8, pngCrc32(out.subarray(4, data.length + 8)));
  return out;
}
interface Chunk { readonly type: string; readonly offset: number; readonly data: Uint8Array }
interface PngTable { readonly chunks: readonly Chunk[]; readonly width: number; readonly height: number }
function scanPng(bytes: Uint8Array): PngTable {
  if (bytes.length > MAX_SPORE_PNG_BYTES) refuse('png', 'PNG exceeds the 16 MiB file limit');
  if (bytes.length < 8 || !SIGNATURE.every((v, i) => bytes[i] === v)) refuse('png', 'Not a PNG file');
  const chunks: Chunk[] = [];
  let p = 8, width = 0, height = 0, hasData = false, dataEnded = false, hasPalette = false;
  while (p < bytes.length) {
    if (chunks.length >= 8192 || bytes.length - p < 12) refuse('png', 'Malformed PNG chunk table');
    const size = uint32(bytes, p);
    if (size > bytes.length - p - 12) refuse('png', 'Truncated PNG chunk');
    const type = ascii(bytes.subarray(p + 4, p + 8));
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) refuse('png', 'Malformed PNG chunk type');
    if (pngCrc32(bytes.subarray(p + 4, p + 8 + size)) !== uint32(bytes, p + 8 + size)) refuse('crc', `CRC-32 mismatch in ${type}`);
    const data = bytes.subarray(p + 8, p + 8 + size);
    if (chunks.length === 0 && type !== 'IHDR') refuse('png', 'IHDR must be the first chunk');
    if (type === 'IHDR') {
      if (chunks.length !== 0 || size !== 13) refuse('png', 'Malformed or duplicate IHDR');
      width = uint32(data, 0); height = uint32(data, 4);
      const depths: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!width || !height || width > 8192 || height > 8192 || !depths[data[9]!] ?.includes(data[8]!) || data[10] !== 0 || data[11] !== 0 || data[12]! > 1) refuse('png', 'Invalid PNG image header');
    } else if (type === 'PLTE') {
      if (hasPalette || hasData || size === 0 || size > 768 || size % 3 !== 0) refuse('png', 'Malformed PNG palette');
      hasPalette = true;
    } else if (type === 'IDAT') {
      if (dataEnded) refuse('png', 'Non-contiguous PNG image data');
      hasData = true;
    } else if (type === 'IEND') {
      if (size !== 0 || !hasData || p + 12 !== bytes.length) refuse('png', 'Malformed PNG ending');
      chunks.push({ type, offset: p, data });
      return { chunks, width, height };
    } else if (type[0] === type[0]!.toUpperCase()) refuse('png', `Unknown critical PNG chunk ${type}`);
    if (hasData && type !== 'IDAT') dataEnded = true;
    chunks.push({ type, offset: p, data }); p += size + 12;
  }
  return refuse('png', 'PNG is missing IEND');
}
function presetData(table: PngTable): Uint8Array | null {
  let found: Uint8Array | null = null;
  for (const c of table.chunks) {
    if (c.type !== 'zTXt') continue;
    const zero = c.data.indexOf(0);
    if (zero < 1 || zero > 79 || c.data.length <= zero + 2 || c.data[zero + 1] !== 0) refuse('png', 'Malformed zTXt chunk');
    if (ascii(c.data.subarray(0, zero)) !== SPORE_KEYWORD) continue;
    if (found) refuse('png', 'Ambiguous duplicate Spore payload');
    found = c.data.subarray(zero + 2);
  }
  return found;
}
function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (const n of data) { a = (a + n) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

/**
 * Feed at most 64 compressed bytes per step. Worst-case DEFLATE expansion of a step is bounded (~66 KiB); abort on
 * the very first over-limit callback, not after a multi-megabyte unzlibSync allocation. Only 256 KiB is retained.
 * fflate does not verify the zlib Adler trailer itself, so we do, in addition to each PNG chunk's CRC.
 */
function inflatePreset(data: Uint8Array): Uint8Array {
  if (data.length < 6 || data.length > MAX_SPORE_PAYLOAD_BYTES + 1024) refuse('compression', 'Invalid compressed payload size');
  if ((data[0]! & 15) !== 8 || data[0]! >>> 4 > 7 || ((data[0]! << 8) + data[1]!) % 31 !== 0 || (data[1]! & 32)) refuse('compression', 'Invalid zlib header or external dictionary');
  const out = new Uint8Array(MAX_SPORE_PAYLOAD_BYTES);
  let length = 0;
  const inflate = new Inflate((chunk) => {
    if (length + chunk.length > MAX_SPORE_PAYLOAD_BYTES) refuse('payload-limit', 'Spore payload exceeds 256 KiB');
    out.set(chunk, length); length += chunk.length;
  });
  try {
    const deflate = data.subarray(2, -4);
    for (let i = 0; i < deflate.length; i += 64) inflate.push(deflate.subarray(i, i + 64), i + 64 >= deflate.length);
    // fflate 0.8.3's public streaming API tolerates bytes after BFINAL. Check its bounded
    // unread tail as well: only the partially consumed final byte (DEFLATE padding) may remain.
    // Keep the dependency pinned and the trailing-stream regression tests when upgrading it.
    const end = inflate as unknown as { s: { f: number; l: unknown; p: number }; p: Uint8Array };
    if (end.s.f !== 1 || end.s.l || end.p.length !== (end.s.p ? 1 : 0)) refuse('compression', 'Trailing or incomplete DEFLATE stream');
  } catch (e) {
    if (e instanceof SporeCardError) throw e;
    refuse('compression', 'Invalid or truncated zlib payload');
  }
  const result = out.subarray(0, length);
  if (adler32(result) !== uint32(data, data.length - 4)) refuse('compression', 'Zlib checksum mismatch');
  return result;
}
function validateCard(value: unknown): SporeCard {
  const parsed = SporeCardSchema.safeParse(value);
  if (!parsed.success) refuse('schema', parsed.error.message);
  try { auditSporeCreation(parsed.data.creation); }
  catch (e) { refuse('audit', e instanceof Error ? e.message : 'studio.kit.audit refused this creation'); }
  return parsed.data;
}
export interface EncodeSporeCardOptions {
  readonly card: SporeCard;
  /** A 512 x 512 PNG captured by the shared offscreen renderer (the web wrapper supplies it automatically). */
  readonly beautyPng: Uint8Array;
}
export function encodeSporeCardPng(options: EncodeSporeCardOptions): Uint8Array<ArrayBuffer> {
  const card = validateCard(options.card);
  const raw = encoder.encode(canonicalJson(card));
  if (raw.length > MAX_SPORE_PAYLOAD_BYTES) refuse('payload-limit', 'Spore payload exceeds 256 KiB');
  const table = scanPng(options.beautyPng);
  if (table.width !== SPORE_CARD_SIZE || table.height !== SPORE_CARD_SIZE) refuse('png', 'Spore beauty render must be 512 x 512');
  if (presetData(table)) refuse('png', 'Beauty PNG already contains a Spore payload');
  const compressed = zlibSync(raw, { level: 9 });
  const keyword = encoder.encode(SPORE_KEYWORD);
  const textData = new Uint8Array(keyword.length + 2 + compressed.length);
  textData.set(keyword); // the two zero bytes are the keyword separator and compression method 0 (zlib)
  textData.set(compressed, keyword.length + 2);
  const chunk = pngChunk('zTXt', textData);
  const beforeEnd = table.chunks[table.chunks.length - 1]!.offset;
  const result = new Uint8Array(options.beautyPng.length + chunk.length);
  if (result.length > MAX_SPORE_PNG_BYTES) refuse('png', 'Encoded PNG exceeds the 16 MiB file limit');
  result.set(options.beautyPng.subarray(0, beforeEnd)); result.set(chunk, beforeEnd);
  result.set(options.beautyPng.subarray(beforeEnd), beforeEnd + chunk.length);
  return result;
}

export type SporePngInput = Blob | ArrayBuffer | Uint8Array;
export async function decodeSporeCardPng(fileOrBuffer: SporePngInput): Promise<SporeCard> {
  let bytes: Uint8Array;
  if (fileOrBuffer instanceof Uint8Array) bytes = fileOrBuffer;
  else if (fileOrBuffer instanceof ArrayBuffer) bytes = new Uint8Array(fileOrBuffer);
  else if (typeof Blob !== 'undefined' && fileOrBuffer instanceof Blob) {
    if (fileOrBuffer.size > MAX_SPORE_PNG_BYTES) refuse('png', 'PNG exceeds the 16 MiB file limit');
    bytes = new Uint8Array(await fileOrBuffer.arrayBuffer());
  } else return refuse('png', 'Expected a PNG file or byte buffer');
  const compressed = presetData(scanPng(bytes));
  if (!compressed) return refuse('missing-preset', 'This PNG has no hm2:preset:v1 Spore Card');
  const raw = inflatePreset(compressed);
  let json: unknown;
  try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch { return refuse('schema', 'Spore payload is not valid UTF-8 JSON'); }
  return validateCard(json);
}
