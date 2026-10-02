import test from "node:test";
import assert from "node:assert/strict";
import {
  RIGS,
  RigState,
  Director,
  blendShots,
  describeRig,
  scoreEvent,
  validateRig,
  type GameEvent,
  type RigDef,
  type Shot,
  type Subject,
  type V3,
} from "../src";

const flatGround = (): number => -100;

function named(name: string): RigDef {
  const rig = RIGS.find((candidate) => candidate.name === name);
  if (!rig) throw new Error(`Missing rig: ${name}`);
  return rig;
}

function subject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 1,
    pos: [0, 0, 0],
    vel: [0, 0, 0],
    yaw: 0,
    alive: true,
    ...overrides,
  };
}

function assertNear(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function assertVecNear(actual: V3, expected: V3, tolerance = 1e-9): void {
  assertNear(actual[0], expected[0], tolerance);
  assertNear(actual[1], expected[1], tolerance);
  assertNear(actual[2], expected[2], tolerance);
}

test("every preset validates and junk is rejected without throwing", () => {
  for (const rig of RIGS) {
    assert.deepEqual(validateRig(rig), { ok: true, errors: [] });
  }

  const junk: unknown[] = [
    null,
    12,
    "camera",
    [],
    {},
    { ...named("Classic chase"), fov: 121 },
    { ...named("Classic chase"), stiffness: 0 },
    { ...named("Classic chase"), shake: 2 },
  ];

  for (const value of junk) {
    assert.doesNotThrow(() => validateRig(value));
    assert.equal(validateRig(value).ok, false);
    assert.ok(validateRig(value).errors.length > 0);
  }

  const hostile = Object.defineProperty({}, "name", {
    get(): never {
      throw new Error("unreadable");
    },
  });
  assert.doesNotThrow(() => validateRig(hostile));
  assert.equal(validateRig(hostile).ok, false);
});

test("chase exponential smoothing is frame-rate independent", () => {
  const rig: RigDef = { ...named("Classic chase"), shake: 0, stiffness: 6 };

  const run = (steps: number, dt: number): Shot => {
    const car = subject();
    const state = new RigState(rig);
    state.reset(car, flatGround);
    state.step(rig, 0, car, flatGround);
    car.pos = [10, 0, 0];

    let shot = state.step(rig, 0, car, flatGround);
    for (let i = 0; i < steps; i += 1) {
      shot = state.step(rig, dt, car, flatGround);
    }
    return shot;
  };

  const one = run(1, 0.1);
  const ten = run(10, 0.01);
  const distanceCovered = Math.abs(one.eye[0]);
  assert.ok(Math.abs(one.eye[0] - ten.eye[0]) <= distanceCovered * 0.01);
  assertVecNear(one.eye, ten.eye, 1e-9);
});

test("heading smoothing crosses the pi boundary by the short route", () => {
  const rig: RigDef = {
    ...named("Classic chase"),
    distance: 0,
    height: 0,
    lookAhead: 10,
    stiffness: 1,
    shake: 0,
    collideGround: false,
  };
  const car = subject({ yaw: Math.PI - 0.02 });
  const state = new RigState(rig);
  state.reset(car, flatGround);
  state.step(rig, 0, car, flatGround);

  car.yaw = -Math.PI + 0.02;
  const shot = state.step(rig, 0.1, car, flatGround);
  assert.ok(shot.target[2] < -9);
  assert.ok(Math.abs(shot.target[0]) < 1);
});

test("the first step after reset snaps to the wanted chase position", () => {
  const rig = named("Classic chase");
  const car = subject();
  const state = new RigState(rig);
  state.reset(car, flatGround);
  car.pos = [100, 3, 20];

  const shot = state.step(rig, 0.016, car, flatGround);
  assertVecNear(shot.eye, [100, 5.5, 14]);
  assertVecNear(shot.target, [100, 3, 27]);
});

test("ground collision keeps the camera 1.2 metres above terrain", () => {
  const rig: RigDef = {
    ...named("Classic chase"),
    height: -10,
    shake: 0,
    collideGround: true,
  };
  const car = subject();
  const state = new RigState(rig);
  const ground = (): number => 5;
  state.reset(car, ground);

  const shot = state.step(rig, 0.1, car, ground);
  assert.ok(shot.eye[1] >= 6.2);
});

test("first-person roll leans against positive lateral acceleration and is capped", () => {
  const rig: RigDef = { ...named("Cockpit first person"), shake: 0 };
  const car = subject({ vel: [0, 0, 10] });
  const state = new RigState(rig);
  state.reset(car, flatGround);
  state.step(rig, 0, car, flatGround);

  car.vel = [5, 0, 10];
  const rightTurn = state.step(rig, 0.1, car, flatGround);
  assert.ok(rightTurn.roll < 0);
  assert.ok(rightTurn.roll >= -0.15);

  car.vel = [-5, 0, 10];
  const leftTurn = state.step(rig, 0.1, car, flatGround);
  assert.ok(leftTurn.roll > 0);
  assert.ok(leftTurn.roll <= 0.15);
});

test("orbit completes a full circle in two pi over orbit speed", () => {
  const rig: RigDef = {
    ...named("Orbit"),
    orbitSpeed: 0.8,
    shake: 0,
    collideGround: false,
  };
  const car = subject({ pos: [4, 2, -7] });
  const state = new RigState(rig);
  state.reset(car, flatGround);
  const start = state.step(rig, 0, car, flatGround);
  const finish = state.step(rig, Math.PI * 2 / rig.orbitSpeed, car, flatGround);
  assertVecNear(finish.eye, start.eye, 1e-8);
});

test("top-down camera targets a point directly below its eye", () => {
  const rig = named("Top down");
  const car = subject({ pos: [8, 3, -4] });
  const state = new RigState(rig);
  state.reset(car, flatGround);

  const shot = state.step(rig, 0.1, car, flatGround);
  assert.equal(shot.target[0], shot.eye[0]);
  assert.equal(shot.target[2], shot.eye[2]);
  assert.ok(shot.target[1] < shot.eye[1]);
  assert.equal(shot.roll, 0);
});

test("free camera moves at normal and boosted speed and clamps pitch", () => {
  const rig: RigDef = { ...named("Ghost drift"), shake: 0 };
  const car = subject();
  const state = new RigState(rig);
  state.reset(car, flatGround);

  const start = state.stepFree(rig, 0, {
    move: [0, 0, 0],
    yawDelta: 0,
    pitchDelta: 0,
    boost: false,
  });
  const moved = state.stepFree(rig, 1, {
    move: [0, 0, 1],
    yawDelta: 0,
    pitchDelta: 0,
    boost: false,
  });
  assertNear(Math.hypot(
    moved.eye[0] - start.eye[0],
    moved.eye[1] - start.eye[1],
    moved.eye[2] - start.eye[2],
  ), 12);

  const pitched = state.stepFree(rig, 0, {
    move: [0, 0, 0],
    yawDelta: 0,
    pitchDelta: 100,
    boost: false,
  });
  const dx = pitched.target[0] - pitched.eye[0];
  const dy = pitched.target[1] - pitched.eye[1];
  const dz = pitched.target[2] - pitched.eye[2];
  assertNear(Math.asin(dy / Math.hypot(dx, dy, dz)), 1.4);

  const beforeBoost = pitched.eye;
  const boosted = state.stepFree(rig, 1, {
    move: [1, 0, 0],
    yawDelta: 0,
    pitchDelta: 0,
    boost: true,
  });
  assertNear(Math.hypot(
    boosted.eye[0] - beforeBoost[0],
    boosted.eye[1] - beforeBoost[1],
    boosted.eye[2] - beforeBoost[2],
  ), 36);
});

test("scoreEvent follows the event score table and weights", () => {
  const table: Array<[GameEvent["kind"], number]> = [
    ["finish", 10],
    ["crash", 8],
    ["item-hit", 7],
    ["overtake", 6],
    ["fell-off", 7],
    ["lap", 3],
    ["boost", 2],
    ["near-miss", 3],
  ];

  for (const [kind, expected] of table) {
    assert.equal(scoreEvent({ t: 0, kind, a: 1 }), expected);
  }
  assert.equal(scoreEvent({ t: 0, kind: "finish", a: 1, weight: 1.5 }), 15);
  assert.equal(scoreEvent({ t: 0, kind: "overtake", a: 2, forLead: true }), 8);
});

test("director holds the minimum shot and then switches for a larger event", () => {
  const racers = [
    subject({ id: 1 }),
    subject({ id: 2 }),
  ];
  const director = new Director({
    minShotSeconds: 3,
    maxShotSeconds: 12,
    switchMargin: 1.5,
  });

  assert.equal(director.step(0, racers, 1).subjectId, 1);
  director.feed({ t: 0, kind: "overtake", a: 2, b: 1 });

  const held = director.step(2.99, racers, 1);
  assert.equal(held.subjectId, 1);

  const switched = director.step(0.01, racers, 1);
  assert.equal(switched.subjectId, 2);
  assert.equal(switched.rig.name, "Close chase");
  assert.equal(switched.reason, "Overtake by goblin 2");
  assert.equal(switched.shotAgeSeconds, 0);
});

test("director never selects a dead subject", () => {
  const racers = [
    subject({ id: 1, alive: false }),
    subject({ id: 2, alive: true }),
  ];
  const director = new Director({ minShotSeconds: 0, maxShotSeconds: 1 });

  assert.equal(director.step(0, racers, 1).subjectId, 2);
  director.feed({ t: 0, kind: "finish", a: 1 });
  assert.equal(director.step(10, racers, 1).subjectId, 2);
});

test("director forces a cut to a different live subject after the maximum", () => {
  const racers = [
    subject({ id: 1 }),
    subject({ id: 2 }),
  ];
  const director = new Director({
    minShotSeconds: 2,
    maxShotSeconds: 4,
    switchMargin: 100,
  });

  assert.equal(director.step(0, racers, 1).subjectId, 1);
  const forced = director.step(4, racers, 1);
  assert.equal(forced.subjectId, 2);
  assert.match(forced.reason, /Maximum shot length/);
});

test("identical camera inputs produce identical outputs", () => {
  const run = (): Shot[] => {
    const rig = named("Classic chase");
    const car = subject({ vel: [0, 0, 8] });
    const state = new RigState(rig);
    state.reset(car, flatGround);
    const shots: Shot[] = [];

    for (let i = 0; i < 8; i += 1) {
      car.pos = [i * 0.3, 0, i * 0.8];
      car.vel = [3, 0, 8];
      shots.push(state.step(rig, 0.05, car, flatGround, i === 3 ? 0.7 : 0));
    }
    return shots;
  };

  assert.deepEqual(run(), run());
});

test("describeRig mentions chase distance", () => {
  const rig = named("Classic chase");
  const description = describeRig(rig);
  assert.match(description, new RegExp(`${rig.distance}\\s*m`));
  assert.match(description, /Chases/);
});

test("blendShots preserves endpoints and blends roll by the shortest route", () => {
  const a: Shot = {
    eye: [0, 0, 0],
    target: [0, 0, 10],
    fov: 60,
    roll: 3,
  };
  const b: Shot = {
    eye: [10, 20, 30],
    target: [5, 6, 7],
    fov: 90,
    roll: -3,
  };

  assert.deepEqual(blendShots(a, b, 0), a);
  assert.deepEqual(blendShots(a, b, 1), b);

  const middle = blendShots(a, b, 0.5);
  assertVecNear(middle.eye, [5, 10, 15]);
  assertNear(middle.fov, 75);
  assert.ok(Math.abs(middle.roll) > 3);
});