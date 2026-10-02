import test from 'node:test';
import assert from 'node:assert/strict';
import { RIGS, RigState, Director, type Subject } from '../src';

const flat = (): number => 0;
const sub = (id: number, x: number, z: number, vz = 20, alive = true): Subject => ({ id, pos: [x, 0, z], vel: [0, 0, vz], yaw: 0, alive });

test('a chase camera sits behind and above a subject driving along +z, looking ahead', () => {
  const rig = RIGS.find((r) => r.kind === 'chase')!;
  const st = new RigState(rig);
  const s = sub(1, 0, 0);
  st.reset(s, flat);
  const shot = st.step(rig, 1 / 60, s, flat);
  assert.ok(shot.eye[2] < -rig.distance * 0.5, `eye z ${shot.eye[2]}`);
  assert.ok(shot.eye[1] > rig.height * 0.5);
  assert.ok(shot.target[2] > 0);
});

test('the chase follows a moving subject and stays near the wanted distance', () => {
  const rig = RIGS.find((r) => r.kind === 'chase')!;
  const st = new RigState(rig);
  const s = sub(1, 0, 0);
  st.reset(s, flat);
  let shot = st.step(rig, 1 / 60, s, flat);
  for (let i = 0; i < 600; i++) { s.pos[2] += 20 / 60; shot = st.step(rig, 1 / 60, s, flat); }
  const gap = s.pos[2] - shot.eye[2];
  assert.ok(gap > rig.distance * 0.6 && gap < rig.distance * 2.5, `gap ${gap}`);
});

test('the director never returns a subject that is not in the list', () => {
  const d = new Director();
  const subs = [sub(1, 0, 10), sub(2, 3, 5), sub(3, -3, 0, 20, false)];
  for (let i = 0; i < 300; i++) {
    if (i === 100) d.feed({ t: i / 10, kind: 'overtake', a: 2, b: 1 });
    const r = d.step(0.1, subs, 1);
    assert.ok([1, 2].includes(r.subjectId));
    assert.ok(r.reason.length > 3);
  }
});
