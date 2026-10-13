/**
 * Mounts the Studio's dev routes on the Vite dev server only (`apply: 'serve'`). `vite build` never includes them.
 *   /__studio/data/...   the tweak file (write-back.ts)
 *   /__studio/bench/...  the asset bench: the 3D AI connection and the redo steps (bench.ts)
 * Env, for the test run only: STUDIO_BENCH_MOCK=1 runs every step as a fixture, and STUDIO_BENCH_DIR moves the bench's
 * files under a temporary folder (the mock cannot run without it: it would write to the real assets). STUDIO_SECRETS_FILE
 * points the connection at another file (so a test never touches the owner's .studio-secrets.json).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { BENCH_ROUTE, JobRunner, benchPathsFor, handleBenchRequest } from './bench';
import { BodyTooLarge, ROUTE, handleStudioRequest, type Reply, type Request } from './write-back';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const paths = {
  dataDir: path.join(here, '../src/studio-data'),
  registryFile: path.join(here, '../src/assets/gen/registry.json'),
};
const mock = process.env.STUDIO_BENCH_MOCK === '1';
const benchDir = process.env.STUDIO_BENCH_DIR || undefined;
if (mock && !benchDir) throw new Error('STUDIO_BENCH_MOCK=1 needs STUDIO_BENCH_DIR (a temporary folder): the fixtures never run on the real assets');
const benchPaths = benchPathsFor(root, process.env.STUDIO_SECRETS_FILE || path.join(root, '.studio-secrets.json'), benchDir);
const jobs = new JobRunner(root);

export function studioWriteBack(): Plugin {
  return {
    name: 'studio-write-back',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const isData = url.startsWith(ROUTE);
        const isBench = url.startsWith(BENCH_ROUTE);
        if (!isData && !isBench) { next(); return; }
        const request: Request = {
          method: req.method ?? 'GET',
          path: url.split('?')[0] ?? url,
          host: req.headers.host,
          origin: req.headers.origin,
          contentType: req.headers['content-type'],
          readBody: (max: number) => new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;
            req.on('data', (c: Buffer) => {
              size += c.length;
              if (size > max) { reject(new BodyTooLarge('too large')); req.resume(); return; }
              chunks.push(c);
            });
            req.on('end', () => { if (size <= max) resolve(Buffer.concat(chunks).toString('utf8')); });
            req.on('error', reject);
          }),
        };
        const answer = isBench
          ? handleBenchRequest(request, benchPaths, jobs, { mock })
          : handleStudioRequest(request, paths);
        answer.then((reply: Reply | null) => {
          if (!reply) { next(); return; }
          res.statusCode = reply.status;
          res.setHeader('Content-Type', reply.type ?? 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(reply.body);
        }, (e: unknown) => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, why: e instanceof Error ? e.message : 'write failed' }));
        });
      });
    },
  };
}
