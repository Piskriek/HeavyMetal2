import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWad, parseSpriteLumpName, spriteViewsForFrame } from '../src/wad';

/** A PWAD whose lumps are all empty: enough to test the directory and the sprite names. */
function buildWad(names: string[]): ArrayBuffer {
  const dirOffset = 12;
  const out = new Uint8Array(dirOffset + names.length * 16);
  const view = new DataView(out.buffer);
  out.set([0x50, 0x57, 0x41, 0x44], 0); // PWAD
  view.setInt32(4, names.length, true);
  view.setInt32(8, dirOffset, true);
  names.forEach((name, i) => {
    const pos = dirOffset + i * 16;
    view.setInt32(pos, dirOffset, true);
    view.setInt32(pos + 4, 0, true);
    for (let c = 0; c < name.length; c++) out[pos + 8 + c] = name.charCodeAt(c);
  });
  return out.buffer;
}

describe('@hm/shareware - sprite lump names and rotations', () => {
  it('parses a single view, a mirrored pair and a rotation-0 view', () => {
    assert.deepEqual(parseSpriteLumpName('TROOA1'), { base: 'TROO', frame: 'A', rotation: 1 });
    assert.deepEqual(parseSpriteLumpName('TROOA2A8'), { base: 'TROO', frame: 'A', rotation: 2, frame2: 'A', rotation2: 8 });
    assert.deepEqual(parseSpriteLumpName('TROOH0'), { base: 'TROO', frame: 'H', rotation: 0 });
  });

  it('rejects names that are not sprites', () => {
    assert.equal(parseSpriteLumpName('E1M1'), undefined);
    assert.equal(parseSpriteLumpName('TROO'), undefined);
    assert.equal(parseSpriteLumpName('TROOA9'), undefined);
  });

  it('fills the eight views of a frame, flagging the mirrored ones instead of duplicating them', () => {
    const wad = parseWad(buildWad(['TROOA1', 'TROOA2A8', 'TROOA3A7', 'TROOB0', 'SKULA8A2', 'BSPIA1D1']));
    const a = spriteViewsForFrame(wad, 'TROO', 'A');
    assert.equal(a.length, 8);
    assert.deepEqual(a[0], { lump: 'TROOA1', mirrored: false });
    assert.deepEqual(a[1], { lump: 'TROOA2A8', mirrored: false });
    assert.deepEqual(a[7], { lump: 'TROOA2A8', mirrored: true });
    assert.deepEqual(a[2], { lump: 'TROOA3A7', mirrored: false });
    assert.deepEqual(a[6], { lump: 'TROOA3A7', mirrored: true });
    assert.equal(a[3], undefined, 'rotation 4 has no lump');

    const b = spriteViewsForFrame(wad, 'TROO', 'B');
    assert.ok(b.every((v) => v?.lump === 'TROOB0' && v.mirrored === false), 'rotation 0 fills every slot');
  });

  it('mirrors the second pair of a lump of the same frame, and reads a pair from another frame letter as a plain view', () => {
    const wad = parseWad(buildWad(['SKULA8A2', 'BSPIA1D1']));
    const skul = spriteViewsForFrame(wad, 'SKUL', 'A');
    assert.deepEqual(skul[7], { lump: 'SKULA8A2', mirrored: false });
    assert.deepEqual(skul[1], { lump: 'SKULA8A2', mirrored: true });

    const bspi = spriteViewsForFrame(wad, 'BSPI', 'D');
    assert.deepEqual(bspi[0], { lump: 'BSPIA1D1', mirrored: false });
  });
});
