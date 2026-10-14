// ============================================================================
// File: packages/presetcodec/src/smx-cartridge-card.ts
// Fix: Merged File 41 and File 74 into one unified module keeping both APIs,
// with every Uint8Array index read guarded for noUncheckedIndexedAccess.
// ============================================================================

export const SMX_MAGIC_HEADER = 'SMX1';
export const SMX_MAX_BYTE_LENGTH = 4096;
export const PNG_TEXT_KEYWORD = 'SMX_CARTRIDGE_V1';

export interface SmxCartridgeBundle {
  version: 1;
  id: string;
  title: string;
  author: string;
  primaryMetric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq' | 'Mix';
  macroSliders: {
    primaryHueDeg: number;
    grainScale: number;
    weatheringMoss: number;
    roughness: number;
    bumpDepth: number;
  };
  fusedFromIds?: [string, string];
}

export function encodeSmxCartridgeBundle(bundle: SmxCartridgeBundle): Uint8Array {
  const json = JSON.stringify(bundle);
  const payload = new TextEncoder().encode(json);
  const out = new Uint8Array(4 + payload.byteLength);
  out[0] = 0x53; // 'S'
  out[1] = 0x4d; // 'M'
  out[2] = 0x58; // 'X'
  out[3] = 0x31; // '1'
  out.set(payload, 4);
  if (out.byteLength > SMX_MAX_BYTE_LENGTH) {
    throw new Error(`SMX bundle exceeds 4KB limit (${out.byteLength} bytes)`);
  }
  return out;
}

export function decodeSmxCartridgeBundle(bytes: Uint8Array): SmxCartridgeBundle {
  if (
    bytes.byteLength < 5 ||
    (bytes[0] ?? 0) !== 0x53 ||
    (bytes[1] ?? 0) !== 0x4d ||
    (bytes[2] ?? 0) !== 0x58 ||
    (bytes[3] ?? 0) !== 0x31
  ) {
    throw new Error('Invalid SMX1 header');
  }
  const json = new TextDecoder().decode(bytes.subarray(4));
  return JSON.parse(json) as SmxCartridgeBundle;
}

export function buildSmxPngCardSvgDataUrl(bundle: SmxCartridgeBundle): string {
  const colorByMetric: Record<SmxCartridgeBundle['primaryMetric'], string> = {
    Pxd: '#ff3d8a',
    Vtx: '#7cff4d',
    Lx: '#ffc13d',
    Aq: '#3dc8ff',
    Mix: '#b46bff',
  };
  const accent = colorByMetric[bundle.primaryMetric];
  const b64 = Buffer.from(encodeSmxCartridgeBundle(bundle)).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" data-smx-b64="${b64}">
    <rect width="320" height="180" fill="#0d1118" stroke="${accent}" stroke-width="4"/>
    <text x="20" y="36" fill="${accent}" font-family="monospace" font-size="12">SETMIX CARTRIDGE // ${bundle.primaryMetric}</text>
    <text x="20" y="72" fill="#e8eef5" font-family="sans-serif" font-size="20" font-weight="bold">${bundle.title}</text>
    <text x="20" y="152" fill="#8fa3b8" font-family="monospace" font-size="11">BY ${bundle.author.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function encodeSmxWithPngTextChunk(
  bundle: SmxCartridgeBundle
): {
  smxBytes: Uint8Array;
  pngTextChunkPayload: string;
} {
  const smxBytes = encodeSmxCartridgeBundle(bundle);
  let binary = '';
  for (let i = 0; i < smxBytes.byteLength; i++) {
    binary += String.fromCharCode(smxBytes[i] ?? 0);
  }
  const b64 = Buffer.from(binary, 'binary').toString('base64');
  return {
    smxBytes,
    pngTextChunkPayload: `${PNG_TEXT_KEYWORD}:${b64}`,
  };
}

export function decodeSmxFromPngTextChunk(payload: string): SmxCartridgeBundle {
  const prefix = `${PNG_TEXT_KEYWORD}:`;
  if (!payload.startsWith(prefix)) {
    throw new Error('Missing SMX_CARTRIDGE_V1 PNG tEXt prefix');
  }
  const b64 = payload.slice(prefix.length);
  const buf = Buffer.from(b64, 'base64');
  return decodeSmxCartridgeBundle(new Uint8Array(buf));
}
