import test from 'node:test';
import assert from 'node:assert/strict';
import { cmd } from '@hm/contracts';
import { createRuntime } from '../src/runtime';

const STEER = `
export function update(ctx: ScriptContext): void {
  for (const id of ctx.world.query('velocity')) {
    const v = ctx.world.get(id, 'velocity');
    if (!v) continue;
    const steer = ctx.input['p1']?.['steer'];
    ctx.set(id, 'velocity', { vx: Number(v['vx']) + (typeof steer === 'number' ? steer : 0) * 0.5 });
  }
}
`;

function demo(source = STEER) {
  const rt = createRuntime({ seed: 3 });
  const ground = rt.store.put({ kind: 'entity', name: 'Ground', params: { shape: 'box', size: 30, scaleY: 0.04, y: -1, body: 'static' } });
  const ball = rt.store.put({ kind: 'entity', name: 'Ball', params: { shape: 'sphere', y: 0.5, body: 'dynamic' } });
  const mech = rt.store.put({ kind: 'mechanic', name: 'Steer', params: {}, script: { language: 'ts', source, apiVersion: 1 } });
  const scene = rt.store.put({ kind: 'scene', name: 'S', params: {}, children: { entities: [{ ref: ground.id }, { ref: ball.id }], mechanics: [{ ref: mech.id }] } });
  rt.loadScene(scene.id);
  return { rt, ball, mech, scene };
}
const run = (rt: ReturnType<typeof createRuntime>, secs: number, steer: number): void => {
  for (let i = 0; i < Math.round(secs * 60); i++) rt.frame(1000 / 60, (tick) => ({ tick, actors: { p1: { steer } } }));
};
const X = (rt: ReturnType<typeof createRuntime>, id: string): number => rt.world.get(rt.binder.entityOf(id)!, 'transform')!['x'] as number;

test('a mechanic script reads the input frame and drives the ball', () => {
  const { rt, ball } = demo();
  rt.play(); run(rt, 1, 1);
  assert.ok(X(rt, ball.id) > 2, `x=${X(rt, ball.id)}`);
});

test('without input the script does nothing; the status shows it healthy', () => {
  const { rt, ball, mech } = demo();
  rt.play(); run(rt, 1, 0);
  assert.ok(Math.abs(X(rt, ball.id)) < 0.01);
  assert.deepEqual(rt.scripts.status(), [{ id: mech.id, faulted: false }]);
});

test('editing the script (set-script command) reloads it on the next tick', () => {
  const { rt, ball, mech } = demo();
  rt.play(); run(rt, 0.5, 1);
  const x1 = X(rt, ball.id);
  rt.commands.execute(cmd.setScript(mech.id, STEER.replace('* 0.5', '* 0.0')));
  run(rt, 0.5, 1);
  const dx = X(rt, ball.id) - x1;
  assert.ok(dx > 10 && dx < 17, `it coasts at the speed it had (about 30 m/s * 0.5 s), no more acceleration: dx=${dx} x1=${x1}`);
});

test('a script that throws is faulted and reported; the simulation keeps running', () => {
  const { rt, ball, mech } = demo('export function update(ctx: ScriptContext): void { throw new Error("boom"); }');
  const errors: unknown[] = [];
  rt.events.on('script:error', (p) => errors.push(p));
  rt.play(); run(rt, 0.5, 1);
  assert.ok(errors.length >= 1);
  assert.equal(rt.scripts.status()[0]?.faulted, true);
  assert.ok((rt.world.get(rt.binder.entityOf(ball.id)!, 'transform')!['y'] as number) > 0.65, 'physics still ran (the ball settled onto the ground)');
  void mech;
});

test('a script with a compile error never runs and says why', () => {
  const { rt } = demo('export function update( {');
  const st = rt.scripts.status()[0];
  assert.equal(st?.faulted, true);
  assert.ok(st?.lastError);
});
