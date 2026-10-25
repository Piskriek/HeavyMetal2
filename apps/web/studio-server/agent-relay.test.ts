// The relay between an agent's bridge and the Studio page (plan 40 §4). What matters: a call only settles when the page answers, an
// unanswered call fails with a reason an agent can act on, and one key cannot be held by two pages at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentRelay, AGENT_ROUTE } from './agent-relay';

const relay = (now = 0): { relay: AgentRelay; tick: (t: number) => void } => {
  let clock = now;
  const r = new AgentRelay({ ttlMs: 1000, pageTtlMs: 500, now: () => clock });
  return { relay: r, tick: (t) => { clock = t; } };
};

test('a call is queued for the page and settled by its answer', async () => {
  const { relay: r } = relay();
  const answer = r.call('k1', 'studio.material.coverage', { preset: 'mat:furnace' });
  const queue = r.poll('k1');
  assert.equal(queue.length, 1);
  assert.equal(queue[0]!.tool, 'studio.material.coverage');
  assert.deepEqual(queue[0]!.args, { preset: 'mat:furnace' });
  assert.deepEqual(r.status('k1'), { connected: true, waiting: 0, inFlight: 1 });
  assert.equal(r.answer('k1', queue[0]!.id, { ok: true, value: { yes: true } }), true);
  assert.deepEqual(await answer, { ok: true, value: { yes: true } });
  assert.deepEqual(r.status('k1'), { connected: true, waiting: 0, inFlight: 0 });
});

test('a poll takes the queue; a second poll with nothing waiting gets nothing', () => {
  const { relay: r } = relay();
  void r.call('k1', 'studio.doc.read', {});
  assert.equal(r.poll('k1').length, 1);
  assert.deepEqual(r.poll('k1'), []);
});

test('a call nobody answers fails with a reason, not a hang', async () => {
  const r = new AgentRelay({ ttlMs: 20, pageTtlMs: 500 });
  const answer = r.call('k1', 'studio.capture', { mode: 'view' });
  assert.deepEqual(await answer, { ok: false, why: 'the Studio page did not answer \'studio.capture\' within 0 s' });
});

test('answering a call that is not in flight is ignored, never a crash', () => {
  const { relay: r } = relay();
  assert.equal(r.answer('k1', 'call-999', { ok: true }), false);
  void r.call('k1', 'studio.doc.read', {});
  assert.equal(r.answer('k2', 'call-1', { ok: true }), false, 'a different key must not settle it');
});

test('a dropped key fails every waiting call and forgets the page', async () => {
  const { relay: r } = relay();
  const a = r.call('k1', 'studio.changes.list', {});
  const b = r.call('k1', 'studio.doc.read', {});
  assert.equal(r.drop('k1', 'the person disconnected'), 2);
  assert.deepEqual(await a, { ok: false, why: 'the person disconnected' });
  assert.deepEqual(await b, { ok: false, why: 'the person disconnected' });
  assert.equal(r.status('k1').connected, false);
  assert.equal(r.drop('k1'), 0, 'dropping twice is a no-op');
});

test('a key with no recent poll reads as disconnected and is pruned', async () => {
  const { relay: r, tick } = relay();
  void r.call('k1', 'studio.doc.read', {});
  r.poll('k1');
  tick(100);
  assert.equal(r.status('k1').connected, true);
  tick(700);
  assert.equal(r.status('k1').connected, false, 'the page has not polled for longer than pageTtlMs');
  // pruning only drops keys with nothing outstanding (a waiting call keeps its key alive)
  const { relay: r2, tick: tick2 } = relay();
  r2.poll('k2');
  tick2(800);
  assert.deepEqual(r2.prune(), ['k2']);
  const { relay: r3, tick: tick3 } = relay();
  const waiting = r3.call('k3', 'studio.doc.read', {});
  r3.poll('k3');
  tick3(800);
  assert.deepEqual(r3.prune(), [], 'a call still in flight must keep its key');
  r3.answer('k3', 'call-1', { ok: true, value: null });
  await waiting;
});

test('two pages on one key: the second poll takes the queue, and both can answer their own call', async () => {
  const { relay: r } = relay();
  const first = r.call('k1', 'studio.doc.read', { id: 'a' });
  const queueA = r.poll('k1');
  const second = r.call('k1', 'studio.doc.read', { id: 'b' });
  const queueB = r.poll('k1');
  // each poll takes only what was waiting when it came: the first page never sees the second page's call
  assert.deepEqual(queueA.map((c) => c.args), [{ id: 'a' }]);
  assert.deepEqual(queueB.map((c) => c.args), [{ id: 'b' }]);
  r.answer('k1', queueB[0]!.id, { ok: true, value: 'b' });
  r.answer('k1', queueA[0]!.id, { ok: true, value: 'a' });
  assert.deepEqual(await first, { ok: true, value: 'a' });
  assert.deepEqual(await second, { ok: true, value: 'b' });
});

test('a call without a key is refused before it reaches a page', async () => {
  const { relay: r } = relay();
  assert.deepEqual(await r.call('', 'studio.doc.read', {}), { ok: false, why: 'a pairing key is required' });
  assert.equal(r.status('').connected, false);
});

test('the route the page and the bridge share is the Studio\'s dev route', () => {
  assert.equal(AGENT_ROUTE, '/__studio/agent');
});
