#!/usr/bin/env node
/**
 * The Studio's agent bridge (plan 40 §4): an MCP server over stdio that forwards tool calls to the open Studio page.
 *
 *   node scripts/studio-agent-bridge.mjs --key <pairing key> [--url http://localhost:5173] [--verbose]
 *
 * The page shows its pairing key in the Studio; the agent's host runs this script and reads `studio-skill.md`
 * (`apps/web/public/studio-skill.md`). Every `tools/call` is posted to the dev server's relay (`/__studio/agent/call`), which hands it to
 * the page's long poll and settles it with whatever the page answered — including a refusal, which is returned as the tool result rather
 * than an error, because a refusal ("the material already has 6 layers") is information the agent has to act on.
 *
 * JSON-RPC 2.0, one message per line on stdin, one per line on stdout. Nothing is written to stdout except protocol messages (`--verbose`
 * logs to stderr). No dependencies: `fetch` is Node's own.
 */
import { createInterface } from 'node:readline';

const TOOLS = [
  {
    name: 'studio.doc.read',
    description: 'Reads the Studio document (or one node\'s subtree) with each node\'s type and its slider schema.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'a node id; omit for the whole document' } }, additionalProperties: false },
  },
  {
    name: 'studio.commands.list',
    description: 'Lists every command an agent can call, with its parameter schema.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio.doc.propose',
    description: 'Stages scenedoc operations and/or material commands as reviewable rows. Nothing is applied until a person accepts a row.',
    inputSchema: {
      type: 'object',
      properties: {
        calls: {
          type: 'array',
          description: 'one row each: { label, ops } and/or { label, material: { name, command } }',
          items: { type: 'object' },
        },
      },
      required: ['calls'],
      additionalProperties: false,
    },
  },
  {
    name: 'studio.changes.list',
    description: 'Lists the staged and decided change rows.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio.changes.accept',
    description: 'Runs one staged row on the undo history (the person\'s own undo stack).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'studio.changes.reject',
    description: 'Drops one staged row, with an optional reason.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'studio.history.undo',
    description: 'Undoes one step of the document history.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio.history.redo',
    description: 'Redoes one step of the document history.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio.kit.validate',
    description: 'kitspec validate plus the review checks: unresolved mat:/vault: ids, a part below the floor or floating, a missing machine socket.',
    inputSchema: {
      type: 'object',
      properties: { kit: { type: 'object' }, preset: { type: 'string' }, options: { type: 'object' } },
      required: ['kit', 'preset'],
      additionalProperties: false,
    },
  },
  {
    name: 'studio.kit.audit',
    description:
      'The anatomy standard for a kit: colliding part pairs at rest, exploded and through 8 motion phases, loose ends, pipes that end in mid-air, bend radii at moving joints, and 24-ray orbit clearance for every control.',
    inputSchema: {
      type: 'object',
      properties: {
        kit: { type: 'object' },
        preset: { type: 'string', description: 'the assembly that is the whole machine' },
        options: { type: 'object', description: 'collisionM, socketToleranceM, explode, phases, stage, ground, conduits, targets, minClearRays' },
      },
      required: ['kit'],
      additionalProperties: false,
    },
  },
  {
    name: 'studio.material.coverage',
    description: 'Percent of a 2.8 m machine each layer paints, in six zones, plus edge metal and plain readings. Measure before you ask for a review.',
    inputSchema: {
      type: 'object',
      properties: {
        preset: { type: 'string', description: 'a mat: shelf id' },
        material: { type: 'object', description: 'a MaterialSpec (wins over preset)' },
        grid: { type: 'number', description: 'sample grid per zone, 4..64 (default 24)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'studio.capture',
    description: 'An image of the view or a four-side turntable, at a detail rank, optionally one layer\'s mask.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['view', 'turntable4'] },
        includeStaged: { type: 'boolean' },
        rank: { type: 'number', enum: [0, 1, 2] },
        maskView: { type: 'number', description: 'layer index, or -1 for none' },
      },
      additionalProperties: false,
    },
  },
];

function parseArgs(argv) {
  const out = { url: 'http://localhost:5173', key: '', verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--key') out.key = argv[++i] ?? '';
    else if (a === '--url') out.url = (argv[++i] ?? out.url).replace(/\/$/, '');
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

const options = parseArgs(process.argv.slice(2));
const log = (...args) => {
  if (options.verbose) console.error('[studio-agent]', ...args);
};

const reply = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
const fail = (id, code, message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);

if (options.help) {
  console.error('usage: node scripts/studio-agent-bridge.mjs --key <pairing key> [--url http://localhost:5173] [--verbose]');
  process.exit(0);
}
if (!options.key) {
  console.error('studio-agent-bridge: --key <pairing key> is required (the Studio shows it; a new key cancels the old)');
  process.exit(2);
}

/** Posts one tool call to the relay and returns the page's answer. */
async function call(tool, args) {
  const res = await fetch(`${options.url}/__studio/agent/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: options.key, tool, args: args ?? {} }),
  });
  const body = await res.json().catch(() => ({ ok: false, why: `HTTP ${res.status}` }));
  if (!res.ok && body.why === undefined) return { ok: false, why: `HTTP ${res.status}` };
  return body;
}

const handlers = {
  async initialize(id, params) {
    log('initialize', params?.clientInfo?.name ?? 'an agent');
    reply(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'fidelity-studio', version: '1.0.0' },
      instructions:
        'This is the FIDELITY Studio. Read apps/web/public/studio-skill.md first: it carries the four floats, the stage ladder, the closed ' +
        'loop (propose -> validate -> measure -> look) and three worked examples. Nothing you propose is applied until the person accepts ' +
        'a row, so propose, measure with studio.material.coverage, look with studio.capture, then ask.',
    });
    return true;
  },
  async 'tools/list'(id) {
    reply(id, { tools: TOOLS });
    return true;
  },
  async 'tools/call'(id, params) {
    const name = params?.name;
    if (!TOOLS.some((t) => t.name === name)) {
      fail(id, -32602, `unknown tool '${name}' (this bridge serves ${TOOLS.length} tools; read studio-skill.md)`);
      return true;
    }
    let answer;
    try {
      answer = await call(name, params?.arguments ?? {});
    } catch (e) {
      // the dev server is not up, or the page is not connected: say which
      fail(id, -32000, `the Studio is not reachable at ${options.url} (${e instanceof Error ? e.message : String(e)})`);
      return true;
    }
    // A refusal can come from the relay ("the page did not answer") or from the tool itself ("the material already has 6 layers",
    // "the kit has 3 problems"). Both are the agent's business, so both come back as an error result with the reason in the payload.
    const value = answer.ok === false ? answer : answer.value;
    const refused = answer.ok === false || (typeof value === 'object' && value !== null && value.ok === false);
    log(name, refused ? `refused: ${(value && value.why) || 'see the problems in the payload'}` : 'ok');
    reply(id, {
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      isError: refused,
    });
    return true;
  },
  async ping(id) {
    reply(id, {});
    return true;
  },
};

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let inFlight = 0;
let closing = false;

const maybeExit = () => {
  if (closing && inFlight === 0) process.exit(0);
};

lines.on('line', (line) => {
  const text = line.trim();
  if (!text) return;
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    fail(null, -32700, 'parse error');
    return;
  }
  const { id, method, params } = message ?? {};
  if (typeof method !== 'string') {
    // a response from the client (we send no requests), or not a request at all
    return;
  }
  const handler = handlers[method];
  if (!handler) {
    // notifications have no id and expect no answer
    if (id !== undefined && id !== null) fail(id, -32601, `method not found: ${method}`);
    return;
  }
  inFlight += 1;
  Promise.resolve(handler(id, params))
    .catch((e) => fail(id ?? null, -32603, e instanceof Error ? e.message : 'internal error'))
    .finally(() => {
      inFlight -= 1;
      maybeExit();
    });
});

lines.on('close', () => {
  closing = true;
  maybeExit();
});
