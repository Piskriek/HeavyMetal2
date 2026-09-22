/**
 * T03 — Shared track-space & collision-coordinate adapter tests.
 * Run with: node scripts/check.mjs   (node --import tsx --test)
 *
 * Coverage mandated by the ticket:
 *  - renderer and physics agree on representative positions
 *  - finite-difference velocity / Jacobian checks
 *  - varying width, slopes, curves, loops, section boundaries
 *  - singular / ambiguous transforms fail visibly
 *  - placed-ramp support decision (supported transforms + rejected cases)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GROUND, RADIUS, START_X, TRACK_DISTANCE, courseY } from '../src/game/scene';
import {
  CENTERLINE_WAYPOINTS,
  D_END_RUNOUT,
  D_START,
  LANE_Z_RANGE,
  LATERAL_RADIUS_FACTOR,
  TRACK_HALF_WIDTH,
  TrackSpaceError,
  buildTrackSpace,
  canonicalVelocityFromWorld,
  catmullRomPointAt,
  classifyPlacedRamp,
  compileRampSurfaces,
  engineDistanceFromX,
  engineFromWorld,
  engineXFromDistance,
  expandCenterline,
  getTrackSpace,
  laneZFromLateral,
  lateralFromLaneZ,
  placementFromEngine,
  placementJacobian,
  rampHeightAt,
  rampNormalAt,
  splinePointAt,
  splineTangentAt,
  surfaceNormalAt,
  validateFrameList,
  worldFromCanonical,
  worldVelocityFromCanonical,
  worldVelocityFromEngine,
  type CPoint,
  type PhysicalRampSurface,
  type TrackSpaceMap,
} from '../src/game/track-space';

const map = getTrackSpace();
const dot = (a: CPoint, b: CPoint) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: CPoint) => Math.hypot(a.x, a.y, a.z);
const dist = (a: CPoint, b: CPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const sub = (a: CPoint, b: CPoint): CPoint => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: CPoint, b: CPoint): CPoint => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scaleP = (a: CPoint, k: number): CPoint => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const lerpP = (a: CPoint, b: CPoint, t: number): CPoint => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
});
const unit = (a: CPoint): CPoint => scaleP(a, 1 / len(a));

/* ---------------------------------------------------------------------------
   0. The adapter must stay headless: no three.js / WebGL dependency
   ------------------------------------------------------------------------ */
test('headless: adapter module has no three.js/WebGL dependency', () => {
  const src = readFileSync(new URL('../src/game/track-space.ts', import.meta.url), 'utf8');
  const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.equal(/^import .*from ['"]three/m.test(withoutComments), false, 'track-space.ts must not import three');
  assert.equal(/\bTHREE\.|WebGL|HTMLCanvasElement|document\./.test(withoutComments), false, 'track-space.ts must not touch WebGL/DOM');
});

/* ---------------------------------------------------------------------------
   1. The headless spline is bit-faithful to the renderer's three.js curve
   (drift guard: rebuilds the reference curve with real three.js)
   ------------------------------------------------------------------------ */
test('renderer agreement: compiled samples match THREE.CatmullRomCurve3 within 1e-8', () => {
  const cl = expandCenterline();
  const curve = new THREE.CatmullRomCurve3(
    cl.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)), false, 'centripetal',
  );
  curve.arcLengthDivisions = 6000;
  const lengths = curve.getLengths(6000);
  const threeLen = lengths[lengths.length - 1];
  assert.ok(Math.abs(threeLen - map.length) < 1e-6, `length drift: three=${threeLen} adapter=${map.length}`);

  const count = map.samples.length - 1;
  let maxPosErr = 0;
  let maxTanErr = 0;
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const p3 = curve.getPointAt(u);
    const t3 = curve.getTangentAt(u).normalize();
    const s = map.samples[i];
    maxPosErr = Math.max(maxPosErr, Math.hypot(p3.x - s.pos.x, p3.y - s.pos.y, p3.z - s.pos.z));
    maxTanErr = Math.max(maxTanErr, Math.hypot(t3.x - s.tangent.x, t3.y - s.tangent.y, t3.z - s.tangent.z));
    assert.ok(
      Math.hypot(p3.x - s.pos.x, p3.y - s.pos.y, p3.z - s.pos.z) < 1e-6,
      `sample ${i} (dist ${s.dist.toFixed(0)}, ${s.stage}) position drift ${maxPosErr}`,
    );
  }
  assert.ok(maxPosErr < 1e-6 && maxTanErr < 1e-6, `pos err ${maxPosErr}, tan err ${maxTanErr}`);

  // off-knot agreement as well
  for (const u of [0.113, 0.3377, 0.5001, 0.7071, 0.921]) {
    const p3 = curve.getPointAt(u);
    const pa = splinePointAt(map.spline, u);
    assert.ok(dist({ x: p3.x, y: p3.y, z: p3.z }, pa) < 1e-8, `getPointAt(${u}) drift`);
  }
  const raw = curve.getPoint(0.42);
  const rp = catmullRomPointAt(map.centerline.points, 0.42);
  assert.ok(dist({ x: raw.x, y: raw.y, z: raw.z }, rp) < 1e-9);
});

test('renderer agreement: frame basis (transported up, banking, right) matches the legacy build', () => {
  // replicate the legacy renderer buildTrack basis pipeline in three.js terms
  const WORLD_UP3 = new THREE.Vector3(0, 1, 0);
  const clamp3 = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const transportUp = new THREE.Vector3(0, 1, 0);
  const prevTan = new THREE.Vector3(0, 0, 1);
  let bank = 0;
  const count = map.samples.length - 1;
  let maxUp = 0, maxRight = 0, maxTurn = 0;
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const tangent = splineTangentAt(map.spline, u);
    const t3 = new THREE.Vector3(tangent.x, tangent.y, tangent.z);
    transportUp.addScaledVector(t3, -transportUp.dot(t3)).normalize();
    const gravityUp = WORLD_UP3.clone().addScaledVector(t3, -t3.y);
    if (gravityUp.lengthSq() > 0.04) {
      gravityUp.normalize();
      transportUp.lerp(gravityUp, 0.12 * clamp3(transportUp.y, 0, 1)).normalize();
    }
    const turn = i === 0 ? 0 : new THREE.Vector3().crossVectors(prevTan, t3).dot(transportUp);
    bank = bank + (clamp3(-turn * 7, -0.35, 0.35) - bank) * 0.15;
    const up = transportUp.clone().applyAxisAngle(t3, bank).normalize();
    const right = new THREE.Vector3().crossVectors(t3, up).normalize();
    prevTan.copy(t3);
    const s = map.samples[i];
    maxUp = Math.max(maxUp, Math.hypot(up.x - s.up.x, up.y - s.up.y, up.z - s.up.z));
    maxRight = Math.max(maxRight, Math.hypot(right.x - s.right.x, right.y - s.right.y, right.z - s.right.z));
    maxTurn = Math.max(maxTurn, Math.abs(turn / 50 - s.turnRate));
  }
  assert.ok(maxUp < 1e-9, `up drift ${maxUp}`);
  assert.ok(maxRight < 1e-9, `right drift ${maxRight}`);
  assert.ok(maxTurn < 1e-9, `turnRate drift ${maxTurn}`);
});

test('map structure: frozen, sane invariants, validated at build', () => {
  assert.ok(Object.isFrozen(map), 'map must be frozen');
  assert.ok(Object.isFrozen(map.samples));
  assert.ok(Object.isFrozen(map.samples[0]));
  assert.ok(Object.isFrozen(map.loops[0]));
  assert.ok(map.length > 100000 && map.length < 250000, `length=${map.length}`);
  assert.equal(map.D_START, D_START);
  assert.equal(map.D_END, map.distOf('finish') + D_END_RUNOUT);
  assert.ok(validateFrameList(map.samples).length === 0, 'compiled frames validate');
  // arc-distance knots strictly increase
  assert.ok(map.samples.every((s, i) => i === 0 || s.dist > map.samples[i - 1].dist));
  // knot arc spacing is the declared sampling spacing
  const knotGap = map.samples[1].dist - map.samples[0].dist;
  assert.ok(Math.abs(knotGap - map.length / (map.samples.length - 1)) < 1e-9);
});

/* ---------------------------------------------------------------------------
   2. trackDistFromDistance engine↔track mapping
   ------------------------------------------------------------------------ */
test('distance mapping: linear D_START..D_END, endpoints exact, inverse round-trips', () => {
  assert.equal(map.trackDistFromEngineDistance(0), D_START);
  assert.equal(map.trackDistFromEngineDistance(TRACK_DISTANCE), map.D_END);
  assert.equal(map.trackDistFromEngineDistance(-500), D_START, 'clamps below 0');
  assert.equal(map.trackDistFromEngineDistance(TRACK_DISTANCE * 2), map.D_END, 'clamps above range');
  assert.equal(map.engineDistanceFromTrackDist(D_START), 0);
  assert.equal(map.engineDistanceFromTrackDist(map.D_END), TRACK_DISTANCE);
  for (const d of [0, 1, 123.456, 8000, 19999.5, 35999.999]) {
    const rt = map.engineDistanceFromTrackDist(map.trackDistFromEngineDistance(d));
    assert.ok(Math.abs(rt - d) < 1e-6, `round-trip ${d} → ${rt}`);
  }
  // engine x ↔ distance (the 2:1 px-per-distance-unit rule used by the renderer fallback)
  assert.equal(engineDistanceFromX(START_X), 0);
  assert.equal(engineDistanceFromX(engineXFromDistance(TRACK_DISTANCE)), TRACK_DISTANCE);
  for (const x of [START_X, START_X + 2, 41234.5]) {
    assert.ok(Math.abs(engineXFromDistance(engineDistanceFromX(x)) - x) < 1e-9);
  }
});

/* ---------------------------------------------------------------------------
   3. Varying width: canyon 400, bridges 420, stadium → 660, default 480
   ------------------------------------------------------------------------ */
test('varying width: profile plateaus and lane-edge lateral scaling', () => {
  const mid = (a: number, b: number) => (a + b) / 2;
  assert.ok(Math.abs(map.halfWidthAt(mid(map.stageStart.canyon + 800, map.stageEnd.canyon - 800)) - 400) < 2,
    `canyon plateau hw=${map.halfWidthAt(mid(map.stageStart.canyon, map.stageEnd.canyon))}`);
  for (const b of map.bridges) {
    assert.ok(Math.abs(map.halfWidthAt(mid(b.start, b.end)) - 420) < 2, `bridge plateau`);
  }
  assert.ok(Math.abs(map.halfWidthAt(map.D_END - 2000) - 660) < 5, `stadium flare hw`);
  // straight alpine default
  assert.ok(Math.abs(map.halfWidthAt(30000) - TRACK_HALF_WIDTH) < 1e-9, 'alpine default 480');
  // drivable lateral = (z/480)·(hw − R·1.2), lane far maps to +right
  for (const s of [30000, 80000, 120000]) {
    const expect = (LANE_Z_RANGE / LANE_Z_RANGE) * (map.halfWidthAt(s) - RADIUS * LATERAL_RADIUS_FACTOR);
    assert.ok(Math.abs(lateralFromLaneZ(map, s, LANE_Z_RANGE) - expect) < 1e-9);
    assert.ok(Math.abs(laneZFromLateral(map, s, expect) - LANE_Z_RANGE) < 1e-6);
    const f = map.frameAt(s);
    const lift = (w: { x: number; y: number; z: number }) =>
      sub(sub(w, f.pos), scaleP(f.up, RADIUS)); // strip the ball-lift, keep lateral direction
    const plus = worldFromCanonical(map, { s, laneZ: LANE_Z_RANGE, altitude: 0 });
    const dir = unit(lift(plus.world));
    assert.ok(dot(dir, f.right) > 0.999, 'lane far (+480) must point along +right');
    const minus = worldFromCanonical(map, { s, laneZ: -LANE_Z_RANGE, altitude: 0 });
    assert.ok(dot(unit(lift(minus.world)), f.right) < -0.999, 'lane near (−480) points along −right');
  }
  // width never collapses anywhere (no singular lane mapping)
  assert.ok(map.samples.every((s) => s.halfWidth >= 399.9), 'halfWidth floor');
});

/* ---------------------------------------------------------------------------
   4. Curves & hairpins: frames stay orthonormal; hairpin tangents reverse;
      lateral Jacobian (∂P/∂z) never vanishes along the whole course
   ------------------------------------------------------------------------ */
test('curves: orthonormal frames everywhere and true hairpin reversal', () => {
  for (const s of map.samples) {
    assert.ok(Math.abs(dot(s.tangent, s.up)) < 1e-9, `non-orthogonal frame ${s.index}`);
    assert.ok(Math.abs(len(s.right) - 1) < 1e-9);
    const J = placementJacobian(map, { s: s.dist, laneZ: 0, altitude: 0 });
    // |J.dz| = (hw − R·1.2)/480 ≥ (400 − 37.2)/480 ≈ 0.756 at the narrowest canyon
    assert.ok(len(J.dz) > 0.7, `lateral Jacobian collapsed at dist ${s.dist.toFixed(0)}: |J.dz|=${len(J.dz)}`);
  }
  // hairpin reversal: tangent direction changes sign across each hairpin label
  for (const h of ['hairpin1', 'hairpin2', 'hairpin3', 'hairpin4']) {
    const d = map.distOf(h);
    const tBefore = map.frameAt(d - 1200).tangent;
    const tAfter = map.frameAt(d + 1200).tangent;
    assert.ok(dot(tBefore, tAfter) < 0.2, `${h} should reverse the tangent, dot=${dot(tBefore, tAfter).toFixed(3)}`);
  }
  // zigzag actually descends (slope coverage): elevation falls through the stage
  const zzTop = map.frameAt(map.stageStart.zigzag).pos.y;
  const zzBottom = map.frameAt(map.stageEnd.zigzag - 10).pos.y;
  assert.ok(zzTop - zzBottom > 10000, `zigzag descent ${zzTop - zzBottom}`);
  // slope content: the tangent has a meaningful downhill component in alpine
  const alpineTan = map.frameAt(30000).tangent;
  assert.ok(alpineTan.y < -0.05, `alpine downhill tangent y=${alpineTan.y}`);
});

/* ---------------------------------------------------------------------------
   5. Loops: span flags, inverted frames, anchored procedural waypoints
   ------------------------------------------------------------------------ */
test('loops: spans flagged, frames invert inside, pins match definitions', () => {
  assert.equal(map.loops.length, 3);
  const [alpine, lava1, lava2] = map.loops;
  assert.equal(alpine.label, 'alpineLoop');
  assert.ok(Math.abs(alpine.radius - 1400) < 1e-9 && Math.abs(lava1.radius - 1600) < 1e-9 && Math.abs(lava2.radius - 1500) < 1e-9);
  for (const l of map.loops) {
    const span = l.end - l.start;
    assert.ok(span > 6000 && span < 12000, `${l.label} span ${span.toFixed(0)}`);
    // loop start should sit at the procedural entry point
    const entry = map.frameAt(l.start + 1);
    assert.ok(dist(entry.pos, l.entry) < 250, `${l.label} entry proximity`);
    // some frames inside are genuinely upside-down (up.y < −0.5)
    let minUpY = 1;
    let sawLoop = false;
    for (let s = l.start; s <= l.end; s += 25) {
      const f = map.frameAt(s);
      minUpY = Math.min(minUpY, f.up.y);
      assert.equal(f.inLoop, true, `inLoop flag at ${s}`);
    }
    sawLoop = minUpY < -0.5;
    assert.ok(sawLoop, `${l.label} reaches inversion, min up.y=${minUpY.toFixed(3)}`);
    // outside margin: not in loop
    assert.equal(map.frameAt(l.start - 500).inLoop, false);
  }
  // total arc ≈ circle circumference + shift (between 0.95× and 1.25× of 2πr)
  for (const l of map.loops) {
    assert.ok(l.end - l.start > 0.95 * 2 * Math.PI * l.radius && l.end - l.start < 1.25 * 2 * Math.PI * l.radius);
  }
  // FD-verified Jacobian inside an inverted loop region as well
  const loopS = map.loops[0].start + 3000;
  const J = placementJacobian(map, { s: loopS, laneZ: 120, altitude: 90 });
  assert.ok(Math.abs(len(J.dAlt) - 1) < 1e-9, 'altitude Jacobian stays unit inside loops');
});

/* ---------------------------------------------------------------------------
   6. Section boundaries: positions and widths are continuous across them
   ------------------------------------------------------------------------ */
test('section boundaries: position and half-width continuity', () => {
  const boundaries: number[] = [];
  for (const st of ['canyon', 'zigzag', 'cavern', 'mine', 'breakthrough', 'stadium'] as const) {
    boundaries.push(map.stageStart[st] - 0.02, map.stageStart[st] + 0.02);
  }
  for (const b of map.bridges) boundaries.push(b.start, b.end);
  for (const l of map.loops) boundaries.push(l.start, l.end);
  const E = 0.05;
  for (const d of boundaries) {
    if (d - E < 0 || d + E > map.length) continue;
    const a = map.frameAt(d - E);
    const c = map.frameAt(d + E);
    assert.ok(dist(a.pos, c.pos) < 1, `position jump at ${d.toFixed(0)}: ${dist(a.pos, c.pos).toFixed(3)}`);
    assert.ok(Math.abs(a.halfWidth - c.halfWidth) < 1, `halfWidth jump at ${d.toFixed(0)}`);
    assert.ok(dot(a.tangent, c.tangent) > 0.99, `tangent twist at ${d.toFixed(0)}`);
  }
  // stage assignment is a partition matching stageStart/stageEnd
  const inCanyon = map.frameAt((map.stageStart.canyon + map.stageEnd.canyon) / 2);
  assert.equal(inCanyon.stage, 'canyon');
});

/* ---------------------------------------------------------------------------
   7. Finite-difference velocity / Jacobian verification
   ------------------------------------------------------------------------ */
const fdWorld = (mapRef: TrackSpaceMap, s: number, z: number, a: number) =>
  worldFromCanonical(mapRef, { s, laneZ: z, altitude: a }).world;

test('Jacobian: analytic ∂P/∂(s,z,a) matches central finite differences', () => {
  const cellArc = map.length / (map.samples.length - 1);
  const states: { s: number; z: number; a: number }[] = [];
  // pick s strictly inside cells (never on the piecewise-linear joints)
  for (let k = 3; k < 300; k += 7) {
    const s = (k / 300) * map.length;
    const cellT = (s * (map.samples.length - 1)) / map.length % 1;
    if (cellT < 0.05 || cellT > 0.95) continue;
    states.push({ s, z: [-380, -60, 0, 250, 420][k % 5], a: [0, 31, 130, 260][k % 4] });
  }
  // worst-case spots: hairpins, loop interior, canyon/stadium transitions
  for (const extra of [map.distOf('hairpin2'), map.loops[0].start + 2200, map.stageStart.canyon + 400,
    map.stageStart.stadium + 600, map.stageEnd.zigzag - 300]) {
    const cellT = (extra * (map.samples.length - 1)) / map.length % 1;
    if (cellT > 0.05 && cellT < 0.95) states.push({ s: extra, z: 150, a: 40 });
  }
  assert.ok(states.length > 25, `enough states (${states.length})`);
  void cellArc;

  const EPS_S = 0.05, EPS_Z = 1e-3, EPS_A = 1e-3;
  let worstS = 0, worstZ = 0, worstA = 0;
  for (const st of states) {
    const J = placementJacobian(map, { s: st.s, laneZ: st.z, altitude: st.a });
    const fdS = scaleP(sub(fdWorld(map, st.s + EPS_S, st.z, st.a), fdWorld(map, st.s - EPS_S, st.z, st.a)), 1 / (2 * EPS_S));
    const fdZ = scaleP(sub(fdWorld(map, st.s, st.z + EPS_Z, st.a), fdWorld(map, st.s, st.z - EPS_Z, st.a)), 1 / (2 * EPS_Z));
    const fdA = scaleP(sub(fdWorld(map, st.s, st.z, st.a + EPS_A), fdWorld(map, st.s, st.z, st.a - EPS_A)), 1 / (2 * EPS_A));
    const eS = dist(J.ds, fdS), eZ = dist(J.dz, fdZ), eA = dist(J.dAlt, fdA);
    worstS = Math.max(worstS, eS); worstZ = Math.max(worstZ, eZ); worstA = Math.max(worstA, eA);
    assert.ok(eS < 2e-2, `∂P/∂s mismatch ${eS.toFixed(4)} at s=${st.s.toFixed(0)} z=${st.z}`);
    assert.ok(eZ < 1e-3, `∂P/∂z mismatch ${eZ.toFixed(5)} at s=${st.s.toFixed(0)}`);
    assert.ok(eA < 1e-6, `∂P/∂a mismatch ${eA.toFixed(7)} at s=${st.s.toFixed(0)}`);
  }
  assert.ok(worstS < 2e-2 && worstZ < 1e-3 && worstA < 1e-6, `worst ${worstS} ${worstZ} ${worstA}`);
});

test('velocity: analytic world velocity matches FD of the placement trajectory', () => {
  const cases = [
    // grounded, rolling on engine surface (vy = slope · vx → altitude ~constant)
    () => {
      const x = 43000;
      return {
        st: { x, y: courseY(x, 'ridge') - RADIUS, z: 120, grounded: true },
        vel: { vx: 640, vy: 0, vz: 30 },
      };
    },
    // airborne high above the plateaus (engine altitude source dominates)
    () => {
      const x = 21000;
      return {
        st: { x, y: courseY(x, 'ridge') - 500, z: -260, grounded: false },
        vel: { vx: 720, vy: -150, vz: -80 },
      };
    },
    // steep zigzag descent, lane change in progress
    () => {
      const x = 61000;
      return {
        st: { x, y: courseY(x, 'ridge') - RADIUS, z: 300, grounded: true },
        vel: { vx: 560, vy: 0, vz: -120 },
      };
    },
  ];
  const DT = 1e-4;
  for (const mk of cases) {
    const { st, vel } = mk();
    const { worldV } = worldVelocityFromEngine(map, st, vel);
    const p0 = placementFromEngine(map, { ...st, x: st.x - vel.vx * DT, y: st.y - vel.vy * DT, z: st.z - vel.vz * DT }).world;
    const p1 = placementFromEngine(map, { ...st, x: st.x + vel.vx * DT, y: st.y + vel.vy * DT, z: st.z + vel.vz * DT }).world;
    const fd = scaleP(sub(p1, p0), 1 / (2 * DT));
    const err = dist(worldV, fd) / Math.max(1, len(fd));
    assert.ok(err < 1e-3, `velocity FD mismatch rel=${err.toFixed(5)} (|v|=${len(worldV).toFixed(1)} vs ${len(fd).toFixed(1)})`);
  }
});

test('velocity inverse: canonicalVelocityFromWorld round-trips and reports units', () => {
  const states = [
    { s: 30000, laneZ: -200, altitude: 31 },
    { s: map.loops[0].start + 2600, laneZ: 80, altitude: 0 },
    { s: map.stageStart.stadium + 900, laneZ: 400, altitude: 200 },
  ];
  for (const st of states) {
    const canonical = { ds: 2100, dz: -75, dAlt: 40 };
    const worldV = worldVelocityFromCanonical(map, st, canonical);
    const rec = canonicalVelocityFromWorld(map, st, worldV);
    assert.ok(Math.abs(rec.ds - canonical.ds) < 1e-3, `ds ${rec.ds}`);
    assert.ok(Math.abs(rec.dz - canonical.dz) < 1e-3, `dz ${rec.dz}`);
    assert.ok(Math.abs(rec.dAlt - canonical.dAlt) < 1e-3, `dAlt ${rec.dAlt}`);
  }
  // speed units: on a flat straight where the engine course is level, world
  // speed = |v| ≈ (vx/2)·ARC_PER_ENGINE_DISTANCE  (|∂P/∂s| = 1 by arc length)
  const flatDist = 350; // engine start plateau: elevation 0, world spline flat
  const flatX = engineXFromDistance(flatDist);
  const { worldV, canonical } = worldVelocityFromEngine(
    map,
    { x: flatX, y: courseY(flatX, 'ridge') - RADIUS, z: 0, grounded: true },
    { vx: 700, vy: 0, vz: 0 },
  );
  const expected = (700 / 2) * map.ARC_PER_ENGINE_DISTANCE;
  assert.ok(Math.abs(len(worldV) - expected) / expected < 0.02, `world speed ${len(worldV).toFixed(1)} vs ${expected.toFixed(1)}`);
  assert.ok(Math.abs(canonical.ds - expected) < 1e-6, 'canonical ṡ is the world speed here');
});

test('normals: ribbon normal on flats, ramp normal tilts against travel', () => {
  const n = surfaceNormalAt(map, map.stageStart.stadium + 1000);
  assert.ok(dot(n, { x: 0, y: 1, z: 0 }) > 0.995, `flat stadium normal ${JSON.stringify(n)}`);
  const crestDist = 33000;
  const ramp: PhysicalRampSurface = {
    crestDist, startDist: crestDist - 1100, length: 1100, height: 260,
    centerLateral: 0, halfWidth: 480, exponent: 1.4,
  };
  const rn = rampNormalAt(map, [ramp], crestDist - 550, 0);
  const f = map.frameAt(crestDist - 550);
  assert.ok(dot(rn, f.tangent) < -0.1, 'ramp normal leans backward along -tangent');
  assert.ok(Math.abs(len(rn) - 1) < 1e-9);
  // off the ramp: the ramp normal falls back to the ribbon normal
  const off = rampNormalAt(map, [ramp], crestDist + 5000, 0);
  assert.ok(dist(off, surfaceNormalAt(map, crestDist + 5000)) < 1e-12);
});

/* ---------------------------------------------------------------------------
   8. Placed-ramp support decision
   ------------------------------------------------------------------------ */
const worldPointAt = (s: number, lateral: number): CPoint => {
  const f = map.frameAt(s);
  return add(f.pos, scaleP(f.right, lateral));
};

test('ramps: supported straight placement compiles the legacy incline profile', () => {
  const crest = 33000; // straight alpine sprint, past the loop
  const pos = worldPointAt(crest, 0);
  const cls = classifyPlacedRamp(map, { id: 'r1', x: pos.x, y: pos.y, z: pos.z, rotY: 0, scale: 1, trackDist: crest });
  assert.ok(cls.supported, cls.detail);
  const surf = cls.surface!;
  assert.ok(Math.abs(surf.crestDist - crest) < 1e-6 && Math.abs(surf.length - 1100) < 1e-9);
  assert.ok(Math.abs(surf.height - 260) < 1e-9 && Math.abs(surf.halfWidth - 480) < 1e-9);
  // legacy incline replica: h = 260·(delta/1100)^1.4 rising to the crest
  for (const [ds, expect] of [[0, 0], [550, 260 * Math.pow(0.5, 1.4)], [1100, 260]] as const) {
    const s = crest - 1100 + ds;
    assert.ok(Math.abs(rampHeightAt([surf], s, 0) - expect) < 1e-9, `elevation at delta ${ds}`);
  }
  // T03 decision: NO renderer-only scripted arc past the crest — physics owns ballistics
  assert.equal(rampHeightAt([surf], crest + 500, 0), 0, 'no scripted jump arc past the crest');
  // lateral window respected
  assert.equal(rampHeightAt([surf], crest - 500, 480 + RADIUS + 1), 0);
  assert.ok(rampHeightAt([surf], crest - 500, 200) > 0);
});

test('ramps: unsupported placements reject visibly with structured reasons', () => {
  const crest = 33000;
  // edge overhang: lateral footprint exceeds the ribbon
  const edgePos = worldPointAt(crest, 380);
  const edge = classifyPlacedRamp(map, { x: edgePos.x, y: edgePos.y, z: edgePos.z, scale: 1, trackDist: crest });
  assert.equal(edge.supported, false);
  assert.equal(edge.reason, 'insufficient-width', edge.detail);

  // loop region: launch ballistics on an inverted ribbon are undefined
  const loopS = map.loops[0].start + 2500;
  const loopPos = worldPointAt(loopS, 0);
  const loopRamp = classifyPlacedRamp(map, { x: loopPos.x, y: loopPos.y, z: loopPos.z, scale: 1, trackDist: loopS });
  assert.equal(loopRamp.supported, false);
  assert.ok(
    loopRamp.reason === 'unsupported-region-loop' || loopRamp.reason === 'ambiguous-backing',
    `loop ramp reason=${loopRamp.reason}`,
  );

  // singular / non-finite transforms
  assert.equal(classifyPlacedRamp(map, { x: NaN, y: 0, z: 0, scale: 1 }).reason, 'non-finite');
  assert.equal(classifyPlacedRamp(map, { x: 1, y: 2, z: Infinity, scale: 1 }).reason, 'non-finite');
  assert.equal(classifyPlacedRamp(map, { x: 1, y: 2, z: 3, scale: 0 }).reason, 'invalid-scale');
  assert.equal(classifyPlacedRamp(map, { x: 1, y: 2, z: 3, scale: NaN }).reason, 'non-finite');

  // too far from any ribbon to back physically
  const farPos = { x: 30000, y: 0, z: 30000 };
  const far = classifyPlacedRamp(map, { ...farPos, scale: 1 });
  assert.equal(far.supported, false);
  assert.equal(far.reason, 'projection-failed', far.detail);

  // compile() separates surfaces from rejections
  const goodPos = worldPointAt(crest, 0);
  const { surfaces, rejected } = compileRampSurfaces(map, [
    { id: 'ok', x: goodPos.x, y: goodPos.y, z: goodPos.z, scale: 1, trackDist: crest },
    { id: 'bad', x: NaN, y: 0, z: 0, scale: 1 },
  ]);
  assert.equal(surfaces.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason !== undefined && rejected[0].supported === false);
});

test('ramps: placement elevation flows into the shared racer placement', () => {
  const crest = 33000;
  const goodPos = worldPointAt(crest, 0);
  const { surfaces } = compileRampSurfaces(map, [{ x: goodPos.x, y: goodPos.y, z: goodPos.z, scale: 1, trackDist: crest }]);
  const midS = crest - 550;
  const engineDistance = map.engineDistanceFromTrackDist(midS);
  const x = engineXFromDistance(engineDistance);
  // grounded racer riding the ramp surface: ramp altitude must dominate
  const placement = placementFromEngine(
    map,
    { x, distance: engineDistance, y: courseY(x, 'ridge') - RADIUS, z: 0, grounded: true },
    surfaces,
  );
  const expectedAlt = 260 * Math.pow(0.5, 1.4);
  assert.ok(Math.abs(placement.altitude - expectedAlt) < 1e-9, `altitude ${placement.altitude} vs ${expectedAlt}`);
  assert.equal(placement.altSource, 'ramp');
  // and its world position is on the ramp surface
  assert.ok(Math.abs(dot(sub(placement.world, placement.frame.pos), placement.frame.up) - (RADIUS + expectedAlt)) < 1e-9);
});

/* ---------------------------------------------------------------------------
   9. Placement extraction == the legacy renderer formula (drift guard)
   ------------------------------------------------------------------------ */
test('placement: extracted composition matches the legacy renderer formula exactly', () => {
  const cases = [
    { x: 43000, y: courseY(43000, 'ridge') - RADIUS, z: 120, grounded: true },
    { x: 21000, y: courseY(21000, 'ridge') - 480, z: -300, grounded: false },
    { x: 61000, y: courseY(61000, 'ridge') - 90, z: 330, grounded: false },
    { x: 70000, y: courseY(70000, 'ridge') - RADIUS, z: -480, grounded: true },
  ];
  for (const st of cases) {
    const distance = engineDistanceFromX(st.x);
    const d = D_START + (distance / TRACK_DISTANCE) * (map.D_END - D_START);
    const frame = map.frameAt(d);
    // === legacy Renderer3D.render() formula, replicated longhand ===
    const lateral = (st.z / 480) * (frame.halfWidth - RADIUS * 1.2);
    const engineElev = Math.max(0, courseY(st.x, 'ridge') - st.y);
    const airborneElev = st.grounded ? 0 : Math.max(0, GROUND - RADIUS - st.y);
    const altitude = Math.max(engineElev, airborneElev, 0);
    const expected = add(
      add(frame.pos, scaleP(frame.right, lateral)),
      scaleP(frame.up, RADIUS + altitude),
    );
    const placed = placementFromEngine(map, { ...st, distance });
    assert.ok(dist(placed.world, expected) < 1e-6, `placement drift ${dist(placed.world, expected)} at x=${st.x}`);
  }
});

/* ---------------------------------------------------------------------------
   10. Projection: engine→world→engine round-trips; ambiguous sheets reported
   ------------------------------------------------------------------------ */
test('projection: world→engine round-trips across all sections', () => {
  const probe = (s: number, laneZ: number, alt: number) => {
    const placed = worldFromCanonical(map, { s, laneZ, altitude: alt });
    const back = engineFromWorld(map, placed.world);
    assert.equal(back.ambiguous, false, `unexpected ambiguity at s=${s.toFixed(0)}`);
    assert.ok(Math.abs(back.s - s) < 1.5, `s round-trip s=${s.toFixed(0)} → ${back.s.toFixed(2)}`);
    assert.ok(Math.abs(back.laneZ - laneZ) < 2, `laneZ ${back.laneZ.toFixed(1)} vs ${laneZ}`);
    assert.ok(Math.abs(back.altitude - alt) < 2, `alt ${back.altitude.toFixed(1)} vs ${alt}`);
    const backDist = map.engineDistanceFromTrackDist(back.s);
    const expectDist = map.engineDistanceFromTrackDist(s);
    assert.ok(Math.abs(backDist - expectDist) < 6, `distance ${backDist.toFixed(1)} vs ${expectDist.toFixed(1)}`);
  };
  probe(5000, 0, 0);
  probe(30000, -300, 40);
  probe(map.distOf('hairpin2') + 400, 260, 0);
  probe(map.stageStart.cavern + 700, -100, 150);
  probe(map.stageStart.mine + 3000, 300, 0);
  probe(map.loops[1].start + 500, 0, 30); // near loop entry but unambiguous deck
  probe(map.stageStart.stadium + 2400, -420, 0);
  probe(map.D_END - 800, 120, 90);
});

test('projection: ambiguous stacked-deck points are flagged instead of guessed', () => {
  // find the closest pair of topologically distinct ribbon sheets on the course
  // (this is the loop crossover: the helix exit deck passes ~1000 units beside
  // the approach deck) — a world point between them has no unique physical backing
  let best: { d: number; i: number; j: number } | null = null;
  for (let i = 40; i < map.samples.length - 40; i += 2) {
    for (let j = i + 40; j < map.samples.length; j += 2) {
      const d = dist(map.samples[i].pos, map.samples[j].pos);
      if (!best || d < best.d) best = { d, i, j };
    }
  }
  assert.ok(best !== null && best.d > 400 && best.d < 1400, `cross-sheet pair exists, min distance ${best?.d.toFixed(0)}`);
  const { i, j } = best!;
  const mid = scaleP(add(map.samples[i].pos, map.samples[j].pos), 0.5);
  const result = engineFromWorld(map, mid);
  assert.equal(result.ambiguous, true, `midpoint between sheets should be ambiguous (residual=${result.residual.toFixed(0)})`);
  // but a point clearly on one sheet is unambiguous
  const onDeck = worldFromCanonical(map, { s: map.samples[i].dist, laneZ: 200, altitude: 0 });
  const clearResult = engineFromWorld(map, onDeck.world);
  assert.equal(clearResult.ambiguous, false, `on-deck point must not be ambiguous (residual=${clearResult.residual.toFixed(1)})`);
});

/* ---------------------------------------------------------------------------
   11. Singular / degenerate inputs fail visibly
   ------------------------------------------------------------------------ */
test('singular transforms: build-time validation and runtime errors', () => {
  // synthetic corrupt frames are rejected with structural issue codes
  const good = map.samples[0];
  const issues = validateFrameList([
    { index: 0, pos: { x: NaN, y: 0, z: 0 }, tangent: good.tangent, up: good.up, right: good.right, halfWidth: 480 },
    { index: 1, pos: good.pos, tangent: { x: 2, y: 0, z: 0 }, up: good.up, right: good.right, halfWidth: 480 },
    { index: 2, pos: good.pos, tangent: good.tangent, up: good.up, right: good.up, halfWidth: 480 },
    { index: 3, pos: good.pos, tangent: good.tangent, up: good.up, right: good.right, halfWidth: 0 },
  ]);
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes('non-finite'));
  assert.ok(codes.includes('non-unit-basis'));
  assert.ok(codes.includes('bad-handedness'));
  assert.ok(codes.includes('singular-lane-scale'));

  // a centerline whose loop anchor drifted explodes at expansion time
  assert.throws(
    () => {
      const moved = CENTERLINE_WAYPOINTS.map((w, idx) =>
        idx === 50 ? { ...w, x: w.x + 500 } : w);
      buildTrackSpace(moved);
    },
    (e) => e instanceof TrackSpaceError && e.code === 'loop-anchor-drift',
  );

  // non-finite world point cannot be projected silently
  assert.throws(
    () => engineFromWorld(map, { x: NaN, y: 0, z: 0 }),
    (e) => e instanceof TrackSpaceError && e.code === 'non-finite-input',
  );

  // zero-length normalize helper path: two identical consecutive control points
  // are tolerated by the spline (three.js repeated-point rule) — verify no NaN
  const dup = [map.centerline.points[0], map.centerline.points[0], ...map.centerline.points.slice(1, 4)];
  const p = catmullRomPointAt(dup, 0.5);
  assert.ok(Number.isFinite(p.x + p.y + p.z), 'repeated control point must not produce NaN');
});
