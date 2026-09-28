/**
 * AutoPaint — the easy paint rules, asserted headlessly on a blank road mask.
 *
 * What is checked, and why it matters to someone driving on the result:
 *  - **a band is a band**: the carriageway covers the centre, leaves the verge alone, and its feather
 *    never bleeds outside the requested width;
 *  - **re-running is free**: the same rule with the same numbers over the same span changes nothing the
 *    second time (order-independent noise, no double-darkening), which is what makes "Re-run jobs" and
 *    live sliders safe;
 *  - **the preview does not lie**: `preview` runs the real rule on a scratch mask and reports exactly
 *    what the click then changes;
 *  - **corners read the bend**: scree lands on the outside, and nothing at all on a straight;
 *  - **markings are per row**, dropped where the bend is tight;
 *  - **shoulders and ruts stay in their lanes**;
 *  - **undo and factory reset are reversible**: the mask *and* the job list come back;
 *  - **jobs ride in the save**: the road mask document round-trips them, so a track loads dressed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfaceMask } from '../src/game/surface/surface-mask';
import { RoadMask } from '../src/game/surface/road-mask';
import { AutoPaint, flatPaintField, jobsFromDoc, jobsToDoc } from '../src/game/surface/auto-paint';
import { PAINT_PRESETS, coverage, paintRule } from '../src/game/surface/paint-rules';
import type { PaintField, RowInfo } from '../src/game/surface/paint-rules';
import {
  MARK_CENTRE_DOUBLE, MARK_EDGE_LINES, MARK_LANE_DASHES, MARK_NONE, SURFACE_ASPHALT, SURFACE_COBBLE, SURFACE_DIRT, SURFACE_GRAVEL, SURFACE_PLANK,
} from '../src/game/surface/surface-table';

const ACROSS = 16;
const ROWS = 64;

/** A blank road of `ROWS` rows, optionally with a per-row override (bends, bridges, stages). */
function field(info?: (row: number) => Partial<RowInfo>): PaintField {
  const mask = new SurfaceMask(ACROSS, ROWS);
  const base: RowInfo = { stage: 'alpine', turnRate: 0, onBridge: false, inLoop: false, halfWidth: 480 };
  return {
    mask, across: ACROSS, rows: ROWS, step: 60, length: ROWS * 60,
    rowAt: (s) => s / 60,
    sOfRow: (row) => row * 60 + 30,
    infoAt: (s) => ({ ...base, ...(info?.(Math.floor(s / 60)) ?? {}) }),
  };
}

const centre = (f: PaintField, row: number) => f.mask.dominantId(Math.floor(ACROSS / 2), row);
const column = (f: PaintField, row: number, c: number) => f.mask.dominantId(c, row);
/** Road lines are opt-in (the owner wants no lane paint by default); the marking tests switch them on. */
const withLines = (f: PaintField) => { const a = new AutoPaint(f); a.lines = true; return a; };

test('carriageway: centre covered, verge left alone, feather stays inside the width', () => {
  const f = field();
  const auto = new AutoPaint(f);
  const result = auto.runRule(paint('carriageway'), { surface: SURFACE_ASPHALT, width: 0.6, edge: 0.2, wobble: 0 });
  assert.ok(result.rows > 0 && result.changed > 0, 'the pass painted');
  assert.equal(centre(f, 10), SURFACE_ASPHALT);
  assert.equal(column(f, 10, 0), SURFACE_DIRT, 'the left edge is untouched');
  assert.equal(column(f, 10, ACROSS - 1), SURFACE_DIRT, 'the right edge is untouched');
  // width 0.6 → columns 3‥12 are inside; 0‥2 and 13‥15 must be clean.
  for (const c of [0, 1, 2, 13, 14, 15]) assert.equal(column(f, 10, c), SURFACE_DIRT, `column ${c} is outside the band`);
  for (const c of [4, 8, 11]) assert.equal(column(f, 10, c), SURFACE_ASPHALT, `column ${c} is inside`);
  // The feather is real, not decorative: the outermost column of the band takes the surface as a minority
  // blend (so the road shows through) while still being written — coverage counts dominance, changed
  // counts bytes, and the soft edge is exactly the difference.
  const soft = f.mask.get(3, 10);
  assert.equal(soft.id1, SURFACE_ASPHALT, 'the edge column was written');
  assert.ok(soft.weight > 0 && soft.weight < 128, `and left soft (${soft.weight}/255)`);
  assert.equal(column(f, 10, 3), SURFACE_DIRT, 'so it still reads as road');
  const asphalt = result.coverage.find((x) => x.id === SURFACE_ASPHALT)!.texels;
  assert.ok(asphalt > 0 && asphalt < result.changed, `${asphalt} solid texels inside ${result.changed} written`);
});

test('running the same pass again changes nothing (idempotent, so re-run and live sliders are safe)', () => {
  const f = field();
  const auto = new AutoPaint(f);
  const rule = paint('carriageway');
  const first = auto.runRule(rule, { width: 0.8, edge: 0.1, wobble: 0.4 });
  const after = f.mask.hash();
  const second = auto.runRule(rule, { width: 0.8, edge: 0.1, wobble: 0.4 });
  assert.ok(first.changed > 0, `first pass changed ${first.changed} texels`);
  assert.equal(second.changed, 0, 'second pass changes nothing');
  assert.equal(f.mask.hash(), after, 'byte-identical, even with the wobble on');
  assert.deepEqual(coverage(f, 0, ROWS), first.coverage.map((c) => ({ ...c })), 'and coverage is unchanged');
});

test('a preview reports exactly what the click will change, without touching the mask', () => {
  const f = field();
  const auto = new AutoPaint(f);
  const before = f.mask.hash();
  const rule = paint('carriageway');
  const params = { surface: SURFACE_ASPHALT, width: 0.7, edge: 0.25 };
  const preview = auto.runRule(rule, params, undefined, { preview: true });
  assert.equal(f.mask.hash(), before, 'the preview painted nothing');
  assert.ok(preview.rows > 0 && preview.coverage.length > 0, 'and still measured the result');
  const real = auto.runRule(rule, params);
  assert.equal(real.coverage[0].texels, preview.coverage[0].texels, 'preview == reality');
});

test('corner scree sits on the outside of the bend and never on a straight', () => {
  const bend = (row: number): Partial<RowInfo> => (row >= 20 && row < 40 ? { turnRate: 0.0009 } : {});
  const f = field(bend);
  const auto = new AutoPaint(f);
  auto.runRule(paint('corners'), { threshold: 0.00018, width: 0.4, strength: 1, leadIn: 0 });
  for (const c of [0, 1, 2]) assert.equal(column(f, 30, c), SURFACE_GRAVEL, `outside (left) column ${c} is scree`);
  for (const c of [12, 13, 14, 15]) assert.notEqual(column(f, 30, c), SURFACE_GRAVEL, 'the inside keeps its road');
  assert.equal(coverage(f, 0, 15).length, 0, 'nothing on the straight before the bend');
  assert.equal(coverage(f, 45, ROWS).length, 0, 'nothing on the straight after it');
});

test('markings set the flag byte per row and drop it in tight bends', () => {
  const f = field((row) => (row >= 30 && row < 34 ? { turnRate: 0.004 } : {}));
  const auto = withLines(f);
  auto.runRule(paint('markings'), { mode: 0, bendCut: 1, threshold: 0.0002, stadiumDouble: 1 });
  assert.equal(f.mask.get(4, 10).flags, MARK_LANE_DASHES | MARK_EDGE_LINES, 'straight: dashes + edges');
  assert.equal(f.mask.get(4, 32).flags, MARK_NONE, 'tight bend: no markings');
  const stadium = field(() => ({ stage: 'stadium' }));
  withLines(stadium).runRule(paint('markings'), { mode: 0 });
  assert.equal(stadium.mask.get(4, 5).flags, MARK_CENTRE_DOUBLE | MARK_EDGE_LINES, 'stadium ends with a double line');
  const forced = field();
  withLines(forced).runRule(paint('markings'), { mode: 1 });
  assert.equal(forced.mask.get(9, 40).flags, MARK_LANE_DASHES | MARK_EDGE_LINES);
  withLines(forced).runRule(paint('markings'), { mode: 3 });
  assert.equal(forced.mask.get(9, 40).flags, MARK_NONE, 'mode 3 clears them again');
});

test('shoulders hug both edges and ruts sit at the tyre lines', () => {
  const f = field();
  const auto = new AutoPaint(f);
  auto.runRule(paint('shoulders'), { surface: SURFACE_GRAVEL, width: 240, taper: 0, strength: 1, spareBridges: 0 });
  assert.equal(column(f, 20, 0), SURFACE_GRAVEL, 'left shoulder');
  assert.equal(column(f, 20, ACROSS - 1), SURFACE_GRAVEL, 'right shoulder');
  assert.equal(column(f, 20, 8), SURFACE_DIRT, 'the centre is untouched');

  // Ruts wear a painted road *back to* the base surface, so they only read on top of a carriageway.
  const worn = field();
  const wa = new AutoPaint(worn);
  wa.runRule(paint('carriageway'), { surface: SURFACE_ASPHALT, width: 1, edge: 0, wobble: 0, spareBridges: 0, spareLoops: 0 });
  wa.runRule(paint('ruts'), { surface: SURFACE_DIRT, depth: 1, breakup: 0, width: 40, gauge: 60 });
  // Lane 0 centre is u=0.125; a 60-unit gauge puts a track either side of it at u=0.0625 and 0.1875,
  // which are column boundaries, so each track shares its wear between the two columns it straddles.
  const wear = (c: number) => { const t = worn.mask.get(c, 12); return (t.id0 === SURFACE_DIRT ? 255 - t.weight : 0) + (t.id1 === SURFACE_DIRT && t.id0 !== t.id1 ? t.weight : 0); };
  assert.ok(wear(0) + wear(1) > 60, 'left track of lane 1 is worn through');
  assert.ok(wear(2) + wear(3) > 60, 'right track of lane 1 is worn through');
  assert.equal(centre(worn, 12), SURFACE_ASPHALT, 'and the road between the tracks is still asphalt');
  let wornTexels = 0;
  for (let c = 0; c < ACROSS; c++) if (wear(c) > 0) wornTexels++;
  assert.ok(wornTexels > 0 && wornTexels < ACROSS * 0.75, `ruts are lines, not a fill (${wornTexels} of ${ACROSS} columns worn)`);
});

test('painting surface 0 on a blank road changes nothing — the base is transparent, not a colour', () => {
  const f = field();
  const auto = new AutoPaint(f);
  const result = auto.runRule(paint('carriageway'), { surface: SURFACE_DIRT, width: 1, edge: 0, wobble: 0, spareBridges: 0 });
  assert.equal(result.changed, 0, 'so a "dirt" pass over unpainted road is a no-op…');
  assert.equal(f.mask.hash(), new SurfaceMask(ACROSS, ROWS).hash(), '…and leaves the mask byte-identical');
  // …which is why wear rules target the base id: they erase paint back to the road, not onto it.
  auto.runRule(paint('carriageway'), { surface: SURFACE_ASPHALT, width: 1, edge: 0, wobble: 0, spareBridges: 0 });
  const erase = auto.runRule(paint('carriageway'), { surface: SURFACE_DIRT, width: 1, edge: 0, wobble: 0, spareBridges: 0 });
  assert.ok(erase.changed > 0 && f.mask.data.every((b) => b === 0), 'a dirt pass over paint takes it off again');
});

test('bridges and loops can be spared by name, not by luck', () => {
  const f = field((row) => (row === 10 ? { onBridge: true } : row === 11 ? { inLoop: true } : {}));
  const auto = new AutoPaint(f);
  auto.runRule(paint('carriageway'), { width: 1, edge: 0, strength: 1, spareBridges: 1, spareLoops: 1, wobble: 0 });
  assert.equal(centre(f, 9), SURFACE_ASPHALT, 'row 9 got asphalt');
  assert.equal(centre(f, 10), SURFACE_DIRT, 'the plank bridge kept its deck');
  assert.equal(centre(f, 11), SURFACE_DIRT, 'the loop kept its deck');
  assert.equal(centre(f, 12), SURFACE_ASPHALT);
  auto.runRule(paint('carriageway'), { width: 1, edge: 0, strength: 1, spareBridges: 0, spareLoops: 0, wobble: 0 });
  assert.equal(centre(f, 10), SURFACE_ASPHALT, 'and paints them when told to');
});

test('a preset preview equals the apply, and every preset step is a real rule', () => {
  for (const preset of PAINT_PRESETS) {
    assert.ok(preset.steps.length >= 2, `${preset.id} is more than one pass`);
    for (const step of preset.steps) {
      const rule = paintRule(step.rule);
      assert.ok(rule, `${preset.id}: ${step.rule} is a real rule`);
      // A preset may only set parameters the rule declares, or it silently does nothing.
      for (const key of Object.keys(step.params ?? {})) assert.ok(rule!.params.some((p) => p.key === key), `${preset.id}.${step.rule} has no "${key}" parameter`);
    }
  }
  const f = field();
  const auto = new AutoPaint(f);
  const preview = auto.runPreset('asphalt-highway', undefined, {}, { preview: true });
  const applied = auto.runPreset('asphalt-highway');
  assert.deepEqual(applied.coverage, preview.coverage, 'the button shows what the button does');
  assert.ok(applied.coverage.some((c) => c.id === SURFACE_ASPHALT && c.texels > 100), 'asphalt dominates');
  assert.ok(applied.coverage.some((c) => c.id === SURFACE_GRAVEL), 'with gravel at the edges and corners');
  assert.equal(auto.jobs.length, applied.results.length, 'every step recorded a job');
});

test('undo and factory reset are reversible: mask and job list both come back', () => {
  const f = field();
  const auto = new AutoPaint(f);
  const empty = f.mask.hash();
  auto.runRule(paint('carriageway'), { width: 0.8, wobble: 0 });
  auto.runRule(paint('shoulders'), { width: 200 });
  assert.notEqual(f.mask.hash(), empty);
  assert.equal(auto.jobs.length, 2);

  assert.equal(auto.undo(), 'Shoulders & verge');
  assert.equal(auto.jobs.length, 1);
  assert.notEqual(f.mask.hash(), empty, 'only the shoulder pass went back');

  assert.equal(auto.undo(), 'Carriageway');
  assert.equal(f.mask.hash(), empty, 'the mask is byte-identical to before');
  assert.equal(auto.jobs.length, 0);
  assert.equal(auto.undo(), null, 'nothing left to undo');

  auto.runPreset('stadium-circuit');
  const dressed = f.mask.hash();
  assert.ok(auto.jobs.length >= 3);
  auto.resetToFactory();
  assert.equal(f.mask.hash(), empty, 'factory: nothing painted');
  assert.equal(auto.jobs.length, 0);
  auto.undo();
  assert.equal(f.mask.hash(), dressed, 'and the whole paint job returns');
  assert.ok(auto.jobs.length >= 3, 'with its jobs back, so Re-run still works');
});

test('jobs ride in the save: a road mask document round-trips them verbatim', () => {
  const road = new RoadMask(ROWS * 60, ACROSS, 60);
  const auto = new AutoPaint(flatPaintField(road));
  auto.lines = true;
  auto.runRule(paint('carriageway'), { width: 0.8, wobble: 0 });
  auto.runRule(paint('markings'), { mode: 1 });
  road.jobs = jobsToDoc(auto.jobs);
  const doc = road.toDoc('ridge');
  assert.ok(Array.isArray((doc as unknown as { jobs: unknown[] }).jobs) && (doc as unknown as { jobs: unknown[] }).jobs.length === 2);
  const back = RoadMask.fromDoc(doc, ROWS * 60);
  assert.ok(back, 'the document still fits the same track');
  assert.equal(back!.mask.hash(), road.mask.hash(), 'the mask survived');
  const restored = new AutoPaint(flatPaintField(back!));
  for (const job of jobsFromDoc(back!.jobs)) restored.jobs.push(job);
  assert.deepEqual(restored.jobs.map((j) => [j.rule, j.span, j.params]), auto.jobs.map((j) => [j.rule, j.span, j.params]));
  // Replaying on a fresh mask rebuilds the same paint — the point of recording jobs at all.
  const fresh = new AutoPaint(flatPaintField(new RoadMask(ROWS * 60, ACROSS, 60)));
  fresh.lines = true;
  fresh.replay(auto.jobs);
  assert.equal(fresh.field.mask.hash(), road.mask.hash(), 'replay reproduces the paint exactly');
});

test('stage theme dresses each stage from the table and refuses an undressed one', () => {
  const f = field((row) => (row < 30 ? { stage: 'mine' } : row < 60 ? { stage: 'stadium' } : { stage: 'zigzag' }));
  const auto = withLines(f);
  auto.runRule(paint('stage-theme'), { intensity: 1, keepBridges: 0, ruts: 1, markings: 1 });
  assert.equal(centre(f, 5), SURFACE_PLANK, 'the mine gets planks, from the table');
  assert.equal(centre(f, 45), SURFACE_COBBLE, 'stadium is cobbles');
  assert.equal(f.mask.get(4, 45).flags, MARK_CENTRE_DOUBLE | MARK_EDGE_LINES, 'with its markings');
  assert.equal(f.mask.get(4, 5).flags, MARK_NONE, 'and none underground');
  // An unknown stage is skipped, not painted over with something arbitrary.
  const odd = field(() => ({ stage: 'nowhere' as unknown as RowInfo['stage'] }));
  const r = new AutoPaint(odd).runRule(paint('stage-theme'), {});
  assert.equal(r.rows, 0);
  assert.equal(odd.mask.hash(), new SurfaceMask(ACROSS, ROWS).hash());
});

/** The rule by id, failing loudly: a typo in a test should not read as "the rule painted nothing". */
function paint(id: string) {
  const rule = paintRule(id);
  if (!rule) throw new Error(`no rule ${id}`);
  return rule;
}

test('road lines are off by default: no rule, preset or theme writes a marking flag until switched on', () => {
  const f = field((row) => (row < 40 ? { stage: 'stadium' } : {}));
  const auto = new AutoPaint(f);
  assert.equal(auto.lines, false);
  const flagged = () => { let n = 0; for (let row = 0; row < ROWS; row++) for (let c = 0; c < ACROSS; c++) if (f.mask.get(c, row).flags) n++; return n; };
  const r = auto.runRule(paint('markings'), { mode: 1 });
  assert.equal(r.rows, 0, 'the Markings rule is a no-op');
  assert.equal(auto.jobs.length, 0, 'and records no job');
  for (const preset of PAINT_PRESETS) auto.runPreset(preset.id);
  auto.runRule(paint('stage-theme'), { markings: 1 });
  assert.equal(flagged(), 0, 'no preset or stage theme painted a line');
  assert.ok(!auto.jobs.some((j) => j.rule === 'markings'), 'no markings job was recorded');
  auto.lines = true;
  auto.runRule(paint('markings'), { mode: 1 });
  assert.ok(flagged() > 0, 'switched on, the lines come back');
});
