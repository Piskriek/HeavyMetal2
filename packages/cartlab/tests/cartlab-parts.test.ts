import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, newLab, makeBlank, canWritePart, startPartWrite, canPrintPart, printPart, freeBlank, startWrite, canCombine, canSlot, step, loadLab, affinityOf, type LabEnv, type PartSpec, type Preset } from '../src/index';

const P: Preset[] = [{ id: 'mud', name: 'Mud', affinity: { pxd: 1.4 }, minStage: 0 }];
const env = (o: Partial<LabEnv> = {}): LabEnv => ({ presets: P, stage: 1, powered: true, ...o });
const FAT_GREEN: PartSpec = {
  name: 'Fat green bolt',
  gen: 'bolt',
  params: { headWidth: 0.12, head: 0 },
  slotMaterials: { metal: 'green' },
  ops: [{ op: 'chamfer-hard-edges', params: {} }],
};

test('the bench prints a part onto a blank, and the cartridge carries it', () => {
  let s = makeBlank(newLab(), 100).state;
  const blank = s.cartridges[0]!.id;
  assert.equal(canWritePart(s, env({ powered: false }), blank, FAT_GREEN).ok, false);
  s = startPartWrite(s, env(), blank, FAT_GREEN);
  assert.equal(canWritePart(s, env(), blank, FAT_GREEN).ok, false, 'the bench is busy');
  s = step(s, env(), RULES.writeSeconds / 2).state;
  assert.equal(s.cartridges[0]!.kind, 'blank', 'still printing');
  const r = step(s, env(), RULES.writeSeconds);
  s = r.state;
  assert.deepEqual(r.events, [{ type: 'written', id: blank }]);
  const c = s.cartridges[0]!;
  assert.equal(c.kind, 'part');
  assert.equal(c.name, 'Fat green bolt');
  assert.deepEqual(c.part, FAT_GREEN);
  assert.equal(affinityOf(s, c.id, 'pxd'), 1, 'a part does not change what a machine pours');
});

test('a power cut pauses a part print without losing the part', () => {
  let s = makeBlank(newLab(), 100).state;
  const blank = s.cartridges[0]!.id;
  s = startPartWrite(s, env(), blank, FAT_GREEN);
  s = step(s, env(), 5).state;
  s = step(s, env({ powered: false }), 5).state;
  assert.deepEqual(s.bench?.part, FAT_GREEN);
  s = step(s, env(), RULES.writeSeconds).state;
  assert.equal(s.cartridges[0]!.kind, 'part');
});

test('part cartridges go in the beam rifle: the combiner and the machines refuse them', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPartWrite(s, env(), a, FAT_GREEN), env(), RULES.writeSeconds).state;
  s = step(startWrite(s, env(), b, 'mud'), env(), RULES.writeSeconds).state;
  assert.match(canCombine(s, env(), [a, b]).why, /beam rifle/);
  assert.match(canSlot(s, a, 0).why, /beam rifle/);
});

test('a save round trip keeps part cartridges and part jobs, and refuses broken ones', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPartWrite(s, env(), a, FAT_GREEN), env(), RULES.writeSeconds).state;
  s = startPartWrite(s, env(), b, { ...FAT_GREEN, name: 'Second bolt' });
  s = step(s, env({ powered: false }), 1).state;
  const back = loadLab(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  const broken = JSON.parse(JSON.stringify(s));
  broken.cartridges[0].part.params.headWidth = 'fat';
  assert.equal(loadLab(broken), null);
});

test('the planet Drafting Table prints a part at once onto a free blank, with no lab power', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = startPartWrite(s, env(), a, FAT_GREEN);
  assert.equal(freeBlank(s), b, 'the blank on the bench is not free');
  assert.match(canPrintPart(s, a, FAT_GREEN).why, /being written/);
  s = printPart(s, b, FAT_GREEN);
  const c = s.cartridges.find((x) => x.id === b)!;
  assert.equal(c.kind, 'part');
  assert.deepEqual(c.part, FAT_GREEN);
  assert.equal(freeBlank(s), null);
  assert.match(canPrintPart(s, b, FAT_GREEN).why, /not a blank/);
  assert.equal(canPrintPart(s, 'c99', FAT_GREEN).ok, false);
  assert.throws(() => printPart(s, b, FAT_GREEN), /not a blank/);
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s, 'a printed part survives a save');
});
