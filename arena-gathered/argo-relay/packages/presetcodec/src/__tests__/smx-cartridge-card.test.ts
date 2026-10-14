// ============================================================================
// File: packages/presetcodec/src/__tests__/smx-cartridge-card.test.ts
// Plan: Plan 20 (P2-STUDIO-06 Unit Tests for .smx & PNG Cartridge Cards)
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  decodeSmxBinary,
  embedSmxInPngCard,
  encodeSmxBinary,
  extractSmxFromPngCard,
  type SmxCartridgePayload,
} from '../smx-cartridge-card';

const SAMPLE_PAYLOAD: SmxCartridgePayload = {
  version: 1,
  id: 'golden-master-04',
  name: 'Sector 04 Golden Master',
  metric: 'Mix',
  hexColor: '#b46bff',
  macros: {
    primaryHueDeg: 140,
    grainScale: 1.2,
    weatheringMoss: 0.65,
    roughness: 0.45,
    bumpDepth: 1.1,
  },
  authorCallsign: 'Operator Astro',
};

describe('.smx Binary & PNG Cartridge Card Codec (P2-STUDIO-06)', () => {
  it('round-trips .smx binary under 4 KB', () => {
    const bytes = encodeSmxBinary(SAMPLE_PAYLOAD);
    expect(bytes.byteLength).toBeLessThan(4096);
    const decoded = decodeSmxBinary(bytes);
    expect(decoded).toEqual(SAMPLE_PAYLOAD);
  });

  it('embeds and extracts a .smx payload inside a PNG Cartridge Card buffer', () => {
    // Minimal 20-byte mock PNG header + IEND trailer
    const mockPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const cardPng = embedSmxInPngCard(mockPng, SAMPLE_PAYLOAD);
    const extracted = extractSmxFromPngCard(cardPng);
    expect(extracted).toEqual(SAMPLE_PAYLOAD);
  });
});
