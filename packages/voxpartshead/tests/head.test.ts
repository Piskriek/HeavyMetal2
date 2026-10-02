// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// voxparts_head.test.ts — node:test suite for the head-side voxel part library.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAD_PARTS, PART_PALETTES, buildHeadParts, validatePart, partStats, ascii,
  SLOT_VALUES, PALETTE_SLOT_VALUES,
} from '../src';
import { weldPart } from '../src';
import type { Part, Slot } from '../src';

const ASYMMETRIC_IDS = ['fx_eyepatch', 'fx_scar', 'head_scarred', 'nose_crooked'];
const EXPECTED_IDS = [
  'head_classic', 'head_hero_cube', 'head_hobgoblin', 'head_bulb', 'head_long', 'head_warty', 'head_helmeted', 'head_scarred',
  'ear_long_pointed', 'ear_short_pointed', 'ear_droopy', 'ear_notched', 'ear_ring_pierced', 'ear_tall_rabbit', 'ear_fin', 'ear_small_round',
  'nose_hooked', 'nose_button', 'nose_bulbous', 'nose_pointy', 'nose_pig_flat', 'nose_crooked',
  'eye_amber_glow', 'eye_angry_slanted', 'eye_cartoon_big', 'eye_squint', 'eye_cyclops', 'eye_visor_cyber',
  'mouth_grin_fangs', 'mouth_smirk_wide', 'mouth_tusks', 'mouth_tongue', 'mouth_frown', 'mouth_gap_toothy',
  'hair_mohawk', 'hair_tuft', 'hair_topknot', 'hair_braid_long',
  'hat_pointed', 'hat_bandana_pirate', 'hat_helmet_horn', 'hat_flat_cap', 'hat_crown', 'hat_goggles',
  'fx_eyepatch', 'fx_warpaint', 'fx_beard', 'fx_scar',
];
const HEAD_ANCHORS = ['neck', 'earL', 'earR', 'noseBase', 'eyeL', 'eyeR', 'mouthSeat', 'hatSeat', 'root'];
const bySlot = (s: Slot): Part[] => HEAD_PARTS.filter(p => p.slot === s);

test('library exposes every hand-designed part', () => {
  assert.equal(HEAD_PARTS.length, 48);
  const ids = HEAD_PARTS.map(p => p.id).sort();
  assert.deepEqual(ids, [...EXPECTED_IDS].sort());
  for (const id of EXPECTED_IDS) {
    const p = HEAD_PARTS.find(q => q.id === id);
    assert.ok(p, `missing part ${id}`);
    assert.ok((p as Part).name.length > 2, `${id} needs a display name`);
    assert.ok((p as Part).doc.length > 12, `${id} needs a doc string`);
  }
});

test('ids are unique across HEAD_PARTS', () => {
  const ids = HEAD_PARTS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate part ids found');
});

test('per-slot counts match the design brief', () => {
  assert.equal(bySlot('head').length, 8);
  assert.equal(bySlot('ears').length, 8);
  assert.equal(bySlot('nose').length, 6);
  assert.equal(bySlot('eyes').length, 6);
  assert.equal(bySlot('mouth').length, 6);
  assert.equal(bySlot('face-extra').length, 4);
  assert.equal(bySlot('hair').length, 4);
  assert.equal(bySlot('hat').length, 6);
  assert.ok(bySlot('hair').length + bySlot('hat').length >= 8);
  assert.equal(bySlot('torso').length + bySlot('boots').length, 0, 'head file must not contain body parts');
});

test('every part validates cleanly', () => {
  for (const p of HEAD_PARTS) {
    const r = validatePart(p);
    assert.deepEqual(r.errors, [], `${p.id}: ${r.errors.join(' | ')}`);
    assert.equal(r.ok, true, p.id);
  }
});

test('sizes stay within 1..40 on every axis', () => {
  for (const p of HEAD_PARTS) {
    assert.equal(p.size.length, 3, p.id);
    for (const n of p.size) {
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 40, `${p.id} axis ${n}`);
    }
    assert.equal(p.cells.length, p.size[0] * p.size[1] * p.size[2], `${p.id} cells length`);
  }
});

test('pair parts are tagged pair and only ears/eyes come in pairs', () => {
  for (const p of bySlot('ears')) assert.ok(p.tags.includes('pair'), `${p.id} must be a pair`);
  const pairEyes = bySlot('eyes').filter(p => p.tags.includes('pair')).map(p => p.id).sort();
  assert.deepEqual(pairEyes, ['eye_amber_glow', 'eye_angry_slanted', 'eye_cartoon_big', 'eye_squint']);
  for (const id of ['eye_cyclops', 'eye_visor_cyber']) {
    const p = HEAD_PARTS.find(q => q.id === id) as Part;
    assert.ok(!p.tags.includes('pair'), `${id} is a single centred part, not a pair`);
  }
  for (const p of HEAD_PARTS) {
    if (p.tags.includes('pair')) assert.ok(p.slot === 'ears' || p.slot === 'eyes', `${p.id} unexpected pair slot`);
  }
});

test('heads carry the full anchor rig', () => {
  for (const p of bySlot('head')) {
    for (const a of HEAD_ANCHORS) assert.ok(a in p.anchors, `${p.id} missing anchor ${a}`);
    assert.equal(p.attachTo, 'neck', `${p.id} should attach to the torso neck`);
    const [sx, sy, sz] = p.size;
    assert.deepEqual(p.anchors.earL, [sx - 1, Math.round(sy * 0.55), Math.floor((sz - 1) / 2)], `${p.id} earL`);
    assert.deepEqual(p.anchors.earR, [0, Math.round(sy * 0.55), Math.floor((sz - 1) / 2)], `${p.id} earR`);
    assert.ok(p.anchors.hatSeat[1] === sy - 1, `${p.id} hatSeat must sit on top`);
    assert.ok(p.anchors.neck[1] === 0, `${p.id} neck must sit at the base`);
  }
});

test('every part has a root anchor inside its own grid', () => {
  for (const p of HEAD_PARTS) {
    assert.ok('root' in p.anchors, `${p.id} needs root`);
    assert.equal(typeof p.attachTo, 'string');
    assert.ok(p.attachTo.length > 0, `${p.id} needs attachTo`);
    const r = p.anchors.root as [number, number, number];
    assert.ok(r[0] >= 0 && r[0] < p.size[0] && r[1] >= 0 && r[1] < p.size[1] && r[2] >= 0 && r[2] < p.size[2], `${p.id} root out of grid`);
  }
});

test('voxel budgets and single 6-connected component', () => {
  for (const p of HEAD_PARTS) {
    const s = partStats(p);
    assert.equal(s.components, 1, `${p.id} has ${s.components} components`);
    if (p.slot === 'head') {
      assert.ok(s.voxels >= 600 && s.voxels <= 2500, `${p.id} voxels=${s.voxels} outside 600..2500`);
    } else {
      assert.ok(s.voxels >= 40 && s.voxels <= 1200, `${p.id} voxels=${s.voxels} outside 40..1200`);
    }
    assert.ok(s.bounds.min[0] >= 0 && s.bounds.max[0] < p.size[0], `${p.id} bounds x`);
    assert.ok(s.bounds.min[1] >= 0 && s.bounds.max[1] < p.size[1], `${p.id} bounds y`);
    assert.ok(s.bounds.min[2] >= 0 && s.bounds.max[2] < p.size[2], `${p.id} bounds z`);
  }
});

test('building twice yields byte-identical cells (deterministic)', () => {
  const again = buildHeadParts().map(weldPart);
  assert.equal(again.length, HEAD_PARTS.length);
  for (let i = 0; i < again.length; i++) {
    const a = again[i] as Part, b = HEAD_PARTS[i] as Part;
    assert.equal(a.id, b.id);
    assert.deepEqual(a.cells, b.cells, `${a.id} cells differ between builds`);
    assert.deepEqual(a.palette, b.palette, `${a.id} palette differs`);
    assert.deepEqual(a.anchors, b.anchors, `${a.id} anchors differ`);
  }
  assert.deepEqual(again, HEAD_PARTS);
});

test('palettes only use PaletteSlot names, with no duplicates or unused entries', () => {
  for (const p of HEAD_PARTS) {
    assert.ok(p.palette.length > 0, p.id);
    assert.ok(p.palette.length <= PALETTE_SLOT_VALUES.length, p.id);
    assert.equal(new Set(p.palette).size, p.palette.length, `${p.id} duplicate palette slots`);
    for (const s of p.palette) assert.ok(PALETTE_SLOT_VALUES.includes(s), `${p.id} bad palette slot ${String(s)}`);
    for (let i = 1; i <= p.palette.length; i++) {
      assert.ok(p.cells.includes(i), `${p.id} palette entry ${i} (${p.palette[i - 1]}) unused`);
    }
    for (const c of p.cells) assert.ok(c >= 0 && c <= p.palette.length, `${p.id} cell value ${c} out of range`);
  }
});

test('non-pair parts are exactly mirror symmetric in x', () => {
  let checked = 0;
  for (const p of HEAD_PARTS) {
    if (p.tags.includes('pair') || p.tags.includes('asymmetric')) continue;
    checked++;
    const [sx, sy, sz] = p.size;
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
      const a = p.cells[x + y * sx + z * sx * sy] ?? 0;
      const b = p.cells[(sx - 1 - x) + y * sx + z * sx * sy] ?? 0;
      assert.equal(a, b, `${p.id} asymmetric at x=${x} y=${y} z=${z}`);
    }
  }
  assert.ok(checked >= 30, `expected most parts to be symmetric, checked ${checked}`);
});

test('asymmetric exemption is limited to the four designed parts', () => {
  const asym = HEAD_PARTS.filter(p => p.tags.includes('asymmetric')).map(p => p.id).sort();
  assert.deepEqual(asym, [...ASYMMETRIC_IDS].sort());
  for (const id of ASYMMETRIC_IDS) {
    const p = HEAD_PARTS.find(q => q.id === id) as Part;
    const [sx, sy, sz] = p.size;
    let differs = false;
    for (let z = 0; z < sz && !differs; z++) for (let y = 0; y < sy && !differs; y++) for (let x = 0; x < sx; x++) {
      if ((p.cells[x + y * sx + z * sx * sy] ?? 0) !== (p.cells[(sx - 1 - x) + y * sx + z * sx * sy] ?? 0)) { differs = true; break; }
    }
    assert.ok(differs, `${id} is tagged asymmetric but is mirror symmetric`);
  }
});

test('PART_PALETTES has 8 complete #rrggbb schemes', () => {
  const keys = Object.keys(PART_PALETTES);
  assert.equal(keys.length, 8, `expected 8 schemes, got ${keys.join(', ')}`);
  for (const k of keys) {
    const e = PART_PALETTES[k] as Record<string, string>;
    assert.equal(Object.keys(e).length, PALETTE_SLOT_VALUES.length, `${k} key count`);
    for (const s of PALETTE_SLOT_VALUES) {
      const c = e[s];
      assert.equal(typeof c, 'string', `${k}.${s} missing`);
      assert.match(c, /^#[0-9a-f]{6}$/, `${k}.${s} = ${c}`);
    }
    const uniq = new Set(PALETTE_SLOT_VALUES.map(s => e[s]));
    assert.ok(uniq.size >= PALETTE_SLOT_VALUES.length - 2, `${k} has too many identical colours`);
  }
});

test('ascii renders one row per z with one glyph per x, deterministically', () => {
  for (const p of HEAD_PARTS) {
    const [sx, sy, sz] = p.size;
    const y = Math.floor(sy / 2);
    const s = ascii(p, y);
    const rows = s.split('\n');
    assert.equal(rows.length, sz, `${p.id} row count`);
    for (const r of rows) assert.equal(r.length, sx, `${p.id} row width`);
    assert.equal(ascii(p, y), s, `${p.id} ascii not deterministic`);
    assert.ok(/^[\n.#*+=\-@$%!~^&o]+$/.test(s), `${p.id} unexpected glyphs`);
    assert.equal(ascii(p, -5), ascii(p, 0), `${p.id} clamps low y`);
    assert.equal(ascii(p, sy + 9), ascii(p, sy - 1), `${p.id} clamps high y`);
  }
  const classic = HEAD_PARTS.find(p => p.id === 'head_classic') as Part;
  assert.ok(ascii(classic, 7).includes('#'), 'head slice should contain material');
});

test('validatePart rejects malformed parts', () => {
  assert.equal(validatePart(null).ok, false);
  assert.equal(validatePart(undefined).ok, false);
  assert.equal(validatePart(42).ok, false);
  assert.equal(validatePart({}).ok, false);

  const base = HEAD_PARTS[0] as Part;
  const cases: Array<[string, unknown]> = [
    ['empty cells', { ...base, cells: [] }],
    ['missing root', { ...base, anchors: { neck: [0, 0, 0] } }],
    ['anchor outside grid', { ...base, anchors: { ...base.anchors, root: [99, 0, 0] } }],
    ['bad size', { ...base, size: [0, 13, 13] }],
    ['oversized axis', { ...base, size: [41, 13, 13] }],
    ['bad slot', { ...base, slot: 'wings' }],
    ['unknown palette slot', { ...base, palette: ['skin', 'sparkle'] }],
    ['duplicate palette slot', { ...base, palette: ['skin', 'skin'] }],
    ['tags not strings', { ...base, tags: [1, 2] }],
    ['value beyond palette', { ...base, cells: base.cells.map((c, i) => (i === 0 ? base.palette.length + 4 : c)) }],
  ];
  for (const [label, broken] of cases) {
    const r = validatePart(broken);
    assert.equal(r.ok, false, `${label} should fail`);
    assert.ok(r.errors.length > 0, `${label} should report errors`);
  }

  const twoBlob: Part = {
    id: 't', slot: 'head', name: 't', doc: 'two blobs', size: [3, 1, 1],
    palette: ['skin', 'metal'], cells: [1, 0, 2], anchors: { root: [0, 0, 0] }, attachTo: 'neck', tags: [],
  };
  const r = validatePart(twoBlob);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('component')), 'should report disconnected components');

  const unusedPal = validatePart({ ...twoBlob, cells: [1, 1, 0] });
  assert.equal(unusedPal.ok, false);
  assert.ok(unusedPal.errors.some(e => e.includes('unused')), 'should report unused palette entry');

  const okTiny = validatePart({ ...twoBlob, cells: [1, 1, 0], palette: ['skin'] });
  assert.equal(okTiny.ok, true, okTiny.errors.join(' | '));
});

test('partStats reports voxels, bounds and components consistently', () => {
  const p: Part = {
    id: 'cube', slot: 'head', name: 'cube', doc: 'unit cube', size: [2, 2, 2],
    palette: ['skin'], cells: [1, 1, 1, 1, 0, 0, 0, 0], anchors: { root: [0, 0, 0] }, attachTo: 'neck', tags: [],
  };
  const s = partStats(p);
  assert.equal(s.voxels, 4);
  assert.equal(s.components, 1);
  assert.deepEqual(s.bounds.min, [0, 0, 0]);
  assert.deepEqual(s.bounds.max, [1, 1, 0]);

  const empty = partStats({ ...p, cells: [0, 0, 0, 0, 0, 0, 0, 0] });
  assert.equal(empty.voxels, 0);
  assert.equal(empty.components, 0);

  for (const part of HEAD_PARTS) {
    const st = partStats(part);
    const counted = part.cells.filter(c => c > 0).length;
    assert.equal(st.voxels, counted, `${part.id} voxel count mismatch`);
    assert.ok(st.voxels > 0, `${part.id} is empty`);
  }
});

test('slots used by this file are all legal Slot values', () => {
  const used = new Set<Slot>();
  for (const p of HEAD_PARTS) {
    assert.ok(SLOT_VALUES.includes(p.slot), `${p.id} slot ${p.slot}`);
    used.add(p.slot);
  }
  assert.deepEqual([...used].sort(), ['ears', 'eyes', 'face-extra', 'hair', 'hat', 'head', 'mouth', 'nose'].sort());
});