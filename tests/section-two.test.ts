/**
 * TICKET-08 contracts: the Section 2 circuit, its surfaces, gravity scaling, pinball
 * props and fire rings. These are pure-node checks against the real modules, so a
 * regression in the 12 km waterfall cliff fails here before it reaches the browser.
 *
 * Run with: node scripts/check.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINISH, GRAVITY, LANE, LANE_WIDTH, RADIUS, STADIUM_START, START_X, TRACK_DISTANCE,
  closestLane, courseSlope, courseY, laneZ, obstacleBounds, obstacleZ, occupiesLane,
  type Obstacle,
} from '../src/game/scene';
import {
  BANK_PULL, CLIFF_GRAVITY_SCALE, PEG, PEG_BOUNCE, RING, ROCK_BOUNCE, SECTION_TWO, SECTION_TWO_START,
  STAGE_TWO_SECTORS, bumperRebound, cameraPitch, cliffGravityScale, createSectionTwoLayout,
  gravityAt, mx, stageTwoProfile, surfaceGripAt, surfaceKindAt, throughRing, toMetres,
} from '../src/game/stage-two';
import { createTrackLayout } from '../src/game/track-layout';
import { TRACKS } from '../src/game/courses';
import { sectorAt } from '../src/game/scene';

const COURSES = ['ridge', 'boomtown', 'sheep'] as const;

test('the grand circuit is a 24 km, two-stage course', () => {
  assert.equal(TRACK_DISTANCE, 24000, 'Stage 1 (12 km) + Stage 2 (12 km)');
  assert.equal(FINISH, START_X + TRACK_DISTANCE * 2);
  assert.ok(STADIUM_START < FINISH && STADIUM_START > mx(22000), 'the maw approach is the last grandstand run');
  assert.equal(toMetres(mx(12300)), 12300, 'metres and world units round-trip');
  assert.ok(SECTION_TWO_START < mx(SECTION_TWO.cascade), 'the crest sits before the cascade');
});

test('every course descends monotonically through Section 2', () => {
  for (const course of COURSES) {
    const crest = courseY(mx(SECTION_TWO.crest), course);
    const maw = courseY(mx(SECTION_TWO.maw), course);
    assert.ok(maw > crest, `${course}: the chasm descends (crest ${crest} -> maw ${maw})`);
    let previous = -Infinity;
    for (let metres = 11800; metres <= 24000; metres += 25) {
      const y = courseY(mx(metres), course);
      assert.ok(y >= previous - 0.001, `${course}: no uphill step at ${metres} m`);
      previous = y;
    }
  }
});

test('the Stage 1 downhill is never re-graded by the splice', () => {
  // TICKET-08 splices Section 2 at the crest. Stage 1's own knots must survive exactly and
  // the curve between them must stay within a couple of metres of the original descent,
  // or every existing race line and record stops matching the hill it was set on.
  const ridge: [number, number][] = [
    [0, 0], [1400, 0], [5400, 600], [10000, 1960], [13600, 2130], [18600, 3830], [23000, 4380], [26400, 4970], [27000, 5060], [31000, 5060],
  ];
  const reference = (x: number) => {
    const slopes = ridge.slice(0, -1).map((p, i) => (ridge[i + 1][1] - p[1]) / (ridge[i + 1][0] - p[0]));
    const tangents = ridge.map((_, i) => !i || i === ridge.length - 1 || !slopes[i - 1] || !slopes[i] ? 0 : 2 / (1 / slopes[i - 1] + 1 / slopes[i]));
    let section = 0;
    while (section < ridge.length - 2 && x > ridge[section + 1][0]) section++;
    const a = ridge[section]; const b = ridge[section + 1]; const span = b[0] - a[0];
    const t = Math.max(0, Math.min(1, (x - a[0]) / span)); const t2 = t * t; const t3 = t2 * t;
    return 478 + (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * span * tangents[section]
      + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * span * tangents[section + 1];
  };
  // courseY(x) reads the shipped sample table, which is keyed on (x - START_X); compare
  // like for like so the check is about the hill, not about that historical indexing.
  for (let x = START_X; x <= 22000; x += 32) {
    assert.ok(Math.abs(courseY(x, 'ridge') - reference(x - START_X)) < 12, `ridge x=${x} stayed on the Stage 1 curve`);
  }
});

test('Section 2 grades stay inside the projection limit and reach the cliff threshold', () => {
  const steepest: Record<string, number> = {};
  for (const course of COURSES) {
    let max = 0;
    for (let metres = 12000; metres <= 23900; metres += 5) {
      max = Math.max(max, Math.abs(courseSlope(mx(metres), course)));
    }
    steepest[course] = max;
    assert.ok(max > 0.6, `${course}: the chasm is genuinely steep (max |slope| ${max.toFixed(2)})`);
    assert.ok(max <= 1.0, `${course}: the deck never tears into a wall (max |slope| ${max.toFixed(2)})`);
  }
  // The two mountain courses dive hard enough for the chasm gravity to reach full scale.
  assert.ok(cliffGravityScale(steepest.ridge) > 1.3, `ridge gravity ${cliffGravityScale(steepest.ridge).toFixed(2)}x`);
  assert.ok(cliffGravityScale(steepest.boomtown) > 1.3, `boomtown gravity ${cliffGravityScale(steepest.boomtown).toFixed(2)}x`);
  assert.ok(cliffGravityScale(steepest.sheep) > 1, 'even the meadow course leans on it');
});

test('cliff gravity scales to 1.45x only on the steepest decks', () => {
  assert.equal(cliffGravityScale(0), 1, 'flat ground keeps normal gravity');
  assert.equal(cliffGravityScale(0.3), 1, 'Stage 1 grades are left alone');
  assert.ok(cliffGravityScale(0.75) > 1.3 && cliffGravityScale(0.75) < CLIFF_GRAVITY_SCALE);
  assert.equal(cliffGravityScale(1.4), CLIFF_GRAVITY_SCALE, 'clamped at the chasm figure');
  assert.equal(cliffGravityScale(-0.9), cliffGravityScale(0.9), 'sign independent');
  assert.equal(gravityAt(1.4), GRAVITY * CLIFF_GRAVITY_SCALE);
});

test('camera pitch unwinds on ledges and leans into the drop', () => {
  assert.equal(cameraPitch(0), 0);
  assert.equal(cameraPitch(0.4), 0, 'the alpine downhill keeps the classic framing');
  assert.ok(cameraPitch(0.95) > 0.1, 'the chute tilts the view down');
  assert.equal(cameraPitch(3), cameraPitch(0.95), 'clamped');
});

test('surfaces change grip by section and never touch Stage 1', () => {
  assert.equal(surfaceKindAt(mx(9000), 'ridge'), 'dirt');
  assert.equal(surfaceGripAt(mx(9000), 'ridge'), 1, 'Stage 1 dirt is the baseline grip');
  assert.equal(surfaceKindAt(mx(12200), 'ridge'), 'wood');
  assert.ok(Math.abs(surfaceGripAt(mx(12200), 'ridge') - 0.6) < 1e-9, 'wet timber is 40% looser');
  assert.equal(surfaceKindAt(mx(16000), 'ridge'), 'metal');
  assert.equal(surfaceKindAt(mx(21000), 'ridge'), 'wood');
  assert.equal(surfaceKindAt(mx(22000), 'ridge'), 'moss');
  assert.equal(surfaceKindAt(mx(23900), 'ridge'), 'hazard');
  assert.equal(surfaceKindAt(mx(22000), 'sheep'), 'wood', 'the meadow course dries its slate');
  assert.equal(surfaceKindAt(mx(22000), 'boomtown'), 'metal');
});

test('the Section 2 layout is deterministic, ordered and complete', () => {
  for (const course of COURSES) {
    const first = createSectionTwoLayout(course);
    const second = createSectionTwoLayout(course);
    assert.deepEqual(first.map((o) => [o.kind, o.x, o.lane, o.z, o.pegType]), second.map((o) => [o.kind, o.x, o.lane, o.z, o.pegType]),
      `${course}: the same seed builds the same chasm`);
    assert.ok(first.every((obstacle, index) => index === 0 || obstacle.x >= first[index - 1].x), `${course}: sorted by x`);
    assert.ok(first.every((o) => o.x >= SECTION_TWO_START - 600), `${course}: nothing lands in Stage 1`);
    assert.ok(first.every((o) => o.x < FINISH), `${course}: nothing lands past the finish`);
    const kinds = new Set(first.map((o) => o.kind));
    for (const kind of ['peg', 'rock', 'ring', 'switchback', 'gap', 'spring', 'boost', 'crate', 'skull']) {
      assert.ok(kinds.has(kind), `${course}: the chasm uses ${kind}`);
    }
    const pegs = first.filter((o) => o.kind === 'peg');
    assert.ok(pegs.length > 60, `${course}: the pinball rockfield has real peg density (${pegs.length})`);
    assert.ok(pegs.some((p) => p.pegType === 'crown'), `${course}: crown bumpers exist`);
    assert.ok(pegs.some((p) => p.pegType === 'spiked'), `${course}: spiked bumpers exist`);
    assert.ok(first.filter((o) => o.kind === 'ring').length >= 4, `${course}: fire rings are laid out`);
    assert.ok(first.filter((o) => o.kind === 'switchback').length >= 3, `${course}: switchback berms exist`);
  }
});

test('courses differ: boomtown dives deeper, the meadows are shallower', () => {
  const depth = (course: typeof COURSES[number]) => courseY(mx(SECTION_TWO.maw), course) - courseY(mx(SECTION_TWO.crest), course);
  assert.ok(depth('boomtown') > depth('ridge'));
  assert.ok(depth('ridge') > depth('sheep'));
  const pegs = (course: typeof COURSES[number]) => createSectionTwoLayout(course).filter((o) => o.kind === 'peg').length;
  assert.ok(pegs('ridge') > pegs('sheep'), 'the meadow course is a gentler chasm');
});

test('the leap off the crest is a full-width void that cannot be rolled through', () => {
  const gaps = createSectionTwoLayout('ridge').filter((o) => o.kind === 'gap' && o.x < mx(12400));
  assert.ok(gaps.length, 'the gorge exists');
  const gorge = gaps[0];
  assert.equal(gorge.lane, 0);
  assert.equal(gorge.laneSpan, 4, 'all four lanes drop away');
  for (let lane = 0; lane < 4; lane++) assert.ok(occupiesLane(gorge, laneZ(lane), 0), `lane ${lane} is void`);
  assert.ok(gorge.width > 100, 'wide enough to need the launch pads');
});

test('cliff-side voids always leave at least two lanes of deck', () => {
  // A void that closed every lane would be a guaranteed fall, not a line choice.
  for (const course of COURSES) {
    const layout = createSectionTwoLayout(course);
    const voids = layout.filter((o) => o.kind === 'gap');
    for (const gap of voids) {
      const spans = gap.laneSpan ?? 1;
      if (gap.lane === 0 && spans >= 4) continue; // the crest leap is the one full-width void
      let open = 0;
      for (let lane = 0; lane < 4; lane++) {
        const blocked = voids.some((other) => Math.abs(other.x - gap.x) < Math.max(other.width, gap.width)
          && occupiesLane(other, laneZ(lane), 0));
        if (!blocked) open++;
      }
      assert.ok(open >= 2, `${course}: a void at ${toMetres(gap.x).toFixed(0)} m leaves ${open} open lanes`);
    }
  }
});

test('the rope bridge is a two-lane plank span between two voids', () => {
  const layout = createSectionTwoLayout('ridge');
  const bridge = layout.filter((o) => o.kind === 'gap' && toMetres(o.x) > 21600 && toMetres(o.x) < 22000);
  assert.equal(bridge.length, 2, 'both outer lanes fall away at the bridge');
  const open = [1, 2].every((lane) => !bridge.some((gap) => occupiesLane(gap, laneZ(lane), 0)));
  assert.ok(open, 'the two centre lanes keep their planks');
});

test('switchback berms bank toward the deck and never overlap the full width', () => {
  const layout = createSectionTwoLayout('ridge').filter((o) => o.kind === 'switchback');
  assert.ok(layout.length >= 3);
  for (const bank of layout) {
    assert.ok(bank.width > 200, 'a berm is a long shelf, not a point');
    const safe = bank.lane ?? 2;
    assert.ok(safe >= 0 && safe < 4, 'the berm pulls toward a real lane');
    const bounds = obstacleBounds(bank);
    assert.ok(bounds.near >= LANE.near && bounds.far <= LANE.far, 'the safe span stays on the deck');
  }
  assert.ok(BANK_PULL > 0);
});

test('crown bumpers pay back 1.5x, spiked bumpers deflect harder', () => {
  assert.ok(PEG.crown > PEG.spiked);
  assert.ok(Math.abs((1 + PEG_BOUNCE.crown) - 1.5) < 0.01, 'crown restitution = 1.5x incoming impulse');
  assert.ok(1 + PEG_BOUNCE.spiked > 1 + ROCK_BOUNCE, 'spiked bumpers out-bounce rock outcrops');
  const incoming = { vx: 900, vz: 0 };
  const crown = bumperRebound(incoming, { x: -1, z: 0 }, PEG_BOUNCE.crown);
  assert.ok(Math.abs(crown.vx + 450) < 1e-6, 'a crown impact leaves at 0.5x the incoming speed, reversed');
  assert.ok(Math.abs(crown.vx - incoming.vx) > 1300, 'and adds 1.5x the incoming impulse');
  const spiked = bumperRebound(incoming, { x: -1, z: 0 }, PEG_BOUNCE.spiked);
  assert.ok(Math.abs(spiked.vx) > Math.abs(crown.vx), 'spiked still throws harder');
  const leaving = bumperRebound({ vx: -400, vz: 0 }, { x: -1, z: 0 }, 0.5);
  assert.deepEqual(leaving, { vx: -400, vz: 0 }, 'a ball already separating is not re-kicked');
});

test('pinball props are solid circles the ball can also fly over', () => {
  const peg = createSectionTwoLayout('ridge').find((o) => o.kind === 'peg')!;
  assert.ok(peg.radius === PEG.crown || peg.radius === PEG.spiked);
  assert.ok(occupiesLane(peg, obstacleZ(peg), 0), 'a peg occupies its own footprint');
  assert.ok(!occupiesLane(peg, obstacleZ(peg) + peg.radius! + RADIUS * 2, 0), 'and nothing beyond it');
  const rock = createSectionTwoLayout('ridge').find((o) => o.kind === 'rock')!;
  assert.ok(rock.radius! >= 62 && rock.radius! <= 116);
});

test('fire rings are threadable while rolling, and the raised ones are not', () => {
  const rings = createSectionTwoLayout('ridge').filter((o) => o.kind === 'ring');
  const rolling = rings.filter((o) => (o.altitude ?? 0) <= RING.altitude + 1);
  const raised = rings.filter((o) => (o.altitude ?? 0) >= RING.airAltitude - 1);
  assert.ok(rolling.length >= 3 && raised.length >= 1);
  for (const ring of rolling) {
    const deck = courseY(ring.x + ring.width / 2, 'ridge');
    const centre = { x: ring.x + ring.width / 2, z: laneZ(ring.lane ?? 2) };
    assert.ok(throughRing(ring, centre.x, deck - RADIUS, centre.z, deck), 'a rolling ball threads it');
    assert.ok(throughRing(ring, centre.x, deck - RADIUS - 20, centre.z, deck), 'and has room above');
    assert.ok(!throughRing(ring, centre.x, deck - RADIUS - 120, centre.z, deck), 'but not from high air');
  }
  for (const ring of raised) {
    const deck = courseY(ring.x + ring.width / 2, 'ridge');
    const centre = { x: ring.x + ring.width / 2, z: laneZ(ring.lane ?? 2) };
    assert.ok(!throughRing(ring, centre.x, deck - RADIUS, centre.z, deck), 'rolling under a raised ring misses it');
    assert.ok(throughRing(ring, centre.x, deck - RING.airAltitude, centre.z, deck), 'but a jump threads it');
  }
  const off = rings[0];
  const deck = courseY(off.x, 'ridge');
  assert.ok(!throughRing(off, off.x + off.width / 2, deck - RADIUS, laneZ(off.lane ?? 2) + 130, deck), 'outside the hoop is a miss');
});

test('every ring sits in a lane, not in the wall or the void', () => {
  for (const course of COURSES) {
    for (const ring of createSectionTwoLayout(course).filter((o) => o.kind === 'ring')) {
      const lane = ring.lane ?? 2;
      assert.ok(lane >= 0 && lane <= 3, `${course}: ring lane ${lane}`);
      const z = laneZ(lane);
      assert.ok(z >= LANE.near && z <= LANE.far);
      assert.ok(closestLane(z) === lane);
    }
  }
});

test('sector names cover the whole circuit and never fall back to Stage 1', () => {
  for (const course of COURSES) {
    assert.equal(sectorAt(mx(11000), course), TRACKS[course].sectors[5], 'the last alpine sector still ends where it did');
    assert.equal(sectorAt(mx(11900), course), STAGE_TWO_SECTORS[0], 'the crest names Section 2');
    assert.equal(sectorAt(mx(SECTION_TWO.crest + 50), course), STAGE_TWO_SECTORS[0]);
    assert.equal(sectorAt(mx(14000), course), 'THE HAIRPIN BERMS');
    assert.equal(sectorAt(mx(17000), course), 'THE PINBALL ROCKFIELD');
    assert.equal(sectorAt(mx(21000), course), 'THE WET FOAM RUN');
    assert.equal(sectorAt(mx(21800), course), 'THE ROPE BRIDGE');
    assert.equal(sectorAt(mx(23500), course), 'THE DROWNED MAW');
    for (let metres = 0; metres <= TRACK_DISTANCE; metres += 100) {
      assert.ok(sectorAt(mx(metres), course).length > 0);
    }
  }
});

test('the combined track layout keeps Stage 1 obstacles and appends Section 2', () => {
  const layout = createTrackLayout('ridge');
  assert.ok(layout.every((o, index) => index === 0 || o.x >= layout[index - 1].x), 'sorted');
  assert.ok(layout.some((o) => o.kind === 'peg'), 'Section 2 props are merged in');
  assert.ok(layout.some((o) => o.kind === 'blimp'), 'Stage 1 scenery survives');
  const stageOne = layout.filter((o) => o.x < SECTION_TWO_START - 600);
  assert.ok(stageOne.length > 50, 'Stage 1 still has its obstacle rhythm');
  // The finish pads moved to the cavern maw; the old stadium Sprint pads are gone.
  const boosts = layout.filter((o) => o.kind === 'boost' && o.x > STADIUM_START);
  assert.ok(boosts.length >= 4, 'the maw run-in keeps its pads');
  assert.ok(layout.every((o) => !(o.kind === 'loop' && toMetres(o.x) > 19000)), 'no alpine loops in the chasm');
});

test('the Stage 2 profile starts exactly where Stage 1 ended', () => {
  for (const course of COURSES) {
    const profile = stageTwoProfile(courseY(mx(SECTION_TWO.crest), course), course);
    assert.equal(profile[0][0], mx(SECTION_TWO.crest));
    assert.ok(Math.abs(profile[0][1] - courseY(mx(SECTION_TWO.crest), course)) < 1, 'shared crest point');
    assert.equal(profile[profile.length - 1][0], mx(SECTION_TWO.finish));
    for (let i = 1; i < profile.length; i++) assert.ok(profile[i][0] > profile[i - 1][0], 'x increases');
  }
});

test('a ball can always reach the crest: the launch chain still clears Section 2', () => {
  // The Stage 1 launch pads and the crest boost pads are the only speed sources before
  // the gorge; there must be at least one boost lane on the lip itself.
  const layout = createSectionTwoLayout('ridge');
  const lipBoosts = layout.filter((o) => o.kind === 'boost' && toMetres(o.x) > 12100 && toMetres(o.x) < 12250);
  assert.equal(new Set(lipBoosts.map((o) => o.lane)).size, 4, 'every lane gets a launch pad');
  // And the gorge is short enough to clear at chasm gravity.
  const gorge = layout.find((o) => o.kind === 'gap' && toMetres(o.x) < 12400) as Obstacle;
  const launchSpeed = 160 / 0.16;
  const airtime = 2 * (launchSpeed * Math.sin(38 * Math.PI / 180)) / (GRAVITY * CLIFF_GRAVITY_SCALE);
  assert.ok(airtime * launchSpeed * 0.9 > gorge.width, `a launch clears the ${gorge.width}-unit gorge`);
  assert.ok(LANE_WIDTH > 0);
});
