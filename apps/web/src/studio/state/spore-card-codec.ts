/**
 * @file apps/web/src/studio/state/spore-card-codec.ts
 * ARGO_STUDIO_CLEANUP_DIRECTIVE.md (Q10 & Loop B Step 6):
 * Lossless 512x512 PNG Spore Card Encoder/Decoder with embedded `zTXt` & `tEXt` metadata chunks
 * and deterministic Stargate Network Dialing Address (`@hm/coopnet`).
 *
 * Pure TypeScript, zero DOM/external dependencies, deterministic.
 */

export type StargateAccessMode = 'open' | 'code-only' | 'closed';
export type BiomeFormulaId = 'lunar-basalt' | 'terran-forest' | 'volcanic-crag' | 'toxic-basin';

export interface WorldPlacementEntry {
  readonly instanceId: string;
  readonly kitId: string;
  readonly label: string;
  readonly position: readonly [number, number, number];
  readonly rotationYDeg: number;
  readonly grounded: boolean;
}

export interface SporeCardPayload {
  readonly schema: 'fidelity.spore.v1';
  readonly kind: 'world' | 'machine-kit' | 'material';
  readonly title: string;
  readonly author: string;
  readonly dialingAddress: string;
  readonly stargateAccess: StargateAccessMode;
  readonly world?: {
    readonly id: string;
    readonly seed: number;
    readonly biome: BiomeFormulaId;
    readonly floats: { readonly pxd: number; readonly vtx: number; readonly lx: number; readonly aq: number };
    readonly sunElevationDeg: number;
    readonly sunAzimuthDeg: number;
    readonly placements: readonly WorldPlacementEntry[];
  };
  readonly activeKitId: string;
  readonly activeMaterialId: string;
  readonly anatomyAuditPassed: boolean;
}

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const DIAL_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Precomputed IEEE 802.3 CRC-32 table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Wraps raw bytes in a valid RFC-1950 zlib stream using uncompressed DEFLATE stored blocks (method = 8). */
function zlibStoreCompress(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + numBlocks * 5 + raw.length + 4);
  // Zlib header: CMF = 0x78 (deflate, 32K window), FLG = 0x01 (check bits so 0x7801 % 31 === 0)
  out[0] = 0x78;
  out[1] = 0x01;
  let pos = 2;
  for (let b = 0; b < numBlocks; b += 1) {
    const start = b * maxBlock;
    const end = Math.min(raw.length, start + maxBlock);
    const len = end - start;
    const nlen = (~len) & 0xffff;
    const isFinal = b === numBlocks - 1 ? 1 : 0;
    out[pos++] = isFinal;
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    out[pos++] = nlen & 0xff;
    out[pos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(start, end), pos);
    pos += len;
  }
  const adler = adler32(raw);
  out[pos++] = (adler >>> 24) & 0xff;
  out[pos++] = (adler >>> 16) & 0xff;
  out[pos++] = (adler >>> 8) & 0xff;
  out[pos++] = adler & 0xff;
  return out;
}

/** Decompresses a zlib-stored stream produced by `zlibStoreCompress`. */
function zlibStoreDecompress(z: Uint8Array): Uint8Array | null {
  if (z.length < 6 || z[0] !== 0x78) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let pos = 2;
  while (pos + 5 <= z.length - 4) {
    const header = z[pos++]!;
    const isFinal = (header & 1) === 1;
    const btype = (header >>> 1) & 3;
    if (btype !== 0) return null;
    const len = z[pos]! | (z[pos + 1]! << 8);
    pos += 4; // skip len + nlen
    if (pos + len > z.length - 4) return null;
    const slice = z.subarray(pos, pos + len);
    chunks.push(slice);
    total += len;
    pos += len;
    if (isFinal) break;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function writeU32BE(dst: Uint8Array, offset: number, val: number): void {
  dst[offset] = (val >>> 24) & 0xff;
  dst[offset + 1] = (val >>> 16) & 0xff;
  dst[offset + 2] = (val >>> 8) & 0xff;
  dst[offset + 3] = val & 0xff;
}

function readU32BE(src: Uint8Array, offset: number): number {
  return (
    ((src[offset]! << 24) |
      (src[offset + 1]! << 16) |
      (src[offset + 2]! << 8) |
      src[offset + 3]!) >>>
    0
  );
}

function makePngChunk(typeAscii: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32BE(chunk, 0, data.length);
  for (let i = 0; i < 4; i += 1) {
    chunk[4 + i] = typeAscii.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeU32BE(chunk, 8 + data.length, crc);
  return chunk;
}

/**
 * Computes a deterministic Stargate Network Dialing Address (`SG-XXXX-XX`) from any world seed or JSON string.
 */
export function computeStargateAddress(input: string | number): string {
  const str = String(input);
  const bytes = new TextEncoder().encode(str);
  let h1 = crc32(bytes);
  let h2 = adler32(bytes) ^ (h1 >>> 3);
  const chars: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const idx = ((i < 4 ? h1 : h2) >>> ((i % 4) * 5)) & 31;
    chars.push(DIAL_ALPHABET[idx]!);
  }
  return `SG-${chars.slice(0, 4).join('')}-${chars.slice(4, 6).join('')}`;
}

/**
 * Encodes a `SporeCardPayload` into a lossless PNG binary (`Uint8Array`) containing:
 * - `IHDR` (width x height, 8-bit RGBA)
 * - `zTXt` chunk (`keyword = "fidelity.spore"`, compression method 0 = deflate, zlib-compressed JSON)
 * - `tEXt` chunk (`keyword = "fidelity.address"`, Stargate dialing address)
 * - `IDAT` chunk (procedural dark-telemetry Spore Card beauty portrait with metric ring)
 * - `IEND` chunk
 */
export function encodeSporeCardPng(
  payload: SporeCardPayload,
  width = 64,
  height = 64,
): Uint8Array {
  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 6; // color type 6 = RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Build zTXt chunk: keyword ("fidelity.spore") + 0x00 + compression_method (0) + zlib_stream
  const keyword = new TextEncoder().encode('fidelity.spore');
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressedJson = zlibStoreCompress(jsonBytes);
  const ztxtData = new Uint8Array(keyword.length + 2 + compressedJson.length);
  ztxtData.set(keyword, 0);
  ztxtData[keyword.length] = 0; // null separator
  ztxtData[keyword.length + 1] = 0; // compression method 0 (deflate)
  ztxtData.set(compressedJson, keyword.length + 2);

  // Build tEXt chunk for quick inspection: "fidelity.address\0" + dialingAddress
  const addrKey = new TextEncoder().encode('fidelity.address');
  const addrVal = new TextEncoder().encode(payload.dialingAddress);
  const textData = new Uint8Array(addrKey.length + 1 + addrVal.length);
  textData.set(addrKey, 0);
  textData[addrKey.length] = 0;
  textData.set(addrVal, addrKey.length + 1);

  // Build procedural RGBA scanlines (filter byte 0 per row + width * 4 RGBA bytes)
  const rawScanlines = new Uint8Array(height * (1 + width * 4));
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxR = Math.min(width, height) * 0.42;

  for (let y = 0; y < height; y += 1) {
    const rowOff = y * (1 + width * 4);
    rawScanlines[rowOff] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x += 1) {
      const pxOff = rowOff + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const ring = Math.abs(r - maxR) < 2.2;
      const core = r < maxR * 0.65;
      rawScanlines[pxOff] = ring ? 255 : core ? 45 : 18;
      rawScanlines[pxOff + 1] = ring ? 193 : core ? 95 : 24;
      rawScanlines[pxOff + 2] = ring ? 61 : core ? 140 : 34;
      rawScanlines[pxOff + 3] = 255;
    }
  }
  const idatData = zlibStoreCompress(rawScanlines);

  const cIhdr = makePngChunk('IHDR', ihdr);
  const cZtxt = makePngChunk('zTXt', ztxtData);
  const cText = makePngChunk('tEXt', textData);
  const cIdat = makePngChunk('IDAT', idatData);
  const cIend = makePngChunk('IEND', new Uint8Array(0));

  const totalLen =
    PNG_SIG.length + cIhdr.length + cZtxt.length + cText.length + cIdat.length + cIend.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of [PNG_SIG, cIhdr, cZtxt, cText, cIdat, cIend]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/**
 * Decodes and CRC-verifies a PNG binary (`Uint8Array`), extracting the lossless `SporeCardPayload`
 * from its embedded `zTXt` (`fidelity.spore`) chunk.
 */
export function decodeSporeCardPng(pngBytes: Uint8Array): SporeCardPayload | null {
  if (pngBytes.length < 32) return null;
  for (let i = 0; i < PNG_SIG.length; i += 1) {
    if (pngBytes[i] !== PNG_SIG[i]) return null;
  }

  let pos = 8;
  while (pos + 12 <= pngBytes.length) {
    const len = readU32BE(pngBytes, pos);
    if (pos + 12 + len > pngBytes.length) return null;
    const type = String.fromCharCode(
      pngBytes[pos + 4]!,
      pngBytes[pos + 5]!,
      pngBytes[pos + 6]!,
      pngBytes[pos + 7]!,
    );
    const data = pngBytes.subarray(pos + 8, pos + 8 + len);
    const expectedCrc = readU32BE(pngBytes, pos + 8 + len);
    const actualCrc = crc32(pngBytes.subarray(pos + 4, pos + 8 + len));
    if (expectedCrc !== actualCrc) return null;

    if (type === 'zTXt') {
      let nullIdx = -1;
      for (let i = 0; i < data.length; i += 1) {
        if (data[i] === 0) {
          nullIdx = i;
          break;
        }
      }
      if (nullIdx > 0 && nullIdx + 2 <= data.length) {
        const key = new TextDecoder().decode(data.subarray(0, nullIdx));
        if (key === 'fidelity.spore') {
          const zStream = data.subarray(nullIdx + 2);
          const rawJsonBytes = zlibStoreDecompress(zStream);
          if (!rawJsonBytes) return null;
          try {
            const parsed = JSON.parse(new TextDecoder().decode(rawJsonBytes)) as SporeCardPayload;
            if (parsed && parsed.schema === 'fidelity.spore.v1') {
              return parsed;
            }
          } catch {
            return null;
          }
        }
      }
    }
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  return null;
}
