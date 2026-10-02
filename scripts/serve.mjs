/**
 * Host the built game on this PC so another machine on the network can open it:
 *   npm run host            (builds, then serves apps/web/dist on port 8080)
 *   node scripts/serve.mjs  (serve what is already built; PORT=9000 to change the port)
 * Then open http://<this PC's address>:8080 on the laptop. Static files only, no uploads, no write access.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/web/dist/', import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) { res.writeHead(403).end('no'); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file).catch(() => null);
    if (!body) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch { res.writeHead(500).end('error'); }
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root}`);
  for (const list of Object.values(networkInterfaces())) for (const n of list ?? []) if (n.family === 'IPv4' && !n.internal) console.log(`  open on the laptop:  http://${n.address}:${port}`);
  console.log(`  this PC:             http://localhost:${port}`);
});
