// ============================================================================
// File: packages/presetcodec/src/smx-cartridge-card.ts
// Plan: Plan 20 (P2-STUDIO-06 One-Click .smx Cartridge & Scene Bundle Codec < 4 KB)
// Purity: 100% pure deterministic functions for @hm/presetcodec.
// ============================================================================

export const SMX_MAGIC_HEADER = 'SMX1';
export const MAX_SMX_PAYLOAD_BYTES = 4096; // Strict 4 KB cap

export interface SmxCartridgeBundle {
  version: 1;
  id: string;
  title: string;
  author: string;
  dominantMetric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq' | 'Mix';
  macroSliders: {
    primaryHueDeg: number;
    grainScale: number;
    weatheringMoss: number;
    roughness: number;
    bumpDepth: number;
  };
  fusedParentIds?: [string, string];
  socketOverrides?: Array<{
    socketId: string;
    pos: [number, number, number];
    rotDeg: [number, number, number];
  }>;
}

/**
 * Encodes an SmxCartridgeBundle into a compact UTF-8 Uint8Array with "SMX1" header (< 4 KB).
 */
export function encodeSmxBundle(bundle: SmxCartridgeBundle): Uint8Array {
  const json = JSON.stringify(bundle);
  const payload = `${SMX_MAGIC_HEADER}${json}`;
  const bytes = new TextEncoder().encode(payload);
  if (bytes.byteLength > MAX_SMX_PAYLOAD_BYTES) {
    throw new Error(
      `SMX bundle exceeds 4 KB limit (${bytes.byteLength} > ${MAX_SMX_PAYLOAD_BYTES} bytes)`
    );
  }
  return bytes;
}

/**
 * Decodes and validates an SmxCartridgeBundle from a dropped .smx Uint8Array buffer.
 */
export function decodeSmxBundle(bytes: Uint8Array): SmxCartridgeBundle {
  if (bytes.byteLength < 6 || bytes.byteLength > MAX_SMX_PAYLOAD_BYTES) {
    throw new Error(`Invalid .smx payload size: ${bytes.byteLength} bytes`);
  }
  const text = new TextDecoder().decode(bytes);
  if (!text.startsWith(SMX_MAGIC_HEADER)) {
    throw new Error('Invalid .smx magic header (expected SMX1)');
  }
  const parsed = JSON.parse(text.slice(SMX_MAGIC_HEADER.length)) as SmxCartridgeBundle;
  if (parsed.version !== 1 || !parsed.id || !parsed.dominantMetric) {
    throw new Error('Malformed .smx bundle schema');
  }
  return parsed;
}
