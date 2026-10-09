import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseWad,
  extractPlaypal,
  extractPatch,
  extractSound,
  findSpriteLumps,
} from '../src/wad';

describe('@hm/shareware - DOOM WAD Parser', () => {
  const assetPath = path.resolve('packages/shareware/assets/doom1.wad');
  const buffer = fs.readFileSync(assetPath).buffer;

  it('rejects buffers smaller than 12 bytes', () => {
    assert.throws(() => parseWad(new ArrayBuffer(8)), /Buffer too small/);
  });

  it('rejects buffers with invalid magic', () => {
    const fake = new Uint8Array(16);
    fake.set([0x4e, 0x4f, 0x50, 0x45]); // "NOPE"
    assert.throws(() => parseWad(fake.buffer), /Invalid WAD magic/);
  });

  it('successfully parses doom1.wad as IWAD', () => {
    const wad = parseWad(buffer);
    assert.equal(wad.type, 'IWAD');
    assert.ok(wad.numLumps > 1200, `Expected > 1200 lumps, got ${wad.numLumps}`);
    assert.ok(wad.lumpMap.has('PLAYPAL'));
    assert.ok(wad.lumpMap.has('SARGA1'));
    assert.ok(wad.lumpMap.has('DSSHOTGN'));
  });

  it('extracts PLAYPAL 256-color palette (768 bytes)', () => {
    const wad = parseWad(buffer);
    const pal = extractPlaypal(wad, 0);
    assert.equal(pal.length, 768);
    // First color in Doom palette 0 is black (0, 0, 0)
    assert.equal(pal[0], 0);
    assert.equal(pal[1], 0);
    assert.equal(pal[2], 0);
  });

  it('decodes Demon sprite SARGA1 with valid RGBA pixels', () => {
    const wad = parseWad(buffer);
    const img = extractPatch(wad, 'SARGA1');
    assert.equal(img.width, 40);
    assert.equal(img.height, 56);
    assert.equal(img.leftOffset, 18);
    assert.equal(img.topOffset, 51);
    assert.equal(img.data.length, 40 * 56 * 4);

    let opaqueCount = 0;
    for (let i = 3; i < img.data.length; i += 4) {
      if (img.data[i] === 255) opaqueCount++;
    }
    assert.ok(opaqueCount > 1000, `Expected > 1000 opaque pixels, got ${opaqueCount}`);
  });

  it('decodes DSSHOTGN 8-bit PCM sound lump', () => {
    const wad = parseWad(buffer);
    const snd = extractSound(wad, 'DSSHOTGN');
    assert.equal(snd.format, 3);
    assert.equal(snd.sampleRate, 11025);
    assert.ok(snd.samples > 9000, `Expected > 9000 samples, got ${snd.samples}`);
    assert.equal(snd.data.length, snd.samples);
  });

  it('finds monster sprite lumps by prefix', () => {
    const wad = parseWad(buffer);
    const sargSprites = findSpriteLumps(wad, 'SARG');
    assert.ok(sargSprites.length >= 15);
    assert.ok(sargSprites.includes('SARGA1'));
  });
});
