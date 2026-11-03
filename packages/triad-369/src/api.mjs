#!/usr/bin/env node
// Authenticated HTTP facade for the local Triad Apex query bridge.
// TLS must be terminated by a trusted reverse proxy when used remotely.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getBridgeRoot } from './bridge_paths.mjs';
import { BridgeError, MAX_QUESTION_LENGTH, MIN_TIMEOUT_MS, sendBridgeRequest } from './query_bridge.mjs';

export const MAX_BODY_BYTES = MAX_QUESTION_LENGTH * 6 + 4096;
export const API_MAX_TIMEOUT_MS = 30000;
const DEFAULT_TIMEOUT_MS = 15000;
const BODY_TIMEOUT_MS = 10000;
const DEFAULT_RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60000;
const MAX_CONCURRENT = 8;
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,256}$/;
const OPENAPI = JSON.parse(fs.readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));

class ApiError extends Error {
  constructor(status, code, message, { closeConnection = false, headers = {} } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.closeConnection = closeConnection;
    this.headers = headers;
  }
}

function validateToken(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new Error('Set a strong TRIAD_API_TOKEN or TRIAD_API_TOKEN_FILE: 32–256 URL-safe characters.');
  }
  return token;
}

function normalizeOrigins(origins) {
  const result = new Set();
  for (const value of origins) {
    let url;
    try { url = new URL(value); } catch { throw new Error('CORS origins must be exact HTTP(S) origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) {
      throw new Error('CORS origins must be exact HTTP(S) origins without paths or wildcards.');
    }
    result.add(value);
  }
  return result;
}

export function configFromEnv(env = process.env) {
  if (env.TRIAD_API_TOKEN && env.TRIAD_API_TOKEN_FILE) {
    throw new Error('Set either TRIAD_API_TOKEN or TRIAD_API_TOKEN_FILE, not both.');
  }
  let token = env.TRIAD_API_TOKEN;
  if (env.TRIAD_API_TOKEN_FILE) {
    try { token = fs.readFileSync(env.TRIAD_API_TOKEN_FILE, 'utf8').trim(); }
    catch { throw new Error('Unable to read TRIAD_API_TOKEN_FILE.'); }
  }
  validateToken(token);
  const host = env.TRIAD_API_HOST || '127.0.0.1';
  const rawPort = env.TRIAD_API_PORT || env.PORT || '8787';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error('TRIAD_API_PORT must be an integer from 1 to 65535.');
  }
  const originList = (env.TRIAD_API_CORS_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  return { token, host, port: Number(rawPort), allowedOrigins: [...normalizeOrigins(originList)] };
}

function jsonResponse(res, status, value, extraHeaders = {}) {
  if (res.destroyed || res.writableEnded) return;
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function readJsonBody(req, bodyTimeoutMs) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chunks = [];
      if (error) { req.resume(); reject(error); }
      else resolve(result);
    };
    const timer = setTimeout(() => finish(new ApiError(408, 'BODY_TIMEOUT', 'Request body took too long.', { closeConnection: true })), bodyTimeoutMs);
    timer.unref();
    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        finish(new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.', { closeConnection: true }));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (settled) return;
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        finish(null, JSON.parse(text));
      } catch {
        finish(new ApiError(400, 'INVALID_JSON', 'Request body must be valid UTF-8 JSON.'));
      }
    });
    req.on('aborted', () => finish(new ApiError(400, 'REQUEST_ABORTED', 'Request was interrupted.', { closeConnection: true })));
    req.on('error', () => finish(new ApiError(400, 'REQUEST_ABORTED', 'Request was interrupted.', { closeConnection: true })));
  });
}

function parseQuery(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['question', 'record', 'timeout_ms'].includes(key))) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Expected an object with question and optional record and timeout_ms fields.');
  }
  if (typeof body.question !== 'string' || !body.question.trim() || body.question.length > MAX_QUESTION_LENGTH) {
    throw new ApiError(400, 'INVALID_REQUEST', `Question must contain non-whitespace and be at most ${MAX_QUESTION_LENGTH} UTF-16 code units.`);
  }
  if (body.record !== undefined && typeof body.record !== 'boolean') {
    throw new ApiError(400, 'INVALID_REQUEST', 'record must be a boolean.');
  }
  const timeoutMs = body.timeout_ms === undefined ? DEFAULT_TIMEOUT_MS : body.timeout_ms;
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > API_MAX_TIMEOUT_MS) {
    throw new ApiError(400, 'INVALID_REQUEST', `timeout_ms must be an integer from ${MIN_TIMEOUT_MS} to ${API_MAX_TIMEOUT_MS}.`);
  }
  return { question: body.question, record: body.record === true, timeoutMs };
}

function authorized(header, expectedHash) {
  if (typeof header !== 'string') return false;
  const match = /^Bearer ([A-Za-z0-9._~-]{32,256})$/i.exec(header);
  if (!match) return false;
  const suppliedHash = createHash('sha256').update(match[1]).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}

/** Create an HTTP server; the caller chooses its bind address and starts it. */
export function createTriadApi({
  token,
  bridgeRoot = getBridgeRoot(),
  allowedOrigins = [],
  rateLimit = DEFAULT_RATE_LIMIT,
  rateWindowMs = RATE_WINDOW_MS,
  maxConcurrent = MAX_CONCURRENT,
  bodyTimeoutMs = BODY_TIMEOUT_MS,
} = {}) {
  const expectedHash = createHash('sha256').update(validateToken(token)).digest();
  const origins = normalizeOrigins(allowedOrigins);
  if (![rateLimit, rateWindowMs, maxConcurrent, bodyTimeoutMs].every(value => Number.isInteger(value) && value > 0)) {
    throw new Error('API limits must be positive integers.');
  }
  let requestsInWindow = 0;
  let resetAt = Date.now() + rateWindowMs;
  let activeBridgeRequests = 0;

  function checkRate() {
    const now = Date.now();
    if (now >= resetAt) { requestsInWindow = 0; resetAt = now + rateWindowMs; }
    if (requestsInWindow >= rateLimit) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many API requests.', {
        closeConnection: true,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((resetAt - now) / 1000))) },
      });
    }
    requestsInWindow++;
  }

  async function handle(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    try {
      let pathname;
      try { pathname = new URL(req.url, 'http://localhost').pathname; }
      catch { throw new ApiError(400, 'INVALID_URL', 'The request URL is invalid.', { closeConnection: true }); }
      const protectedPath = pathname === '/v1/status' || pathname === '/v1/query';
      const methodForPath = pathname === '/v1/status' ? 'GET' : pathname === '/v1/query' ? 'POST' : null;
      if (req.method !== 'POST' && (Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'])) {
        throw new ApiError(400, 'UNEXPECTED_BODY', 'This method does not accept a request body.', { closeConnection: true });
      }
      if (req.method === 'OPTIONS') {
        if (!origin || !origins.has(origin) || !methodForPath || req.headers['access-control-request-method'] !== methodForPath) {
          throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'CORS preflight is not allowed.');
        }
        res.writeHead(204, {
          'Access-Control-Allow-Methods': methodForPath,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
        });
        res.end();
        return;
      }
      if (pathname === '/' || pathname === '/healthz' || pathname === '/openapi.json') {
        if (req.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.', { headers: { Allow: 'GET' } });
        if (pathname === '/healthz') return jsonResponse(res, 200, { ok: true, service: 'triad-api' });
        if (pathname === '/openapi.json') return jsonResponse(res, 200, OPENAPI);
        return jsonResponse(res, 200, {
          service: 'Fidelity Triad API',
          version: '1',
          authentication: 'Bearer token required for /v1 endpoints',
          endpoints: { health: 'GET /healthz', status: 'GET /v1/status', query: 'POST /v1/query', openapi: 'GET /openapi.json' },
          query_mode: 'keyword routing; no conversational model connected',
        });
      }
      if (!protectedPath) throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.');
      checkRate();
      if (!authorized(req.headers.authorization, expectedHash)) {
        throw new ApiError(401, 'UNAUTHORIZED', 'A valid bearer token is required.', {
          closeConnection: true,
          headers: { 'WWW-Authenticate': 'Bearer' },
        });
      }
      if (req.method !== methodForPath) {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Use ${methodForPath} for this endpoint.`, { headers: { Allow: methodForPath } });
      }
      if (activeBridgeRequests >= maxConcurrent) {
        throw new ApiError(429, 'BRIDGE_BUSY', 'Too many concurrent bridge requests.', {
          closeConnection: true,
          headers: { 'Retry-After': '1' },
        });
      }
      activeBridgeRequests++;
      try {
        if (pathname === '/v1/status') {
          const status = await sendBridgeRequest({ bridgeRoot, type: 'ping', timeoutMs: 2000 });
          return jsonResponse(res, 200, {
            bridge: status.bridge,
            running: status.running,
            started_at: status.started_at,
            query_mode: status.query_mode,
          });
        }
        const mediaType = (req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        const encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();
        if (mediaType !== 'application/json' || encoding !== 'identity') {
          throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use uncompressed application/json.', { closeConnection: true });
        }
        const lengthHeader = req.headers['content-length'];
        if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
          throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.', { closeConnection: true });
        }
        const query = parseQuery(await readJsonBody(req, bodyTimeoutMs));
        const result = await sendBridgeRequest({ bridgeRoot, from: 'api-client', ...query });
        return jsonResponse(res, 200, result);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof BridgeError && error.code === 'INVALID_REQUEST') {
          throw new ApiError(503, 'BRIDGE_INCOMPATIBLE', 'The Apex does not support this request; update or restart it.');
        }
        if (error instanceof BridgeError && ['BRIDGE_TIMEOUT', 'EXPIRED_REQUEST'].includes(error.code)) {
          throw new ApiError(503, 'BRIDGE_UNAVAILABLE', 'The Apex bridge did not respond in time.');
        }
        throw new ApiError(502, 'BRIDGE_ERROR', 'The Apex bridge could not process the request.');
      } finally {
        activeBridgeRequests--;
      }
    } catch (error) {
      const problem = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'The API could not process the request.');
      if (problem.closeConnection || !req.complete) {
        res.setHeader('Connection', 'close');
        req.resume();
      }
      jsonResponse(res, problem.status, { error: { code: problem.code, message: problem.message } }, problem.headers);
    }
  }

  const server = http.createServer({ maxHeaderSize: 8192, connectionsCheckingInterval: 1000 }, (req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent && !res.destroyed) {
        jsonResponse(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'The API could not process the request.' } });
      } else {
        res.destroy();
      }
    });
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 20000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 64;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { token, host, port, allowedOrigins } = configFromEnv();
    const server = createTriadApi({ token, allowedOrigins });
    server.once('error', error => { console.error(`Triad API failed to start: ${error.message}`); process.exitCode = 1; });
    server.listen(port, host, () => {
      console.log(`Triad API listening on http://${host}:${port} (Apex must be running).`);
      if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
        console.warn('HTTP is unencrypted: expose this listener only behind a trusted HTTPS proxy.');
      }
    });
  } catch (error) {
    console.error(`Triad API configuration error: ${error.message}`);
    process.exitCode = 1;
  }
}
