// ============================================================================
// File: apps/web/src/studio/studio-agent-audit.test.ts
// JOB-06b: the anatomy standard's five checks, each proved on a kit small enough to reason about by hand, and the gate
// numbers the ticket names (0 loose ends, 0 unterminated ends, 0 collision violations, every control reachable).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Kit, PartDef, Placement, Vec3 } from '@hm/kitspec';
import {
  LOOSE_END_TOLERANCE_M,
  MOTION_PHASES,
  ORBIT_ANGLES,
  ORBIT_RAY_COUNT,
  ORBIT_STEP_DEG,
  auditSummary,
  jointTravelRad,
  kitAudit,
  orbitDirection,
  requiredBendRadius,
} from './studio-agent-audit';

const PRESET = 'machine';

const part = (size: readonly [number, number, number], extra: Partial<PartDef> = {}): PartDef => ({
  source: { kind: 'box', size },
  material: 'khaki-paint',
  rank: 0,
  ...extra,
});

const kitOf = (
  parts: Readonly<Record<string, PartDef>>,
  children: readonly Placement[],
  sockets: Readonly<Record<string, { readonly at: Vec3 }>> = {},
): Kit => ({ parts, assemblies: { [PRESET]: { children, sockets } } });

/** A deck on the ground with two parts hung on its sockets: the smallest kit that can collide, float or hold a control. */
const deckKit = (sockets: Readonly<Record<string, { readonly at: Vec3 }>>, parts: Readonly<Record<string, PartDef>>, children: readonly Placement[]): Kit =>
  kitOf({ deck: part([1, 0.2, 1], { sockets }), ...parts }, [{ ref: 'deck', key: 'deck' }, ...children], {});

const pair = (atA: Vec3, atB: Vec3, extra: Partial<PartDef> = {}): Kit =>
  deckKit(
    { a: { at: atA }, b: { at: atB } },
    { p: part([0.4, 0.4, 0.4]), q: part([0.4, 0.4, 0.4], extra) },
    [
      { ref: 'p', key: 'p', on: { child: 0, socket: 'a' } },
      { ref: 'q', key: 'q', on: { child: 0, socket: 'b' } },
    ],
  );

test('the gate numbers are the ticket’s: a quarter millimetre, 8 phases, 24 rays at 15 degrees', () => {
  assert.equal(LOOSE_END_TOLERANCE_M, 0.00025);
  assert.equal(MOTION_PHASES, 8);
  assert.equal(ORBIT_RAY_COUNT, 24);
  assert.equal(ORBIT_STEP_DEG, 15);
  assert.equal(ORBIT_ANGLES.length, 24);
  // 24 distinct directions, one every 15 degrees of azimuth, the elevation stepping -15, 0 and +15
  const seen = new Set(ORBIT_ANGLES.map((a) => `${a.azimuthDeg}:${a.elevationDeg}`));
  assert.equal(seen.size, 24);
  for (const a of ORBIT_ANGLES) {
    assert.equal(a.azimuthDeg % 15, 0);
    assert.ok([-15, 0, 15].includes(a.elevationDeg), `elevation ${a.elevationDeg}`);
    const d = orbitDirection(a.azimuthDeg, a.elevationDeg);
    assert.ok(Math.abs(Math.hypot(d[0], d[1], d[2]) - 1) < 1e-9, 'a unit direction');
  }
});

test('solidClearances: two overlapping siblings are reported as a pair, with the depth they reached', () => {
  const report = kitAudit(pair([0, 0.2, 0], [0.3, 0.2, 0]), { preset: PRESET });
  const hit = report.solidClearances.find((c) => c.a === 'p' && c.b === 'q');
  assert.ok(hit, `expected a p/q clearance, got ${JSON.stringify(report.solidClearances)}`);
  // 0.4 m boxes whose sockets are 0.3 m apart overlap by exactly 0.1 m
  assert.ok(Math.abs(hit.depth - 0.1) < 1e-9, `depth ${hit.depth}`);
  assert.equal(hit.mode, 'rest');
  assert.equal(report.ok, false);
  // the exploded view pushes the same pair apart along a diagonal, so the summary counts both sweeps
  assert.ok(auditSummary(report).includes('solid clearances'), auditSummary(report));
});

test('solidClearances: a pair that clears at rest is silent, whatever the explode and motion sweeps do', () => {
  const report = kitAudit(pair([0, 0.2, 0], [0.6, 0.2, 0]), { preset: PRESET });
  assert.deepEqual(report.solidClearances, []);
  assert.equal(report.ok, true);
  assert.ok(auditSummary(report).startsWith(`${PRESET}: pass`), auditSummary(report));
});

test('solidClearances: a declared socket joint is a mount, never a collision (a hose on a port is not an overlap)', () => {
  const kit = kitOf(
    { deck: part([1, 0.2, 1], { sockets: { seat: { at: [0, 0.2, 0] } } }), cap: part([0.4, 0.4, 0.4]) },
    [{ ref: 'deck', key: 'deck' }, { ref: 'cap', key: 'cap', on: { child: 0, socket: 'seat' } }],
  );
  const report = kitAudit(kit, { preset: PRESET });
  assert.deepEqual(report.solidClearances, [], 'a part and the part it is bolted to are one solid, not two');
});

test('solidClearances: the motion sweep samples every phase, and names the phase that struck', () => {
  const stroking = pair([0, 0.82, 0], [0, 0.62, 0], { motion: { kind: 'reciprocate', axis: 'y', rateHz: 1, amplitude: 0.4 } });
  const report = kitAudit(stroking, { preset: PRESET });
  const moving = report.solidClearances.filter((c) => c.mode === 'motion');
  assert.ok(moving.length > 0, `expected a motion-phase collision, got ${JSON.stringify(report.solidClearances)}`);
  for (const c of moving) {
    assert.ok(Number.isInteger(c.phase) && c.phase >= 0 && c.phase < MOTION_PHASES, `phase ${c.phase}`);
    assert.ok(c.depth > 0.002, `depth ${c.depth}`);
  }
  assert.deepEqual(report.moving, ['q'], 'the sweep names the parts it moved');
});

test('looseEnds: a socket-mounted part is seated; a part left hanging is named with the gap it left', () => {
  const seated = kitAudit(
    kitOf(
      { deck: part([1, 0.2, 1], { sockets: { seat: { at: [0, 0.2, 0] } } }), cap: part([0.2, 0.2, 0.2]) },
      [{ ref: 'deck', key: 'deck' }, { ref: 'cap', key: 'cap', on: { child: 0, socket: 'seat' } }],
    ),
    { preset: PRESET },
  );
  assert.equal(seated.looseEnds, 0);

  const hanging = kitAudit(
    kitOf(
      { deck: part([1, 0.2, 1]), cap: part([0.2, 0.2, 0.2]) },
      [{ ref: 'deck', key: 'deck' }, { ref: 'cap', key: 'cap', at: [0, 5, 0] }],
    ),
    { preset: PRESET },
  );
  assert.equal(hanging.looseEnds, 1);
  const loose = hanging.loose[0];
  assert.ok(loose, 'the loose part is named');
  assert.ok(loose.gap > 4, `gap ${loose.gap}`);
  assert.ok(auditSummary(hanging).includes('1 loose ends'), auditSummary(hanging));
});

test('terminals: a conduit ending in mid-air is reported at both ends; landing each end on a port clears it', () => {
  const hose = part([0.4, 0.03, 0.03]);
  const bare = kitAudit(
    kitOf(
      { deck: part([1, 0.2, 1], { sockets: { run: { at: [0, 0.2, 0] } } }), hose },
      [{ ref: 'deck', key: 'deck' }, { ref: 'hose', key: 'hose', on: { child: 0, socket: 'run' } }],
    ),
    { preset: PRESET },
  );
  assert.equal(bare.terminals, 2, JSON.stringify(bare.terminalIssues));
  assert.deepEqual(bare.terminalIssues.map((t) => t.end).sort(), ['a', 'b']);

  const plumbed = kitAudit(
    kitOf(
      {
        deck: part([1, 0.2, 1], { sockets: { run: { at: [0, 0.2, 0] }, left: { at: [-0.2, 0.185, 0] }, right: { at: [0.2, 0.185, 0] } } }),
        hose,
        'port-l': part([0.1, 0.1, 0.1]),
        'port-r': part([0.1, 0.1, 0.1]),
      },
      [
        { ref: 'deck', key: 'deck' },
        { ref: 'port-l', key: 'port-l', on: { child: 0, socket: 'left' } },
        { ref: 'port-r', key: 'port-r', on: { child: 0, socket: 'right' } },
        { ref: 'hose', key: 'hose', on: { child: 0, socket: 'run' } },
      ],
    ),
    { preset: PRESET },
  );
  assert.equal(plumbed.terminals, 0, JSON.stringify(plumbed.terminalIssues));
  // the port the hose ends on is a declared joint, so the sweep does not report the contact it asked for
  assert.deepEqual(
    plumbed.solidClearances.filter((c) => c.a.includes('hose') || c.b.includes('hose')),
    [],
  );
});

test('hingeBendRadius: R >= 2r / sin^2(e - thetaMax), and a travel that swallows the elbow needs a coaxial clip', () => {
  assert.ok(Math.abs(requiredBendRadius(0.015, Math.PI / 2, Math.PI / 4) - 0.06) < 1e-12);
  assert.ok(Number.isFinite(requiredBendRadius(0.015, Math.PI / 2, 0)));
  assert.equal(requiredBendRadius(0.015, Math.PI / 4, Math.PI / 4), Number.POSITIVE_INFINITY, 'a 45 deg travel into a 45 deg elbow cannot be bent');
  assert.equal(jointTravelRad({ kind: 'spin', axis: 'y', rateHz: 1, amplitude: 1 }, 0.2), Math.PI * 2);
  assert.equal(jointTravelRad({ kind: 'oscillate', axis: 'x', rateHz: 1, amplitude: 0.3 }, 0.2), 0.3);
  assert.ok(Math.abs(jointTravelRad({ kind: 'reciprocate', axis: 'y', rateHz: 1, amplitude: 0.3 }, 0.3) - Math.PI / 4) < 1e-9);

  // a flexible run into a moving flange: 30 mm across, a 90 deg elbow, and 10 mm of declared bend radius cannot survive it
  const hose: PartDef = {
    source: { kind: 'param', gen: 'pipe', params: { radius: 0.03, length: 0.6, armLength: 0.1, elbow: 1, sides: 8, flangeWidth: 0.02, bendRadius: 0.01, elbowDeg: 90 } },
    material: 'hull-steel',
    rank: 0,
  };
  const kit = kitOf(
    {
      deck: part([1, 0.2, 1], { sockets: { run: { at: [0, 0.2, 0] }, flange: { at: [0, 0.2, 0] } } }),
      hose,
      'port-flange': part([1, 1, 1], { motion: { kind: 'reciprocate', axis: 'y', rateHz: 1, amplitude: 0.4 } }),
    },
    [
      { ref: 'deck', key: 'deck' },
      { ref: 'port-flange', key: 'port-flange', on: { child: 0, socket: 'flange' } },
      { ref: 'hose', key: 'hose', on: { child: 0, socket: 'run' } },
    ],
  );
  const report = kitAudit(kit, { preset: PRESET });
  assert.equal(report.hingeBendRadius.ok, false);
  const failure = report.hingeBendRadius.failures[0];
  assert.ok(failure, 'the tight bend is reported');
  assert.ok(failure.requiredM > failure.radiusM, `${failure.requiredM} > ${failure.radiusM}`);
  assert.ok(auditSummary(report).includes('bend-radius failures'), auditSummary(report));
});

test('orbitClearance24: a lever on the deck is reachable from the ring; a lever boxed in is not', () => {
  const open = kitAudit(
    kitOf(
      { deck: part([1, 0.2, 1], { sockets: { lever: { at: [0, 0.2, 0] } } }), lever: part([0.1, 0.3, 0.05]) },
      [{ ref: 'deck', key: 'deck' }, { ref: 'lever', key: 'lever', on: { child: 0, socket: 'lever' } }],
    ),
    { preset: PRESET },
  );
  assert.equal(open.orbitClearance24.targets, 1);
  assert.equal(open.orbitClearance24.ok, true, JSON.stringify(open.orbitClearance24.failures));

  const boxed = kitAudit(
    kitOf(
      { shell: part([2, 2, 2], { sockets: { lever: { at: [0, 0.5, 0] } } }), lever: part([0.1, 0.1, 0.1]) },
      [{ ref: 'shell', key: 'shell' }, { ref: 'lever', key: 'lever', on: { child: 0, socket: 'lever' } }],
    ),
    { preset: PRESET },
  );
  assert.equal(boxed.orbitClearance24.ok, false);
  const stuck = boxed.orbitClearance24.failures[0];
  assert.ok(stuck, 'the boxed lever is named');
  assert.equal(stuck.rays, 24);
  assert.ok(stuck.clearRays < 3, `clearRays ${stuck.clearRays}`);
  assert.ok(stuck.blocked.every((b) => b.by.includes('shell')), JSON.stringify(stuck.blocked));
});

test('the audit is pure and deterministic: the same kit gives the same report, byte for byte', () => {
  const kit = pair([0, 0.2, 0], [0.3, 0.2, 0], { motion: { kind: 'reciprocate', axis: 'y', rateHz: 1, amplitude: 0.25 } });
  const a = kitAudit(kit, { preset: PRESET });
  const b = kitAudit(kit, { preset: PRESET });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('a preset that places nothing is reported as such rather than passed', () => {
  const report = kitAudit({ parts: {}, assemblies: { empty: { children: [] } } }, { preset: 'empty' });
  assert.equal(report.ok, false);
  assert.ok(report.problems.length > 0, 'an empty kit is a problem, not a pass');
  assert.ok(auditSummary(report).startsWith('could not audit'), auditSummary(report));
});
