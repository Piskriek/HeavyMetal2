// The Arena reply-route receiver (docs/ARENA_PLAN.md section 5). Arena's page blocks fetch to localhost, but a navigation is allowed: the Arena
// tab is pointed at http://127.0.0.1:8791/put?name=<pkg>&d=<base64url of JSON {"files": {"src/index.ts": "...", ...}}> and the files land
// in arena-out/<pkg>/ (git-ignored). Then reopen the chat URL. Only listens on 127.0.0.1; only writes inside arena-out.
//   node scripts/arena-recv.mjs            (leave it running while collecting)
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), 'arena-out');
const PORT = 8791;
const safe = (s) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(s);

// maxHeaderSize: a reply travels in the URL (tens of KB), past Node's 16 KB default
createServer({ maxHeaderSize: 4 * 1024 * 1024 }, (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const reply = (code, text) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px Inter,sans-serif;padding:24px">${text}</body>`); };
  if (url.pathname === '/ping') return reply(200, 'arena-recv is running');
  if (url.pathname !== '/put') return reply(404, 'Use /put?name=&lt;pkg&gt;&amp;d=&lt;base64url JSON&gt;');
  const name = url.searchParams.get('name') ?? '', d = url.searchParams.get('d') ?? '';
  if (!safe(name)) return reply(400, 'Bad name');
  let files;
  try { files = JSON.parse(Buffer.from(d, 'base64url').toString('utf8')).files; } catch { return reply(400, 'Bad data'); }
  if (!files || typeof files !== 'object') return reply(400, 'No files');
  const base = join(root, name), written = [];
  for (const [path, text] of Object.entries(files)) {
    const target = normalize(join(base, path));
    if (!target.startsWith(base + sep) || typeof text !== 'string') continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    written.push(`${path} (${text.length} chars)`);
  }
  console.log(`arena-recv: ${name}: ${written.join(', ')}`);
  return reply(200, `Saved ${written.length} file(s) for <b>${name}</b>:<br>${written.join('<br>')}<br><br>Go back to the chat.`);
}).listen(PORT, '127.0.0.1', () => console.log(`arena-recv listening on http://127.0.0.1:${PORT} (writes to ${root})`));
