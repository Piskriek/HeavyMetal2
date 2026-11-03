import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@hm/contracts': p('../../packages/contracts/src/index.ts'),
      '@hm/render': p('../../packages/render/src/index.ts'),
      '@hm/sim': p('../../packages/sim/src/index.ts'),
      '@hm/orbital': p('../../packages/orbital/src/index.ts'),
      '@hm/sky': p('../../packages/sky/src/index.ts'),
      '@hm/terrain': p('../../packages/terrain/src/index.ts'),
      '@hm/substrate': p('../../packages/substrate/src/index.ts'),
      '@hm/wiregraph': p('../../packages/wiregraph/src/index.ts'),
      '@hm/rover': p('../../packages/rover/src/index.ts'),
      '@hm/partgen': p('../../packages/partgen/src/index.ts'),
      '@hm/harness': p('../../packages/harness/src/index.ts'),
      '@hm/kinematic': p('../../packages/kinematic/src/index.ts'),
    },
  },
  server: {
    port: 5195,
  },
});

