import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SEEDS, MATERIALS, RACERS, CAMERAS, PROPS, seedsOfKind, findSeed, validateSeeds, PARAM_KEYS } from '../src';

const num = (s: { params: Record<string, unknown> }, k: string): number => Number(s.params[k]);
test('counts and kinds', () => {
  assert.equal(MATERIALS.length, 48); assert.equal(RACERS.length, 12); assert.equal(CAMERAS.length, 8); assert.equal(PROPS.length, 12);
  assert.equal(ALL_SEEDS.length, 80);
  assert.ok(MATERIALS.every((s) => s.kind === 'material') && RACERS.every((s) => s.kind === 'racer') && CAMERAS.every((s) => s.kind === 'camera') && PROPS.every((s) => s.kind === 'entity'));
  assert.equal(seedsOfKind('racer').length, 12); assert.equal(findSeed(RACERS[0]!.name), RACERS[0]); assert.equal(findSeed('nope'), undefined);
});
test('the library validates clean', () => { assert.deepEqual(validateSeeds(ALL_SEEDS), []); });
test('names are unique and tidy', () => {
  const names = ALL_SEEDS.map((s) => s.name); assert.equal(new Set(names).size, names.length);
  for (const s of ALL_SEEDS) { assert.ok(s.name.trim() === s.name && s.name.length >= 3); assert.ok(s.tags.length >= 1 && s.tags.every((t) => t === t.toLowerCase() && t.length > 1)); assert.ok(typeof s.doc === 'string' && s.doc.length > 10, `doc of ${s.name}`); }
});
test('materials: real-world sanity and variety', () => {
  assert.ok(MATERIALS.filter((m) => num(m, 'metalness') >= 0.85).length >= 7);
  assert.ok(MATERIALS.filter((m) => num(m, 'roughness') >= 0.7 && num(m, 'metalness') <= 0.05).length >= 14);
  assert.ok(MATERIALS.filter((m) => num(m, 'roughness') >= 0.2 && num(m, 'roughness') <= 0.45 && num(m, 'metalness') <= 0.1).length >= 6);
  assert.ok(MATERIALS.filter((m) => m.tier === 'play').length >= 18 && MATERIALS.filter((m) => m.tier === 'play').length <= 24);
  for (const m of MATERIALS) { assert.ok(/^#[0-9a-f]{6}$/i.test(String(m.params.color))); const r = num(m, 'roughness'); assert.ok(r >= 0.02 && r <= 1, `roughness ${m.name}`); }
  assert.ok(new Set(MATERIALS.map((m) => String(m.params.color).toLowerCase())).size >= 40, 'colours are distinct');
  for (const word of ['gold', 'chrome', 'basalt', 'sand', 'moss', 'jade', 'obsidian', 'ice']) assert.ok(MATERIALS.some((m) => m.name.toLowerCase().includes(word)), word);
  const gold = MATERIALS.find((m) => m.name.toLowerCase().includes('gold'))!; assert.ok(num(gold, 'metalness') >= 0.95);
});
test('racers: budget, spread and personality', () => {
  for (const r of RACERS) { const w = num(r, 'weight'), s = num(r, 'speed'), b = num(r, 'bounce'); assert.ok([w, s, b].every((v) => Number.isInteger(v) && v >= 1 && v <= 10)); assert.ok(w + s + b <= 15, r.name); assert.ok(r.tags.includes('goblin')); }
  assert.ok(RACERS.filter((r) => num(r, 'weight') + num(r, 'speed') + num(r, 'bounce') === 15).length >= 8);
  const skills = RACERS.map((r) => num(r, 'skill')); assert.ok(Math.min(...skills) <= 0.25 && Math.max(...skills) >= 0.9);
  assert.ok(RACERS.filter((r) => r.tags.includes('heavy')).length >= 2 && RACERS.filter((r) => r.tags.includes('fast')).length >= 2 && RACERS.filter((r) => r.tags.includes('bouncy')).length >= 2);
  assert.ok(new Set(RACERS.map((r) => String(r.params.hat))).size >= 5 && new Set(RACERS.map((r) => String(r.params.ears))).size >= 3);
  assert.ok(new Set(RACERS.map((r) => String(r.params.color))).size === 12);
});
test('cameras and props: ranges and references', () => {
  for (const c of CAMERAS) { assert.ok(num(c, 'fov') >= 20 && num(c, 'fov') <= 110); assert.ok(Math.abs(num(c, 'pitch')) <= 1.5); assert.ok(num(c, 'distance') >= 0.5); }
  assert.ok(CAMERAS.some((c) => num(c, 'pitch') > 1.2) && CAMERAS.some((c) => num(c, 'distance') >= 100));
  for (const p of PROPS) { const target = findSeed(p.refs!.material!); assert.ok(target && target.kind === 'material', p.name); assert.ok(['none', 'static'].includes(String(p.params.body))); assert.ok(['sphere', 'box', 'cylinder', 'plane'].includes(String(p.params.shape))); }
  assert.ok(PROPS.some((p) => p.params.shape === 'cylinder') && PROPS.some((p) => p.params.shape === 'sphere') && PROPS.some((p) => p.params.shape === 'box'));
});
test('the validator catches mistakes', () => {
  const base = MATERIALS[0]!;
  const bad = (patch: Partial<typeof base>, expect: RegExp): void => { const issues = validateSeeds([{ ...base, ...patch }]); assert.ok(issues.some((i) => expect.test(i.message)), JSON.stringify(issues)); };
  bad({ params: { ...base.params, roughness: 2 } }, /roughness/i);
  bad({ params: { ...base.params, color: 'red' } }, /colo/i);
  bad({ params: { ...base.params, bogus: 1 } }, /bogus|unknown/i);
  bad({ tags: [] }, /tag/i);
  bad({ name: 'x'.repeat(40) }, /name|long/i);
  const r = RACERS[0]!;
  assert.ok(validateSeeds([{ ...r, params: { ...r.params, weight: 9, speed: 9, bounce: 9 } }]).some((i) => /budget|sum|15/i.test(i.message)));
  assert.ok(validateSeeds([{ ...PROPS[0]!, refs: { material: 'Nope' } }]).some((i) => /ref|material|Nope/i.test(i.message)));
  assert.ok(validateSeeds([base, { ...base }]).some((i) => /unique|duplicate/i.test(i.message)));
  assert.ok(Object.keys(PARAM_KEYS).length === 4);
});
