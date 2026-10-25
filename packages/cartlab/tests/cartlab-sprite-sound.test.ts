import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES,
  canCombine,
  canSlot,
  canWritePrint,
  loadLab,
  makeBlank,
  newLab,
  printKind,
  printOf,
  readPrint,
  startPrintWrite,
  step,
  type LabEnv,
  type SoundPrintSpec,
  type SpritePrintSpec,
} from '../src/index';

const env = (o: Partial<LabEnv> = {}): LabEnv => ({ presets: [], stage: 1, powered: true, ...o });

const GATE_CARD: SpritePrintSpec = { name: 'Gate sprite, stage 2', kit: 'gate', stage: 2, size: 32, angles: 8, dither: 'bayer2', elevationDeg: 12 };
const LOCK: SoundPrintSpec = {
  name: 'Chevron lock',
  role: 'gate',
  stage: 4,
  gain: 0.5,
  loopSeconds: 1.3,
  patch: {
    name: 'lock',
    children: [
      { name: 'tick-1', atoms: [{ wave: 'square', freqHz: 300, gain: 0.3, attackMs: 2, decayMs: 90 }] },
      { name: 'tick-2', atoms: [{ wave: 'square', freqHz: 345, gain: 0.3, attackMs: 2, decayMs: 90, delayMs: 150 }] },
    ],
  },
};

test('the bench prints a sprite and a sound onto blanks, like a part', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPrintWrite(s, env(), a, { sprite: GATE_CARD }), env(), RULES.writeSeconds).state;
  s = step(startPrintWrite(s, env(), b, { sound: LOCK }), env(), RULES.writeSeconds).state;
  const [ca, cb] = s.cartridges;
  assert.equal(ca!.kind, 'sprite');
  assert.equal(ca!.name, 'Gate sprite, stage 2');
  assert.deepEqual(printOf(ca!), { sprite: GATE_CARD });
  assert.equal(cb!.kind, 'sound');
  assert.deepEqual(cb!.sound, LOCK);
  assert.equal(printKind({ sprite: GATE_CARD }), 'sprite');
  assert.equal(printKind({ sound: LOCK }), 'sound');
  // a print cartridge never sits in a machine and never names a preset
  assert.equal(ca!.preset, null);
  assert.equal(ca!.slot, null);
  assert.deepEqual(ca!.affinity, { pxd: 1, vtx: 1, lx: 1, aq: 1 });
});

test('sprite and sound cartridges go in the beam rifle only: never the combiner, never a plot machine', () => {
  let s = makeBlank(makeBlank(newLab(), 100).state, 100).state;
  const [a, b] = s.cartridges.map((c) => c.id) as [string, string];
  s = step(startPrintWrite(s, env(), a, { sprite: GATE_CARD }), env(), RULES.writeSeconds).state;
  s = step(startPrintWrite(s, env(), b, { sound: LOCK }), env(), RULES.writeSeconds).state;
  assert.match(canCombine(s, env(), [a, b]).why, /sprite cartridge goes in the beam rifle/);
  assert.match(canSlot(s, b, 0).why, /sound cartridge goes in the beam rifle/);
});

test('a malformed sprite or sound is refused, and a save keeps only well formed prints', () => {
  const s0 = makeBlank(newLab(), 100).state;
  const a = s0.cartridges[0]!.id;
  const bad = (print: unknown): boolean => canWritePrint(s0, env(), a, print as never).ok;
  // the sheet
  assert.equal(bad({ sprite: { ...GATE_CARD, kit: 'Not A Kit' } }), false, 'a kit id is a slug');
  assert.equal(bad({ sprite: { ...GATE_CARD, stage: 7 } }), false, 'the ladder stops at 6');
  assert.equal(bad({ sprite: { ...GATE_CARD, size: 3 } }), false, 'a frame has at least 4 pixels');
  assert.equal(bad({ sprite: { ...GATE_CARD, angles: 17 } }), false, 'sixteen frames is the most');
  assert.equal(bad({ sprite: { ...GATE_CARD, dither: 'noise' } }), false, 'a dither is a dither');
  assert.equal(bad({ sprite: { ...GATE_CARD, elevationDeg: 90 } }), false, 'the crane has a limit');
  assert.equal(bad({ sprite: { ...GATE_CARD, name: '' } }), false, 'a print needs a name');
  // the patch
  assert.equal(bad({ sound: { ...LOCK, role: 'choir' } }), false, 'a role is one of the four');
  assert.equal(bad({ sound: { ...LOCK, gain: 3 } }), false, 'gain is bounded');
  assert.equal(bad({ sound: { ...LOCK, loopSeconds: 0 } }), false, 'a loop has a length');
  assert.equal(bad({ sound: { ...LOCK, stage: -1 } }), false, 'there is no stage below 0');
  assert.equal(bad({ sound: { ...LOCK, patch: { name: 'empty' } } }), false, 'a patch needs at least one atom');
  assert.equal(
    bad({ sound: { ...LOCK, patch: { name: 'p', atoms: [{ wave: 'vocoder', freqHz: 200, gain: 0.3, attackMs: 1, decayMs: 50 }] } } }),
    false,
    'the engine knows five waveforms',
  );
  assert.equal(
    bad({ sound: { ...LOCK, patch: { name: 'p', atoms: [{ wave: 'sine', freqHz: 200, gain: 0.3, attackMs: 1, decayMs: 50 }, { wave: 'sine', freqHz: 200, gain: 0.3, attackMs: 1, decayMs: 50, detuneCents: 9000 }] } } }),
    false,
    'a detune has a limit',
  );
  // a patch nested deeper than a hand-made one can sensibly be is junk
  let deep: Record<string, unknown> = { name: 'leaf', atoms: [{ wave: 'sine', freqHz: 200, gain: 0.3, attackMs: 1, decayMs: 50 }] };
  for (let i = 0; i < 8; i += 1) deep = { name: `n${i}`, children: [deep] };
  assert.equal(bad({ sound: { ...LOCK, patch: deep } }), false, 'the recursion is bounded');

  // the reader is the same test the bench uses, and a saved cartridge survives it
  assert.ok(readPrint({ sprite: GATE_CARD }));
  assert.ok(readPrint({ sound: LOCK }));
  assert.equal(readPrint({ sprite: GATE_CARD, sound: LOCK }), null, 'one print per cartridge');
  let s = step(startPrintWrite(s0, env(), a, { sprite: GATE_CARD }), env(), RULES.writeSeconds).state;
  assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s);
  const broken = JSON.parse(JSON.stringify(s)) as { cartridges: { sprite: { angles: number } }[] };
  broken.cartridges[0]!.sprite.angles = 99;
  assert.equal(loadLab(broken), null, 'a save with an impossible turntable is refused whole');
});

test('a paused sprite or sound job survives a save', () => {
  for (const print of [{ sprite: GATE_CARD }, { sound: LOCK }]) {
    let s = makeBlank(newLab(), 100).state;
    const a = s.cartridges[0]!.id;
    s = startPrintWrite(s, env(), a, print);
    s = step(s, env({ powered: false }), 1).state;
    assert.deepEqual(loadLab(JSON.parse(JSON.stringify(s))), s, `${Object.keys(print)[0]} job must survive a power cut`);
  }
});
