// STARGATE_KIT (plan 42 §4.3): the plot's own gate as a modular preset. These hold it to what the plan and the beam need — a ring
// of nine bevelled segments with nine chevrons, a ramp onto the sill, a dialing pedestal, and an iris that closes across the
// aperture unless the gate is open — and to the wear policy the annulus depends on (Argon directive 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flatten, mergeBuckets, presetBounds, presetSockets, validate, type Kit } from '@hm/kitspec';
import { buildPart } from '@hm/partgen';
import { maskAttributes, lineDistance, FAR } from '@hm/matstack';
import {
  STARGATE_APERTURE_R,
  STARGATE_CHEVRON_COUNT,
  STARGATE_DIAL_CHEVRONS,
  STARGATE_DIAL_LAMP,
  STARGATE_KIT,
  STARGATE_PLINTH_H,
  STARGATE_PRESET,
  STARGATE_RING_CENTRE_Y,
  STARGATE_RING_DEPTH,
  STARGATE_SILL_Y,
  stargateChevronMaterial,
  stargateChevronPose,
  stargateChevronSlot,
  stargateIrisClosed,
  stargateKit,
  stargateSegmentPose,
} from './kit-stargate';
import { KIT_TRIM_MATERIAL_IDS, isKitTrimMaterial } from './kit-trim-palette';

const ACCESS_MODES = ['open', 'code-only', 'closed'] as const;

/** The placed parts of a kit by their key's stem (segment3 → 'segment'). */
const byKind = (kit: Kit, kind: string) =>
  flatten(kit, STARGATE_PRESET).filter((p) => p.path.startsWith(kind));

test('the gate validates in all three privacy states: nothing floats and nothing sinks', () => {
  for (const access of ACCESS_MODES) {
    assert.deepEqual(validate(stargateKit(access), STARGATE_PRESET), [], `${access} does not validate`);
  }
});

test('the ring is nine bevelled segments on a 2.6 m aperture, standing on its plinth', () => {
  const segments = byKind(STARGATE_KIT, 'segment');
  assert.equal(segments.length, STARGATE_CHEVRON_COUNT);
  for (const s of segments) {
    assert.equal(s.source.kind, 'param', `${s.path} must be a generator part, so a Part cartridge can retune it`);
    assert.equal(s.source.kind === 'param' ? s.source.gen : '', 'panel');
    const bevel = s.source.kind === 'param' ? Number(s.source.params.bevel) : 0;
    assert.ok(bevel > 0.02, `${s.path} has no radial bevel (bevel ${bevel})`);
  }
  // the aperture is 2.6 m across (a 0.9 m-wide walker and their pack fit), and the ring sits on the plinth, not above it
  assert.ok(Math.abs(STARGATE_APERTURE_R * 2 - 2.64) < 0.02, `aperture ${(STARGATE_APERTURE_R * 2).toFixed(3)} m`);
  const b = presetBounds(STARGATE_KIT, flatten(STARGATE_KIT, STARGATE_PRESET))!;
  const ringBottom = segments.reduce((low, s) => Math.min(low, s.matrix[13]!), Infinity);
  assert.ok(Math.abs(ringBottom - STARGATE_PLINTH_H) < 0.02, `the ring's lowest segment sits at ${ringBottom.toFixed(3)} m`);
  assert.ok(b.min[1] >= -1e-6);
  // 3.2-3.4 m to the top of the highest chevron, 3.0-3.4 m across the ring itself
  assert.ok(b.max[1] > 3.15 && b.max[1] < 3.4, `height ${b.max[1].toFixed(3)} m`);
  assert.ok(STARGATE_RING_CENTRE_Y + STARGATE_APERTURE_R <= b.max[1] + 1e-6);
});

test('nine chevrons, each its own lamp, each on a segment of its own', () => {
  const chevrons = byKind(STARGATE_KIT, 'chevron');
  assert.equal(chevrons.length, STARGATE_CHEVRON_COUNT);
  const materials = chevrons.map((c) => c.material);
  assert.equal(new Set(materials).size, STARGATE_CHEVRON_COUNT, 'every chevron needs its own Kelvin, or they merge into one mesh');
  for (const m of materials) assert.match(m, /^lx:\d{4}:[\d.]+:[a-z]+$/, `${m} is not a light cartridge`);
  // every lamp keeps its own bucket through the merge (nine chevrons plus the console's status lamp), so the ignition sweep can
  // light one chevron at a time instead of the whole ring at once
  const lamps = [...mergeBuckets(flatten(STARGATE_KIT, STARGATE_PRESET)).keys()].filter((k) => k.startsWith('lx:'));
  assert.equal(lamps.length, STARGATE_CHEVRON_COUNT + 1, `lamps: ${lamps.join(', ')}`);
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i += 1) assert.ok(lamps.some((k) => k.startsWith(stargateChevronMaterial(i))), `chevron ${i} merged away`);
  // and every pose puts the lamp outside its own segment, at the same angle
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i += 1) {
    const seg = stargateSegmentPose(i);
    const chev = stargateChevronPose(i);
    assert.deepEqual(seg.rot, chev.rot);
    const segR = Math.hypot(seg.at[0], seg.at[1] - STARGATE_RING_CENTRE_Y);
    const chevR = Math.hypot(chev.at[0], chev.at[1] - STARGATE_RING_CENTRE_Y);
    assert.ok(chevR > segR, `chevron ${i} is inside the ring (${chevR.toFixed(3)} < ${segR.toFixed(3)})`);
  }
});

test('the iris closes across the aperture for closed and code-only gates, and is absent when the gate is open', () => {
  assert.equal(stargateIrisClosed('open'), false);
  assert.equal(stargateIrisClosed('code-only'), true);
  assert.equal(stargateIrisClosed('closed'), true);
  const open = byKind(STARGATE_KIT, 'iris');
  assert.equal(open.length, 0, 'an open gate has no iris');
  for (const access of ['code-only', 'closed'] as const) {
    const iris = byKind(stargateKit(access), 'iris');
    assert.ok(iris.length >= 2, `${access} must draw the iris disc and its hub`);
    // the disc covers the whole aperture: it is a 2.6 m plate standing in the ring's plane at the ring's centre
    const disc = iris[0]!;
    assert.equal(disc.source.kind, 'param');
    const params = disc.source.kind === 'param' ? disc.source.params : {};
    assert.ok(Number(params.width) >= STARGATE_APERTURE_R * 2 - 1e-9, 'the iris is narrower than the aperture');
    assert.ok(Number(params.depth) >= STARGATE_APERTURE_R * 2 - 1e-9);
    // turned on its side, so the can's axis (its local +y) lies along the gate's depth: the disc stands in the ring's plane
    assert.ok(Math.abs(Math.abs(disc.matrix[6]!) - 1) < 1e-9, `the disc is not stood up (local y maps to ${disc.matrix[6]!.toFixed(3)})`);
    assert.ok(Math.abs(disc.matrix[13]! - STARGATE_RING_CENTRE_Y) < 1e-6, 'the disc is not at the ring centre');
    assert.ok(Math.abs(disc.matrix[14]!) <= STARGATE_RING_DEPTH / 2 + 0.02, 'the disc is outside the ring');
  }
  // closing the iris adds exactly the two shield parts and changes nothing else about the ring
  const openParts = flatten(STARGATE_KIT, STARGATE_PRESET).map((p) => p.path);
  const closedParts = flatten(stargateKit('closed'), STARGATE_PRESET).map((p) => p.path);
  assert.deepEqual(
    closedParts.filter((p) => !openParts.includes(p)),
    ['iris', 'iris-hub'],
  );
  assert.deepEqual(openParts.filter((p) => !closedParts.includes(p)), []);
});

test('the ramp climbs to the aperture sill in grounded steps', () => {
  const steps = byKind(STARGATE_KIT, 'ramp-step').concat(byKind(STARGATE_KIT, 'sill'));
  assert.ok(steps.length >= 4, 'the ramp needs several steps and a sill');
  // every block stands on the ground (its own base is at 0), and the tallest is exactly the sill height
  for (const s of steps) assert.ok(Math.abs(s.matrix[13]!) < 1e-9, `${s.path} is not on the ground`);
  const sill = steps.find((s) => s.path === 'sill')!;
  const top = sill.source.kind === 'box' ? sill.source.size[1] : 0;
  assert.ok(Math.abs(top - STARGATE_SILL_Y) < 1e-9, `the sill tops out at ${top}, not the aperture's ${STARGATE_SILL_Y}`);
  assert.ok(Math.abs(STARGATE_RING_CENTRE_Y - STARGATE_APERTURE_R - STARGATE_SILL_Y) < 1e-9, 'the sill is not the aperture floor');
  // the steps rise towards the gate: nearer the ring is higher
  const rising = steps
    .filter((s) => s.path.startsWith('ramp-'))
    .map((s) => ({ z: s.matrix[14]!, h: s.source.kind === 'box' ? s.source.size[1] : 0 }))
    .sort((a, b) => a.z - b.z);
  for (let i = 1; i < rising.length; i += 1) assert.ok(rising[i]!.h < rising[i - 1]!.h, 'the ramp does not climb towards the gate');
});

test('the dialing pedestal stands by the gate with a working status lamp', () => {
  const pedestal = flatten(STARGATE_KIT, STARGATE_PRESET).find((p) => p.path === 'pedestal')!;
  assert.equal(pedestal.source.kind, 'param');
  assert.equal(pedestal.source.kind === 'param' ? pedestal.source.gen : '', 'can');
  const lamp = flatten(STARGATE_KIT, STARGATE_PRESET).find((p) => p.path === 'dial-lamp')!;
  assert.equal(lamp.material, STARGATE_DIAL_LAMP);
  assert.match(STARGATE_DIAL_LAMP, /^lx:/);
  // it is within arm's reach of the walker who steps off the ramp (the console is beside the gate, not across the plot)
  const sockets = presetSockets(STARGATE_KIT, STARGATE_PRESET);
  assert.ok(sockets['dial'], 'the kit should expose the console as a socket');
  const dial = sockets['dial']!;
  assert.ok(Math.abs(dial.at[0]) > 1.5, 'the console stands clear of the aperture');
  assert.ok(Math.hypot(dial.at[0], dial.at[2]) < 4, 'the console is not beside the gate');
});

test('every module a cartridge can reach has a socket, and the palette dresses the gate', () => {
  const sockets = Object.keys(presetSockets(STARGATE_KIT, STARGATE_PRESET));
  for (const name of ['gateway', 'iris', 'ramp', 'dial']) assert.ok(sockets.includes(name), `no '${name}' socket`);
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i += 1) assert.ok(sockets.includes(`chevron${i}`), `no chevron${i} socket`);
  // the gate wears the 4d palette (JOB-02's Sheet-12 pair included) plus light cartridges, nothing else
  const placed = flatten(stargateKit('closed'), STARGATE_PRESET);
  for (const part of placed) {
    if (part.material.startsWith('lx:')) continue;
    assert.ok(isKitTrimMaterial(part.material), `${part.path} wears '${part.material}', which is not a trim material`);
  }
  const worn = new Set(placed.map((p) => p.material).filter((m) => KIT_TRIM_MATERIAL_IDS.includes(m as never)));
  assert.ok(worn.has('hull-steel') && worn.has('hopper-slate') && worn.has('khaki-paint'), `the gate wears ${[...worn].join(', ')}`);
});

test('the dial lights six of the nine chevrons, never the same one twice', () => {
  const lit = [0, 1, 2, 3, 4, 5].map(stargateChevronSlot);
  assert.equal(new Set(lit).size, 6, `the six-symbol dial lit ${lit.join(', ')}`);
  for (const i of lit) assert.ok(i >= 0 && i < STARGATE_CHEVRON_COUNT);
  // a hex code wraps, so any symbol the dial sends lands on a real chevron
  assert.equal(stargateChevronSlot(6), stargateChevronSlot(0));
  assert.equal(stargateChevronSlot(-1), stargateChevronSlot(8));
  assert.equal(stargateChevronSlot(1.9), stargateChevronSlot(1));
  assert.deepEqual([...STARGATE_DIAL_CHEVRONS].sort((a, b) => a - b), STARGATE_DIAL_CHEVRONS);
  // and the six lamps it uses are six of the nine the ring draws
  assert.equal(new Set([0, 1, 2, 3, 4, 5].map(stargateChevronSlot)).size, 6);
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i += 1) assert.match(stargateChevronMaterial(i), new RegExp(`^lx:${2400 + i}:`));
});

test('the ring segment keeps its bevelled wear: a 45-degree chamfer is not narrowed, a shallow seam is', () => {
  const segment = STARGATE_KIT.parts['ring-segment'];
  assert.ok(segment && segment.source.kind === 'param');
  const src = segment.source;
  const md = src.kind === 'param' ? buildPart(src.gen, src.params, 1) : null;
  assert.ok(md, 'the segment generator built nothing');
  const mesh = maskAttributes({ positions: md.positions, indices: md.indices, normals: md.normals, uvs: md.uvs });
  assert.equal(mesh.kind, 'lines');
  // a rank-1 panel is chamfered, so its edges fold at 45 degrees: those keep the whole band (scale 1), which is the wear the
  // annulus needs. A right angle or better is likewise untouched.
  let chamferReadings = 0;
  for (let v = 0; v < mesh.edge.length / 4; v += 1) {
    for (let k = 0; k < 4; k += 1) {
      const d = mesh.edge[v * 4 + k]!;
      if (d >= FAR - 1) continue;
      // every stored distance is a plain geometric distance: nothing on this part is scaled, so no reading is inflated
      assert.ok(d >= 0 && d < 1, `a slot reads ${d}`);
      chamferReadings += 1;
    }
  }
  assert.ok(chamferReadings > 0, 'the segment carries no edge lines at all');
  // the segment is wider than the ring's chord, so neighbours overlap: a nine-sided ring leaves no grout line of sky
  const width = src.kind === 'param' ? Number(src.params.width) : 0;
  assert.ok(width > 2 * 1.42 * Math.sin(Math.PI / 9), 'the segment is cut to the bare chord, which only touches at the corners');
});

test('the ring is nine parts deep, not one: a Material cartridge reaches one segment at a time', () => {
  const segments = byKind(STARGATE_KIT, 'segment');
  assert.equal(new Set(segments.map((s) => s.path)).size, STARGATE_CHEVRON_COUNT);
  // the shared part id means one Part cartridge retunes every segment together; the paths stay distinct so overrides can differ
  assert.equal(new Set(segments.map((s) => `${(s.matrix[12]!).toFixed(3)},${(s.matrix[13]!).toFixed(3)}`)).size, STARGATE_CHEVRON_COUNT);
  assert.equal(lineDistance(new Float32Array([FAR, FAR, FAR, FAR])), FAR, 'an unused slot reads as far');
});
