import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { processInboundQuery, runArenaNode } from '../src/arena_node.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src/arena_node.mjs');
const bridge = path.join(root, 'src/arena_fractal_bridge.mjs');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const save = (dir, file, object) => fs.writeFileSync(path.join(dir, file), JSON.stringify(object, null, 2));
const load = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const blankEnv = { ...process.env, ARENA_REASONER_EXEC: '', ARENA_REASONER_ARGS: '' };

function reflection(id, question) {
  return {
    query_id: id,
    query_sha256: sha(question),
    answer: 'Hello. The input is a greeting; machine availability is not verified.',
    density_review: Array.from({ length: 7 }, (_, i) => ({ rung: `D${i + 1}`, assessment: `Review ${i + 1}: distinguish evidence from assumptions.` })),
    four_floats: { Pxd: null, Vtx: null, Lx: null, Aq: null },
    four_floats_basis: 'No measurement or defensible numeric estimate is available.',
  };
}

test('Node 4 does not fabricate a model response or measured state', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-idle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const idle = await runArenaNode({ syncDir: dir, env: blankEnv });
  assert.deepEqual(idle, { status: 'waiting_for_query', written: true, query_id: null });
  const first = load(dir, 'arena_telemetry.json');
  assert.equal(first.node.up, null);
  assert.equal(first.lastQueryResponse, null);
  assert.deepEqual(first.telemetry.reported_four_floats, [null, null, null, null]);
  assert.equal(first.telemetry.reported_lyapunov_ftle, null);
  assert.equal((await runArenaNode({ syncDir: dir, env: blankEnv })).written, false);

  const question = '  Hello World 🧭\n';
  const input = { updated_at: '2026-11-03T00:00:00Z', fourFloats: [0.1, 0.2, 0.3, 0.4], lyapunovFTLE: 0.012, query: { id: 'greeting-1', from: 'Laptop', question } };
  save(dir, 'triad_telemetry.json', input);
  const pending = await runArenaNode({ syncDir: dir, env: blankEnv });
  assert.equal(pending.status, 'awaiting_reasoner');
  const output = load(dir, 'arena_telemetry.json');
  assert.equal(output.lastQueryResponse.query, question);
  assert.equal(output.lastQueryResponse.query_sha256, sha(question));
  assert.equal(output.lastQueryResponse.answer, null);
  assert.equal(output.lastQueryResponse.loop_closed, false);
  assert.equal(output.lastQueryResponse.handshake.step_3_change.applied, false);
  assert.equal(output.telemetry.reported_ftle_within_limit, false);
  assert.equal(output.telemetry.independently_verified, false);
  assert.match(output.telemetry.note, /not a measurement of confirmation bias/);
  assert.deepEqual(load(dir, 'triad_telemetry.json'), input);
  assert.equal((await runArenaNode({ syncDir: dir, env: blankEnv })).written, false);
});

test('interactive reflection is matched to query and includes all seven rungs', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-reflection-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const question = 'Hello World from the laptop';
  const input = { query: { id: 'q-123', question, from: 'Laptop' } };
  save(dir, 'triad_telemetry.json', input);
  const ref = reflection('q-123', question);
  save(dir, 'reflection.json', ref);
  const result = await runArenaNode({ syncDir: dir, reflectionFile: path.join(dir, 'reflection.json'), env: blankEnv });
  assert.equal(result.status, 'completed');
  const output = load(dir, 'arena_telemetry.json');
  assert.equal(output.lastQueryResponse.answer, ref.answer);
  assert.deepEqual(output.lastQueryResponse.density_review.map(item => item.rung), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);
  assert.equal(output.lastQueryResponse.four_floats.kind, 'reasoner_estimates_not_measurements');
  assert.equal(output.lastQueryResponse.provenance.type, 'interactive_agent_submission');
  assert.equal(output.lastQueryResponse.provenance.independently_verified, false);
  assert.equal(output.lastQueryResponse.invariants.compassion_return.recipient_landed, 'unknown');
  assert.deepEqual(load(dir, 'triad_telemetry.json'), input);
  assert.equal((await runArenaNode({ syncDir: dir, env: blankEnv })).written, false);
  const before = fs.readFileSync(path.join(dir, 'arena_telemetry.json'), 'utf8');
  save(dir, 'reflection.json', { ...ref, query_sha256: 'wrong' });
  await assert.rejects(runArenaNode({ syncDir: dir, reflectionFile: path.join(dir, 'reflection.json'), env: blankEnv }), /does not match/);
  assert.equal(fs.readFileSync(path.join(dir, 'arena_telemetry.json'), 'utf8'), before);
  save(dir, 'reflection.json', { ...ref, density_review: ref.density_review.slice(0, 6) });
  await assert.rejects(runArenaNode({ syncDir: dir, reflectionFile: path.join(dir, 'reflection.json'), env: blankEnv }), /seven rungs|each of D1/);
  save(dir, 'triad_telemetry.json', { query: { id: 'q-123', question: 'different text' } });
  await assert.rejects(runArenaNode({ syncDir: dir, env: blankEnv }), /reused with different text/);
  assert.equal(fs.readFileSync(path.join(dir, 'arena_telemetry.json'), 'utf8'), before);
});

test('processed legacy inquiry is ignored unless explicitly revisited', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-legacy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const legacy = { id: 'legacy-1', question: 'Legacy greeting', sender: 'Piskriek', processed: true, response: { answer: 'old placeholder' } };
  save(dir, 'pending_query.json', legacy);
  assert.equal((await runArenaNode({ syncDir: dir, env: blankEnv })).status, 'waiting_for_query');
  const pathToReflection = path.join(dir, 'reflection.json');
  save(dir, 'reflection.json', reflection(legacy.id, legacy.question));
  const result = await runArenaNode({ syncDir: dir, includeProcessed: true, reflectionFile: pathToReflection, env: blankEnv });
  assert.equal(result.status, 'completed');
  assert.equal(load(dir, 'arena_telemetry.json').query_source_previously_processed, true);
  assert.deepEqual(load(dir, 'pending_query.json'), legacy);
});

test('configured reasoner adapter receives structured input and remains unverified', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-adapter-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const question = 'Adapter request';
  save(dir, 'triad_telemetry.json', { query: { id: 'adapter-1', question } });
  const fixture = path.join(dir, 'reasoner.mjs');
  fs.writeFileSync(fixture, `let data=''; for await (const c of process.stdin) data += c; const input=JSON.parse(data); if (input.query.trust !== 'untrusted_data' || input.density_rungs.length !== 7) process.exit(2); console.log(JSON.stringify({query_id:input.query.id,query_sha256:input.query.sha256,answer:'Adapter response',density_review:input.density_rungs.map(x=>({rung:x.rung,assessment:'No independent evidence.'})),four_floats:{Pxd:null,Vtx:null,Lx:null,Aq:null},four_floats_basis:'Not measured'}));`);
  const result = await runArenaNode({ syncDir: dir, env: { ...blankEnv, ARENA_REASONER_EXEC: process.execPath, ARENA_REASONER_ARGS: JSON.stringify([fixture]) } });
  assert.equal(result.status, 'completed');
  const output = load(dir, 'arena_telemetry.json');
  assert.equal(output.lastQueryResponse.answer, 'Adapter response');
  assert.equal(output.lastQueryResponse.provenance.type, 'configured_reasoner_adapter');
  assert.equal(output.lastQueryResponse.provenance.independently_verified, false);
});

test('changing the single-slot query during reasoning prevents a stale write', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-stale-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  save(dir, 'triad_telemetry.json', { query: { id: 'old', question: 'old question' } });
  const fixture = path.join(dir, 'replace.mjs');
  fs.writeFileSync(fixture, `import fs from 'node:fs'; let s=''; for await (const c of process.stdin) s+=c; const input=JSON.parse(s); fs.writeFileSync(process.env.TEST_INPUT, JSON.stringify({query:{id:'new',question:'new question'}})); console.log(JSON.stringify({query_id:input.query.id,query_sha256:input.query.sha256,answer:'old response',density_review:input.density_rungs.map(x=>({rung:x.rung,assessment:'unknown'})),four_floats:{Pxd:null,Vtx:null,Lx:null,Aq:null},four_floats_basis:'unknown'}));`);
  const env = { ...blankEnv, TEST_INPUT: path.join(dir, 'triad_telemetry.json'), ARENA_REASONER_EXEC: process.execPath, ARENA_REASONER_ARGS: JSON.stringify([fixture]) };
  await assert.rejects(runArenaNode({ syncDir: dir, env }), /input changed/);
  assert.equal(fs.existsSync(path.join(dir, 'arena_telemetry.json')), false);
});

test('invalid input or failed adapters do not overwrite existing responses', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-invalid-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  save(dir, 'arena_telemetry.json', { marker: 'keep' });
  fs.writeFileSync(path.join(dir, 'triad_telemetry.json'), '{');
  await assert.rejects(runArenaNode({ syncDir: dir, env: blankEnv }), /valid JSON/);
  assert.equal(load(dir, 'arena_telemetry.json').marker, 'keep');
  save(dir, 'triad_telemetry.json', { query: { id: 'q', question: 'hello' } });
  await assert.rejects(runArenaNode({ syncDir: dir, env: { ...blankEnv, ARENA_REASONER_EXEC: path.join(dir, 'missing') } }), /reasoner/);
  assert.equal(load(dir, 'arena_telemetry.json').marker, 'keep');
  assert.throws(() => processInboundQuery({ question: 'hello' }, { reflection: {} }), /does not match/);
  assert.throws(() => processInboundQuery({ id: '\u001b[2J', question: 'hello' }), /Query ID/);
});

test('legacy bridge queues inquiries without claiming a model or live flows', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-bridge-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const script = `import {dispatchTetraQuery} from ${JSON.stringify(pathToFileURL(bridge).href)}; console.log(JSON.stringify(await dispatchTetraQuery('bridge greeting','test')));`;
  const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', script], { env: { ...blankEnv, TRIAD_SYNC_DIR: dir, BRIDGE_ROOT: path.join(dir, 'local-root') }, timeout: 5000 });
  const result = JSON.parse(stdout);
  assert.equal(result.cascade_summary.status, 'awaiting_reasoner');
  assert.equal(result.arena_response.answer, null);
  assert.equal(result.cascade_summary.nodes_contacted, null);
  assert.ok(result.tetra_holon.flows.every(flow => flow.active === null));
  assert.ok(Object.values(result.tetra_holon.invariants).every(value => value === null));
  assert.equal(load(dir, 'pending_query.json').processed, false);
  await assert.rejects(exec(process.execPath, ['--input-type=module', '-e', script], { env: { ...blankEnv, TRIAD_SYNC_DIR: dir, BRIDGE_ROOT: path.join(dir, 'local-root') }, timeout: 5000 }), /slot is occupied/);
});

test('daemon observes local file updates without inventing a response', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-daemon-'));
  const child = spawn(process.execPath, [cli, '--daemon', '--interval', '250', '--sync-dir', dir], { env: blankEnv, stdio: 'ignore' });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exit;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(path.join(dir, 'arena_telemetry.json')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(fs.existsSync(path.join(dir, 'arena_telemetry.json')));
  save(dir, 'triad_telemetry.json', { query: { id: 'daemon-1', question: 'new inquiry' } });
  while (Date.now() < deadline) {
    if (load(dir, 'arena_telemetry.json').lastQueryResponse?.id === 'daemon-1') break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  const result = load(dir, 'arena_telemetry.json').lastQueryResponse;
  assert.equal(result.id, 'daemon-1');
  assert.equal(result.status, 'awaiting_reasoner');
  assert.equal(result.answer, null);
});

test('CLI reports pending or idle instead of claiming an agent connection', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-node-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  save(dir, 'triad_telemetry.json', { query: { id: 'cli-1', question: 'hello' } });
  const { stdout } = await exec(process.execPath, [cli, '--sync-dir', dir], { env: blankEnv, timeout: 5000 });
  assert.match(stdout, /awaiting_reasoner/);
  assert.equal(load(dir, 'arena_telemetry.json').lastQueryResponse.answer, null);
});
