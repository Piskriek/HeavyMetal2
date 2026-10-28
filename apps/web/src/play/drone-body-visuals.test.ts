// Plan 56 §20: the drone's body shows its warnings, on its real parts, where it is held and where it shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten } from '@hm/kitspec';
import type { BodyWarning } from '@hm/harness';
import { DRONE_KIT } from './kit-drone';
import {
  CONGESTED_HUE, DRONE_ZONE_PARTS, INFLAMED_HUE, bodyJitter, hintsFromWarnings, limpRoll, lookOpacity, overlayPlan, partSide, type BodyLook,
} from './drone-body-visuals';

const placed = flatten(DRONE_KIT, 'drone-vacuum');

const warning = (over: Partial<BodyWarning>): BodyWarning => ({
  of: 'loc:f17e', ray: 1, source: 'thruster pods', at: 5, place: 'radio', quality: 'Wisdom & Surrender', side: 'left',
  signal: 'ache', sickness: 'congested', ache: 0.4, d: 'solar-control',
  visual: { place: 'radio', side: 'left', hue: '#3c78d2', look: 'stiff' }, ...over,
});

test('every zone has parts on the drone, and every part sits in at most one zone', () => {
  for (let ray = 1; ray <= 7; ray++) {
    assert.ok(placed.some((p) => DRONE_ZONE_PARTS[ray]!(p.path)), `ray ${ray} has parts`);
  }
  for (const p of placed) {
    const zones = Object.values(DRONE_ZONE_PARTS).filter((inZone) => inZone(p.path)).length;
    assert.ok(zones <= 1, `${p.path} is in ${zones} zones`);
  }
  assert.deepEqual([partSide('lamp-front-left'), partSide('thruster-back-right'), partSide('hull'), partSide('skid-left')], ['left', 'right', 'center', 'left']);
});

test('the voice zone on the left lights the left radio mast and nav lamps only; a middle part warned on one side shows only that half', () => {
  const lamps = overlayPlan(placed, [{ ray: 5, side: 'left', hue: '#3c78d2', look: 'static' }]);
  assert.ok(lamps.length > 0);
  assert.ok(lamps.every((o) => /^(lamp|mast)-/.test(o.path) && partSide(o.path) === 'left'), lamps.map((o) => o.path).join());
  assert.ok(['mast-base-left', 'mast-left', 'mast-tip-left'].every((m) => lamps.some((o) => o.path === m)), 'the left radio mast, footing to tip');
  // the ache starves each lamp's glow (a dark shell outside) and crackles blue over it: the voice goes dim
  const starved = lamps.filter((o) => o.look === 'starve');
  assert.equal(starved.length, lamps.filter((o) => o.look === 'static').length);
  const pained = overlayPlan(placed, [{ ray: 5, side: 'left', hue: '#3c78d2', look: 'flash' }]);
  assert.equal(pained.filter((o) => o.look === 'starve').length, pained.filter((o) => o.look === 'flash').length, 'a pain starves the glow too');
  assert.equal(overlayPlan(placed, [{ ray: 5, side: 'left', hue: '#3c78d2', look: 'tinge' }]).filter((o) => o.look === 'starve').length, 0, 'an itch does not');
  assert.ok(starved.every((o) => o.hue === '#000000' && o.size[0] > lamps.find((x) => x.path === o.path && x.look === 'static')!.size[0]));
  const hull = overlayPlan(placed, [{ ray: 4, side: 'left', hue: '#3cb45a', look: 'stiff' }]);
  assert.equal(hull.length, 1);
  const whole = overlayPlan(placed, [{ ray: 4, side: 'center', hue: '#3cb45a', look: 'stiff' }])[0]!;
  assert.ok(Math.abs(hull[0]!.size[0] - whole.size[0] / 2) < 1e-9, 'half as wide');
  assert.ok(hull[0]!.offsetX > 0, 'the drone\'s left is +x');
  // kit boxes stand on their base, so the overlay rises to the part's centre (else it hangs half a part low)
  const hullH = (placed.find((p) => p.path === 'hull')!.source as { size: readonly number[] }).size[1]!;
  assert.ok(Math.abs(whole.offsetY - hullH / 2) < 1e-9);
  assert.ok(whole.size[1] > (placed.find((p) => p.path === 'hull')!.source as { size: readonly number[] }).size[1]!, 'grown over its part');
});

test('a held control shows where it is held by its stage and where it shows as static; a pain flashes there', () => {
  const congested = hintsFromWarnings([warning({})]);
  assert.deepEqual(congested.map((h) => [h.ray, h.look, h.hue]), [[1, 'stiff', CONGESTED_HUE], [5, 'static', '#3c78d2']]);
  const inflamed = hintsFromWarnings([warning({ sickness: 'inflamed' })]);
  assert.deepEqual(inflamed.map((h) => [h.ray, h.look, h.hue]), [[1, 'pulse', INFLAMED_HUE], [5, 'static', '#3c78d2']]);
  const runaway = hintsFromWarnings([warning({ sickness: 'runaway' })]);
  assert.equal(runaway[0]!.look, 'crack');
  assert.ok(bodyJitter(runaway) > 0 && bodyJitter(inflamed) === 0, 'only a runaway shakes the drone');
  const pain = hintsFromWarnings([warning({ signal: 'pain', sickness: null })]);
  assert.deepEqual(pain.map((h) => [h.ray, h.look]), [[5, 'flash']]);
  const itch = hintsFromWarnings([warning({ signal: 'itch', sickness: null })]);
  assert.deepEqual(itch.map((h) => [h.ray, h.look]), [[5, 'tinge']]);
  assert.ok(hintsFromWarnings([warning({ side: 'right' })]).every((h) => h.side === 'right'));
});

test('a eureka sweeps the antidote\'s colour from where it was held up into where it ached', () => {
  const e = hintsFromWarnings([warning({ signal: 'eureka', sickness: null, ache: 0 })]);
  assert.deepEqual(e.map((h) => [h.ray, h.look, h.hue]), [[1, 'sweep-from', '#3c78d2'], [5, 'sweep-to', '#3c78d2']]);
  // the held zone fades first, then the aching zone brightens
  assert.ok(lookOpacity('sweep-from', 0.1) > lookOpacity('sweep-to', 0.1));
  assert.ok(lookOpacity('sweep-to', 1.8) > lookOpacity('sweep-from', 1.8));
});

test('every look stays a visible, bounded opacity and is deterministic; a numb side dips the drone toward it', () => {
  const looks: BodyLook[] = ['flash', 'glow', 'stiff', 'pulse', 'static', 'starve', 'flicker', 'tinge', 'crack', 'limp', 'sweep-from', 'sweep-to'];
  for (const look of looks) {
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      const t = i * 0.037;
      const a = lookOpacity(look, t, 2);
      assert.ok(a >= 0 && a <= 1, `${look} at ${t}: ${a}`);
      assert.equal(a, lookOpacity(look, t, 2));
      peak = Math.max(peak, a);
    }
    assert.ok(peak > 0.2, `${look} shows (peak ${peak})`);
  }
  const numb = hintsFromWarnings([warning({ sickness: 'numb', signal: null })]);
  assert.ok(limpRoll(numb) < 0, 'left numb dips +x');
  assert.ok(limpRoll(hintsFromWarnings([warning({ sickness: 'numb', signal: null, side: 'right' })])) > 0);
  assert.equal(limpRoll([]), 0);
});
