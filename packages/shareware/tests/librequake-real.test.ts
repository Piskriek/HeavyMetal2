import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parsePak, readPakEntry } from '../src/pak';
import { parseMdl, framesWithPrefix, layoutMdlMesh } from '../src/mdl';

// The real LibreQuake progs/dog.mdl, when the archive is on this machine (zips/ is not in git).
const pakFile = path.resolve('zips/monsters/librequake/lite/id1/pak0.pak');
const exists = fs.existsSync(pakFile);

describe('@hm/shareware - real LibreQuake progs/dog.mdl', { skip: !exists && 'zips/monsters/librequake not present' }, () => {
  it('parses the dog model from pak0', () => {
    const buf = fs.readFileSync(pakFile);
    const pak = parsePak(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const bytes = readPakEntry(pak, 'progs/dog.mdl');
    assert.ok(bytes, 'progs/dog.mdl in pak0');
    const model = parseMdl(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    assert.equal(model.frames.length, 86);
    assert.equal(model.triangles.length, 367);
    assert.equal(model.texCoords.length, 303);
    assert.equal(model.skinWidth, 256);
    assert.equal(model.skinHeight, 256);
    const layout = layoutMdlMesh(model);
    assert.ok(layout.sourceIndex.length >= 303);
    // LibreQuake names its frames frame1..frame86, so there are no walk/attack names to find
    assert.deepEqual(framesWithPrefix(model, 'walk'), []);
  });
});
