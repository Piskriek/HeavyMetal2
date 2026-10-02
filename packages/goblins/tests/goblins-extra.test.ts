import test from 'node:test';
import assert from 'node:assert/strict';
import {
  goblinParts,
  placeAll,
  quatMul,
  rotateVec,
  quatFromYaw,
  quatFromAxisAngle,
  yawFromHeading,
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

const base: GoblinLook = { color: '#6aa84f', accent: '#ffd24a', hat: 'none', ears: 'big' };
const byRole = (ps: Part[], r: string): Part[] => ps.filter((p) => p.role === r);

test('every look produces between 12 and 40 parts', () => {
  for (const color of ['#6aa84f', '#2a8f8f', '#aa0033', '#3344cc']) {
    for (const accent of ['#ffd24a', '#ff66aa', '#222244', '#ffee88']) {
      const looks = allLooks(color, accent);
      for (const look of looks) {
        const ps = goblinParts(look, 1);
        assert.ok(
          ps.length >= 12 && ps.length <= 40,
          `${JSON.stringify(look)} produced ${ps.length} parts`,
        );
      }
    }
  }
});

test('hats never occupy the exact ear position', () => {
  for (const hat of HATS.filter((h) => h !== 'none')) {
    for (const ears of EARS) {
      const ps = goblinParts({ ...base, hat, ears }, 1);
      const earPositions = byRole(ps, 'ear').map((p) => p.position);
      const hatParts = [...byRole(ps, 'hat'), ...byRole(ps, 'hat-detail')];
      for (const h of hatParts) {
        for (const e of earPositions) {
          const dx = h.position[0] - e[0];
          const dy = h.position[1] - e[1];
          const dz = h.position[2] - e[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          // hats are well above the head (y much greater than ears), so the
          // distance must be substantially more than a tiny epsilon. We pick
          // a generous threshold that still detects true overlaps.
          assert.ok(dist > 0.05, `hat ${h.id} overlaps ear ${JSON.stringify([hat, ears])}`);
        }
      }
    }
  }
});

test('mirrored part pairs share x,y,size,scale,color and differ only in z sign', () => {
  for (const look of allLooks('#6aa84f', '#ffd24a')) {
    const ps = goblinParts(look, 1);
    const byId = new Map<string, Part>();
    for (const p of ps) byId.set(p.id, p);

    // Mirrored pairs share x, y, size, scale, color and differ only in z sign.
    const mirrorPairs: ReadonlyArray<readonly [string, string]> = [
      ['pupil-a', 'pupil-b'],
      ['eye-a', 'eye-b'],
      ['ear-a', 'ear-b'],
    ];
    for (const pair of mirrorPairs) {
      const pa = byId.get(pair[0]);
      const pb = byId.get(pair[1]);
      if (!pa || !pb) continue;
      near(pa.position[0], pb.position[0]);
      near(pa.position[1], pb.position[1]);
      near(pa.position[2], -pb.position[2]);
      near(pa.size, pb.size);
      assert.deepEqual(pa.scale, pb.scale);
      assert.equal(pa.color, pb.color);
    }
  }
});

test('lookFromParams handles a 12-colour palette correctly', () => {
  const palette = [
    '#000000',
    '#ffffff',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#ff00ff',
    '#00ffff',
    '#123456',
    '#abcdef',
    '#AABBCC',
    '#0F1E2D',
  ];
  for (const c of palette) {
    const look = lookFromParams({ color: c, accent: c, hat: 'none', ears: 'big', mood: 'happy' });
    assert.equal(look.color, c.toLowerCase());
    assert.equal(look.accent, c.toLowerCase());
  }
  // Invalid colours fall back.
  const bad = lookFromParams({ color: 'green', accent: '#xyz' });
  assert.equal(bad.color, '#6aa84f');
  assert.equal(bad.accent, '#ffd24a');
});

test('placeAll with yaw=0 and origin position is the identity', () => {
  const ps = goblinParts(base, 1);
  const placed = placeAll(ps, { position: [0, 0, 0], yaw: 0 });
  assert.equal(placed.length, ps.length);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    const q = placed[i]!;
    assert.equal(q.id, p.id);
    near(q.position[0], p.position[0], 1e-12);
    near(q.position[1], p.position[1], 1e-12);
    near(q.position[2], p.position[2], 1e-12);
    near(q.rotation[0], p.rotation[0], 1e-12);
    near(q.rotation[1], p.rotation[1], 1e-12);
    near(q.rotation[2], p.rotation[2], 1e-12);
    near(q.rotation[3], p.rotation[3], 1e-12);
  }
});

test('quatMul associativity', () => {
  const a = quatFromAxisAngle([0, 1, 0], 0.3);
  const b = quatFromAxisAngle([1, 0, 0], 0.5);
  const c = quatFromAxisAngle([0, 0, 1], 0.7);
  const left = quatMul(quatMul(a, b), c);
  const right = quatMul(a, quatMul(b, c));
  for (let i = 0; i < 4; i++) near(left[i]!, right[i]!, 1e-12);
  // Unit length preserved
  near(Math.hypot(...left), 1, 1e-12);
});

test('rotateVec around yaw matches analytical formula', () => {
  for (const theta of [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 3]) {
    const q = quatFromYaw(theta);
    const v: [number, number, number] = [0.4, -0.2, 0.7];
    const r = rotateVec(q, v);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    // yaw turns +x towards +z, so the rotation matrix is
    //   R = [[c, 0, -s], [0, 1, 0], [s, 0, c]]
    const expected: [number, number, number] = [
      v[0] * c - v[2] * s,
      v[1],
      v[0] * s + v[2] * c,
    ];
    near(r[0], expected[0]);
    near(r[1], expected[1]);
    near(r[2], expected[2]);
  }
});

test('yawFromHeading matches the heading direction', () => {
  // Heading in +z: yaw = pi/2
  near(yawFromHeading(0, 1), Math.PI / 2);
  // Heading in +x: yaw = 0
  near(yawFromHeading(1, 0), 0);
  // Heading in -x: yaw = pi
  near(yawFromHeading(-1, 0), Math.PI);
  // Heading in -z: yaw = -pi/2
  near(yawFromHeading(0, -1), -Math.PI / 2);
});

test('glass is the only transparent part and is centred', () => {
  for (const look of allLooks('#6aa84f', '#ffd24a')) {
    const ps = goblinParts(look, 1);
    const transparent = ps.filter((p) => p.opacity < 1);
    assert.equal(transparent.length, 1, `look ${JSON.stringify(look)}`);
    assert.equal(transparent[0]!.role, 'glass');
    assert.deepEqual(transparent[0]!.position, [0, 0, 0]);
  }
});

test('placePart preserves part id and id order', () => {
  const ps = goblinParts(base, 1);
  const placed = placeAll(ps, { position: [1, 2, 3], yaw: 0.4 });
  assert.deepEqual(
    placed.map((p) => p.id),
    ps.map((p) => p.id),
  );
});

test('all ear variants scale with ball radius and remain mirrored', () => {
  for (const ears of EARS) {
    const ps1 = goblinParts({ ...base, ears }, 1);
    const ps2 = goblinParts({ ...base, ears }, 2);
    const ears1 = byRole(ps1, 'ear');
    const ears2 = byRole(ps2, 'ear');
    assert.equal(ears1.length, 2);
    assert.equal(ears2.length, 2);
    for (let i = 0; i < 2; i++) {
      near(ears2[i]!.position[0], ears1[i]!.position[0] * 2, 1e-9);
      near(ears2[i]!.position[1], ears1[i]!.position[1] * 2, 1e-9);
      near(ears2[i]!.position[2], ears1[i]!.position[2] * 2, 1e-9);
      near(ears2[i]!.size, ears1[i]!.size * 2, 1e-9);
    }
  }
});

test('every hat has at least one part with its documented or accent color', () => {
  // Hats that use a fixed material colour (independent of the look).
  const fixed: Record<string, string> = {
    helmet: '#9aa3ad',
    crown: '#ffd24a',
    horns: '#efe6d2',
    leaf: '#3f9d4a',
    pot: '#7a7a7a',
  };
  // Hats whose colour matches the look's accent.
  const accentHats = new Set(['cap', 'bandana']);
  const accent = '#abc123';
  const lookBase: GoblinLook = { color: '#6aa84f', accent, hat: 'none', ears: 'big' };
  for (const hat of HATS.filter((h) => h !== 'none')) {
    const ps = goblinParts({ ...lookBase, hat }, 1);
    const hats = [...byRole(ps, 'hat'), ...byRole(ps, 'hat-detail')];
    assert.ok(hats.length >= 1, hat);
    if (fixed[hat]) {
      const match = hats.find((p) => p.color === fixed[hat]);
      assert.ok(match, `${hat} should have a part with color ${fixed[hat]}`);
    }
    if (accentHats.has(hat)) {
      const match = hats.find((p) => p.color === accent);
      assert.ok(match, `${hat} should have a part with accent color ${accent}`);
    }
  }
});

test('allLooks returns exactly 96 entries', () => {
  for (const c of ['#000000', '#ffffff', '#abcabc']) {
    for (const a of ['#000000', '#112233']) {
      const looks = allLooks(c, a);
      assert.equal(looks.length, 96);
      // Every entry has valid hat, ears, mood.
      for (const l of looks) {
        assert.ok((HATS as readonly string[]).includes(l.hat));
        assert.ok((EARS as readonly string[]).includes(l.ears));
        assert.ok((MOODS as readonly string[]).includes(l.mood ?? 'happy'));
      }
    }
  }
});