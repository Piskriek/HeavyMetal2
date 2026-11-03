import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { API_MAX_TIMEOUT_MS, MAX_BODY_BYTES, configFromEnv, createTriadApi } from '../src/api.mjs';
import { MAX_QUESTION_LENGTH, sendBridgeRequest } from '../src/query_bridge.mjs';

const exec = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = name => path.join(packageRoot, 'src', name);
const TOKEN = 'test-key-ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789';
const AUTH = { Authorization: `Bearer ${TOKEN}` };

function testEnvironment(root) {
  return {
    ...process.env,
    BRIDGE_ROOT: root,
    TRIAD_SYNC_DIR: path.join(root, 'sync'),
    SSH_KEY: path.join(root, 'no-remote-key'),
    TRIAD_REMOTE_QUERY_LOG: '0',
  };
}

async function waitForBridge(root, child) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Apex exited before the bridge became ready.');
    try { return await sendBridgeRequest({ bridgeRoot: root, type: 'ping', timeoutMs: 300 }); }
    catch { await delay(50); }
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

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

function postJson(base, value, headers = AUTH) {
  return jsonFetch(`${base}/v1/query`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

function openStreamingPost(base, headers = AUTH) {
  let request;
  const result = new Promise((resolve, reject) => {
    request = http.request(`${base}/v1/query`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
    }, response => {
      let body = '';
      response.setEncoding('utf8').on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ response, body: JSON.parse(body) }));
    });
    request.on('error', reject);
  });
  return { request, result };
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

test('API configuration requires a strong token and explicit browser origins', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-api-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => configFromEnv({}), /strong TRIAD_API_TOKEN/);
  assert.throws(() => configFromEnv({ TRIAD_API_TOKEN: 'short' }), /strong TRIAD_API_TOKEN/);
  assert.throws(() => configFromEnv({ TRIAD_API_TOKEN: TOKEN, TRIAD_API_TOKEN_FILE: 'other' }), /either/);
  assert.throws(() => configFromEnv({ TRIAD_API_TOKEN: TOKEN, TRIAD_API_CORS_ORIGINS: '*' }), /origins/);
  assert.throws(() => configFromEnv({ TRIAD_API_TOKEN: TOKEN, TRIAD_API_CORS_ORIGINS: 'https://example.com/path' }), /origins/);
  assert.throws(() => configFromEnv({ TRIAD_API_TOKEN: TOKEN, TRIAD_API_PORT: '0' }), /TRIAD_API_PORT/);
  const tokenFile = path.join(root, 'token');
  fs.writeFileSync(tokenFile, `${TOKEN}\n`, { mode: 0o600 });
  const config = configFromEnv({ TRIAD_API_TOKEN_FILE: tokenFile, TRIAD_API_CORS_ORIGINS: 'https://example.com' });
  assert.equal(config.token, TOKEN);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 8787);
  assert.deepEqual(config.allowedOrigins, ['https://example.com']);
  await assert.rejects(exec(process.execPath, [source('api.mjs')], {
    env: { ...process.env, TRIAD_API_TOKEN: '', TRIAD_API_TOKEN_FILE: '' },
    timeout: 5000,
  }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /configuration error.*strong TRIAD_API_TOKEN/i);
    return true;
  });
});

test('authenticated API relays real requests to Apex', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-api-live-'));
  const env = testEnvironment(root);
  let child;
  let server;
  t.after(async () => {
    if (server) await closeServer(server);
    if (child) await stopChild(child);
    fs.rmSync(root, { recursive: true, force: true });
  });
  await exec(process.execPath, [source('bootstrap.mjs')], { env, timeout: 10000 });
  child = spawn(process.execPath, [source('triad_369_process.mjs')], { env, stdio: 'ignore' });
  await waitForBridge(root, child);
  server = createTriadApi({ token: TOKEN, bridgeRoot: root, allowedOrigins: ['https://client.example'] });
  const base = await listen(server);

  await t.test('public discovery is honest and protected endpoints require the token', async () => {
    const health = await jsonFetch(`${base}/healthz`);
    assert.equal(health.response.status, 200);
    assert.deepEqual(health.body, { ok: true, service: 'triad-api' });
    const discovery = await jsonFetch(`${base}/`);
    assert.match(discovery.body.query_mode, /no conversational model/);
    const spec = await jsonFetch(`${base}/openapi.json`);
    assert.equal(spec.body.openapi, '3.0.3');
    assert.ok(spec.body.paths['/v1/query'].post.security);
    assert.equal(spec.body.components.schemas.QueryRequest.properties.record.default, false);
    for (const headers of [{}, { Authorization: 'Bearer short' }, { Authorization: `Bearer ${'x'.repeat(48)}` }, { Authorization: `Basic ${TOKEN}` }]) {
      const result = await jsonFetch(`${base}/v1/status`, { headers });
      assert.equal(result.response.status, 401);
      assert.equal(result.response.headers.get('www-authenticate'), 'Bearer');
      assert.equal(result.body.error.code, 'UNAUTHORIZED');
    }
    const unauthorized = await postJson(base, { question: 'NO_AUTH_MARKER' }, {});
    assert.equal(unauthorized.response.status, 401);
    const unknown = await jsonFetch(`${base}/missing`);
    assert.equal(unknown.response.status, 404);
  });

  await t.test('authenticated status uses a live bridge ping without exposing local paths', async () => {
    const result = await jsonFetch(`${base}/v1/status`, { headers: AUTH });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.running, true);
    assert.match(result.body.query_mode, /keyword routing/);
    assert.equal(result.body.bridge_root, undefined);
    assert.equal(result.body.pid, undefined);
    assert.equal(result.response.headers.get('cache-control'), 'no-store');
  });

  await t.test('query preserves exact text and defaults to no persistent history', async () => {
    const history = path.join(root, 'loop/thoughts_369.jsonl');
    const log = path.join(root, 'loop/triad_369.log');
    const output = path.join(root, 'loop/triad_query_out.json');
    const previousOutput = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null;
    const question = '  API_PRIVATE_MARKER hello World 🧭\r\nSecond line.\n';
    const result = await postJson(base, { question });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.question, question);
    assert.equal(result.body.teacher_handshake.step_1_ask.request, question);
    assert.equal(result.body.from, 'api-client');
    assert.equal(result.body.query_mode, 'keyword-routing');
    assert.match(result.body.cascade_trace.primary_domain, /^D5/);
    assert.equal(result.body.loop_metrics.loop_closed, false);
    assert.equal(fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null, previousOutput);
    assert.doesNotMatch(fs.readFileSync(history, 'utf8'), /API_PRIVATE_MARKER/);
    assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /API_PRIVATE_MARKER|NO_AUTH_MARKER/);
    assert.doesNotMatch(fs.readFileSync(log, 'utf8'), new RegExp(TOKEN));
    await waitUntil(() => ['requests', 'processing', 'responses'].every(dir =>
      fs.readdirSync(path.join(root, 'loop/cli-bridge', dir)).length === 0));
  });

  await t.test('concurrent requests are correlated and optional recording is explicit', async () => {
    const questions = Array.from({ length: 6 }, (_, index) => `API parallel request ${index}`);
    const replies = await Promise.all(questions.map(question => postJson(base, { question })));
    assert.equal(new Set(replies.map(reply => reply.body.id)).size, questions.length);
    for (let index = 0; index < questions.length; index++) {
      assert.equal(replies[index].response.status, 200);
      assert.equal(replies[index].body.question, questions[index]);
    }
    const recorded = await postJson(base, { question: 'API_RECORD_OPT_IN', record: true });
    assert.equal(recorded.response.status, 200);
    assert.match(fs.readFileSync(path.join(root, 'loop/thoughts_369.jsonl'), 'utf8'), /API_RECORD_OPT_IN/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'loop/triad_query_out.json'), 'utf8')).question, 'API_RECORD_OPT_IN');
  });

  await t.test('invalid requests fail without reaching Apex', async () => {
    const cases = [
      { body: null, status: 400 },
      { body: [], status: 400 },
      { body: {}, status: 400 },
      { body: { question: '  \n' }, status: 400 },
      { body: { question: 'x'.repeat(MAX_QUESTION_LENGTH + 1) }, status: 400 },
      { body: { question: 'hi', record: 'false' }, status: 400 },
      { body: { question: 'hi', extra: true }, status: 400 },
      { body: { question: 'hi', timeout_ms: 99 }, status: 400 },
      { body: { question: 'hi', timeout_ms: API_MAX_TIMEOUT_MS + 1 }, status: 400 },
      { body: { question: 'hi', timeout_ms: 150.5 }, status: 400 },
    ];
    for (const entry of cases) {
      const result = await postJson(base, entry.body);
      assert.equal(result.response.status, entry.status, JSON.stringify(entry.body));
      assert.equal(result.body.error.code, 'INVALID_REQUEST');
    }
    const malformed = await jsonFetch(`${base}/v1/query`, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.body.error.code, 'INVALID_JSON');
    const invalidUtf8 = await jsonFetch(`${base}/v1/query`, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: new Uint8Array([255]) });
    assert.equal(invalidUtf8.response.status, 400);
    const wrongType = await jsonFetch(`${base}/v1/query`, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(wrongType.response.status, 415);
    const compressed = await jsonFetch(`${base}/v1/query`, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: '{}' });
    assert.equal(compressed.response.status, 415);
    const tooLarge = await jsonFetch(`${base}/v1/query`, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: 'x'.repeat(MAX_BODY_BYTES + 1) });
    assert.equal(tooLarge.response.status, 413);
    const wrongMethod = await jsonFetch(`${base}/v1/query`, { headers: AUTH });
    assert.equal(wrongMethod.response.status, 405);
    assert.equal(wrongMethod.response.headers.get('allow'), 'POST');
  });

  await t.test('browser access requires an explicitly allowed origin', async () => {
    const preflight = await fetch(`${base}/v1/query`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://client.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://client.example');
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/i);
    const denied = await fetch(`${base}/v1/query`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://other.example', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const browser = await postJson(base, { question: 'browser test' }, { ...AUTH, Origin: 'https://client.example' });
    assert.equal(browser.response.status, 200);
    assert.equal(browser.response.headers.get('access-control-allow-origin'), 'https://client.example');
  });

  await t.test('maximum-sized escaped input and streamed oversized bodies are bounded', async () => {
    const question = `x${'\0'.repeat(MAX_QUESTION_LENGTH - 1)}`;
    const valid = await postJson(base, { question });
    assert.equal(valid.response.status, 200);
    assert.equal(valid.body.question, question);
    const stream = openStreamingPost(base);
    stream.request.write('x'.repeat(MAX_BODY_BYTES + 1));
    stream.request.end();
    const oversized = await stream.result;
    assert.equal(oversized.response.statusCode, 413);
    assert.equal(oversized.body.error.code, 'BODY_TOO_LARGE');
  });

  await t.test('concurrent and slow-body limits release their slots', async () => {
    const limited = createTriadApi({ token: TOKEN, bridgeRoot: root, maxConcurrent: 1, bodyTimeoutMs: 500 });
    t.after(() => closeServer(limited));
    const limitedBase = await listen(limited);
    const accepted = new Promise(resolve => limited.once('request', resolve));
    const stream = openStreamingPost(limitedBase);
    stream.request.flushHeaders();
    stream.request.write('{"question":"held');
    await accepted;
    const busy = await jsonFetch(`${limitedBase}/v1/status`, { headers: AUTH });
    assert.equal(busy.response.status, 429);
    assert.equal(busy.body.error.code, 'BRIDGE_BUSY');
    const timedOut = await stream.result;
    assert.equal(timedOut.response.statusCode, 408);
    assert.equal(timedOut.body.error.code, 'BODY_TIMEOUT');
    const recovered = await jsonFetch(`${limitedBase}/v1/status`, { headers: AUTH });
    assert.equal(recovered.response.status, 200);
  });
});

test('rate limiting includes failed authentication attempts', async t => {
  const server = createTriadApi({ token: TOKEN, rateLimit: 2, rateWindowMs: 60000 });
  t.after(() => closeServer(server));
  const base = await listen(server);
  assert.equal((await fetch(`${base}/v1/status`)).status, 401);
  assert.equal((await fetch(`${base}/v1/status`)).status, 401);
  const limited = await jsonFetch(`${base}/v1/status`, { headers: AUTH });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(limited.response.headers.get('retry-after')) >= 1);
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test('API reports an offline Apex instead of fabricating an answer', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-api-offline-'));
  const server = createTriadApi({ token: TOKEN, bridgeRoot: root });
  t.after(async () => {
    await closeServer(server);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = await listen(server);
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  const query = await postJson(base, { question: 'offline', timeout_ms: 150 });
  assert.equal(query.response.status, 503);
  assert.equal(query.body.error.code, 'BRIDGE_UNAVAILABLE');
  assert.equal(query.body.answer, undefined);
  const status = await jsonFetch(`${base}/v1/status`, { headers: AUTH });
  assert.equal(status.response.status, 503);
  assert.equal(status.body.error.code, 'BRIDGE_UNAVAILABLE');
});

test('an incompatible version-1 Apex cannot silently record the default API relay', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-api-v1-'));
  const server = createTriadApi({ token: TOKEN, bridgeRoot: root });
  t.after(async () => {
    await closeServer(server);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = await listen(server);
  const query = postJson(base, { question: 'DO_NOT_RECORD_V1', timeout_ms: 3000 });
  const requestDir = path.join(root, 'loop/cli-bridge/requests');
  const requestFile = await waitUntil(() => {
    if (!fs.existsSync(requestDir)) return null;
    const entry = fs.readdirSync(requestDir).find(name => name.endsWith('.json'));
    return entry ? path.join(requestDir, entry) : null;
  });
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
  if (request.version === 1) fs.writeFileSync(path.join(root, 'recorded.txt'), request.question);
  fs.writeFileSync(path.join(root, 'loop/cli-bridge/responses', `${request.id}.json`), JSON.stringify({
    version: 1, id: request.id, ok: false,
    error: { code: 'INVALID_REQUEST', message: 'Request ID or protocol version is invalid.' },
  }));
  const result = await query;
  assert.equal(request.version, 2);
  assert.equal(request.record, false);
  assert.equal(result.response.status, 503);
  assert.equal(result.body.error.code, 'BRIDGE_INCOMPATIBLE');
  assert.equal(fs.existsSync(path.join(root, 'recorded.txt')), false);
});
