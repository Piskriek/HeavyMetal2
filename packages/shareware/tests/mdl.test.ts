import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMdl,
  layoutMdlMesh,
  mdlVertexNormals,
  mdlSignedVolume,
  mdlQuakeToGltf,
  mdlSkinRgba,
  framesWithPrefix,
  MDL_IDENT,
} from '../src/mdl';

/**
 * A tiny Quake MDL built in code: 4 vertices (a tetrahedron), a 2x2 skin, one simple frame ("stand"),
 * and one frame group ("walk1", "walk2") with intervals 0.2 and 0.3. Scale 2, origin -1, so byte b decodes to 2b - 1.
 */
function buildMdl(): ArrayBuffer {
  const bytes: number[] = [];
  const f32 = (v: number) => {
    const b = new Uint8Array(new Float32Array([v]).buffer);
    bytes.push(...b);
  };
  const i32 = (v: number) => {
    const b = new Uint8Array(new Int32Array([v]).buffer);
    bytes.push(...b);
  };
  const name16 = (s: string) => {
    for (let i = 0; i < 16; i++) bytes.push(i < s.length ? s.charCodeAt(i) : 0);
  };
  const vertex = (x: number, y: number, z: number) => bytes.push(x, y, z, 0);

  // header (84 bytes)
  i32(MDL_IDENT);
  i32(6);
  f32(2); f32(2); f32(2); // scale
  f32(-1); f32(-1); f32(-1); // origin
  f32(10); // bounding radius
  f32(0); f32(0); f32(0); // eye position
  i32(1); // skins
  i32(2); i32(2); // skin width and height
  i32(4); // vertices
  i32(4); // triangles
  i32(2); // frames
  i32(0); // sync type
  i32(0); // flags
  f32(0); // size
  // skin: group 0, then 4 palette indices
  i32(0);
  bytes.push(0, 1, 2, 3);
  // texcoords (onseam, s, t): vertex 1 is on the seam
  const tc: [number, number, number][] = [[0, 0, 0], [1, 1, 0], [0, 0, 1], [0, 1, 1]];
  for (const [seam, s, t] of tc) { i32(seam); i32(s); i32(t); }
  // triangles (facesfront, a, b, c): tri 1 is back-facing and touches the seam vertex
  const tris: [number, number, number, number][] = [[1, 0, 1, 2], [0, 1, 2, 3], [1, 0, 2, 3], [1, 0, 1, 3]];
  for (const [front, a, b, c] of tris) { i32(front); i32(a); i32(b); i32(c); }
  // frame 0: simple, name "stand"
  i32(0);
  bytes.push(0, 0, 0, 0, 0, 0, 0, 0); // bounding box
  name16('stand');
  vertex(0, 0, 0); vertex(2, 0, 0); vertex(0, 2, 0); vertex(0, 0, 2);
  // frame 1: a group of two, intervals 0.2 and 0.3
  i32(1);
  i32(2);
  bytes.push(0, 0, 0, 0, 0, 0, 0, 0);
  f32(0.2); f32(0.3);
  bytes.push(0, 0, 0, 0, 0, 0, 0, 0); name16('walk1'); vertex(1, 1, 1); vertex(1, 1, 1); vertex(1, 1, 1); vertex(1, 1, 1);
  bytes.push(0, 0, 0, 0, 0, 0, 0, 0); name16('walk2'); vertex(3, 0, 0); vertex(0, 3, 0); vertex(0, 0, 3); vertex(0, 0, 0);
  return new Uint8Array(bytes).buffer;
}

describe('@hm/shareware - Quake MDL reader (synthetic model)', () => {
  const model = parseMdl(buildMdl());

  it('reads the header, the skin and the topology', () => {
    assert.deepEqual([...model.scale], [2, 2, 2]);
    assert.deepEqual([...model.origin], [-1, -1, -1]);
    assert.equal(model.skinWidth, 2);
    assert.equal(model.skinHeight, 2);
    assert.deepEqual([...model.skin], [0, 1, 2, 3]);
    assert.equal(model.skinCount, 1);
    assert.equal(model.texCoords.length, 4);
    assert.equal(model.triangles.length, 4);
    assert.deepEqual([...model.triangles[1]!.v], [1, 2, 3]);
    assert.equal(model.triangles[1]!.facesFront, false);
  });

  it('decodes frames in file order: a simple frame, then a group with its own intervals', () => {
    assert.deepEqual(model.frames.map((f) => f.name), ['stand', 'walk1', 'walk2']);
    assert.deepEqual(model.frames.map((f) => Math.round(f.interval * 100) / 100), [0.1, 0.2, 0.3]);
    // byte 2 decodes to 2 * 2 - 1 = 3, byte 0 to -1
    assert.deepEqual([...model.frames[0]!.positions.slice(0, 3)], [-1, -1, -1]);
    assert.deepEqual([...model.frames[0]!.positions.slice(3, 6)], [3, -1, -1]);
    assert.deepEqual([...model.frames[2]!.positions.slice(0, 3)], [5, -1, -1]);
  });

  it('finds the frames of an animation by name prefix', () => {
    assert.deepEqual(framesWithPrefix(model, 'walk'), [1, 2]);
    assert.deepEqual(framesWithPrefix(model, 'death'), []);
  });

  it('expands the mesh: one GPU vertex per (vertex, seam side), with the back seam shifted half a skin', () => {
    const layout = layoutMdlMesh(model);
    // vertex 1 appears twice (front and back of the seam), the others once each: 5 in all
    assert.equal(layout.sourceIndex.length, 5);
    assert.equal(layout.indices.length, 12);
    const backOfSeam = [...layout.sourceIndex].map((src, i) => ({ src, u: layout.uv[i * 2]!, v: layout.uv[i * 2 + 1]! }))
      .filter((x) => x.src === 1);
    assert.equal(backOfSeam.length, 2);
    const us = backOfSeam.map((x) => x.u).sort((a, b) => a - b);
    // front: s = 1 gives (1.5 / 2); back: s = 1 + 1 gives (2.5 / 2)
    assert.ok(Math.abs(us[0]! - 0.75) < 1e-6);
    assert.ok(Math.abs(us[1]! - 1.25) < 1e-6);
  });

  it('computes unit vertex normals and a non-zero enclosed volume', () => {
    const normals = mdlVertexNormals(new Float32Array(model.frames[0]!.positions), model.triangles.flatMap((t) => [...t.v]));
    for (let i = 0; i < 4; i++) {
      const len = Math.hypot(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!);
      assert.ok(Math.abs(len - 1) < 1e-5, `normal ${i} has length ${len}`);
    }
    // a unit tetrahedron with outward winding has volume 1/6 (the synthetic model's own winding is not closed)
    const unit = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    assert.ok(Math.abs(mdlSignedVolume(unit, [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]) - 1 / 6) < 1e-6);
  });

  it('turns Quake axes into glTF axes as a proper rotation (forward becomes -z, left becomes -x)', () => {
    assert.deepEqual(mdlQuakeToGltf(1, 0, 0), [0, 0, -1]);
    assert.deepEqual(mdlQuakeToGltf(0, 1, 0), [-1, 0, 0]);
    assert.deepEqual(mdlQuakeToGltf(0, 0, 1), [0, 1, 0]);
  });

  it('converts a palette skin to RGBA with full alpha', () => {
    const palette = new Uint8Array(768);
    palette.set([255, 0, 0], 3); // index 1 is red
    const rgba = mdlSkinRgba(new Uint8Array([1, 0]), palette);
    assert.deepEqual([...rgba], [255, 0, 0, 255, 0, 0, 0, 255]);
  });

  it('rejects a wrong ident, a wrong version and truncated data', () => {
    const good = new Uint8Array(buildMdl());
    const badIdent = good.slice();
    badIdent[0] = 0x00;
    assert.throws(() => parseMdl(badIdent.buffer), /ident/);
    const badVersion = good.slice();
    new DataView(badVersion.buffer).setInt32(4, 5, true);
    assert.throws(() => parseMdl(badVersion.buffer), /version/);
    assert.throws(() => parseMdl(good.slice(0, 200).buffer), /ends early/);
  });
});
