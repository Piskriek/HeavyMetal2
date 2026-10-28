// Plan 56 §20: the preset body. Flow stops at the first blocked zone; gates trip into sickness over checkpoints; sides follow
// intake and output; a slow release itches, a fast one is a pain with a rebound unless the cause closed; the body teaches up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIGNED, type Mem } from '@hm/shorthand';
import {
  BODY_ZONES, CONGESTED_AFTER, INFLAMED_AFTER, RELEASE_RATE, RUNAWAY_AFTER, bodyStep, bodyWarnings, createPresetMemory, cuesFromWarnings,
  recordExperience, sideLean, teachUpward, warningLine, type BodyState, type Experience, type Side,
} from '../src/index';

const sideOf = (cat: string): Side => (cat === 'HITS_ON_YOU' || cat === 'CONTACT' ? 'left' : cat === 'TARGET_DOWN' || cat === 'REFLEX' ? 'right' : 'center');
const at = (t: number, over: Partial<Experience> = {}): Experience => ({ t, stage: 'S1', cat: 'HITS_ON_YOU', excitement: 1, error: 0.8, by: ALIGNED, felt: 'root-reactivity', ...over });
const write = (m: Mem, xs: readonly Experience[]): Mem => xs.reduce(recordExperience, m);
/** A part hit hard several times: its root charged, the link open. */
const hit = (): Mem => write(createPresetMemory('loc:f17e'), Array.from({ length: 3 }, (_, i) => at(100 + i)));
const step = (mem: Mem, prev: BodyState | null) => bodyStep({ kind: 'mechanical', mem, prev, sideOf });

test('a balanced body flows in every zone, with nothing to say', () => {
  const { body } = step(createPresetMemory('loc:0001'), null);
  assert.deepEqual(body.zones.map((z) => z.mode), Array(7).fill('flowing'));
  assert.ok(body.zones.every((z) => z.sickness === null && z.signal === null && z.rebound === 0));
  assert.equal(BODY_ZONES[0]!.placeFrom, 'ra');
});

test('the flow stops at the first blocked zone: a charged root starves every zone above it', () => {
  const { body } = step(hit(), null);
  assert.equal(body.zones[0]!.mode, 'blocked');
  assert.deepEqual(body.zones.slice(1).map((z) => z.mode), Array(6).fill('starved'));
  // a block higher up lets the lower zones flow
  const higher = write(createPresetMemory('mot:f1e0'), [at(1, { cat: 'TARGET_DOWN', felt: 'solar-control' })]);
  const b = step(higher, null).body;
  assert.deepEqual(b.zones.map((z) => z.mode), ['flowing', 'flowing', 'blocked', 'starved', 'starved', 'starved', 'starved']);
  // antidote past rest is overopen, wherever it is
  assert.equal(step({ ...createPresetMemory('loc:0002'), charge: [0, 0, 0, -40, 0, 0, 0], bal: 1 - 40 / 127 }, null).body.zones[3]!.mode, 'overopen');
});

test('a gate trips into sickness when it stays out of flow: congested, inflamed, runaway; flowing again resets it', () => {
  const m = hit();
  let prev: BodyState | null = null;
  const seen: (string | null)[] = [];
  for (let k = 1; k <= RUNAWAY_AFTER; k++) { prev = step(m, prev).body; seen.push(prev.zones[0]!.sickness); }
  assert.equal(seen[CONGESTED_AFTER - 1], 'congested');
  assert.equal(seen[INFLAMED_AFTER - 1], 'inflamed');
  assert.equal(seen[RUNAWAY_AFTER - 1], 'runaway');
  assert.equal(prev!.zones[1]!.sickness, 'numb', 'the zones above, starved for long, go numb');
  const healed = step(createPresetMemory('loc:f17e'), prev).body;
  assert.equal(healed.zones[0]!.trips, 0);
  assert.equal(healed.zones[0]!.sickness, null);
});

test('sides: the hits came in, so the root strains on the left; the part\'s own actions strain on the right', () => {
  const m = hit();
  assert.equal(sideLean(m, 0, sideOf), -1);
  assert.equal(step(m, null).body.zones[0]!.side, 'left');
  const out = write(createPresetMemory('mot:f1e0'), [at(1, { cat: 'TARGET_DOWN', felt: 'solar-control' }), at(2, { cat: 'REFLEX', felt: 'solar-control' })]);
  assert.equal(step(out, null).body.zones[2]!.side, 'right');
});

test('a slow release itches; a fast one is a sharp pain, part of it rebounds unless the cause closed, and the pain masks the itch', () => {
  const m = hit();
  const first = step(m, null).body;
  const start = m.charge[0]!;
  // slow: a small fall between checkpoints
  const slow = step({ ...m, charge: m.charge.map((c, i) => (i === 0 ? c - 10 : c)) }, first);
  assert.equal(slow.body.zones[0]!.signal, 'itch');
  assert.equal(slow.body.zones[0]!.rebound, 0);
  // fast: most of it gone in one go, the link still open
  const fastMem = { ...m, charge: m.charge.map((c, i) => (i === 0 ? c - 80 : c)) };
  const fast = step(fastMem, first);
  assert.equal(fast.body.zones[0]!.signal, 'pain');
  assert.equal(fast.body.zones[0]!.rebound, Math.round((80 - RELEASE_RATE) * 0.5));
  // at the next checkpoint the rebound comes back, since the cause is still open; the itch stays masked
  const after = step(fastMem, fast.body);
  assert.equal(after.mem.charge[0], start - 80 + fast.body.zones[0]!.rebound);
  assert.notEqual(after.body.zones[0]!.signal, 'itch');
  // a real realization: the cause closed, so nothing comes back
  const closed = { ...fastMem, cause: fastMem.cause.map((c) => ({ ...c, open: false })) };
  assert.equal(step(closed, fast.body).mem.charge[0], start - 80);
});

test('the body teaches upward: a pain warns with a visible change, cues the part\'s next dream, and the ego learns the link', () => {
  const m = hit();
  const first = step(m, null).body;
  const fast = step({ ...m, charge: m.charge.map((c, i) => (i === 0 ? c - 80 : c)) }, first);
  const warnings = bodyWarnings('loc:f17e', fast.body, fast.mem);
  // held at the root (its own ray), it shows where the suppressed quality lives: Presence, at the throat (the radio)
  assert.deepEqual(warnings.map((w) => [w.ray, w.source, w.at, w.place, w.quality, w.side, w.signal, w.d]), [[1, 'thruster pods', 5, 'radio', 'Presence', 'left', 'pain', 'root-reactivity']]);
  assert.deepEqual(warnings[0]!.visual, { place: 'radio', side: 'left', hue: '#3c78d2', look: 'flash' });
  assert.equal(warningLine(warnings[0]!), 'A sharp pain in my radio, on the left (root-reactivity, held in my thruster pods): I let it go too fast.');
  // the organic body names the place of the same zone
  assert.deepEqual([bodyWarnings('loc:f17e', { ...fast.body, kind: 'organic' }, fast.mem)[0]!.place, bodyWarnings('loc:f17e', { ...fast.body, kind: 'organic' }, fast.mem)[0]!.source], ['throat', 'feet and the base of the spine']);
  const cues = cuesFromWarnings(fast.mem, warnings);
  assert.deepEqual(cues.map((c) => c.t), [102, 101, 100]);
  // the ego, thinking control, learns that its thinking left reactivity in the pods
  const ego = { ...createPresetMemory('brain:d0e0'), charge: [0, 0, 60, 0, 0, 0, 0], bal: 1 - 60 / 127, ep: [{ t: 1, stage: 'S1' as const, cat: 'ORDER', ex: 1, err: 0.5, h: 1, d: 'solar-control' as const, by: 'aligned' as const }] };
  const taught = teachUpward(ego, warnings);
  assert.equal(taught.cause.find((c) => c.by === 'solar-control' && c.d === 'root-reactivity')?.n, 1);
  assert.deepEqual(taught.charge, ego.charge, 'it learns the link; the warning itself does not harden it');
  // an itch is release at work, not a warning: a light hit, released slowly and understood (its link closed)
  const light = write(createPresetMemory('loc:f17e'), [at(100, { excitement: 0.3 })]);
  const lightFirst = step(light, null).body;
  const understood = { ...light, charge: light.charge.map((c, i) => (i === 0 ? 0 : c)), cause: light.cause.map((c) => ({ ...c, open: false })) };
  const settling = step(understood, lightFirst);
  assert.equal(settling.body.zones[0]!.signal, 'itch');
  assert.deepEqual(bodyWarnings('loc:f17e', settling.body, settling.mem), []);
  // but a zone still blocked after a slow fall is congested, and that warns
  const slow = step({ ...m, charge: m.charge.map((c, i) => (i === 0 ? c - 10 : c)) }, first);
  assert.equal(bodyWarnings('loc:f17e', slow.body, slow.mem)[0]?.sickness, 'congested');
});

test('the owner\'s example: a fearful decision to fix what came in aches at the throat, on the left, growing until a eureka', () => {
  // control over another's process, taken on as a burden from what came in (intake: the left)
  const burden = write(createPresetMemory('brain:0e0f'), Array.from({ length: 4 }, (_, i) => at(100 + i, { cat: 'CONTACT', felt: 'solar-control' })));
  let prev: BodyState | null = null;
  const aches: number[] = [];
  let last: ReturnType<typeof step> | null = null;
  for (let k = 0; k < 5; k++) { last = step(burden, prev); prev = last.body; aches.push(last.body.zones[2]!.ache); }
  assert.ok(aches.every((a, i) => i === 0 || a >= aches[i - 1]!), `the dull ache grows while the loop lasts: ${aches.join(' ')}`);
  assert.equal(last!.body.zones[2]!.signal, 'ache');
  const w = bodyWarnings('brain:0e0f', { ...last!.body, kind: 'organic' }, last!.mem)[0]!;
  assert.deepEqual([w.source, w.place, w.side, w.quality, w.visual.look], ['solar plexus', 'throat', 'left', 'Wisdom & Surrender', 'tinge']);
  assert.match(warningLine(w), /^My throat, on the left: inflamed \(solar-control, held in my solar plexus\), the ache is getting worse\.$/);
  // the eureka: the realization lets it go (the charge back at rest, the link closed)
  const realized = { ...burden, charge: burden.charge.map((c, i) => (i === 2 ? 0 : c)), cause: burden.cause.map((c) => ({ ...c, open: false })) };
  const eureka = step(realized, prev);
  assert.equal(eureka.body.zones[2]!.signal, 'pain', 'all of it at once is too fast: a sharp pain');
  // at the body's pace: a little each checkpoint (it itches), then understood at last
  let held = burden.charge[2]!;
  let pace: BodyState = prev!;
  while (held > RELEASE_RATE) {
    held -= RELEASE_RATE;
    const s1 = step({ ...burden, charge: burden.charge.map((c, i) => (i === 2 ? held : c)) }, pace);
    assert.equal(s1.body.zones[2]!.signal, 'itch');
    pace = s1.body;
  }
  const settled = step({ ...burden, charge: burden.charge.map((c, i) => (i === 2 ? 0 : c)), cause: burden.cause.map((c) => ({ ...c, open: false })) }, pace);
  assert.equal(settled.body.zones[2]!.signal, 'eureka', 'released at the body\'s pace and understood: the eureka');
  const notice = bodyWarnings('brain:0e0f', { ...settled.body, kind: 'organic' }, settled.mem)[0]!;
  assert.equal(warningLine(notice), 'Something let go in my throat, on the left: Wisdom & Surrender came back.');
  assert.equal(notice.visual.look, 'glow');
});
