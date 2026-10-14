import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUTTER, CLUTTER_MODELS, clutterById, clutterFootprint, salvageFor } from './lab-clutter';
import { ITEMS } from '../base/catalog';

const ROOM = { left: -7.9, right: 7.9, back: -8.9, front: 2.9 };
// the lab's keep-clear zones: the power wall and its floor covers, the gate's approach from the south, the window's front, the spawn
const ZONES: readonly { readonly name: string; readonly box: readonly [number, number, number, number] }[] = [
  { name: 'power wall path', box: [-8, -8.6, -6.0, 2.1] },
  { name: 'gate approach', box: [-1.5, 1.5, 1.5, 3.0] },
  { name: 'window front', box: [-7.4, -9, 7.4, -7.5] },
  { name: 'spawn', box: [-3.5, 0, -1.5, 2.0] },
];
const overlaps = (a: readonly number[], b: readonly number[]): boolean => a[0]! < b[2]! && b[0]! < a[2]! && a[1]! < b[3]! && b[1]! < a[3]!;

test('every clutter prop is inside the lab and clear of its keep-clear zones', () => {
  for (const c of CLUTTER) {
    const f = clutterFootprint(c);
    assert.ok(f[0] >= ROOM.left && f[2] <= ROOM.right && f[1] >= ROOM.back && f[3] <= ROOM.front, `${c.id} inside the room`);
    for (const z of ZONES) assert.equal(overlaps(f, z.box), false, `${c.id} clear of the ${z.name}`);
  }
});

test('no two clutter props overlap, and the ids and models are unique', () => {
  const ids = CLUTTER.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (let i = 0; i < CLUTTER.length; i++) {
    for (let j = i + 1; j < CLUTTER.length; j++) {
      assert.equal(overlaps(clutterFootprint(CLUTTER[i]!), clutterFootprint(CLUTTER[j]!)), false, `${CLUTTER[i]!.id} and ${CLUTTER[j]!.id} do not overlap`);
    }
  }
  assert.equal(new Set(CLUTTER_MODELS).size, CLUTTER_MODELS.length);
});

test('the lab holds fifteen props: two fixtures (the old monitor and one server rack), thirteen salvage', () => {
  assert.equal(CLUTTER.length, 15);
  const fixtures = CLUTTER.filter((c) => c.role === 'fixture').map((c) => c.id).sort();
  assert.deepEqual(fixtures, ['old-monitor', 'server-rack']);
  assert.equal(CLUTTER.filter((c) => c.role === 'salvage').length, 13);
  // the two logs the brief names as salvageable (LOG-03 and LOG-04) are salvage props
  assert.equal(clutterById('filing-cabinet')?.role, 'salvage');
  assert.equal(clutterById('sample-case')?.role, 'salvage');
});

test('a salvage yields ore scaled to its size, only items the catalogue knows, and the same every time', () => {
  const big = salvageFor(clutterById('crate-large')!);
  const small = salvageFor(clutterById('crate-small')!);
  assert.ok(big.find((s) => s.item === 'ore')!.n > small.find((s) => s.item === 'ore')!.n, 'a big crate gives more ore');
  for (const c of CLUTTER) {
    for (const s of salvageFor(c)) assert.ok(ITEMS[s.item], `${c.id} gives a known item (${s.item})`);
    if (c.role === 'fixture') assert.deepEqual(salvageFor(c), []);
  }
  assert.deepEqual(salvageFor(clutterById('crate-large')!), salvageFor(clutterById('crate-large')!));
});
