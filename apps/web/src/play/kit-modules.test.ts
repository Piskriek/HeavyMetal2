// The material test piece (TICKET-40, plan 41 §4.6): the shape a layered material is judged on. These tests hold it to what the review
// asked for — five partgen parts on sockets, grounded, exactly 0.60 m tall, every material a real `mat:` preset — and to the strict
// typing that the review item was about (the kit is a `Kit`, not a widened literal).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, presetSockets, validate, type Kit } from '@hm/kitspec';
import { buildPart } from '@hm/partgen';
import { MATERIAL_SHELF, resolveMatPreset } from '@hm/matstack';
import {
  MATSTACK_TEST_PIECE_KIT,
  MAT_PRESET_SKINS,
  TEST_PIECE_HEIGHT,
  TEST_PIECE_PRESET,
  kitMaterialKeys,
  withMaterial,
} from './kit-modules';

type Box = [[number, number, number], [number, number, number]];

/** Every vertex of a placed part, in the piece's own frame. */
function placedPoints(kit: Kit, preset: string): { path: string; points: [number, number, number][] }[] {
  return flatten(kit, preset).map((placed) => {
    const src = placed.source;
    const m = placed.matrix as number[];
    const out: [number, number, number][] = [];
    if (src.kind === 'param') {
      const md = buildPart(src.gen, src.params, 2);
      assert.ok(md, `${placed.path}: the generator '${src.gen}' built nothing`);
      for (let i = 0; i < md.positions.length; i += 3) {
        const x = md.positions[i]!, y = md.positions[i + 1]!, z = md.positions[i + 2]!;
        out.push([
          m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
          m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
          m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
        ]);
      }
    }
    return { path: placed.path, points: out };
  });
}

test('the test piece validates as a kit, with no issues at all', () => {
  // the review item: the literal is annotated `Kit`, so `kind: 'param'` checks against PartSource instead of widening to string
  const kit: Kit = MATSTACK_TEST_PIECE_KIT;
  assert.deepEqual(validate(kit, TEST_PIECE_PRESET), []);
});

test('it is five partgen parts on the skid\'s four sockets', () => {
  const placed = flatten(MATSTACK_TEST_PIECE_KIT, TEST_PIECE_PRESET);
  assert.equal(placed.length, 5);
  for (const p of placed) assert.equal(p.source.kind, 'param', `${p.path} should come from a generator`);
  const sockets = Object.keys(presetSockets(MATSTACK_TEST_PIECE_KIT, TEST_PIECE_PRESET));
  assert.deepEqual(sockets.sort(), ['skid.beamMount', 'skid.bracketMount', 'skid.canMount', 'skid.panelMount']);
  // four of the five parts hang on one of those sockets; the skid is the root
  const mounted = placed.filter((p) => p.path !== 'skid');
  assert.equal(mounted.length, 4);
  assert.deepEqual(mounted.map((p) => p.path).sort(), ['bevel-panel', 'bracket', 'short-can', 'square-beam']);
  // both detail ranks are exercised: the piece has something to show at rank 0 and at rank 2
  assert.ok(placed.some((p) => p.rank === 0));
  assert.ok(placed.some((p) => p.rank === 1));
});

test('it stands on the floor and is exactly 0.60 m tall', () => {
  const parts = placedPoints(MATSTACK_TEST_PIECE_KIT, TEST_PIECE_PRESET);
  let low = Infinity;
  let high = -Infinity;
  for (const part of parts) {
    assert.ok(part.points.length > 0, `${part.path} has no geometry`);
    for (const [, y] of part.points) {
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
  }
  assert.ok(Math.abs(low) < 1e-6, `the piece floats or sinks: its lowest point is at y = ${low.toFixed(4)}`);
  assert.ok(Math.abs(high - TEST_PIECE_HEIGHT) < 1e-6, `the piece is ${high.toFixed(4)} m tall, not ${TEST_PIECE_HEIGHT}`);
});

test('every part is where its socket says, and no part hangs in the air', () => {
  // each mounted part's box overlaps the skid's box in plan view: nothing floats off the side
  const parts = new Map(placedPoints(MATSTACK_TEST_PIECE_KIT, TEST_PIECE_PRESET).map((p) => [p.path, p.points]));
  const skid = parts.get('skid')!;
  const box = (pts: readonly [number, number, number][]): Box => {
    const b: Box = [
      [Infinity, Infinity, Infinity],
      [-Infinity, -Infinity, -Infinity],
    ];
    for (const [x, y, z] of pts) {
      b[0][0] = Math.min(b[0][0], x);
      b[0][1] = Math.min(b[0][1], y);
      b[0][2] = Math.min(b[0][2], z);
      b[1][0] = Math.max(b[1][0], x);
      b[1][1] = Math.max(b[1][1], y);
      b[1][2] = Math.max(b[1][2], z);
    }
    return b;
  };
  const skidBox = box(skid);
  for (const [path, pts] of parts) {
    if (path === 'skid') continue;
    const b = box(pts);
    const overlaps = b[0][0] < skidBox[1][0] && b[1][0] > skidBox[0][0] && b[0][2] < skidBox[1][2] && b[1][2] > skidBox[0][2];
    assert.ok(overlaps, `${path} hangs off the skid (${b[0].map((v) => v.toFixed(2))} .. ${b[1].map((v) => v.toFixed(2))})`);
    // and it rests on the skid's top (0.10 m) rather than hovering above it
    assert.ok(b[0][1] <= 0.1001, `${path} starts at ${b[0][1].toFixed(3)} m, above the skid's 0.10 m top`);
  }
});

test('every material it wears is a real mat: preset in the shelf', () => {
  for (const key of kitMaterialKeys(MATSTACK_TEST_PIECE_KIT)) {
    assert.match(key, /^mat:/, `${key} is not a mat: preset id`);
    assert.ok(MATERIAL_SHELF[key] ?? resolveMatPreset(key), `${key} is not in the shelf`);
  }
  // and the skins are the palette's own ids, not free strings
  for (const id of Object.values(MAT_PRESET_SKINS)) assert.ok(resolveMatPreset(id), `${id} does not resolve`);
  // the piece shows a dielectric paint, a brushed steel and a rusted hopper: three different bases
  const bases = new Set(kitMaterialKeys(MATSTACK_TEST_PIECE_KIT).map((id) => resolveMatPreset(id)!.base.name));
  assert.ok(bases.size >= 3, `the piece only shows ${bases.size} base surfaces`);
});

test('withMaterial dresses every part and slot in one key, and changes nothing else', () => {
  const dressed = withMaterial(MATSTACK_TEST_PIECE_KIT, 'M');
  assert.deepEqual(kitMaterialKeys(dressed), ['M']);
  assert.deepEqual(kitMaterialKeys(MATSTACK_TEST_PIECE_KIT).includes('M'), false, 'the original was changed');
  // the geometry is identical: same parts, same placements, same ranks
  const before = flatten(MATSTACK_TEST_PIECE_KIT, TEST_PIECE_PRESET);
  const after = flatten(dressed, TEST_PIECE_PRESET);
  assert.equal(after.length, before.length);
  before.forEach((p, i) => {
    assert.deepEqual(after[i]!.matrix, p.matrix, `${p.path} moved`);
    assert.equal(after[i]!.rank, p.rank);
    assert.equal(after[i]!.material, 'M');
    if (p.slotMaterials) assert.deepEqual(Object.values(after[i]!.slotMaterials!), Object.keys(p.slotMaterials).map(() => 'M'));
  });
  assert.deepEqual(validate(dressed, TEST_PIECE_PRESET), [], 'the dressed kit must still validate');
});
