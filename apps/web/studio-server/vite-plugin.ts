/**
 * Mounts the Studio write-back on the Vite dev server only (`apply: 'serve'`). `vite build` never includes it.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { BodyTooLarge, MAX_BODY, ROUTE, handleStudioRequest, type Request } from './write-back';

const here = path.dirname(fileURLToPath(import.meta.url));
const paths = {
  dataDir: path.join(here, '../src/studio-data'),
  registryFile: path.join(here, '../src/assets/gen/registry.json'),
};

export function studioWriteBack(): Plugin {
  return {
    name: 'studio-write-back',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(ROUTE)) { next(); return; }
        const request: Request = {
          method: req.method ?? 'GET',
          path: url.split('?')[0] ?? url,
          host: req.headers.host,
          origin: req.headers.origin,
          contentType: req.headers['content-type'],
          readBody: () => new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;
            req.on('data', (c: Buffer) => {
              size += c.length;
              if (size > MAX_BODY) { reject(new BodyTooLarge('too large')); req.resume(); return; }
              chunks.push(c);
            });
            req.on('end', () => { if (size <= MAX_BODY) resolve(Buffer.concat(chunks).toString('utf8')); });
            req.on('error', reject);
          }),
        };
        handleStudioRequest(request, paths).then((reply) => {
          if (!reply) { next(); return; }
          res.statusCode = reply.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
