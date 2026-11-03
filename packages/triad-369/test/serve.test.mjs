import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { sendBridgeRequest, startQueryBridge } from '../src/query_bridge.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serve = path.join(packageRoot, 'src', 'serve.mjs');
const TOKEN = 'test-key-ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789';

function environment(root, port) {
  return {
    ...process.env,
    BRIDGE_ROOT: root,
    TRIAD_SYNC_DIR: path.join(root, 'sync'),
    SSH_KEY: path.join(root, 'no-remote-key'),
    TRIAD_REMOTE_QUERY_LOG: '0',
    TRIAD_API_TOKEN: TOKEN,
    TRIAD_API_TOKEN_FILE: '',
    TRIAD_API_HOST: '127.0.0.1',
    TRIAD_API_PORT: String(port),
    TRIAD_API_CORS_ORIGINS: '',
  };
}

async function listeningServer() {
  const server = http.createServer((req, res) => res.end('occupied'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

async function freePort() {
  const server = await listeningServer();
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function startService(env) {
  const child = spawn(process.execPath, [serve], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });
  return { child, output: () => output };
}

async function waitForExit(child, timeoutMs = 10000) {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Service did not exit in time.')); }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve(code); });
  });
}

async function stopIfRunning(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForExit(child);
  child.kill('SIGTERM');
  await exited;
}

async function waitForStatus(base, processState) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (processState.child.exitCode !== null || processState.child.signalCode !== null) {
      throw new Error(`Service exited before becoming ready: ${processState.output()}`);
    }
    try {
      const result = await fetch(`${base}/v1/status`, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(500) });
      if (result.status === 200) return result.json();
    } catch {}
    await delay(50);
  }
  throw new Error(`Service did not become ready: ${processState.output()}`);
}

test('single-command service bootstraps, serves real queries and shuts down its Apex', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-serve-'));
  const port = await freePort();
  const processState = startService(environment(root, port));
  t.after(async () => {
    await stopIfRunning(processState.child);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  const status = await waitForStatus(base, processState);
  assert.equal(status.running, true);
  assert.ok(fs.existsSync(path.join(root, 'loop/density.json')));
  const response = await fetch(`${base}/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'hello World' }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).question, 'hello World');
  assert.doesNotMatch(processState.output(), new RegExp(TOKEN));
  await stopIfRunning(processState.child);
  assert.equal(processState.child.exitCode, 0);
  await assert.rejects(fetch(`${base}/healthz`));
  await assert.rejects(sendBridgeRequest({ bridgeRoot: root, type: 'ping', timeoutMs: 250 }), error => error.code === 'BRIDGE_TIMEOUT');
});

test('single-command service fails closed without a token', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-serve-no-token-'));
  const processState = startService({ ...environment(root, await freePort()), TRIAD_API_TOKEN: '' });
  t.after(async () => {
    await stopIfRunning(processState.child);
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal(await waitForExit(processState.child), 1);
  assert.match(processState.output(), /strong TRIAD_API_TOKEN/);
  assert.equal(fs.existsSync(path.join(root, 'loop/density.json')), false);
});

test('single-command service does not start a duplicate Apex for an active root', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-serve-existing-'));
  const stopBridge = startQueryBridge({ bridgeRoot: root, handleQuery: async () => ({}) });
  const processState = startService(environment(root, await freePort()));
  t.after(async () => {
    await stopIfRunning(processState.child);
    stopBridge();
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal(await waitForExit(processState.child), 1);
  assert.match(processState.output(), /Apex is already running/);
  assert.equal(fs.existsSync(path.join(root, 'loop/density.json')), false);
  assert.equal((await sendBridgeRequest({ bridgeRoot: root, type: 'ping', timeoutMs: 1000 })).running, true);
});

test('API port startup failure terminates the Apex it started', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triad-serve-port-'));
  const occupied = await listeningServer();
  const processState = startService(environment(root, occupied.address().port));
  t.after(async () => {
    await stopIfRunning(processState.child);
    await new Promise(resolve => occupied.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal(await waitForExit(processState.child), 1);
  assert.match(processState.output(), /Triad API failed to start/);
  await assert.rejects(sendBridgeRequest({ bridgeRoot: root, type: 'ping', timeoutMs: 250 }), error => error.code === 'BRIDGE_TIMEOUT');
});
