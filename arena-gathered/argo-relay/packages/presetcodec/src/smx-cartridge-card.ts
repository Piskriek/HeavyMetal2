// ============================================================================
// File: packages/presetcodec/src/smx-cartridge-card.ts
// Plan: Plan 20 (P2-STUDIO-06 .smx Binary & PNG Cartridge Card Drag-and-Drop Codec)
// Purity: 100% pure TypeScript Uint8Array / DataView manipulation.
// ============================================================================

export interface SmxCartridgePayload {
  version: 1;
  id: string;
  name: string;
  metric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq' | 'Mix';
  hexColor: string;
  macros: {
    primaryHueDeg: number;
    grainScale: number;
    weatheringMoss: number;
    roughness: number;
    bumpDepth: number;
  };
  authorCallsign: string;
}

const SMX_MAGIC = 'SMX1';
const PNG_TEXT_KEYWORD = 'FIDELITY_SMX';

export function encodeSmxBinary(payload: SmxCartridgePayload): Uint8Array {
  const json = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const body = encoder.encode(json);
  const out = new Uint8Array(4 + body.length);
  for (let i = 0; i < 4; i++) {
    out[i] = SMX_MAGIC.charCodeAt(i);
  }
  out.set(body, 4);
  return out;
}

export function decodeSmxBinary(bytes: Uint8Array): SmxCartridgePayload {
  if (bytes.length < 5) {
    throw new Error('Invalid .smx binary: too short');
  }
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== SMX_MAGIC) {
    throw new Error(`Invalid .smx magic header: expected ${SMX_MAGIC}, got ${magic}`);
  }
  const decoder = new TextDecoder();
  const json = decoder.decode(bytes.subarray(4));
  return JSON.parse(json) as SmxCartridgePayload;
}

/**
 * Embeds a base64-encoded .smx payload inside a PNG buffer as an ancillary tEXt chunk
 * right before IEND, creating a shareable drag-and-drop "Cartridge Card" PNG.
 */
export function embedSmxInPngCard(
  pngBytes: Uint8Array,
  payload: SmxCartridgePayload
): Uint8Array {
  const smxBytes = encodeSmxBinary(payload);
  let base64 = '';
  for (let i = 0; i < smxBytes.length; i++) {
    base64 += String.fromCharCode(smxBytes[i]);
  }
  const encodedText = `${PNG_TEXT_KEYWORD}\0${btoa(base64)}`;
  const textBytes = new TextEncoder().encode(encodedText);

  // Build tEXt chunk: [4B length][4B 'tEXt'][data][4B CRC32]
  const chunk = new Uint8Array(12 + textBytes.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, textBytes.length, false);
  chunk[4] = 0x74; // 't'
  chunk[5] = 0x45; // 'E'
  chunk[6] = 0x58; // 'X'
  chunk[7] = 0x74; // 't'
  chunk.set(textBytes, 8);
  view.setUint32(8 + textBytes.length, crc32(chunk.subarray(4, 8 + textBytes.length)), false);

  // Insert right before the final 12-byte IEND chunk
  const iendOffset = Math.max(8, pngBytes.length - 12);
  const result = new Uint8Array(pngBytes.length + chunk.length);
  result.set(pngBytes.subarray(0, iendOffset), 0);
  result.set(chunk, iendOffset);
  result.set(pngBytes.subarray(iendOffset), iendOffset + chunk.length);
  return result;
}

/**
 * Extracts a SmxCartridgePayload from a PNG Cartridge Card buffer.
 */
export function extractSmxFromPngCard(pngBytes: Uint8Array): SmxCartridgePayload | null {
  const decoder = new TextDecoder();
  const raw = decoder.decode(pngBytes);
  const marker = `${PNG_TEXT_KEYWORD}\0`;
  const idx = raw.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  let end = start;
  while (end < raw.length && /[A-Za-z0-9+/=]/.test(raw[end])) {
    end++;
  }
  const b64 = raw.slice(start, end);
  const binStr = atob(b64);
  const smxBytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    smxBytes[i] = binStr.charCodeAt(i);
  }
  return decodeSmxBinary(smxBytes);
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}
