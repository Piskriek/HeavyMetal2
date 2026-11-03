import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MAX_QUESTION_LENGTH } from '../src/query_bridge.mjs';

const exec = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = name => path.join(packageRoot, 'src', name);
const cli = source('cli.mjs');
const bootstrap = source('bootstrap.mjs');
const apex = source('triad_369_process.mjs');
const legacyQuery = source('query_triad_369.mjs');
const mirroredLegacyQuery = path.resolve(packageRoot, '../../bridge/loop/query_triad_369.mjs');

function testEnvironment(root) {
  return {
    ...process.env,
    BRIDGE_ROOT: root,
    TRIAD_SYNC_DIR: path.join(root, 'sync'),
    SSH_KEY: path.join(root, 'no-remote-key'),
    TRIAD_REMOTE_QUERY_LOG: '0',
    TRIAD_SENDER: 'test-client',
  };
}

async function run(args, env, options = {}) {
  return exec(process.execPath, args, { env, timeout: 10000, ...options });
}

async function waitForBridge(env, child) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Apex exited before the bridge became ready.');
    try {
      const result = await run([cli, 'status', '--json', '--timeout', '300'], env);
      return JSON.parse(result.stdout);
    } catch {
      await delay(75);
    }
  }
  throw new Error('Apex bridge did not become ready.');
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2000);
    timer.unref();
  });
}

async function runWithInput(args, env, input) {
  const child = spawn(process.execPath, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; });
  child.stdin.end(input);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  return { code, stdout, stderr };
}

async function runChat(env, input) {
  return runWithInput([cli, 'chat'], env, input);
}

async function waitUntil(getValue, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = getValue();
    if (value) return value;
    await delay(25);
  }
  throw new Error('Timed out waiting for a test condition.');
}

test('bootstrap, daemon, CLI and bridge work together', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-cli-test-'));
  const env = testEnvironment(root);
  let child;
  t.after(async () => {
    if (child) await stopChild(child);
    fs.rmSync(root, { recursive: true, force: true });
  });

  await t.test('bootstrap creates the shared bridge root and valid registrations', async () => {
    await run([bootstrap], env);
    for (const file of ['loop/density.json', 'loop/triad_369.json', 'loop/daemons.json', 'sense/universe/rooms.json']) {
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
    }
    const config = JSON.parse(fs.readFileSync(path.join(root, 'loop/daemons.json'), 'utf8'));
    assert.deepEqual(config.daemons.map(item => item.name).sort(), ['density-bridge', 'triad-369-apex']);
  });

  child = spawn(process.execPath, [apex], { env, stdio: 'ignore' });
  const status = await waitForBridge(env, child);

  await t.test('status is a real request to the running Apex process', async () => {
    assert.equal(status.running, true);
    assert.equal(status.pid, child.pid);
    assert.equal(status.bridge_root, root);
    assert.match(status.query_mode, /keyword routing/);
    const otherEnv = { ...env, BRIDGE_ROOT: path.join(root, 'different-root') };
    const explicit = await run([cli, 'status', '--bridge-root', root, '--json'], otherEnv);
    assert.equal(JSON.parse(explicit.stdout).pid, child.pid);
  });

  await t.test('Node 4 is reported as an unverified snapshot without exposing prior queries', async () => {
    fs.mkdirSync(env.TRIAD_SYNC_DIR, { recursive: true });
    fs.writeFileSync(path.join(env.TRIAD_SYNC_DIR, 'arena_telemetry.json'), JSON.stringify({
      at: '2026-11-03T00:00:00Z', node: { status: 'completed', up: true },
      lastQueryResponse: { query: 'PRIVATE_PREVIOUS_QUERY', answer: 'PRIVATE_PREVIOUS_ANSWER' },
    }));
    const result = JSON.parse((await run([cli, 'ask', 'Status', '--json'], env)).stdout);
    assert.equal(result.cascade_trace.flow_34_down.status, 'file_read');
    assert.equal(result.cascade_trace.flow_34_down.data.reported_status, 'completed');
    assert.equal(result.cascade_trace.flow_34_down.data.up, null);
    assert.equal(result.cascade_trace.flow_34_down.data.independently_verified, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PREVIOUS/);
  });

  await t.test('parallel requests have distinct IDs and matching answers', async () => {
    const questions = Array.from({ length: 8 }, (_, index) => `Triad status request ${index}`);
    const responses = await Promise.all(questions.map(async question => {
      const { stdout } = await run([cli, 'ask', question, '--json'], env);
      return JSON.parse(stdout);
    }));
    assert.equal(new Set(responses.map(response => response.id)).size, questions.length);
    for (let index = 0; index < questions.length; index++) {
      const response = responses[index];
      assert.equal(response.question, questions[index]);
      assert.equal(response.from, 'test-client');
      assert.equal(response.query_mode, 'keyword-routing');
      assert.equal(response.cascade_trace.flow_32_down.data.status, 'not_configured');
      assert.equal(response.cascade_trace.flow_32_down.data.up, null);
      assert.equal(response.cascade_trace.flow_31_down.data.independently_verified, false);
      assert.equal(response.teacher_handshake.step_2_decision.outcome, 'not_evaluated');
      assert.equal(response.teacher_handshake.step_3_change.applied, false);
      assert.equal(response.loop_metrics.flows_active, null);
      assert.equal(response.loop_metrics.loop_closed, false);
      assert.match(response.answer, /no conversational model/i);
      assert.doesNotMatch(response.answer, /100% integrity|6\/6 flows/i);
    }
  });

  await t.test('stdin relay preserves the exact text without persistent query history', async () => {
    const ordinaryText = '  NORMAL_RECORDED_MARKER\n';
    const ordinary = await runWithInput([cli, 'ask', '--stdin', '--json'], env, ordinaryText);
    assert.equal(ordinary.code, 0, ordinary.stderr);
    assert.equal(JSON.parse(ordinary.stdout).question, ordinaryText);
    const historyFile = path.join(root, 'loop/thoughts_369.jsonl');
    const logFile = path.join(root, 'loop/triad_369.log');
    const sharedOutput = path.join(root, 'loop/triad_query_out.json');
    assert.match(fs.readFileSync(historyFile, 'utf8'), /NORMAL_RECORDED_MARKER/);
    assert.match(fs.readFileSync(logFile, 'utf8'), /NORMAL_RECORDED_MARKER/);
    assert.equal(JSON.parse(fs.readFileSync(sharedOutput, 'utf8')).question, ordinaryText);
    const previousOutput = fs.readFileSync(sharedOutput, 'utf8');

    const text = '  RELAY_PRIVATE_MARKER hello World 🧭\r\nSecond line: "$(not a shell)"\n\n';
    const relay = await runWithInput([cli, 'relay', '--json', '--stdin'], env, text);
    assert.equal(relay.code, 0, relay.stderr);
    const response = JSON.parse(relay.stdout);
    assert.equal(response.question, text);
    assert.equal(response.teacher_handshake.step_1_ask.request, text);
    assert.match(response.cascade_trace.primary_domain, /^D5/);
    assert.equal(response.loop_metrics.request_returned, true);
    assert.equal(fs.readFileSync(sharedOutput, 'utf8'), previousOutput);
    assert.doesNotMatch(fs.readFileSync(historyFile, 'utf8'), /RELAY_PRIVATE_MARKER/);
    assert.doesNotMatch(fs.readFileSync(logFile, 'utf8'), /RELAY_PRIVATE_MARKER/);
    await waitUntil(() => ['requests', 'processing', 'responses'].every(dir =>
      fs.readdirSync(path.join(root, 'loop/cli-bridge', dir)).length === 0));
  });

  await t.test('relay accepts the maximum input even with worst-case JSON escaping', async () => {
    const text = `x${'\0'.repeat(MAX_QUESTION_LENGTH - 1)}`;
    const relay = await runWithInput([cli, 'relay', '--stdin', '--json'], env, text);
    assert.equal(relay.code, 0, relay.stderr);
    assert.equal(JSON.parse(relay.stdout).question, text);
  });

  await t.test('explicit rungs take precedence and unmatched questions are not made up', async () => {
    const specific = await run([cli, 'ask', 'What is Triad status at D1?', '--json'], env);
    const specificResponse = JSON.parse(specific.stdout);
    assert.match(specificResponse.cascade_trace.primary_domain, /^D1/);
    assert.deepEqual(specificResponse.cascade_trace.rungs_traversed, []);
    assert.ok(specificResponse.cascade_trace.keyword_matches.some(match => match.density === 'D1'));
    const { stdout } = await run([cli, 'ask', 'What is the capital of France?', '--json'], env);
    const response = JSON.parse(stdout);
    assert.equal(response.cascade_trace.primary_domain, null);
    assert.match(response.answer, /No density-domain keywords matched/);
  });

  await t.test('legacy query entry point and interactive CLI use the same bridge', async () => {
    const legacy = await run([legacyQuery, 'Status of D1 atoms', '--json'], env);
    assert.match(JSON.parse(legacy.stdout).cascade_trace.primary_domain, /^D1/);
    const chat = await runChat(env, 'What is the Triad?\n/status\n/quit\n');
    assert.equal(chat.code, 0, chat.stderr);
    assert.match(chat.stdout, /three nodes/i);
    assert.match(chat.stdout, /Triad query bridge: running/);
    assert.equal(chat.stderr, '');
    // The older single-file client can still talk to the package Apex when
    // explicitly pointed at the same bridge root.
    const mirror = await run([mirroredLegacyQuery, 'Status of D3 body'], env);
    assert.match(mirror.stdout, /D3 \(Vessel & Somatic 14 Zones\)/);
  });
});

test('offline, invalid and empty requests fail without a fabricated response', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-cli-offline-'));
  const env = testEnvironment(root);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  await assert.rejects(run([cli, 'status', '--timeout', '200'], env), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /No response from the Triad bridge/);
    assert.match(error.stderr, /npm run triad:start/);
    return true;
  });
  assert.deepEqual(fs.readdirSync(path.join(root, 'loop/cli-bridge/requests')), []);
  await assert.rejects(run([cli, 'ask'], env), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Provide a question/);
    return true;
  });
  await assert.rejects(run([cli, 'ask', 'x'.repeat(MAX_QUESTION_LENGTH + 1)], env), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Question must be/);
    return true;
  });
  const oversized = await runWithInput([cli, 'relay', '--stdin'], env, 'x'.repeat(MAX_QUESTION_LENGTH + 1));
  assert.equal(oversized.code, 1);
  assert.match(oversized.stderr, /Question must be/);
  const ambiguous = await runWithInput([cli, 'relay', 'argument', '--stdin'], env, 'input');
  assert.equal(ambiguous.code, 1);
  assert.match(ambiguous.stderr, /either --stdin or question arguments/);
});

test('a version-1-only worker rejects relay instead of silently recording it', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-v1-only-'));
  const env = testEnvironment(root);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const text = 'V1_RELAY_MUST_NOT_BE_RECORDED';
  const client = runWithInput([cli, 'relay', '--stdin', '--json', '--timeout', '3000'], env, text);
  const requestDir = path.join(root, 'loop/cli-bridge/requests');
  const requestFile = await waitUntil(() => {
    if (!fs.existsSync(requestDir)) return null;
    const name = fs.readdirSync(requestDir).find(entry => entry.endsWith('.json'));
    return name ? path.join(requestDir, name) : null;
  });
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
  // Model the older Apex: it only accepts version 1, otherwise it rejects
  // before invoking a recording handler.
  const acceptedByOldWorker = request.version === 1;
  if (acceptedByOldWorker) fs.writeFileSync(path.join(root, 'recorded.txt'), request.question);
  fs.writeFileSync(path.join(root, 'loop/cli-bridge/responses', `${request.id}.json`), JSON.stringify({
    version: 1,
    id: request.id,
    ok: false,
    error: { code: 'INVALID_REQUEST', message: 'Request ID or protocol version is invalid.' },
  }));
  const result = await client;
  assert.equal(request.version, 2);
  assert.equal(request.record, false);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /protocol version is invalid/);
  assert.equal(fs.existsSync(path.join(root, 'recorded.txt')), false);
});

test('relay never sends remote history even when remote query logging is enabled', {
  skip: process.platform === 'win32' ? 'The isolated fake ssh executable uses a POSIX shell.' : false,
}, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-remote-log-'));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  const sshLog = path.join(root, 'fake-ssh.log');
  const sshKey = path.join(root, 'fake-key');
  fs.writeFileSync(sshKey, 'test-only');
  fs.writeFileSync(path.join(bin, 'ssh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FAKE_SSH_LOG"\ncase "$*" in *"cat "*) printf '{"up":true,"tick":1}\\n';; esac\n`, { mode: 0o755 });
  const env = {
    ...testEnvironment(root),
    SSH_KEY: sshKey,
    TRIAD_REMOTE_QUERY_LOG: '1',
    FAKE_SSH_LOG: sshLog,
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`,
  };
  const child = spawn(process.execPath, [apex], { env, stdio: 'ignore' });
  t.after(async () => {
    await stopChild(child);
    fs.rmSync(root, { recursive: true, force: true });
  });
  await waitForBridge(env, child);
  const relay = await runWithInput([cli, 'relay', '--stdin', '--json'], env, 'REMOTE_RELAY_MARKER');
  assert.equal(relay.code, 0, relay.stderr);
  assert.equal(JSON.parse(relay.stdout).cascade_trace.flow_32_down.data.up, true);
  await delay(200);
  const before = fs.existsSync(sshLog) ? fs.readFileSync(sshLog, 'utf8') : '';
  assert.doesNotMatch(before, /query_history\.jsonl/);

  const ordinary = await run([cli, 'ask', 'REMOTE_ORDINARY_MARKER', '--json'], env);
  assert.equal(JSON.parse(ordinary.stdout).cascade_trace.flow_32_down.data.up, true);
  const remoteCommand = await waitUntil(() => {
    if (!fs.existsSync(sshLog)) return null;
    return fs.readFileSync(sshLog, 'utf8').split('\n').find(line => line.includes('query_history.jsonl'));
  });
  const encoded = remoteCommand.match(/echo ([A-Za-z0-9+/=]+) \| base64 -d/);
  assert.ok(encoded);
  assert.equal(JSON.parse(Buffer.from(encoded[1], 'base64').toString('utf8')).question, 'REMOTE_ORDINARY_MARKER');
});

test('bootstrap and Apex use the same default root without BRIDGE_ROOT', {
  skip: fs.existsSync('D:/fidelity-llm/bridge') ? 'The machine has an existing Windows bridge root; do not change it during a test.' : false,
}, async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-default-home-'));
  const root = path.join(home, '.triad-bridge');
  const env = { ...testEnvironment(root), HOME: home, USERPROFILE: home };
  delete env.BRIDGE_ROOT;
  let child;
  t.after(async () => {
    if (child) await stopChild(child);
    fs.rmSync(home, { recursive: true, force: true });
  });
  await run([bootstrap], env);
  assert.ok(fs.existsSync(path.join(root, 'loop/density.json')));
  child = spawn(process.execPath, [apex], { env, stdio: 'ignore' });
  const status = await waitForBridge(env, child);
  assert.equal(status.bridge_root, root);
  assert.equal(status.pid, child.pid);
  const { stdout } = await run([cli, 'ask', 'Status of D2 wheels', '--json'], env);
  assert.match(JSON.parse(stdout).cascade_trace.primary_domain, /^D2/);
});

test('an unbootstrapped bridge does not invent telemetry', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-empty-'));
  const env = testEnvironment(root);
  const child = spawn(process.execPath, [apex], { env, stdio: 'ignore' });
  t.after(async () => {
    await stopChild(child);
    fs.rmSync(root, { recursive: true, force: true });
  });
  await waitForBridge(env, child);
  const { stdout } = await run([cli, 'ask', 'Status', '--json'], env);
  const response = JSON.parse(stdout);
  assert.equal(response.cascade_trace.flow_31_down.status, 'unavailable');
  assert.equal(response.cascade_trace.flow_31_down.data.density_rung, null);
  assert.equal(response.cascade_trace.flow_32_down.data.up, null);
  assert.match(response.answer, /No local density snapshot is available/);
});
