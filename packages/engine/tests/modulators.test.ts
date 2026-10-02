import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../src/runtime';

function demo(def: unknown, extra: Record<string, unknown> = {}) {
  const rt = createRuntime({ seed: 3 });
  const ball = rt.store.put({ kind: 'entity', name: 'Ball', params: { shape: 'sphere', y: 5 } });
  const mod = rt.store.put({ kind: 'modulator', name: 'Bob', params: { target: `${ball.id}.size`, def: JSON.stringify(def), ...extra } });
  const scene = rt.store.put({ kind: 'scene', name: 'S', params: {}, children: { entities: [{ ref: ball.id }], modulators: [{ ref: mod.id }] } });
  rt.loadScene(scene.id);
  return { rt, ball, mod };
}
const run = (rt: ReturnType<typeof createRuntime>, secs: number): void => { for (let i = 0; i < Math.round(secs * 120); i++) rt.frame(1000 / 120); };
const size = (rt: ReturnType<typeof createRuntime>, id: string): number => rt.vars.read(`${id}.size`) as number;

test('a timeline driver moves a preset setting while playing and puts it back on stop', () => {
  const { rt, ball } = demo({ kind: 'timeline', durationMs: 1000, loop: 'none', keys: [{ timeMs: 0, value: 1 }, { timeMs: 1000, value: 3 }] });
  assert.equal(size(rt, ball.id), 0.5);
  rt.play(); run(rt, 2);
  assert.ok(Math.abs(size(rt, ball.id) - 3) < 0.01, `size=${size(rt, ball.id)}`);
  rt.stop();
  assert.equal(size(rt, ball.id), 0.5);
});

test('add mode and amount blend with the original value', () => {
  const { rt, ball } = demo({ kind: 'constant', value: 2 }, { mode: 'add', amount: 0.5 });
  rt.play(); run(rt, 0.5);
  assert.ok(Math.abs(size(rt, ball.id) - 1.5) < 1e-6, `size=${size(rt, ball.id)}`);
});

test('a bad definition is reported, not thrown, and the target is untouched', () => {
  const errors: unknown[] = [];
  const { rt, ball } = demo({ kind: 'nope' });
  rt.events.on('modulator:error', (e) => errors.push(e));
  rt.play(); run(rt, 0.2);
  assert.equal(size(rt, ball.id), 0.5);
  assert.equal(rt.modulators.status()[0]!.error !== undefined, true);
});

test('drivers are deterministic: two runs give the same value', () => {
  const def = { kind: 'random', seed: 5, rateHz: 4, mode: 'smooth', out: { min: 1, max: 4 } };
  const a = demo(def); a.rt.play(); run(a.rt, 1.3);
  const b = demo(def); b.rt.play(); run(b.rt, 1.3);
  assert.equal(size(a.rt, a.ball.id), size(b.rt, b.ball.id));
});
