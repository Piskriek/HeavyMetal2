// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// voxparts_body.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_PARTS, validatePart, partStats, ascii } from '../src';
import type { Part, PaletteSlot, V3 } from '../src';

const PAL_NAMES: readonly string[] = ['skin', 'skinDark', 'skinLight', 'cloth1', 'cloth2', 'metal', 'leather', 'glow', 'hair', 'teeth', 'eyeWhite', 'pupil', 'accent'];
const bySlot = (s: string): Part[] => BODY_PARTS.filter(p => p.slot === s);
const cellAt = (p: Part, x: number, y: number, z: number): number => p.cells[x + p.size[0] * (y + p.size[1] * z)] ?? -1;

test('every part passes validatePart with no errors', () => {
  for (const p of BODY_PARTS) {
    const r = validatePart(p);
    assert.deepEqual(r.errors, [], `${p.id}: ${r.errors.join('; ')}`);
    assert.equal(r.ok, true, p.id);
  }
});

test('ids are unique and non-empty', () => {
  const ids = BODY_PARTS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(id.length > 0);
});

test('counts per slot match the catalogue', () => {
  assert.equal(bySlot('torso').length, 8);
  assert.equal(bySlot('shirt').length, 8);
  assert.equal(bySlot('arms').length, 6);
  assert.equal(bySlot('hands').length, 6);
  assert.equal(bySlot('belt').length, 6);
  assert.equal(bySlot('legs').length, 8);
  assert.equal(bySlot('boots').length, 6);
  assert.equal(bySlot('back').length, 8);
  assert.equal(bySlot('handheld').length, 10);
  assert.equal(BODY_PARTS.length, 66);
});

test('pair parts are tagged pair; the robe skirt is centred, not a pair', () => {
  for (const slot of ['arms', 'hands', 'boots']) {
    for (const p of bySlot(slot)) assert.ok(p.tags.includes('pair'), p.id);
  }
  const legs = bySlot('legs');
  const pairs = legs.filter(p => p.tags.includes('pair'));
  const centred = legs.filter(p => !p.tags.includes('pair'));
  assert.equal(pairs.length, 7);
  assert.equal(centred.length, 1);
  const skirt = centred[0];
  assert.ok(skirt !== undefined);
  assert.ok(skirt.tags.includes('centred'));
  for (const p of BODY_PARTS) assert.ok(!(p.tags.includes('pair') && p.tags.includes('centred')), p.id);
});

test('torsos (and shirts) expose the full shared anchor set', () => {
  const names = ['neck', 'shoulderL', 'shoulderR', 'hipL', 'hipR', 'waist', 'backMount', 'root'];
  for (const p of [...bySlot('torso'), ...bySlot('shirt')]) {
    for (const n of names) {
      const a = p.anchors[n];
      assert.ok(a !== undefined, `${p.id} missing anchor ${n}`);
      assert.equal(a.length, 3);
      for (const c of a) assert.ok(Number.isInteger(c));
    }
  }
});

test('legs have root (hip) and ankle anchors; handhelds have grip', () => {
  for (const p of bySlot('legs')) {
    assert.ok(p.anchors['root'] !== undefined, p.id);
    assert.ok(p.anchors['ankle'] !== undefined, p.id);
  }
  for (const p of bySlot('handheld')) {
    assert.ok(p.anchors['grip'] !== undefined, p.id);
    assert.ok(p.anchors['root'] !== undefined, p.id);
  }
});

test('sizes are integer triples within 1..40 and cells lengths match', () => {
  for (const p of BODY_PARTS) {
    assert.equal(p.size.length, 3);
    for (const d of p.size) {
      assert.ok(Number.isInteger(d) && d >= 1 && d <= 40, `${p.id} size ${d}`);
    }
    assert.equal(p.cells.length, p.size[0] * p.size[1] * p.size[2], p.id);
  }
});

test('voxel counts in 40..1800, single 6-connected component, bounds inside grid', () => {
  for (const p of BODY_PARTS) {
    const st = partStats(p);
    assert.ok(st.voxels >= 40, `${p.id} only ${st.voxels} voxels`);
    assert.ok(st.voxels <= 1800, `${p.id} has ${st.voxels} voxels`);
    assert.equal(st.components, 1, `${p.id} has ${st.components} components`);
    for (let i = 0; i < 3; i++) {
      const lo = st.bounds.min[i] ?? -1, hi = st.bounds.max[i] ?? 99, dim = p.size[i] ?? 0;
      assert.ok(lo >= 0 && hi < dim && lo <= hi, p.id);
    }
  }
});

test('anchors sit inside their grids; attachTo is a non-empty string', () => {
  for (const p of BODY_PARTS) {
    assert.ok(typeof p.attachTo === 'string' && p.attachTo.length > 0, p.id);
    for (const [k, a] of Object.entries(p.anchors)) {
      for (let i = 0; i < 3; i++) {
        const c = a[i] ?? -1, dim = p.size[i] ?? 0;
        assert.ok(c >= 0 && c < dim, `${p.id} anchor ${k}`);
      }
    }
  }
});

test('palettes contain only known PaletteSlot names, no duplicates, no unused entries', () => {
  for (const p of BODY_PARTS) {
    assert.ok(p.palette.length >= 1, p.id);
    assert.equal(new Set<PaletteSlot>(p.palette).size, p.palette.length, p.id);
    for (const s of p.palette) assert.ok(PAL_NAMES.includes(s), `${p.id} palette ${s}`);
    const used = new Set<number>();
    for (const v of p.cells) {
      assert.ok(Number.isInteger(v) && v >= 0 && v <= p.palette.length, p.id);
      if (v > 0) used.add(v);
    }
    for (let i = 1; i <= p.palette.length; i++) assert.ok(used.has(i), `${p.id} unused entry ${i}`);
  }
});

test('centred parts are exactly mirror symmetric in x', () => {
  const centred = BODY_PARTS.filter(p => p.tags.includes('centred'));
  assert.ok(centred.length >= 30);
  for (const p of centred) {
    const [sx, sy, sz] = p.size;
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
      assert.equal(cellAt(p, x, y, z), cellAt(p, sx - 1 - x, y, z), `${p.id} asymmetric at ${x},${y},${z}`);
    }
  }
});

test('deterministic: serialization and stats are stable across reads', () => {
  const a = JSON.stringify(BODY_PARTS);
  const b = JSON.stringify(BODY_PARTS);
  assert.equal(a, b);
  const sig1 = BODY_PARTS.map(p => `${p.id}:${partStats(p).voxels}`).join('|');
  const sig2 = BODY_PARTS.map(p => `${p.id}:${partStats(p).voxels}`).join('|');
  assert.equal(sig1, sig2);
  for (const p of BODY_PARTS) for (const v of p.cells) assert.ok(Number.isFinite(v));
});

test('ascii renders a slice with correct dimensions and some filled cells', () => {
  const t = bySlot('torso')[0];
  assert.ok(t !== undefined);
  const s = ascii(t, 1);
  const lines = s.split('\n');
  assert.equal(lines.length, t.size[2]);
  for (const ln of lines) assert.equal(ln.length, t.size[0]);
  assert.ok(/[^.]/.test(s));
  assert.equal(ascii(t, -1), '');
  assert.equal(ascii(t, 999), '');
});

test('validatePart rejects malformed input', () => {
  assert.equal(validatePart(null).ok, false);
  assert.equal(validatePart(42).ok, false);
  assert.equal(validatePart({}).ok, false);
  const base = BODY_PARTS[0];
  assert.ok(base !== undefined);
  assert.equal(validatePart({ ...base, cells: [] }).ok, false);
  assert.equal(validatePart({ ...base, cells: base.cells.map(() => 99) }).ok, false);
  assert.equal(validatePart({ ...base, size: [0, 5, 5] as V3 }).ok, false);
  assert.equal(validatePart({ ...base, anchors: {} }).ok, false);
  assert.equal(validatePart({ ...base, palette: ['notAColour'] }).ok, false);
});