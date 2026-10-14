import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSmxPngCardSvgDataUrl,
  decodeSmxCartridgeBundle,
  decodeSmxFromPngTextChunk,
  encodeSmxCartridgeBundle,
  encodeSmxWithPngTextChunk,
  type SmxCartridgeBundle,
} from '../src/smx-cartridge-card';

test('round-trips both binary SMX1 bundles and PNG tEXt metadata chunks', () => {
  const bundle: SmxCartridgeBundle = {
    version: 1,
    id: 'cart-golden-canopy',
    title: 'Golden Canopy Mix',
    author: 'Francois',
    primaryMetric: 'Mix',
    macroSliders: {
      primaryHueDeg: 95,
      grainScale: 0.4,
      weatheringMoss: 0.85,
      roughness: 0.6,
      bumpDepth: 0.55,
    },
    fusedFromIds: ['cart-grass-01', 'cart-amber-02'],
  };

  assert.deepEqual(decodeSmxCartridgeBundle(encodeSmxCartridgeBundle(bundle)), bundle);
  const { pngTextChunkPayload } = encodeSmxWithPngTextChunk(bundle);
  assert.deepEqual(decodeSmxFromPngTextChunk(pngTextChunkPayload), bundle);
  assert.ok(buildSmxPngCardSvgDataUrl(bundle).startsWith('data:image/svg+xml;base64,'));
});
