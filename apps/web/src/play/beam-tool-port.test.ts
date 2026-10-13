import test from 'node:test';
import assert from 'node:assert/strict';
import { VAULT } from '@hm/vault';
import { newLab, rackCount, type Cartridge, type LabState } from '@hm/cartlab';
import { averagePalette, CATEGORY_ROUGHNESS, presetLook, reloadedLab, writtenOnRack } from './beam-port';

const written = (id: string, preset: string, slot: number | null = null): Cartridge => ({
  id,
  name: `Name ${id}`,
  kind: 'preset',
  preset,
  from: [],
  affinity: { pxd: 1, vtx: 1, lx: 1, aq: 1 },
  slot,
});
const labWith = (cartridges: Cartridge[], extra: Partial<LabState> = {}): LabState => ({ ...newLab(), cartridges, ...extra });

test('a palette averages to one #rrggbb colour; a palette with no readable stop has none', () => {
  assert.equal(averagePalette(['#000000', '#ffffff']), '#808080');
  assert.equal(averagePalette(['#ff0000']), '#ff0000');
  assert.equal(averagePalette(['bogus', '']), null);
  assert.equal(averagePalette([]), null);
});

test('a vault preset has a colour and a roughness between 0 and 1; an unknown id has neither', () => {
  const look = presetLook(VAULT[0]!.id);
  assert.ok(look, 'the first vault preset has a look');
  assert.match(look.colour, /^#[0-9a-f]{6}$/);
  assert.ok(look.roughness > 0 && look.roughness < 1, `roughness ${look.roughness}`);
  assert.equal(presetLook('no-such-preset'), null);
  for (const r of Object.values(CATEGORY_ROUGHNESS)) assert.ok(r > 0 && r <= 1);
});

test('a reload takes the first written cartridge on the rack that no job needs, and the port goes back on the rack', () => {
  const lab = labWith(
    [written('c1', 'moss'), written('c2', 'ash'), written('c3', 'rust')],
    { bench: { inputs: ['c1'], preset: 'moss', done: 0, needs: 20 } },
  );
  const take = writtenOnRack(lab);
  assert.equal(take?.id, 'c2', 'c1 is an input of a bench job, so the next written one is taken');
  const next = reloadedLab(lab, take!, written('c9', 'rust'));
  assert.deepEqual(next.cartridges.map((c) => c.id), ['c1', 'c3', 'c9'], 'c2 left the rack and the port returned');
  assert.equal(rackCount(next), rackCount(lab), 'a reload with a cartridge in hand leaves the rack as it was');
});

test('with no written cartridge on the rack, there is nothing to load', () => {
  assert.equal(writtenOnRack(labWith([written('c1', 'moss', 4)])), null, 'a cartridge in a machine is not on the rack');
  assert.equal(writtenOnRack(labWith([])), null);
  const first = reloadedLab(labWith([written('c1', 'moss')]), written('c1', 'moss'), null);
  assert.equal(first.cartridges.length, 0, 'an empty port loads from the rack alone');
});
