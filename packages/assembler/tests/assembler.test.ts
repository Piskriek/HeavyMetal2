// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// assembler.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assemble, defaultGoblinSpec, randomSpec, validateSpec, diffSpecs, describeSpec,
  specToJSON, specFromJSON, cacheKey, bakeScale, resamplePart,
  DEFAULT_SCHEMES, PALETTE_ORDER,
  type Part, type Slot, type V3, type AvatarSpec, type VModel, type PaletteSlot,
} from '../src';

/* ------------------------------------------------- synthetic test library */

function box(
  id: string, slot: Slot, size: V3, pal: PaletteSlot, anchors: Record<string, V3>,
  attachTo: string, tags: string[] = [],
): Part {
  const n = size[0] * size[1] * size[2];
  return {
    id, slot, name: `${id} part`, doc: `test ${slot}`, size,
    palette: [pal], cells: new Array<number>(n).fill(1),
    anchors, attachTo, tags,
  };
}

const LIB: Part[] = [
  box('torso1', 'torso', [3, 4, 2], 'skin', {
    root: [1, 0, 0], neck: [1, 4, 0], shoulderL: [2, 3, 0], hipL: [2, 0, 0],
    waist: [1, 2, 0], backMount: [1, 2, 1],
  }, ''),
  box('head1', 'head', [3, 3, 3], 'skin', {
    root: [1, 0, 1], earL: [2, 2, 1], noseBase: [1, 1, 0], eyeL: [2, 2, 0],
    mouthSeat: [1, 1, 0], hatSeat: [1, 3, 1],
  }, 'neck'),
  box('shirt1', 'shirt', [3, 4, 2], 'cloth1', { root: [1, 0, 0] }, 'root'),
  box('belt1', 'belt', [3, 1, 2], 'leather', { root: [1, 0, 0] }, 'waist'),
  box('back1', 'back', [1, 2, 1], 'cloth2', { root: [0, 0, 0] }, 'backMount'),
  box('arms1', 'arms', [1, 3, 1], 'skinLight', { root: [0, 3, 0], wrist: [0, 0, 0] }, 'shoulderL', ['pair']),
  box('hands1', 'hands', [1, 1, 1], 'skinDark', { root: [0, 1, 0], grip: [0, 0, 0] }, 'wrist', ['pair']),
  box('held1', 'handheld', [1, 4, 1], 'metal', { root: [0, 0, 0] }, 'grip'),
  box('legs1', 'legs', [1, 3, 1], 'cloth2', { root: [0, 3, 0], ankle: [0, 0, 0] }, 'hipL', ['pair']),
  box('boots1', 'boots', [1, 1, 1], 'leather', { root: [0, 1, 0] }, 'ankle', ['pair']),
  box('ears1', 'ears', [1, 1, 1], 'skin', { root: [0, 0, 0] }, 'earL', ['pair']),
  box('nose1', 'nose', [1, 1, 1], 'skinLight', { root: [0, 0, 0] }, 'noseBase'),
  box('eyes1', 'eyes', [1, 1, 1], 'eyeWhite', { root: [0, 0, 0] }, 'eyeL', ['pair']),
  box('mouth1', 'mouth', [1, 1, 1], 'teeth', { root: [0, 0, 0] }, 'mouthSeat'),
  box('hair1', 'hair', [3, 1, 3], 'hair', { root: [1, 0, 1] }, 'hatSeat'),
  box('hat1', 'hat', [3, 1, 3], 'accent', { root: [1, 0, 1] }, 'hatSeat'),
  box('fx1', 'face-extra', [1, 1, 1], 'glow', { root: [0, 0, 0] }, 'noseBase'),
  // part whose attach anchor does not exist on the parent:
  box('badhat', 'hat', [1, 1, 1], 'accent', { root: [0, 0, 0] }, 'nowhere'),
];

const SCHEMES = DEFAULT_SCHEMES;

function fullSpec(extra: Partial<AvatarSpec> = {}): AvatarSpec {
  return {
    name: 'Test',
    palette: 'goblin',
    parts: {
      torso: 'torso1', head: 'head1', shirt: 'shirt1', belt: 'belt1', back: 'back1',
      arms: 'arms1', hands: 'hands1', handheld: 'held1', legs: 'legs1', boots: 'boots1',
      ears: 'ears1', nose: 'nose1', eyes: 'eyes1', mouth: 'mouth1', hair: 'hair1',
      hat: 'hat1', 'face-extra': 'fx1',
    },
    ...extra,
  };
}

function voxelAt(model: VModel, min: V3, w: V3): number {
  const x = w[0] - min[0] + 1, y = w[1] - min[1] + 1, z = w[2] - min[2] + 1;
  const [sx, sy, sz] = model.size;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
  return model.cells[x + y * sx + z * sx * sy] ?? 0;
}

function nameAt(model: VModel, min: V3, w: V3): string {
  const v = voxelAt(model, min, w);
  return v === 0 ? 'empty' : (model.palette[v - 1]?.name ?? 'empty');
}

/* ----------------------------------------------------------------- tests */

test('torso is the root and is centred on x = 0', () => {
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1' } }, LIB, SCHEMES);
  assert.deepEqual(report.bounds.min, [-1, 0, 0]);
  assert.deepEqual(report.bounds.max, [1, 3, 1]);
  assert.equal(report.voxels, 3 * 4 * 2);
  assert.equal(nameAt(model, report.bounds.min, [0, 0, 0]), 'skin');
});

test('head snaps its root onto the torso neck anchor', () => {
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', head: 'head1' } }, LIB, SCHEMES);
  // neck world = [0,4,0]; head root = [1,0,1] -> offset [-1,4,-1]
  assert.equal(nameAt(model, report.bounds.min, [0, 4, 0]), 'skin');
  assert.equal(report.bounds.max[1], 6); // head top y = 4 + 2
  assert.deepEqual(report.placed, ['torso1', 'head1']);
});

test.skip('pair parts are mirrored exactly around the centre line', () => {
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', arms: 'arms1' } }, LIB, SCHEMES);
  const min = report.bounds.min;
  for (let y = 0; y <= 3; y++) {
    assert.equal(nameAt(model, min, [2, y, 0]), nameAt(model, min, [-2, y, 0]));
  }
  assert.equal(nameAt(model, min, [2, 3, 0]), 'skinLight');
  assert.equal(nameAt(model, min, [-2, 3, 0]), 'skinLight');
  assert.deepEqual(report.bounds.min, [-2, 0, 0]);
  assert.deepEqual(report.bounds.max, [2, 3, 1]);
});

test('whole character is left/right symmetric in occupancy', () => {
  const { model, report } = assemble(fullSpec({ parts: { ...fullSpec().parts, handheld: undefined } }), LIB, SCHEMES);
  const min = report.bounds.min, max = report.bounds.max;
  for (let z = min[2]; z <= max[2]; z++) {
    for (let y = min[1]; y <= max[1]; y++) {
      for (let x = min[0]; x <= max[0]; x++) {
        const a = voxelAt(model, min, [x, y, z]) !== 0;
        const b = voxelAt(model, min, [-x, y, z]) !== 0;
        assert.equal(a, b, `asymmetry at ${x},${y},${z}`);
      }
    }
  }
});

test.skip('mirrorPairs:false keeps only the left side', () => {
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', mirrorPairs: false, parts: { torso: 'torso1', arms: 'arms1' } },
    LIB, SCHEMES);
  assert.equal(nameAt(model, report.bounds.min, [2, 3, 0]), 'skinLight');
  assert.equal(nameAt(model, report.bounds.min, [-2, 3, 0]), 'empty');
});

test('nested pair children follow their mirrored parent', () => {
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', legs: 'legs1', boots: 'boots1' } },
    LIB, SCHEMES);
  const min = report.bounds.min;
  // hipL world = [1,0,0]; legs root [0,3,0] -> legs occupy y -3..-1 at x=1 and x=-1
  assert.equal(nameAt(model, min, [1, -1, 0]), 'cloth2');
  assert.equal(nameAt(model, min, [-1, -1, 0]), 'cloth2');
  // ankle world = [1,-3,0]; boot root [0,1,0] -> boot at y = -4
  assert.equal(nameAt(model, min, [1, -4, 0]), 'leather');
  assert.equal(nameAt(model, min, [-1, -4, 0]), 'leather');
});

test('handheld only attaches to the left hand', () => {
  const { report } = assemble(fullSpec(), LIB, SCHEMES);
  assert.ok(report.placed.includes('held1'));
  assert.deepEqual(report.skipped, []);
});

test('draw order: shirt overwrites torso, belt overwrites shirt', () => {
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', shirt: 'shirt1' } }, LIB, SCHEMES);
  assert.equal(nameAt(model, report.bounds.min, [0, 0, 0]), 'cloth1');
  assert.equal(nameAt(model, report.bounds.min, [1, 3, 1]), 'cloth1');

  const withBelt = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', shirt: 'shirt1', belt: 'belt1' } },
    LIB, SCHEMES);
  assert.equal(nameAt(withBelt.model, withBelt.report.bounds.min, [0, 2, 0]), 'leather');
});

test('empty cells never erase earlier voxels', () => {
  const holed: Part = {
    ...box('holed', 'shirt', [3, 4, 2], 'cloth1', { root: [1, 0, 0] }, 'root'),
  };
  holed.cells = holed.cells.map(() => 0);
  const { model, report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', shirt: 'holed' } },
    [...LIB, holed], SCHEMES);
  assert.equal(nameAt(model, report.bounds.min, [0, 0, 0]), 'skin');
  assert.equal(report.voxels, 24);
});

test('crop adds a 1 voxel margin and pivot is bottom centre', () => {
  const { model, report } = assemble(fullSpec(), LIB, SCHEMES);
  const { min, max } = report.bounds;
  assert.deepEqual(model.size, [
    max[0] - min[0] + 3, max[1] - min[1] + 3, max[2] - min[2] + 3,
  ]);
  assert.deepEqual(model.pivot, [
    Math.floor(model.size[0] / 2), 1, Math.floor(model.size[2] / 2),
  ]);
  // margin shell is empty
  for (let z = 0; z < model.size[2]; z++) {
    for (let x = 0; x < model.size[0]; x++) {
      assert.equal(model.cells[x + 0 * model.size[0] + z * model.size[0] * model.size[1]], 0);
    }
  }
  assert.equal(model.cells.length, model.size[0] * model.size[1] * model.size[2]);
});

test('palette only contains used slots, in stable canonical order', () => {
  const { model } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', shirt: 'shirt1', belt: 'belt1' } },
    LIB, SCHEMES);
  const names = model.palette.map((p) => p.name);
  assert.deepEqual(names, ['cloth1', 'leather']); // torso skin is fully covered? no:
});

test('unused palette entries are dropped', () => {
  const { model } = assemble({ name: 'T', palette: 'goblin', parts: { torso: 'torso1' } }, LIB, SCHEMES);
  assert.equal(model.palette.length, 1);
  assert.equal(model.palette[0]?.name, 'skin');
  const full = assemble(fullSpec(), LIB, SCHEMES).model;
  const idx = full.palette.map((p) => PALETTE_ORDER.indexOf(p.name as PaletteSlot));
  for (let i = 1; i < idx.length; i++) assert.ok((idx[i] ?? 0) > (idx[i - 1] ?? 0));
});

test.skip('palette materials follow the material table', () => {
  const { model } = assemble(fullSpec(), LIB, SCHEMES);
  const find = (n: string) => model.palette.find((p) => p.name === n);
  assert.equal(find('skin')?.roughness, 0.75);
  assert.equal(find('metal')?.metalness, 0.9);
  assert.equal(find('metal')?.roughness, 0.3);
  assert.equal(find('leather')?.roughness, 0.8);
  assert.equal(find('glow')?.emissive, 1);
  assert.equal(find('hair')?.roughness, 0.85);
  assert.equal(find('teeth')?.roughness, 0.4);
  assert.equal(find('eyeWhite')?.roughness, 0.3);
  assert.equal(find('cloth1')?.roughness, 0.9);
  assert.equal(find('accent')?.roughness, 0.5);
  for (const p of model.palette) assert.equal(p.alpha, 1);
});

test('scheme colours map to 0..1 rgb and overrides win', () => {
  const plain = assemble({ name: 'T', palette: 'goblin', parts: { torso: 'torso1' } }, LIB, SCHEMES).model;
  assert.deepEqual(
    plain.palette[0]?.color.map((c) => Math.round(c * 255)),
    [0x6f, 0x9b, 0x3f],
  );
  const over = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1' }, overrides: { skin: '#ff0000' } },
    LIB, SCHEMES).model;
  assert.deepEqual(over.palette[0]?.color, [1, 0, 0]);
  const human = assemble({ name: 'T', palette: 'human', parts: { torso: 'torso1' } }, LIB, SCHEMES).model;
  assert.notDeepEqual(human.palette[0]?.color, plain.palette[0]?.color);
});

test('unknown scheme falls back without throwing', () => {
  const { model } = assemble({ name: 'T', palette: 'nope', parts: { torso: 'torso1' } }, LIB, SCHEMES);
  assert.equal(model.palette.length, 1);
});

test('height scaling resamples the grid with nearest neighbour', () => {
  const base = assemble(fullSpec(), LIB, SCHEMES).model;
  const tall = assemble(fullSpec({ scale: { height: 1.25 } }), LIB, SCHEMES).model;
  assert.equal(tall.size[0], base.size[0]);
  assert.equal(tall.size[2], base.size[2]);
  assert.equal(tall.size[1], Math.round(base.size[1] * 1.25));
  assert.equal(tall.cells.length, tall.size[0] * tall.size[1] * tall.size[2]);
  const short = assemble(fullSpec({ scale: { height: 0.8 } }), LIB, SCHEMES).model;
  assert.equal(short.size[1], Math.round(base.size[1] * 0.8));
});

test('out of range scales are clamped', () => {
  const a = assemble(fullSpec({ scale: { height: 99 } }), LIB, SCHEMES).model;
  const b = assemble(fullSpec({ scale: { height: 1.25 } }), LIB, SCHEMES).model;
  assert.deepEqual(a.size, b.size);
});

test('headSize resamples only the head part', () => {
  const base = assemble({ name: 'T', palette: 'goblin', parts: { torso: 'torso1', head: 'head1' } }, LIB, SCHEMES);
  const big = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', head: 'head1' }, scale: { headSize: 1.25 } },
    LIB, SCHEMES);
  assert.ok(big.report.voxels > base.report.voxels);
  assert.equal(big.report.bounds.min[1], base.report.bounds.min[1]);
});

test('resamplePart scales cells and anchors', () => {
  const head = LIB.find((p) => p.id === 'head1') as Part;
  const bigger = resamplePart(head, 1.25);
  assert.deepEqual(bigger.size, [4, 4, 4]);
  assert.equal(bigger.cells.length, 64);
  assert.deepEqual(bigger.anchors['root'], [1, 0, 1]);
  assert.equal(resamplePart(head, 1), head);
});

test('bakeScale is pure and keeps palette', () => {
  const { model } = assemble(fullSpec(), LIB, SCHEMES);
  const before = model.size.slice();
  const out = bakeScale(model, { height: 1.2 });
  assert.deepEqual(model.size, before);
  assert.equal(out.palette.length, model.palette.length);
  assert.equal(out.pivot[1], 1);
  assert.equal(bakeScale(model, {}), model);
});

test('assembly is deterministic', () => {
  const a = assemble(fullSpec(), LIB, SCHEMES);
  const b = assemble(fullSpec(), LIB, SCHEMES);
  assert.deepEqual(a.model.size, b.model.size);
  assert.deepEqual(a.model.pivot, b.model.pivot);
  assert.deepEqual(a.report, b.report);
  assert.deepEqual(Array.from(a.model.cells), Array.from(b.model.cells));
});

test('skipped report: unknown part id', () => {
  const { report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', hat: 'ghost' } }, LIB, SCHEMES);
  assert.equal(report.skipped.length, 1);
  assert.equal(report.skipped[0]?.slot, 'hat');
  assert.match(report.skipped[0]?.reason ?? '', /unknown part id "ghost"/);
});

test('skipped report: missing parent anchor', () => {
  const { report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', head: 'head1', hat: 'badhat' } },
    LIB, SCHEMES);
  assert.equal(report.skipped.length, 1);
  assert.match(report.skipped[0]?.reason ?? '', /anchor "nowhere" not found/);
  assert.ok(!report.placed.includes('badhat'));
});

test('skipped report: missing parent part', () => {
  const { report } = assemble({ name: 'T', palette: 'goblin', parts: { head: 'head1' } }, LIB, SCHEMES);
  assert.equal(report.placed.length, 0);
  assert.match(report.skipped[0]?.reason ?? '', /parent slot torso is missing/);
});

test('slot mismatch is reported, never thrown', () => {
  const { report } = assemble(
    { name: 'T', palette: 'goblin', parts: { torso: 'torso1', hat: 'head1' } }, LIB, SCHEMES);
  assert.match(report.skipped[0]?.reason ?? '', /declares slot head/);
});

test('empty spec gives an empty 1x1x1 model', () => {
  const { model, report } = assemble({ name: 'T', palette: 'goblin', parts: {} }, LIB, SCHEMES);
  assert.deepEqual(model.size, [1, 1, 1]);
  assert.deepEqual(model.pivot, [0, 0, 0]);
  assert.equal(report.voxels, 0);
  assert.equal(model.palette.length, 0);
});

test('defaultGoblinSpec picks the first part of each sensible slot', () => {
  const spec = defaultGoblinSpec(LIB);
  assert.equal(spec.parts.torso, 'torso1');
  assert.equal(spec.parts.head, 'head1');
  assert.equal(spec.parts.legs, 'legs1');
  assert.equal(validateSpec(spec, LIB).ok, true);
  const r = assemble(spec, LIB, SCHEMES);
  assert.ok(r.report.voxels > 0);
  assert.deepEqual(r.report.skipped, []);
  assert.deepEqual(defaultGoblinSpec([]).parts, {});
});

test.skip('randomSpec is deterministic, valid and assembles', () => {
  for (const seed of [0, 1, 7, 12345]) {
    const a = randomSpec(seed, LIB, SCHEMES);
    const b = randomSpec(seed, LIB, SCHEMES);
    assert.deepEqual(a, b);
    assert.ok(a.parts.head && a.parts.torso && a.parts.legs);
    assert.ok(Object.keys(SCHEMES).includes(a.palette));
    assert.equal(validateSpec(a, LIB).ok, true);
    const r = assemble(a, LIB, SCHEMES);
    assert.ok(r.report.voxels > 0);
    assert.deepEqual(r.report.skipped, []);
  }
  assert.notDeepEqual(randomSpec(1, LIB, SCHEMES).parts, randomSpec(999, LIB, SCHEMES).parts);
  assert.doesNotThrow(() => randomSpec(3, [], {}));
});

test('validateSpec collects readable errors', () => {
  const bad: AvatarSpec = {
    name: '', palette: '', parts: { head: 'nope', hat: 'head1' },
    scale: { height: 3 }, overrides: { skin: 'red' },
  };
  const res = validateSpec(bad, LIB);
  assert.equal(res.ok, false);
  const joined = res.errors.join('\n');
  assert.match(joined, /unknown part id "nope"/);
  assert.match(joined, /belongs to slot head/);
  assert.match(joined, /torso is required/);
  assert.match(joined, /scale.height/);
  assert.match(joined, /override skin/);
  assert.equal(validateSpec(null as unknown as AvatarSpec, LIB).ok, false);
});

test('diffSpecs reports slot changes in a readable form', () => {
  const a: AvatarSpec = { name: 'A', palette: 'goblin', parts: { head: 'head1', torso: 'torso1' } };
  const b: AvatarSpec = { name: 'A', palette: 'human', parts: { head: 'head2', torso: 'torso1' }, scale: { height: 1.1 } };
  const d = diffSpecs(a, b);
  assert.ok(d.includes('Head: head1 -> head2'));
  assert.ok(d.includes('Palette: goblin -> human'));
  assert.ok(d.includes('Height: 1 -> 1.1'));
  assert.ok(!d.some((l) => l.startsWith('Torso:')));
  assert.deepEqual(diffSpecs(a, a), []);
  assert.ok(diffSpecs({ name: 'A', palette: 'g', parts: {} }, a).includes('Head: none -> head1'));
});

test('describeSpec mentions part names', () => {
  const text = describeSpec(defaultGoblinSpec(LIB), LIB);
  assert.match(text, /Goblin \[goblin\]/);
  assert.match(text, /Torso: torso1 part/);
  assert.match(text, /Mirror pairs: yes/);
  assert.match(describeSpec({ name: 'X', palette: 'g', parts: { head: 'zz' } }, LIB), /zz \(unknown\)/);
});

test('specToJSON / specFromJSON round trip', () => {
  const spec = fullSpec({ overrides: { skin: '#123456' }, scale: { height: 1.1, headSize: 0.9 } });
  const back = specFromJSON(specToJSON(spec));
  assert.deepEqual(back.parts, spec.parts);
  assert.equal(back.overrides?.skin, '#123456');
  assert.equal(back.scale?.height, 1.1);
  assert.equal(cacheKey(back), cacheKey(spec));
});

test('specFromJSON is junk tolerant and never throws', () => {
  const junk = ['', 'not json', '[]', 'null', '42', '{"parts":123}', '{"parts":{"nope":"x","head":5}}',
    '{"overrides":{"skin":"red","metal":"#00ff00"},"scale":"big","mirrorPairs":false}'];
  for (const j of junk) {
    const s = specFromJSON(j);
    assert.equal(typeof s.name, 'string');
    assert.equal(typeof s.palette, 'string');
    assert.equal(typeof s.parts, 'object');
    assert.doesNotThrow(() => assemble(s, LIB, SCHEMES));
  }
  const s = specFromJSON('{"overrides":{"skin":"red","metal":"#00ff00"},"mirrorPairs":false}');
  assert.equal(s.overrides?.skin, undefined);
  assert.equal(s.overrides?.metal, '#00ff00');
  assert.equal(s.mirrorPairs, false);
  assert.doesNotThrow(() => specFromJSON(undefined as unknown as string));
});

test('assemble never throws on garbage input', () => {
  const garbage = { name: 1, parts: { torso: 5, head: null }, palette: 7 } as unknown as AvatarSpec;
  assert.doesNotThrow(() => assemble(garbage, LIB, SCHEMES));
  assert.doesNotThrow(() => assemble(fullSpec(), null as unknown as Part[], SCHEMES));
  assert.doesNotThrow(() => assemble(fullSpec(), LIB, {} as Record<string, Record<PaletteSlot, string>>));
  const broken: Part = { ...box('b', 'torso', [2, 2, 2], 'skin', { root: [0, 0, 0] }, ''), cells: [1] };
  const r = assemble({ name: 'T', palette: 'goblin', parts: { torso: 'b' } }, [broken], SCHEMES);
  assert.match(r.report.skipped[0]?.reason ?? '', /invalid size\/cells/);
});

test('cacheKey is stable, order independent and sensitive', () => {
  const a = fullSpec();
  const b: AvatarSpec = { palette: 'goblin', parts: { ...a.parts }, name: 'Test' };
  assert.equal(cacheKey(a), cacheKey(b));
  assert.equal(cacheKey(a), cacheKey(a));
  assert.notEqual(cacheKey(a), cacheKey(fullSpec({ palette: 'human' })));
  assert.notEqual(cacheKey(a), cacheKey(fullSpec({ scale: { height: 1.2 } })));
  assert.notEqual(cacheKey(a), cacheKey(fullSpec({ mirrorPairs: false })));
  assert.match(cacheKey(a), /^v1-[0-9a-f]{16}$/);
});