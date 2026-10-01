import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/** The deployable app: ONE static html file (RUN loads a static build; no server). base './' so it works from a sub-path. */
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  resolve: {
    alias: {
      '@hm/contracts': p('../../packages/contracts/src/index.ts'),
      '@hm/kernel': p('../../packages/kernel/src/index.ts'),
      '@hm/script': p('../../packages/script/src/index.ts'),
      '@hm/sim': p('../../packages/sim/src/index.ts'),
      '@hm/platform': p('../../packages/platform/src/index.ts'),
    },
  },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
