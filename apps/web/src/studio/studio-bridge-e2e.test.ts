// The whole bridge, end to end and headless: an MCP client's JSON-RPC lines go into `scripts/studio-agent-bridge.mjs` on stdin, the
// bridge posts each tool call to a dev-server-shaped relay, the relay answers as the Studio page would (refusals included), and the
// answer comes back as MCP content. No browser and no Vite: the point is that the protocol, the pairing key and the refusal path are
// real, not described.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import path from 'node:path';

const script = path.resolve(process.cwd(), 'scripts/studio-agent-bridge.mjs');

/** A relay stand-in: it answers a tool call the way the Studio page would for that tool. */
function fakeStudio(): Promise<{ server: Server; port: number; seen: { key: string; tool: string; args: unknown }[]; close: () => Promise<void> }> {
  const seen: { key: string; tool: string; args: unknown }[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { key?: string; tool?: string; args?: unknown };
      seen.push({ key: body.key ?? '', tool: body.tool ?? '', args: body.args });
      const answer =
        body.tool === 'studio.material.coverage'
          ? { ok: true, value: { ok: true, preset: 'mat:furnace', layers: [{ name: 'Soot', top: 35, side: 0 }], edgeMetal: 0.92 } }
          : body.tool === 'studio.changes.accept'
            ? { ok: true, value: { ok: false, why: 'change change-1 was already accepted' } }
            : { ok: true, value: { ok: true, tools: 11 } };
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(answer));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        server,
        port,
        seen,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

/** Runs the bridge over stdio with the given request lines and returns its parsed replies, in order. */
function runBridge(port: number, lines: string[], key = 'e2e-key'): Promise<{ replies: { id: unknown; result?: unknown; error?: { code: number; message: string } }[]; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--key', key, '--url', `http://127.0.0.1:${port}`], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (c: Buffer) => {
      out += c.toString('utf8');
    });
    child.stderr.on('data', (c: Buffer) => {
      err += c.toString('utf8');
    });
    child.on('error', reject);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`the bridge did not exit (stdout: ${out.slice(0, 400)})`));
    }, 15_000);
    child.on('exit', () => {
      clearTimeout(timer);
      const replies = out
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as { id: unknown; result?: unknown; error?: { code: number; message: string } });
      resolve({ replies, stderr: err });
    });
    for (const line of lines) child.stdin.write(`${line}\n`);
    child.stdin.end();
  });
}

const line = (id: number, method: string, params?: unknown): string => JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

test('an MCP client handshakes, lists the tools, and gets the page\'s answer for a call', async () => {
  const studio = await fakeStudio();
  try {
    const { replies } = await runBridge(studio.port, [
      line(1, 'initialize', { clientInfo: { name: 'e2e' } }),
      line(2, 'tools/list'),
      line(3, 'tools/call', { name: 'studio.material.coverage', arguments: { preset: 'mat:furnace' } }),
    ]);
    assert.equal(replies.length, 3);
    const init = replies[0]!.result as { serverInfo: { name: string }; instructions: string };
    assert.equal(init.serverInfo.name, 'fidelity-studio');
    assert.match(init.instructions, /studio-skill\.md/);
    assert.match(init.instructions, /propose -> validate -> measure -> look/);

    const list = replies[1]!.result as { tools: { name: string; inputSchema: { type: string } }[] };
    assert.equal(list.tools.length, 11);
    for (const name of ['studio.doc.propose', 'studio.material.coverage', 'studio.capture', 'studio.kit.validate']) {
      assert.ok(list.tools.some((t) => t.name === name), `${name} is not in tools/list`);
    }
    for (const tool of list.tools) assert.equal(tool.inputSchema.type, 'object');

    const call = replies[2]!.result as { content: { type: string; text: string }[]; isError: boolean };
    assert.equal(call.isError, false);
    const payload = JSON.parse(call.content[0]!.text) as { preset: string; layers: { name: string; top: number }[] };
    assert.equal(payload.preset, 'mat:furnace');
    assert.equal(payload.layers[0]!.top, 35);
    // the pairing key travelled with the call, and the call carried its arguments intact
    assert.deepEqual(studio.seen.map((s) => s.tool), ['studio.material.coverage']);
    assert.equal(studio.seen[0]!.key, 'e2e-key');
    assert.deepEqual(studio.seen[0]!.args, { preset: 'mat:furnace' });
  } finally {
    await studio.close();
  }
});

test('a refusal from the page comes back as a tool result flagged as an error, not as a protocol error', async () => {
  const studio = await fakeStudio();
  try {
    const { replies } = await runBridge(studio.port, [line(1, 'tools/call', { name: 'studio.changes.accept', arguments: { id: 'change-1' } })]);
    const result = replies[0]!.result as { content: { text: string }[]; isError: boolean };
    assert.equal(replies[0]!.error, undefined);
    assert.equal(result.isError, true);
    assert.match(JSON.parse(result.content[0]!.text).why, /already accepted/);
  } finally {
    await studio.close();
  }
});

test('an unknown tool is a protocol error that names the tool count, and a bad line is a parse error', async () => {
  const studio = await fakeStudio();
  try {
    const { replies } = await runBridge(studio.port, [line(1, 'tools/call', { name: 'studio.mesh.retopo_single_asset' }), '{"jsonrpc":"2.0",oops']);
    assert.equal(replies[0]!.error?.code, -32602);
    assert.match(replies[0]!.error!.message, /unknown tool 'studio\.mesh\.retopo_single_asset'/);
    assert.equal(replies[1]!.error?.code, -32700);
    assert.equal(studio.seen.length, 0, 'an unknown tool must not reach the page');
  } finally {
    await studio.close();
  }
});

test('with no Studio running the call fails with a reason an agent can act on', async () => {
  // port 1 on loopback: nothing listens there
  const { replies } = await runBridge(1, [line(1, 'tools/call', { name: 'studio.doc.read', arguments: {} })]);
  assert.equal(replies[0]!.error?.code, -32000);
  assert.match(replies[0]!.error!.message, /the Studio is not reachable/);
});

test('the bridge refuses to start without a pairing key', async () => {
  const child = spawn(process.execPath, [script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  child.stderr.on('data', (c: Buffer) => {
    err += c.toString('utf8');
  });
  const code = await new Promise<number | null>((resolve) => child.on('exit', (c) => resolve(c)));
  assert.equal(code, 2);
  assert.match(err, /--key <pairing key> is required/);
});
