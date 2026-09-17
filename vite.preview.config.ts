/**
 * Preview-only Vite configuration for the sandboxed live preview.
 *
 * The sandbox proxies the dev server under a per-session hostname
 * (`<port>-<sandboxId>.e2b.app`), which Vite 7 rejects unless it is allowlisted. The
 * real `vite.config.ts` is intentionally left untouched; this wrapper re-uses it and
 * only adds host/origin allowances, so `npm run build` behaves exactly as before.
 *
 * Usage: npx vite --config vite.preview.config.ts --host 0.0.0.0 --port 5173
 */
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default defineConfig((environment) => mergeConfig(
  // `base` is a plain object config, so it can be merged directly.
  typeof base === 'function' ? base(environment) : base,
  defineConfig({
    server: {
      host: '0.0.0.0',
      strictPort: false,
      // The preview proxy host is dynamic per session, so all hosts are accepted here.
      allowedHosts: true,
      cors: true,
      hmr: { clientPort: 443, protocol: 'wss' },
    },
    preview: { host: '0.0.0.0', allowedHosts: true, cors: true },
  }),
));
