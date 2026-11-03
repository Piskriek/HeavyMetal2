#!/usr/bin/env node
// One-process entry point for hosts that can launch only one command. It owns
// one Apex child and an HTTP API, and shuts both down together.
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { configFromEnv, createTriadApi } from './api.mjs';
import { getBridgeRoot } from './bridge_paths.mjs';
import { BridgeError, sendBridgeRequest } from './query_bridge.mjs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  let apex;
  let server;
  let shuttingDown = false;

  function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    process.exitCode = code;
    if (server?.listening) server.close();
    if (apex && apex.exitCode === null && apex.signalCode === null) apex.kill('SIGTERM');
    const timer = setTimeout(() => {
      server?.closeAllConnections?.();
      if (apex && apex.exitCode === null && apex.signalCode === null) apex.kill('SIGKILL');
    }, 3000);
    timer.unref();
  }
  process.once('SIGTERM', () => shutdown(0));
  process.once('SIGINT', () => shutdown(0));

  try {
    const { token, host, port, allowedOrigins } = configFromEnv();
    const bridgeRoot = getBridgeRoot();
    // Avoid accidentally starting another Apex against an already active root.
    try {
      await sendBridgeRequest({ bridgeRoot, type: 'ping', timeoutMs: 300 });
      throw new Error('An Apex is already running for this bridge root. Use npm run triad:api instead.');
    } catch (error) {
      if (!(error instanceof BridgeError && error.code === 'BRIDGE_TIMEOUT')) throw error;
    }
    if (shuttingDown) return;
    const bootstrap = spawnSync(process.execPath, [path.join(sourceDir, 'bootstrap.mjs')], { stdio: 'inherit', env: process.env });
    if (bootstrap.error || bootstrap.status !== 0) throw new Error('Triad bootstrap failed.');

    apex = spawn(process.execPath, [path.join(sourceDir, 'triad_369_process.mjs')], { stdio: 'inherit', env: process.env });
    apex.once('error', () => { console.error('Triad Apex failed to start.'); shutdown(1); });
    apex.once('exit', () => {
      if (!shuttingDown) { console.error('Triad Apex exited unexpectedly.'); shutdown(1); }
    });
    const deadline = Date.now() + 6000;
    let ready = false;
    while (!shuttingDown && Date.now() < deadline) {
      try {
        await sendBridgeRequest({ bridgeRoot, type: 'ping', timeoutMs: 300 });
        ready = true;
        break;
      } catch (error) {
        if (!(error instanceof BridgeError && error.code === 'BRIDGE_TIMEOUT')) throw error;
        await delay(50);
      }
    }
    if (shuttingDown) return;
    if (!ready) throw new Error('The Triad Apex did not become ready.');

    server = createTriadApi({ token, bridgeRoot, allowedOrigins });
    server.once('error', error => { console.error(`Triad API failed to start: ${error.message}`); shutdown(1); });
    server.listen(port, host, () => {
      console.log(`Triad API and Apex are running on http://${host}:${port}.`);
      if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
        console.warn('HTTP is unencrypted: expose this listener only behind a trusted HTTPS proxy.');
      }
    });
  } catch (error) {
    if (!shuttingDown) console.error(`Triad service failed: ${error.message}`);
    shutdown(1);
  }
}

await main();
