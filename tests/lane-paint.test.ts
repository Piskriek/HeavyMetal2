/**
 * M01 · T6/T7 dressing — the lane paint.
 *
 * An authored network used to be physics and logic with nothing to look at. `lane-paint.ts` draws it:
 * one ribbon per path, sampled from `sampleLane` (the same call the physics steers by), tinted by the
 * kind its end infers. These assertions are the headless half of "and you can see the lane you are
 * driving on" — three.js builds geometry and materials in node, so the numbers are real even though
 * the pixels are the browser's call.
 *
 * What is checked, and why each one would matter to a player:
 *  - **the paint is where the physics drives** — every vertex, read back through the inverse mapping,
 *    sits at the path's own centre ± the stroke;
 *  - **the paint covers the lane exactly** — first sample at the first node, last at the last node,
 *    and never a step longer than asked (a chord across a curve would be a lane you cannot drive);
 *  - **the end reads as its kind** — a merge ends green, a split amber, an out-of-bounds spur red;
 *  - **it floats** — no vertex is below the road it is painted on, so it cannot z-fight or sink;
 *  - **it is cheap** — one material ever, one mesh per path, and a frame that passes the same document
 *    costs nothing at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  LANE_KIND_PAINT, LANE_PAINT_COLOR, LANE_PAINT_END_LENGTH, LANE_PAINT_HALF_STROKE, LANE_PAINT_LIFT,
  LANE_PAINT_STEP, LanePaint, lanePaintSamples, lanePaintWorldPoint, lanePathTerminalKind,
} from '../src/game/lane-paint';
import { inferKind, sampleLane, sampleLaneNetwork, type LaneNetwork } from '../src/game/lane-network';
import { engineFromWorld, engineXFromDistance, getTrackSpace } from '../src/game/track-space';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

/**
 * Geometry is stored as `Float32Array` (three.js' default), and world coordinates on this mountain run
 * to ~2·10⁵ — where a float32 step is ~0.016 units. A lane is 240 wide, so that is noise; but the
 * test must not claim more precision than the buffer has, so positions are compared within 0.05 and a
 * lift within 0.02.
 */
const POSITION_EPS = 0.05;
const LIFT_EPS = 0.02;

/**
 * A world point back in engine coordinates. `track-space`'s own `engineFromWorld` reports the
 * canonical triple (track distance, lane z); engine x is `engineXFromDistance(distance)`, the same
 * conversion `lane-paint.ts` uses in the other direction.
 */
function backToEngine(world: THREE.Vector3) {
  const canonical = engineFromWorld(getTrackSpace(), { x: world.x, y: world.y, z: world.z });
  return { x: engineXFromDistance(canonical.distance), z: canonical.laneZ };
}

/** Every vertex of a ribbon, in world space. */
function verticesOf(mesh: THREE.Mesh): THREE.Vector3[] {
  const position = mesh.geometry.attributes.position;
  const out: THREE.Vector3[] = [];
  for (let index = 0; index < position.count; index++) {
    out.push(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
  }
  return out;
}

function makePaint() {
  const scene = new THREE.Scene();
  const paint = new LanePaint(scene);
  return { scene, paint };
}

test('one mesh per path, and one material for the whole layer however many documents it paints', () => {
  const { paint } = makePaint();
  const network = sampleLaneNetwork('ridge');

  assert.equal(paint.setNetwork(network), true, 'the first document is painted');
  assert.equal(paint.stats.ribbons, network.paths.length, 'a ribbon per path');
  assert.equal(paint.root.children.length, network.paths.length);
  assert.equal(paint.stats.materialsCreated, 1, 'vertex colours: one material, not one per path');
  const vertices = paint.stats.vertices;
  assert.ok(vertices > 0 && vertices % 2 === 0, 'two vertices per sample');

  // Every ribbon is named for its path and shares the one material.
  for (const path of network.paths) {
    const mesh = paint.root.children.find((child) => child.name === `LanePaint:${path.id}`) as THREE.Mesh | undefined;
    assert.ok(mesh, `path ${path.id} has a ribbon`);
    assert.equal(mesh!.material, (paint.root.children[0] as THREE.Mesh).material, 'and it is the shared one');
  }

  // A second, different document repaints but never re-creates a material.
  const other: LaneNetwork = { ...network, paths: network.paths.slice(0, 3) };
  assert.equal(paint.setNetwork(other), true);
  assert.equal(paint.stats.ribbons, 3, 'the new document replaced the old ribbons');
  assert.equal(paint.stats.materialsCreated, 1, 'still one material');
  assert.equal(paint.stats.disposals, network.paths.length, 'and the replaced geometries were disposed, not leaked');
  assert.ok(paint.stats.vertices < vertices, 'fewer paths, fewer vertices');
});

test('a frame that hands back the same document object costs nothing', () => {
  const { paint } = makePaint();
  const network = sampleLaneNetwork('ridge');
  paint.setNetwork(network);
  const rebuilds = paint.stats.rebuilds;

  // This is the render loop's real pattern: once per frame, with `engine.lanePaths`.
  for (let frame = 0; frame < 120; frame++) assert.equal(paint.setNetwork(network), false);
  assert.equal(paint.stats.rebuilds, rebuilds, '120 frames, no rebuilds');

  // A *new object* with the same content is a document change (that is what saving or undoing does).
  assert.equal(paint.setNetwork({ ...network }), true, 'identity, not deep equality, decides');
  assert.equal(paint.stats.rebuilds, rebuilds + network.paths.length);
});

test('the paint is exactly where the physics drives: the path\'s own centre ± the stroke', () => {
  const { paint } = makePaint();
  const network = sampleLaneNetwork('ridge');
  paint.setNetwork(network);
  let checked = 0;

  // The law is written against the *sample*, not against the inverse mapping. `engineFromWorld` is
  // not single-valued where the track doubles back through a giant loop — the same engine x meets two
  // ribbons at different heights — so a round trip can report the other ribbon. The sample is the
  // honest reference: it is the same `sampleLane` call the physics steers by, and the paint's job is
  // to be that curve, ± the stroke, lifted.
  for (const path of network.paths) {
    const mesh = paint.root.children.find((child) => child.name === `LanePaint:${path.id}`) as THREE.Mesh;
    const samples = lanePaintSamples(network, path.id);
    const vertices = verticesOf(mesh);
    assert.equal(vertices.length, samples.length * 2, `${path.id}: two vertices per sample, no more`);

    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      const spine = sampleLane(network, path.id, sample.x);
      assert.ok(spine, `the sample at x ${sample.x} is on the path`);
      assert.equal(sample.z, spine!.z, 'and it is the physics\' own centre');
      for (const side of [-1, 1] as const) {
        const expected = lanePaintWorldPoint(sample.x, sample.z + side * LANE_PAINT_HALF_STROKE);
        const vertex = vertices[index * 2 + (side === -1 ? 0 : 1)];
        assert.ok(near(vertex.x, expected.x, POSITION_EPS), `${path.id} @${sample.x}: x of the ${side} edge`);
        assert.ok(near(vertex.z, expected.z, POSITION_EPS), `${path.id} @${sample.x}: z of the ${side} edge`);
        const lifted = expected.y + LANE_PAINT_LIFT;
        assert.ok(near(vertex.y, lifted, POSITION_EPS), `${path.id} @${sample.x}: lifted to ${lifted}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 100, `every vertex was checked (${checked})`);
});

test('the paint covers the lane exactly, and never steps further than asked', () => {
  const network = sampleLaneNetwork('ridge');
  for (const path of network.paths) {
    const samples = lanePaintSamples(network, path.id);
    const nodes = path.nodeIds.map((id) => network.nodes.find((node) => node.id === id)!);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    assert.ok(samples.length >= 2, `${path.id} has a strip`);
    assert.equal(samples[0].x, first.x, 'the strip starts at the first node, not before it');
    assert.equal(samples[samples.length - 1].x, last.x, 'and ends at the last node — a lane ends where it ends');
    for (let index = 1; index < samples.length; index++) {
      const step = samples[index].x - samples[index - 1].x;
      assert.ok(step > 0, 'x strictly increases');
      assert.ok(step <= LANE_PAINT_STEP + 1e-9, `step ${step} is within ${LANE_PAINT_STEP}`);
    }
    // Every sample is the surface's own sample: the paint is not a second guess at the lane's centre.
    for (const sample of samples) {
      const truth = sampleLane(network, path.id, sample.x);
      assert.ok(truth);
      assert.equal(sample.z, truth!.z);
      assert.equal(sample.halfWidth, truth!.halfWidth);
    }
  }
});

test('a path ends in the colour of what happens there', () => {
  const { paint } = makePaint();
  const network = sampleLaneNetwork('ridge');
  paint.setNetwork(network);

  let green = 0; let amber = 0; let red = 0;
  for (const path of network.paths) {
    const kind = lanePathTerminalKind(network, path.id);
    const expected = new THREE.Color(LANE_KIND_PAINT[kind]);
    const mesh = paint.root.children.find((child) => child.name === `LanePaint:${path.id}`) as THREE.Mesh;
    const color = mesh.geometry.attributes.color;
    const last = color.count - 1;
    for (const vertex of [last, last - 1]) {
      assert.ok(near(color.getX(vertex), expected.r, 0.005), `${path.id} ends in ${kind}`);
      assert.ok(near(color.getY(vertex), expected.g, 0.005));
      assert.ok(near(color.getZ(vertex), expected.b, 0.005));
    }
    // The neutral end of the strip is the neutral paint (paths shorter than the tint get one colour).
    const samples = lanePaintSamples(network, path.id);
    const span = samples[samples.length - 1].x - samples[0].x;
    if (kind !== 'normal' && span > 2 * LANE_PAINT_END_LENGTH) {
      const plain = new THREE.Color(LANE_PAINT_COLOR);
      assert.ok(near(color.getX(0), plain.r, 0.005), `${path.id} starts neutral`);
      assert.ok(near(color.getY(0), plain.g, 0.005));
      assert.ok(near(color.getZ(0), plain.b, 0.005));
    }
    if (kind === 'merge') green += 1;
    if (kind === 'split') amber += 1;
    if (kind === 'oob') red += 1;
  }
  // The sample network exercises all three terminal kinds — otherwise this test proves nothing.
  assert.ok(green > 0 && amber > 0 && red > 0, `merge ${green}, split ${amber}, oob ${red}`);

  // …and the red one is the dead end, by the network's own inference rather than the colour's word.
  const spur = network.paths.find((path) => lanePathTerminalKind(network, path.id) === 'oob')!;
  const tail = spur.nodeIds[spur.nodeIds.length - 1];
  assert.equal(inferKind(network, tail), 'oob');
});

test('the paint floats above the road it is painted on, by one constant', () => {
  const { paint } = makePaint();
  const network = sampleLaneNetwork('ridge');
  paint.setNetwork(network);
  assert.ok(LANE_PAINT_LIFT > 0, 'a lift that is not positive is a z-fight waiting to happen');
  let lowest = Infinity;

  for (const path of network.paths) {
    const mesh = paint.root.children.find((child) => child.name === `LanePaint:${path.id}`) as THREE.Mesh;
    const samples = lanePaintSamples(network, path.id);
    const vertices = verticesOf(mesh);
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      for (const side of [-1, 1] as const) {
        const vertex = vertices[index * 2 + (side === -1 ? 0 : 1)];
        // Directly above the surface point it was built from: no vertex is *in* the road.
        const surface = lanePaintWorldPoint(sample.x, sample.z + side * LANE_PAINT_HALF_STROKE);
        const gap = vertex.y - surface.y;
        lowest = Math.min(lowest, gap);
        assert.ok(gap > 0, 'above, never below');
        // ...and above the lane's own centre line at that x, which is the surface a ball rides.
        const centre = lanePaintWorldPoint(sample.x, sample.z);
        assert.ok(vertex.y > centre.y - 1e-6, 'and above the centre line it straddles');
      }
    }
  }
  assert.ok(
    near(lowest, LANE_PAINT_LIFT, LIFT_EPS),
    `the lift is the constant ${LANE_PAINT_LIFT} (lowest gap was ${lowest.toFixed(6)})`,
  );
});

test('one path can be repainted alone, and a foreign document is refused', () => {
  const { paint } = makePaint();
  const network = sampleLaneNetwork('ridge');
  paint.setNetwork(network);
  const rebuilds = paint.stats.rebuilds;
  const path = network.paths[2];

  assert.equal(paint.rebuildPath(network, path.id), true, 'the path was there, and is again');
  assert.equal(paint.stats.rebuilds, rebuilds + 1, 'exactly one strip rebuilt');
  assert.equal(paint.stats.ribbons, network.paths.length, 'and the layer still has one per path');

  assert.equal(paint.rebuildPath({ ...network }, path.id), false,
    'a document the layer does not hold is not painted behind the renderer\'s back');
  assert.equal(paint.stats.rebuilds, rebuilds + 1);
});

test('an empty document paints nothing, and dispose leaves the scene as it found it', () => {
  // Measured *before* the layer is built: "as it found it" means the scene the renderer handed over,
  // which is a scene with no lane paint in it at all.
  const scene = new THREE.Scene();
  const before = scene.children.length;
  const paint = new LanePaint(scene);

  assert.equal(paint.setNetwork({ version: 1, course: 'ridge', nodes: [], paths: [] }), true);
  assert.equal(paint.stats.ribbons, 0, 'no paths, no ribbons');
  assert.equal(paint.root.children.length, 0);
  assert.equal(paint.stats.materialsCreated, 0, 'and no material is built for an empty document');

  paint.setNetwork(sampleLaneNetwork('ridge'));
  const geometries = paint.stats.ribbons;
  paint.dispose();
  assert.equal(scene.children.length, before, 'the scene is exactly as it was');
  assert.equal(paint.stats.disposals >= geometries, true, 'every geometry was disposed');
  assert.equal(paint.stats.materialsCreated, 0, 'the material went with it');
  assert.equal(paint.document, null);
});

/* ---------------------------------------------------------------------------
   The wiring, as a structural guard.
   ---------------------------------------------------------------------------
   The paint itself is proven above; `Renderer3D` cannot be constructed here (it makes a WebGLRenderer),
   so the join between the three files is asserted the way this repo guards its other render-path
   orders: by reading them. Each pattern is a claim about the wiring, not about the text:
     - the engine's frame carries the very network the physics steers by;
     - the renderer builds the paint lazily, feeds it that frame's network, and disposes it;
     - the builder's "Test drive" hands the engine the document the author is looking at.
   ------------------------------------------------------------------------- */
test('the wiring: engine → frame → paint, and Test drive hands the document over', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /laneNetwork: this\.laneNetwork/, 'the frame carries the runtime network');
  assert.match(engine, /setLaneNetwork\(network: LaneNetwork \| null\)/, 'and the engine can be handed a new one');

  const renderer = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(renderer, /new LanePaint\(this\.scene\)/, 'the paint is built lazily');
  assert.match(renderer, /this\.lanePaint\.setNetwork\(frame\.laneNetwork\)/, 'and fed the frame\'s network');
  assert.match(renderer, /this\.lanePaint\?\.dispose\(\)/, 'and disposed with the renderer');

  const screen = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /onTestRace=\{/, 'the builder is given a Test drive handler');
  assert.match(screen, /engine\.setLaneNetwork\(engine\.trackBuilder\.getLaneNetwork\(\)\)/,
    'which adopts the document the author is holding');

  const builderUi = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  // M11: the panel's handlers are passed through useLatestHandlers, so the wiring is an object entry.
  assert.match(builderUi, /onTestDrive: \(\) => \{ saveLaneDoc\(\); onTestRace\?\.\(\); \}/,
    'the panel\'s Test drive saves the document and then test drives it');
});
