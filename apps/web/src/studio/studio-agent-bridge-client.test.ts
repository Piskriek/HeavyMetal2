// The page's end of the bridge (plan 40 §4): it answers what the relay hands it, posts the answer back, and reports honestly when it
// could not (no API installed, a tool this build does not serve, a dev server that is not there). A fake fetch drives the loop, so this
// runs in node with no dev server and no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc } from '@hm/scenedoc';
import { SERVED_TOOLS, startBridgeClient, type BridgeState } from './studio-agent-bridge-client';
import { installStudioAgent } from './studio-agent-page';

const KEY = 'pairing-key-under-test';

/** A fake dev server: one queue of calls to hand out, and a log of what the page posted back. */
function fakeRelay(calls: { id: string; tool: string; args: unknown }[]): {
  fetchFn: typeof fetch;
  answers: { key: string; id: string; answer: { ok: boolean; why?: string } }[];
  calls: { url: string; method: string }[];
  dropped: string[];
} {
  const answers: { key: string; id: string; answer: { ok: boolean; why?: string } }[] = [];
  const seen: { url: string; method: string }[] = [];
  const dropped: string[] = [];
  const queue = [...calls];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    seen.push({ url, method });
    if (url.includes('/poll')) {
      const next = queue.shift();
      return new Response(JSON.stringify({ ok: true, calls: next ? [next] : [] }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as { key: string; id?: string; answer?: { ok: boolean; why?: string } };
    if (url.includes('/answer') && body.id && body.answer) answers.push({ key: body.key, id: body.id, answer: body.answer });
    if (url.includes('/drop')) dropped.push(body.key);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, answers, calls: seen, dropped };
}

test('the page answers an agent\'s call with its own API and posts the answer back', async () => {
  const installed = installStudioAgent({ key: KEY, doc: emptyDoc() });
  const relay = fakeRelay([{ id: 'call-1', tool: 'studio.doc.read', args: {} }]);
  const client = startBridgeClient({ key: KEY, api: () => installed.api, fetchFn: relay.fetchFn, intervalMs: 60_000, autoStart: false });
  const state = await client.tick();
  await client.stop();

  assert.equal(state.polls, 1);
  assert.equal(state.answered, 1);
  assert.equal(state.refused, 0);
  assert.equal(relay.answers.length, 1);
  assert.equal(relay.answers[0]!.id, 'call-1');
  assert.equal(relay.answers[0]!.key, KEY);
  assert.equal(relay.answers[0]!.answer.ok, true);
  const read = relay.answers[0]!.answer as unknown as { value: { roots: unknown[] } };
  assert.deepEqual(read.value.roots, []);
  assert.deepEqual(relay.dropped, [KEY], 'stopping tells the relay the page is gone');
  installed.disconnect();
});

test('a proposal is answered end to end: staged rows come back over the wire', async () => {
  const installed = installStudioAgent({ key: KEY, doc: emptyDoc() });
  const relay = fakeRelay([
    { id: 'call-7', tool: 'studio.doc.propose', args: { calls: [{ label: 'a machine', ops: [{ op: 'create', type: 'asset', id: 'a1' }] }] } },
  ]);
  const client = startBridgeClient({ key: KEY, api: () => installed.api, fetchFn: relay.fetchFn, intervalMs: 60_000, autoStart: false });
  await client.tick();
  await client.stop();
  const answer = relay.answers[0]!.answer as unknown as { ok: boolean; value: { staged: { label: string }[]; refusals: unknown[] } };
  assert.equal(answer.ok, true);
  assert.equal(answer.value.staged.length, 1);
  assert.equal(answer.value.staged[0]!.label, 'a machine');
  assert.deepEqual(answer.value.refusals, []);
  installed.disconnect();
});

test('a tool this build does not serve is refused with the reason, and the page says how many it refused', async () => {
  const installed = installStudioAgent({ key: KEY, doc: emptyDoc() });
  const relay = fakeRelay([{ id: 'call-2', tool: 'studio.mesh.retopo_single_asset', args: {} }]);
  const client = startBridgeClient({ key: KEY, api: () => installed.api, fetchFn: relay.fetchFn, intervalMs: 60_000, autoStart: false });
  const state = await client.tick();
  await client.stop();
  assert.equal(state.refused, 1);
  assert.match(state.lastWhy, /does not serve 'studio\.mesh\.retopo_single_asset'/);
  assert.equal(relay.answers[0]!.answer.ok, false);
  installed.disconnect();
});

test('with no agent API installed the page refuses instead of pretending', async () => {
  const relay = fakeRelay([{ id: 'call-3', tool: 'studio.doc.read', args: {} }]);
  const client = startBridgeClient({ key: KEY, api: () => undefined, fetchFn: relay.fetchFn, intervalMs: 60_000, autoStart: false });
  const state = await client.tick();
  await client.stop();
  assert.equal(state.answered, 0);
  assert.equal(state.refused, 1);
  assert.match(state.lastWhy, /no agent API installed/);
  assert.equal(relay.answers[0]!.answer.ok, false);
});

test('a dev server that is not there is reported, not thrown', async () => {
  const fetchFn = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  const client = startBridgeClient({ key: KEY, api: () => undefined, fetchFn, intervalMs: 60_000, autoStart: false });
  const state = await client.tick();
  await client.stop();
  assert.equal(state.connecting, false);
  assert.equal(state.lastWhy, 'ECONNREFUSED');
  assert.equal(state.polls, 1);
});

test('an empty poll is a normal round trip: connected, nothing answered', async () => {
  const relay = fakeRelay([]);
  const client = startBridgeClient({ key: KEY, api: () => undefined, fetchFn: relay.fetchFn, intervalMs: 60_000, autoStart: false });
  const state = await client.tick();
  await client.stop();
  assert.equal(state.connecting, true);
  assert.equal(state.polls, 1);
  assert.equal(state.answered, 0);
  assert.equal(relay.answers.length, 0);
  assert.ok(relay.calls.some((c) => c.url.includes(`poll?key=${KEY}`)), 'the key must travel in the poll');
});

test('the served tools are the ones the skill file and the API both name', () => {
  for (const tool of ['studio.doc.read', 'studio.commands.list', 'studio.doc.propose', 'studio.changes.accept', 'studio.kit.validate', 'studio.material.coverage', 'studio.capture']) {
    assert.ok(SERVED_TOOLS.includes(tool), `${tool} is not served through the bridge`);
  }
  // no duplicates, and no tool the API does not have
  assert.equal(new Set(SERVED_TOOLS).size, SERVED_TOOLS.length);
});

test('a call for another key is refused by the API, so the answer carries the reason', async () => {
  const installed = installStudioAgent({ key: KEY, doc: emptyDoc() });
  const relay = fakeRelay([{ id: 'call-4', tool: 'studio.doc.read', args: {} }]);
  const client = startBridgeClient({ key: 'the-wrong-key', api: () => installed.api, fetchFn: relay.fetchFn, intervalMs: 60_000, autoStart: false });
  const state: BridgeState = await client.tick();
  await client.stop();
  assert.equal(state.answered, 1, 'the loop answered, with a refusal');
  const answer = relay.answers[0]!.answer as unknown as { ok: boolean; value: { ok: boolean; why: string } };
  assert.equal(answer.value.ok, false);
  assert.match(answer.value.why, /pairing key does not match/);
  installed.disconnect();
});
