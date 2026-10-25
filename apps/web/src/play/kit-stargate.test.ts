import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, mergeBuckets, presetBounds, presetSockets, sourceBounds, transformBox, validate } from '@hm/kitspec';
import {
  STARGATE_APERTURE_R,
  STARGATE_CHEVRON_COUNT,
  STARGATE_DIAL_CHEVRONS,
  STARGATE_DIAL_LAMP,
  STARGATE_KIT,
  STARGATE_PLINTH_H,
  STARGATE_PRESET,
  STARGATE_RING_CENTRE_Y,
  STARGATE_SILL_Y,
  STARGATE_SOCKETS,
  stargateChevronMaterial,
  stargateChevronSlot,
  stargateIrisClosed,
  stargateKit,
  stargateSegmentPose,
} from './kit-stargate';

const ACCESS = ['open', 'code-only', 'closed'] as const;
const paths = (kit: Parameters<typeof flatten>[0]): string[] => flatten(kit, STARGATE_PRESET).map((p) => p.path);
const placedOf = (access: (typeof ACCESS)[number]) => flatten(stargateKit(access), STARGATE_PRESET);
const boxOf = (access: (typeof ACCESS)[number], path: string) => {
  const part = placedOf(access).find((p) => p.path === path);
  assert.ok(part, `${path} is placed`);
  return transformBox(sourceBounds(part.source), part.matrix);
};

test('the gate validates in every access state: nothing below the ground, nothing floating', () => {
  for (const access of ACCESS) {
    const issues = validate(stargateKit(access), STARGATE_PRESET);
    assert.deepEqual(issues, [], `${access}: ${issues.map((i) => `${i.code} @ ${i.at} (${i.detail})`).join(', ')}`);
  }
  // the open gate carries no shield; the shut ones do
  assert.ok(!paths(stargateKit('open')).some((p) => p.startsWith('iris')));
  for (const access of ['code-only', 'closed'] as const) {
    assert.equal(paths(stargateKit(access)).filter((p) => p.startsWith('iris')).length, 2, `${access} draws the disc and its hub`);
  }
});

test('the annulus is nine bevelled panels that close around the aperture', () => {
  const segments = placedOf('open').filter((p) => p.path.startsWith('segment'));
  assert.equal(segments.length, STARGATE_CHEVRON_COUNT);
  for (const s of segments) {
    assert.equal(s.source.kind, 'param');
    if (s.source.kind !== 'param') continue;
    assert.equal(s.source.gen, 'panel');
    // a radial bevel, not a flat facet: the chamfer is what takes the edge wear
    assert.ok((s.source.params.bevel ?? 0) >= 0.03, `segment bevel ${s.source.params.bevel}`);
    assert.ok((s.source.params.thickness ?? 0) >= 0.15, 'a segment is a slab, not a plate');
  }
  // nine segments in one bucket (with the plinth, which is the same steel at the same rank): the annulus costs one draw call
  const buckets = mergeBuckets(placedOf('open'));
  const segmentBucket = [...buckets.entries()].filter(([, list]) => list.some((p) => p.path.startsWith('segment')));
  assert.equal(segmentBucket.length, 1);
  assert.equal(segmentBucket[0]?.[1].filter((p) => p.path.startsWith('segment')).length, STARGATE_CHEVRON_COUNT);
  // each segment's width covers its 40-degree share of the ring: corners overlap instead of meeting at a point
  const width = (segments[0]!.source as { params: Readonly<Record<string, number>> }).params.width ?? 0;
  const outer = 1.42 + 0.2 / 2;
  assert.ok(width / 2 / outer > Math.sin(Math.PI / 9), `a ${width.toFixed(3)} m segment spans its 40 degrees at the outer edge`);
});

test('nine chevron lamps, nine distinct light cartridges, six dial symbols onto nine physical chevrons', () => {
  const lamps = placedOf('open').filter((p) => p.path.startsWith('chevron-lamp'));
  assert.equal(lamps.length, STARGATE_CHEVRON_COUNT);
  const materials = new Set(lamps.map((l) => l.material));
  assert.equal(materials.size, STARGATE_CHEVRON_COUNT, 'each lamp merges on its own, so the dial can light them one by one');
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i++) assert.ok(materials.has(stargateChevronMaterial(i)));
  for (const m of materials) assert.match(m, /^lx:\d{4}:\d+\.\d{2}:(steady|pulse|flicker)$/);
  // the pedestal's status lamp is its own cartridge, warmer than the ring
  const dial = placedOf('open').find((p) => p.path === 'dial-lamp');
  assert.equal(dial?.material, STARGATE_DIAL_LAMP);
  // the six-symbol dial: six distinct chevrons, and it wraps rather than throwing
  const slots = Array.from({ length: 6 }, (_, i) => stargateChevronSlot(i));
  assert.equal(new Set(slots).size, 6);
  assert.deepEqual(slots, [...STARGATE_DIAL_CHEVRONS]);
  assert.equal(stargateChevronSlot(6), STARGATE_DIAL_CHEVRONS[0]);
  assert.equal(stargateChevronSlot(-1), STARGATE_DIAL_CHEVRONS[5]);
  for (const s of slots) assert.ok(s >= 0 && s < STARGATE_CHEVRON_COUNT);
});

test('the iris covers the aperture and sits in the ring\'s own plane', () => {
  const disc = boxOf('closed', 'iris-plate');
  const centreY = (disc.min[1] + disc.max[1]) / 2;
  assert.ok(Math.abs(centreY - STARGATE_RING_CENTRE_Y) < 1e-6, `disc centre at ${centreY.toFixed(3)} m`);
  // it spans the whole aperture, so nothing shows past its edge
  assert.ok(disc.min[1] <= STARGATE_SILL_Y + 1e-6, `disc bottom ${disc.min[1].toFixed(3)} vs sill ${STARGATE_SILL_Y.toFixed(3)}`);
  assert.ok(disc.max[0] - disc.min[0] >= 2 * STARGATE_APERTURE_R - 0.02);
  assert.ok(disc.max[1] - disc.min[1] >= 2 * STARGATE_APERTURE_R - 0.02);
  // and it lies inside the ring's depth: the shield is in the gate, not in front of it
  assert.ok(disc.min[2] >= -0.17 - 1e-6 && disc.max[2] <= 0.17 + 1e-6, `disc z ${disc.min[2].toFixed(3)}..${disc.max[2].toFixed(3)}`);
  // the hub is on the shield's axis
  const hub = boxOf('closed', 'iris-hub');
  assert.ok(Math.abs((hub.min[0] + hub.max[0]) / 2) < 1e-6);
  assert.ok(Math.abs((hub.min[1] + hub.max[1]) / 2 - STARGATE_RING_CENTRE_Y) < 1e-6);
});

test('the ramp climbs from the ground to the aperture sill, and the plinth carries the landing', () => {
  const tops = ['ramp-step1', 'ramp-step2', 'ramp-step3'].map((p) => boxOf('open', p).max[1]);
  assert.deepEqual(tops.map((t) => Number(t.toFixed(3))), [0.12, 0.24, 0.36]);
  const landing = boxOf('open', 'ramp-landing');
  assert.ok(Math.abs(landing.max[1] - STARGATE_SILL_Y) < 1e-6, `landing top ${landing.max[1].toFixed(3)} vs sill ${STARGATE_SILL_Y.toFixed(3)}`);
  // the landing stands on the plinth rather than sunk in it
  assert.ok(Math.abs(landing.min[1] - STARGATE_PLINTH_H) < 1e-6);
  // the treads are on the ground and step outward from the gate
  for (const p of ['ramp-step1', 'ramp-step2', 'ramp-step3']) assert.ok(Math.abs(boxOf('open', p).min[1]) < 1e-6);
  const zs = ['ramp-step1', 'ramp-step2', 'ramp-step3'].map((p) => (boxOf('open', p).min[2] + boxOf('open', p).max[2]) / 2);
  assert.ok(zs[0]! > zs[1]! && zs[1]! > zs[2]!, 'step 1 is furthest from the gate');
});

test('the gate stands to its documented size, with the dialing pedestal beside the ramp', () => {
  const b = presetBounds(STARGATE_KIT, placedOf('open'));
  assert.ok(b);
  // the annulus is 3.04 m across; the chevrons reach 3.4, and the pedestal makes the kit 4.0 wide
  assert.ok(b!.max[1] > 3.3 && b!.max[1] < 3.45, `height ${b!.max[1].toFixed(2)}`);
  assert.ok(b!.min[1] === 0, 'the gate stands on the ground');
  assert.ok(Math.abs(b!.min[0] + 1.7) < 0.02, `left edge ${b!.min[0].toFixed(2)}`);
  assert.ok(b!.max[0] > 2.2 && b!.max[0] < 2.4, 'the pedestal is on the +x side');
  // the pedestal is a can with a grille dial face and a lamp, all within reach of a player standing at it
  const pedestal = boxOf('open', 'pedestal');
  assert.ok(Math.abs(pedestal.min[1]) < 1e-6);
  assert.ok(pedestal.max[1] > 1.0 && pedestal.max[1] < 1.1);
  assert.equal(placedOf('open').find((p) => p.path === 'dial-face')?.source.kind, 'param');
});

test('every part wears a palette material or a light cartridge, and the sockets are all there', () => {
  const palette = new Set(['hull-steel', 'accent-hardware', 'khaki-paint', 'hopper-slate']);
  for (const part of placedOf('closed')) {
    for (const name of [part.material, ...Object.values(part.slotMaterials ?? {})]) {
      assert.ok(palette.has(name) || /^lx:\d{4}:/.test(name), `${part.path} wears ${name}`);
    }
  }
  const sockets = presetSockets(STARGATE_KIT, STARGATE_PRESET);
  assert.deepEqual(Object.keys(sockets).sort(), [...STARGATE_SOCKETS].sort());
  for (const name of ['gateway', 'iris', 'dial', 'ramp']) assert.ok(sockets[name], `${name} socket`);
  assert.ok(Math.abs((sockets.gateway?.at[1] ?? 0) - STARGATE_RING_CENTRE_Y) < 1e-6);
  // each chevron socket is where its own segment's chevron sits
  for (let i = 0; i < STARGATE_CHEVRON_COUNT; i++) {
    const s = sockets[`chevron${i}`];
    assert.ok(s);
    const pose = stargateSegmentPose(i);
    // the socket is on the ring's radius, at the segment's own angle
    assert.ok(Math.abs(Math.hypot(s!.at[0], s!.at[1] - STARGATE_RING_CENTRE_Y) - (1.42 + 0.1 + 0.12)) < 1e-6);
    assert.ok(Math.sign(s!.at[0]) === Math.sign(pose.at[0]) || Math.abs(s!.at[0]) < 1e-9);
  }
});

test('the iris rule is one rule: shut for everything but an open gate', () => {
  assert.equal(stargateIrisClosed('open'), false);
  assert.equal(stargateIrisClosed('code-only'), true);
  assert.equal(stargateIrisClosed('closed'), true);
  // and the kit follows it exactly
  for (const access of ACCESS) {
    assert.equal(paths(stargateKit(access)).some((p) => p.startsWith('iris')), stargateIrisClosed(access));
  }
});
