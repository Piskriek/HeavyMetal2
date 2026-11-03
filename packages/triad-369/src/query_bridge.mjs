// Local, file-backed request/response bridge for the Triad CLI and Apex process.
// Each request has its own ID and response, so concurrent clients cannot overwrite
// each other's messages. No network listener is required.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const MAX_QUESTION_LENGTH = 20000;
export const MIN_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 120000;
// JSON can encode a single control character as six ASCII bytes (\\uXXXX).
const MAX_REQUEST_BYTES = MAX_QUESTION_LENGTH * 6 + 4096;
const MAX_IN_FLIGHT = 8;
const STALE_FILE_MS = 5 * 60 * 1000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

function locations(bridgeRoot) {
  const base = path.join(bridgeRoot, 'loop', 'cli-bridge');
  return {
    requests: path.join(base, 'requests'),
    processing: path.join(base, 'processing'),
    responses: path.join(base, 'responses'),
  };
}

function ensureDirectories(dirs) {
  for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function removeIfPresent(file) {
  try {
    fs.unlinkSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function writeJsonAtomic(file, value) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { removeIfPresent(temporary); } catch {}
    throw error;
  }
}

function validateRequest(request, id) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new BridgeError('INVALID_REQUEST', 'Request must be a JSON object.');
  }
  if ((request.version !== 1 && request.version !== 2) || request.id !== id || !ID_PATTERN.test(id)) {
    throw new BridgeError('INVALID_REQUEST', 'Request ID or protocol version is invalid.');
  }
  if (!Number.isFinite(request.expires_at_ms) || request.expires_at_ms > Date.now() + MAX_TIMEOUT_MS + 5000) {
    throw new BridgeError('INVALID_REQUEST', 'Request expiry is invalid.');
  }
  if (request.expires_at_ms <= Date.now()) {
    throw new BridgeError('EXPIRED_REQUEST', 'Request expired before the bridge received it.');
  }
  if (request.type !== 'ping' && request.type !== 'query') {
    throw new BridgeError('INVALID_REQUEST', 'Request type must be ping or query.');
  }
  // Version 2 denotes a non-recording query. A version-1-only Apex rejects it
  // rather than silently ignoring the flag and recording the user's message.
  if ((request.version === 2 && (request.type !== 'query' || request.record !== false)) ||
      (request.version === 1 && request.record === false)) {
    throw new BridgeError('INVALID_REQUEST', 'Non-recording queries require relay protocol version 2.');
  }
  if (request.type === 'query') {
    if (typeof request.question !== 'string' || !request.question.trim() || request.question.length > MAX_QUESTION_LENGTH) {
      throw new BridgeError('INVALID_REQUEST', `Question must be 1–${MAX_QUESTION_LENGTH} characters.`);
    }
    if (typeof request.from !== 'string' || !request.from.trim() || request.from.length > 100) {
      throw new BridgeError('INVALID_REQUEST', 'Sender must be 1–100 characters.');
    }
    if (request.record !== undefined && typeof request.record !== 'boolean') {
      throw new BridgeError('INVALID_REQUEST', 'The record flag must be a boolean.');
    }
  }
}

/** Send one request to a running Apex process and wait for its matching response. */
export async function sendBridgeRequest({ bridgeRoot, type = 'query', question, from = 'local-cli', record = true, timeoutMs = 15000 }) {
  if (!bridgeRoot) throw new BridgeError('INVALID_ROOT', 'A bridge root is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new BridgeError('INVALID_TIMEOUT', `Timeout must be ${MIN_TIMEOUT_MS}–${MAX_TIMEOUT_MS} milliseconds.`);
  }
  const id = randomUUID();
  const deadline = Date.now() + timeoutMs;
  const version = type === 'query' && record === false ? 2 : 1;
  const request = { version, id, type, from, question, record, expires_at_ms: deadline };
  validateRequest(request, id);

  const dirs = locations(bridgeRoot);
  ensureDirectories(dirs);
  const requestFile = path.join(dirs.requests, `${id}.json`);
  const responseFile = path.join(dirs.responses, `${id}.json`);
  writeJsonAtomic(requestFile, request);

  try {
    while (true) {
      try {
        const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
        if (response.version !== 1 || response.id !== id || typeof response.ok !== 'boolean') {
          throw new BridgeError('INVALID_RESPONSE', 'The bridge returned an invalid response.');
        }
        if (!response.ok) {
          throw new BridgeError(response.error?.code || 'QUERY_FAILED', response.error?.message || 'The bridge could not process the request.');
        }
        return response.result;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new BridgeError('BRIDGE_TIMEOUT', `No response from the Triad bridge at ${bridgeRoot}. Start it with: npm run triad:start`);
      }
      await delay(Math.min(75, remaining));
    }
  } finally {
    // A claimed request belongs to the worker; it removes it when processing ends.
    removeIfPresent(requestFile);
    removeIfPresent(responseFile);
  }
}

function cleanStaleFiles(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = path.join(dir, entry.name);
    try {
      if (Date.now() - fs.statSync(file).mtimeMs > STALE_FILE_MS) fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

/** Start the local bridge in the Apex daemon. Returns a function to stop polling. */
export function startQueryBridge({ bridgeRoot, handleQuery, onError = () => {}, pollIntervalMs = 150 }) {
  if (!bridgeRoot || typeof handleQuery !== 'function') throw new Error('A bridge root and query handler are required.');
  const dirs = locations(bridgeRoot);
  ensureDirectories(dirs);
  const startedAt = new Date().toISOString();
  let active = 0;
  let stopped = false;
  let lastCleanup = 0;

  async function processClaimed(id, file) {
    let request;
    let result;
    let failure;
    try {
      if (fs.statSync(file).size > MAX_REQUEST_BYTES) throw new BridgeError('INVALID_REQUEST', 'Request is too large.');
      request = JSON.parse(fs.readFileSync(file, 'utf8'));
      validateRequest(request, id);
      if (request.type === 'ping') {
        result = {
          bridge: 'triad-apex',
          running: true,
          pid: process.pid,
          started_at: startedAt,
          bridge_root: bridgeRoot,
          query_mode: 'rule-based keyword routing; no language model connected',
        };
      } else {
        result = await handleQuery({ id, from: request.from, question: request.question, record: request.record !== false });
      }
    } catch (error) {
      failure = {
        code: error.code || 'QUERY_FAILED',
        message: error instanceof BridgeError ? error.message : 'The bridge could not process the request.',
      };
      if (!(error instanceof BridgeError)) onError(error);
    }
    // Do not publish an answer to a client whose deadline has already elapsed.
    if (Number.isFinite(request?.expires_at_ms) && request.expires_at_ms > Date.now()) {
      writeJsonAtomic(path.join(dirs.responses, `${id}.json`), {
        version: 1,
        id,
        ok: !failure,
        ...(failure ? { error: failure } : { result }),
      });
    }
  }

  function poll() {
    if (stopped) return;
    try {
      if (Date.now() - lastCleanup > 30000) {
        lastCleanup = Date.now();
        cleanStaleFiles(dirs.processing);
        cleanStaleFiles(dirs.responses);
      }
      const entries = fs.readdirSync(dirs.requests, { withFileTypes: true });
      for (const entry of entries) {
        if (active >= MAX_IN_FLIGHT) break;
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        const id = entry.name.slice(0, -5);
        if (!ID_PATTERN.test(id)) continue;
        const source = path.join(dirs.requests, entry.name);
        const claimed = path.join(dirs.processing, entry.name);
        try {
          fs.renameSync(source, claimed);
        } catch (error) {
          if (error.code === 'ENOENT') continue; // Another worker claimed it.
          throw error;
        }
        active++;
        void processClaimed(id, claimed)
          .catch(onError)
          .finally(() => {
            try { removeIfPresent(claimed); } catch (error) { onError(error); }
            active--;
          });
      }
    } catch (error) {
      onError(error);
    }
  }

  poll();
  const timer = setInterval(poll, pollIntervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
