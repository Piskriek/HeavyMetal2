import test from 'node:test';
import assert from 'node:assert/strict';
import {
  goblinParts,
  placePart,
  placeAll,
  yawFromHeading,
  quatFromAxisAngle,
  quatMul,
  rotateVec,
  quatFromYaw,
  IDENTITY,
  HATS,
  EARS,
  MOODS,
  allLooks,
  lookFromParams,
  type GoblinLook,
  type Part,
} from '../src/index.js';

const near = (a: number, b: number, e = 1e-9): void =>
  assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

const base: GoblinLook = { color: '#6aa84f', accent: '#ff5533', hat: 'none', ears: 'big' };
const byRole = (ps: Part[], r: string): Part[] => ps.filter((p) => p.role === r);

test('quaternion helpers', () => {
  near(rotateVec(quatFromYaw(Math.PI / 2), [1, 0, 0])[2], 1);
  near(rotateVec(quatFromYaw(Math.PI / 2), [1, 0, 0])[0], 0);
  const q = quatFromAxisAngle([0, 3, 0], 0.7);
  near(Math.hypot(...q), 1);
  const r = quatMul(
    quatFromAxisAngle([0, 1, 0], 0.3),
    quatFromAxisAngle([0, 1, 0], 0.4),
  );
  near(r[1], Math.sin(0.35));
  near(r[3], Math.cos(0.35));
  assert.deepEqual(rotateVec(IDENTITY, [1, 2, 3]), [1, 2, 3]);
  near(yawFromHeading(0, 1), Math.PI / 2);
  near(yawFromHeading(1, 0), 0);
});

test('every look fits in the glass ball and is well formed', () => {
  for (const look of [
    ...allLooks('#6aa84f', '#ffd24a'),
    ...allLooks('#2a8f8f', '#ff66aa'),
  ]) {
    for (const R of [0.5, 1, 3]) {
      const ps = goblinParts(look, R);
      const ids = new Set(ps.map((p) => p.id));
      assert.equal(ids.size, ps.length, JSON.stringify(look));
      assert.equal(byRole(ps, 'glass').length, 1);
      for (const p of ps) {
        assert.ok(
          [...p.position, ...p.scale, p.size, p.metalness, p.roughness, p.opacity].every(
            Number.isFinite,
          ),
        );
        near(Math.hypot(...p.rotation), 1, 1e-9);
        assert.match(p.color, /^#[0-9a-f]{6}$/);
        if (p.role !== 'glass') {
          assert.equal(p.opacity, 1);
          assert.ok(
            Math.hypot(...p.position) + p.size * Math.max(...p.scale) <= 0.97 * R + 1e-9,
            `${p.id} ${JSON.stringify(look)} R=${R}`,
          );
        }
      }
    }
  }
});

test('glass, determinism and scaling with the ball radius', () => {
  const a = goblinParts(base, 1),
    b = goblinParts(base, 1),
    c = goblinParts(base, 2);
  assert.deepEqual(a, b);
  const g = byRole(a, 'glass')[0]!;
  near(g.size, 1);
  assert.ok(g.opacity <= 0.3 && g.roughness <= 0.1);
  assert.deepEqual(g.position, [0, 0, 0]);
  assert.equal(a.length, c.length);
  for (let i = 0; i < a.length; i++) {
    near(c[i]!.size, a[i]!.size * 2, 1e-9);
    near(c[i]!.position[1], a[i]!.position[1] * 2, 1e-9);
  }
});

test('face: skin colours, two eyes with pupils in front, mouth, nose', () => {
  const ps = goblinParts(base, 1);
  assert.equal(byRole(ps, 'head')[0]!.color, '#6aa84f');
  assert.equal(byRole(ps, 'body')[0]!.color, '#6aa84f');
  const eyes = byRole(ps, 'eye');
  const pupils = byRole(ps, 'pupil');
  assert.equal(eyes.length, 2);
  assert.equal(pupils.length, 2);
  near(eyes[0]!.position[2], -eyes[1]!.position[2]);
  near(eyes[0]!.position[0], eyes[1]!.position[0]);
  assert.ok(eyes[0]!.position[0] > byRole(ps, 'head')[0]!.position[0]);
  assert.ok(byRole(ps, 'mouth').length >= 1);
  assert.equal(byRole(ps, 'nose').length, 1);
  assert.ok(byRole(goblinParts({ ...base, mood: 'happy' }, 1), 'tooth').length >= 2);
  const sur = goblinParts({ ...base, mood: 'surprised' }, 1);
  assert.ok(byRole(sur, 'eye')[0]!.size > eyes[0]!.size);
  const ang = goblinParts({ ...base, mood: 'angry' }, 1);
  assert.ok(byRole(ang, 'eye')[0]!.scale[1] < 1);
});

test('ears: two mirrored ears, pointy highest, floppy lowest', () => {
  const y = (e: GoblinLook['ears']): number => {
    const ears = byRole(goblinParts({ ...base, ears: e }, 1), 'ear');
    assert.equal(ears.length, 2);
    near(ears[0]!.position[2], -ears[1]!.position[2]);
    near(ears[0]!.position[1], ears[1]!.position[1]);
    near(ears[0]!.position[0], ears[1]!.position[0]);
    assert.equal(ears[0]!.color, '#6aa84f');
    return ears[0]!.position[1];
  };
  assert.ok(
    (y('pointy') > y('big') && y('big') > y('floppy')) ||
      y('pointy') > y('floppy'),
  );
  assert.ok(y('pointy') > y('floppy'));
});

test('hats', () => {
  const hat = (h: GoblinLook['hat']) => goblinParts({ ...base, hat: h }, 1);
  assert.equal(
    byRole(hat('none'), 'hat').length + byRole(hat('none'), 'hat-detail').length,
    0,
  );
  for (const h of HATS.filter((x) => x !== 'none'))
    assert.ok(byRole(hat(h), 'hat').length >= 1, h);
  assert.ok(
    byRole(hat('crown'), 'hat-detail').length >= 3 &&
      byRole(hat('crown'), 'hat')[0]!.color === '#ffd24a' &&
      byRole(hat('crown'), 'hat')[0]!.metalness >= 0.8,
  );
  assert.ok(byRole(hat('helmet'), 'hat')[0]!.metalness >= 0.8);
  const horns = byRole(hat('horns'), 'hat');
  assert.equal(horns.length, 2);
  near(horns[0]!.position[2], -horns[1]!.position[2]);
  assert.equal(byRole(hat('cap'), 'hat')[0]!.color, '#ff5533');
  assert.ok(hat('pot').length > hat('none').length);
});

test('placing parts: yaw rotates positions and orientations about +y, then translates', () => {
  const ps = goblinParts(base, 1);
  const eye = byRole(ps, 'eye')[0]!;
  const p = placePart(eye, { position: [10, 2, 5], yaw: Math.PI / 2 });
  near(p.position[0], 10 - eye.position[2], 1e-9);
  near(p.position[1], 2 + eye.position[1], 1e-9);
  near(p.position[2], 5 + eye.position[0], 1e-9);
  near(Math.hypot(...p.rotation), 1, 1e-9);
  const all = placeAll(ps, { position: [0, 0, 0], yaw: 0 });
  assert.equal(all.length, ps.length);
  assert.deepEqual(all[0]!.position, ps[0]!.position);
  assert.deepEqual(all.map((x) => x.id), ps.map((x) => x.id));
});

test('variants and loose params', () => {
  assert.equal(allLooks('#112233', '#445566').length, 8 * 4 * 3);
  assert.deepEqual([HATS.length, EARS.length, MOODS.length], [8, 4, 3]);
  assert.deepEqual(
    lookFromParams({
      color: '#112233',
      accent: '#ABCDEF',
      hat: 'crown',
      ears: 'floppy',
      mood: 'angry',
    }),
    { color: '#112233', accent: '#abcdef', hat: 'crown', ears: 'floppy', mood: 'angry' },
  );
  assert.deepEqual(
    lookFromParams({ color: 'green', hat: 'tophat', ears: 3 }),
    { color: '#6aa84f', accent: '#ffd24a', hat: 'none', ears: 'big', mood: 'happy' },
  );
  assert.deepEqual(lookFromParams({}), {
    color: '#6aa84f',
    accent: '#ffd24a',
    hat: 'none',
    ears: 'big',
    mood: 'happy',
  });
});