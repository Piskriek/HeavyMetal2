import test from 'node:test';
import assert from 'node:assert/strict';
import { LOGIC_PRESETS, LogicRunner, normalizeRule, ruleScript, ruleSentence, type LogicRule } from '../src/index';

const rule = (p: Partial<LogicRule>, id = 'r1'): LogicRule => normalizeRule({ thing: 'palm1', ...p }, id);
const world = (player: [number, number, number], now: number, hour = 12) => ({ player, things: new Map([['palm1', { x: 0, y: 0, z: 0 }]]), hour, now });

test('junk becomes a legal rule; every ready-made rule is legal', () => {
  const r = normalizeRule({ when: 'banana', near: -5, do: 7 }, 'x');
  assert.equal(r.when, 'touch'); assert.equal(r.do, 'sound'); assert.equal(r.near, 0.3);
  for (const p of LOGIC_PRESETS) assert.ok(normalizeRule(p.rule, p.id), p.id);
});

test('touch fires once as a goblin comes close, not again while it stays', () => {
  const run = new LogicRunner();
  const rules = [rule({ when: 'touch', do: 'sound', sound: 'boost', near: 2 })];
  assert.equal(run.step(rules, world([10, 0, 0], 0)).events.length, 0);
  assert.deepEqual(run.step(rules, world([1, 0, 0], 0.1)).events, [{ kind: 'sound', id: 'boost' }]);
  assert.equal(run.step(rules, world([1.2, 0, 0], 0.2)).events.length, 0, 'still touching: no repeat');
  run.step(rules, world([10, 0, 0], 0.3));
  assert.equal(run.step(rules, world([0.5, 0, 0], 0.4)).events.length, 1, 'comes back: fires again');
});

test('every fires on its timer; start fires once', () => {
  const run = new LogicRunner();
  const rules = [rule({ when: 'every', every: 1, do: 'say', text: 'tick' }, 'e'), rule({ when: 'start', do: 'say', text: 'hi' }, 's')];
  assert.deepEqual(run.step(rules, world([9, 0, 9], 0)).events, [{ kind: 'say', text: 'hi' }]);
  assert.equal(run.step(rules, world([9, 0, 9], 0.5)).events.length, 0);
  assert.deepEqual(run.step(rules, world([9, 0, 9], 1.05)).events, [{ kind: 'say', text: 'tick' }]);
});

test('a touch spin turns the thing and ends back where it stood; a jump goes up and comes down', () => {
  const run = new LogicRunner();
  const spin = [rule({ when: 'touch', do: 'spin', amount: 1 })];
  run.step(spin, world([0.5, 0, 0], 0));
  const mid = run.step(spin, world([0.5, 0, 0], 0.4)).poses.get('palm1')!;
  assert.ok(mid.dyaw > 0 && mid.dyaw < 360);
  const end = run.step(spin, world([0.5, 0, 0], 2)).poses.get('palm1')!;
  assert.equal(end.dyaw, 0);
  const run2 = new LogicRunner();
  const jump = [rule({ when: 'touch', do: 'jump', amount: 2 })];
  run2.step(jump, world([0.5, 0, 0], 0));
  assert.ok(run2.step(jump, world([0.5, 0, 0], 0.35)).poses.get('palm1')!.dy > 1);
});

test('"only at night" hides the thing by day and shows it at night', () => {
  const run = new LogicRunner();
  const rules = [rule({ when: 'day', do: 'hide' })];
  assert.equal(run.step(rules, world([9, 0, 9], 0, 12)).poses.get('palm1')!.hidden, true);
  assert.equal(run.step(rules, world([9, 0, 9], 1, 22)).poses.get('palm1')!.hidden, false);
});

test('a rule reads as a sentence and as the script it equals', () => {
  const r = rule({ when: 'touch', do: 'sound', sound: 'boost', near: 2 });
  assert.match(ruleSentence(r, 'the palm'), /When a goblin comes within 2 m of the palm: play the sound "boost"/);
  const js = ruleScript(r, 'the palm');
  assert.match(js, /export function onEvent\(ctx, name, payload\)/);
  assert.match(js, /ctx\.emit\('sound', "boost"\)/);
});
