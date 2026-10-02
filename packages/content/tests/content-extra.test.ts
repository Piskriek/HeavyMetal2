import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SEEDS,
  MATERIALS,
  RACERS,
  CAMERAS,
  PROPS,
  seedsOfKind,
  validateSeeds,
} from '../src';

const num = (s: { params: Record<string, unknown> }, k: string): number => Number(s.params[k]);

function parseHexLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('extra 1: every param value is a finite number, string, or boolean', () => {
  for (const s of ALL_SEEDS) {
    for (const [k, v] of Object.entries(s.params)) {
      if (typeof v === 'number') {
        assert.ok(Number.isFinite(v), `${s.name}.${k} is not finite`);
      } else if (typeof v === 'string') {
        assert.ok(v.length > 0, `${s.name}.${k} is empty string`);
      } else if (typeof v === 'boolean') {
        assert.ok(v === true || v === false, `${s.name}.${k} boolean`);
      } else if (v === null) {
        assert.ok(true);
      } else {
        assert.fail(`Invalid param type for ${s.name}.${k}: ${typeof v}`);
      }
    }
  }
});

test('extra 2: racers accent contrast against body colour has luminance delta > 0.15', () => {
  for (const r of RACERS) {
    const skinColor = String(r.params.color);
    const accentColor = String(r.params.accent);
    const skinLum = parseHexLuminance(skinColor);
    const accentLum = parseHexLuminance(accentColor);
    const delta = Math.abs(skinLum - accentLum);
    assert.ok(
      delta > 0.15,
      `Racer ${r.name} has low contrast delta ${delta.toFixed(3)} between ${skinColor} and ${accentColor}`
    );
  }
});

test('extra 3: no two cameras have identical parameters', () => {
  const cameraSignatures = new Set<string>();
  for (const c of CAMERAS) {
    const sig = `${num(c, 'fov')}-${num(c, 'distance')}-${num(c, 'pitch')}-${num(c, 'yaw')}-${num(c, 'targetX')}-${num(c, 'targetY')}-${num(c, 'targetZ')}`;
    assert.ok(!cameraSignatures.has(sig), `Duplicate camera parameters in ${c.name}`);
    cameraSignatures.add(sig);
  }
  assert.equal(cameraSignatures.size, CAMERAS.length);
});

test('extra 4: props never have dynamic body', () => {
  for (const p of PROPS) {
    assert.notEqual(p.params.body, 'dynamic', `Prop ${p.name} must not have dynamic body`);
    assert.ok(p.params.body === 'static' || p.params.body === 'none');
  }
});

test('extra 5: materials tagged metal are metallic (metalness >= 0.6)', () => {
  const metals = MATERIALS.filter((m) => m.tags.includes('metal'));
  assert.ok(metals.length >= 8, 'Expected at least 8 metal materials');
  for (const m of metals) {
    const metalness = num(m, 'metalness');
    assert.ok(metalness >= 0.6, `Metal material ${m.name} has low metalness ${metalness}`);
  }
});

test('extra 6: all props have friction >= 0.3 and restitution <= 0.9', () => {
  for (const p of PROPS) {
    const friction = num(p, 'friction');
    const restitution = num(p, 'restitution');
    assert.ok(friction >= 0.3 && friction <= 1.0, `${p.name} friction ${friction}`);
    assert.ok(restitution >= 0.0 && restitution <= 0.9, `${p.name} restitution ${restitution}`);
    assert.ok(num(p, 'size') >= 0.05 && num(p, 'size') <= 50, `${p.name} size`);
  }
});

test('extra 7: archetype racers have specialized stat distributions', () => {
  const heavy = RACERS.filter((r) => r.tags.includes('heavy'));
  const fast = RACERS.filter((r) => r.tags.includes('fast'));
  const bouncy = RACERS.filter((r) => r.tags.includes('bouncy'));

  assert.ok(heavy.length >= 2);
  assert.ok(fast.length >= 2);
  assert.ok(bouncy.length >= 2);

  for (const h of heavy) {
    assert.ok(num(h, 'weight') >= 8, `${h.name} heavy weight`);
  }
  for (const f of fast) {
    assert.ok(num(f, 'speed') >= 9, `${f.name} fast speed`);
  }
  for (const b of bouncy) {
    assert.ok(num(b, 'bounce') >= 9, `${b.name} bouncy bounce`);
  }
});

test('extra 8: validator flags bad tiers, unknown ref keys, and invalid bodies', () => {
  const baseProp = PROPS[0]!;
  const badTier = validateSeeds([{ ...baseProp, tier: 'godlike' as 'play' }]);
  assert.ok(badTier.some((i) => /tier/i.test(i.message)), 'Validator must catch invalid tier');

  const badRefKey = validateSeeds([{ ...baseProp, refs: { engine: 'V8' } }]);
  assert.ok(badRefKey.some((i) => /ref/i.test(i.message)), 'Validator must catch unknown ref key');

  const badBody = validateSeeds([
    { ...baseProp, params: { ...baseProp.params, body: 'ethereal' } },
  ]);
  assert.ok(badBody.some((i) => /body/i.test(i.message)), 'Validator must catch unknown body');
});

test('extra 9: seedsOfKind accurately groups all 80 seeds', () => {
  const materials = seedsOfKind('material');
  const racers = seedsOfKind('racer');
  const cameras = seedsOfKind('camera');
  const entities = seedsOfKind('entity');

  assert.equal(materials.length, 48);
  assert.equal(racers.length, 12);
  assert.equal(cameras.length, 8);
  assert.equal(entities.length, 12);
  assert.equal(materials.length + racers.length + cameras.length + entities.length, 80);
});

test('extra 10: seed documentation strings are well-formed sentences', () => {
  for (const s of ALL_SEEDS) {
    assert.ok(typeof s.doc === 'string' && s.doc.length > 10, `${s.name} missing doc`);
    assert.ok(
      s.doc.endsWith('.') || s.doc.endsWith('!'),
      `Doc for ${s.name} should end with punctuation: "${s.doc}"`
    );
  }
});
