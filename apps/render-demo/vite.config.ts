import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@hm/contracts': p('../../packages/contracts/src/index.ts'),
      '@hm/sim': p('../../packages/sim/src/index.ts'),
      '@hm/render': p('../../packages/render/src/index.ts'),
    },
  },
});
