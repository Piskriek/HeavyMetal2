import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePak, listPakFiles, readPakEntry } from '../src/pak';

/** Builds a Quake PAK from {path: bytes}. Data goes first, the 64-byte directory last. */
function buildPak(files: Record<string, Uint8Array>): ArrayBuffer {
  const names = Object.keys(files);
  const dataLength = names.reduce((n, k) => n + files[k]!.length, 0);
  const dirOffset = 12 + dataLength;
  const out = new Uint8Array(dirOffset + names.length * 64);
  const view = new DataView(out.buffer);
  out.set([0x50, 0x41, 0x43, 0x4b], 0); // PACK
  view.setInt32(4, dirOffset, true);
  view.setInt32(8, names.length * 64, true);
  let cursor = 12;
  const offsets: number[] = [];
  for (const name of names) {
    offsets.push(cursor);
    out.set(files[name]!, cursor);
    cursor += files[name]!.length;
  }
  names.forEach((name, i) => {
    const pos = dirOffset + i * 64;
    for (let c = 0; c < name.length; c++) out[pos + c] = name.charCodeAt(c);
    view.setInt32(pos + 56, offsets[i]!, true);
    view.setInt32(pos + 60, files[name]!.length, true);
  });
  return out.buffer;
}

describe('@hm/shareware - Quake PAK reader', () => {
  const pakBytes = buildPak({
    'progs/dog.mdl': new Uint8Array([1, 2, 3, 4]),
    'gfx/palette.lmp': new Uint8Array(768).fill(7),
    'maps/start.bsp': new Uint8Array([9, 9]),
  });

  it('lists every entry in directory order', () => {
    const pak = parsePak(pakBytes);
    assert.deepEqual(pak.entries.map((e) => e.name), ['progs/dog.mdl', 'gfx/palette.lmp', 'maps/start.bsp']);
  });

  it('lists the entries under a folder prefix', () => {
    const pak = parsePak(pakBytes);
    assert.deepEqual(listPakFiles(pak, 'progs/'), ['progs/dog.mdl']);
  });

  it('reads entry bytes without copying, and matches paths case-insensitively', () => {
    const pak = parsePak(pakBytes);
    assert.deepEqual([...readPakEntry(pak, 'PROGS/DOG.MDL')!], [1, 2, 3, 4]);
    assert.equal(readPakEntry(pak, 'progs/missing.mdl'), undefined);
    assert.equal(readPakEntry(pak, 'gfx/palette.lmp')!.length, 768);
  });

  it('rejects a bad magic, a bad directory length and entries past the end of the file', () => {
    const bad = new Uint8Array(pakBytes.slice(0));
    bad[0] = 0x58;
    assert.throws(() => parsePak(bad.buffer), /magic/);

    const misaligned = new Uint8Array(pakBytes.slice(0));
    new DataView(misaligned.buffer).setInt32(8, 65, true);
    assert.throws(() => parsePak(misaligned.buffer), /directory/);

    const overrun = new Uint8Array(pakBytes.slice(0));
    const dir = new DataView(overrun.buffer).getInt32(4, true);
    new DataView(overrun.buffer).setInt32(dir + 60, 100000, true);
    assert.throws(() => parsePak(overrun.buffer), /past the end/);
  });
});
