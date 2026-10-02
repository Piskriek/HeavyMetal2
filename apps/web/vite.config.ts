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
      // browser build: the script host uses the transpile-only compiler (no TypeScript program, no Node fs)
      './compile.js': p('../../packages/script/src/compile-lite.ts'),
      './quickjs-loader.js': p('../../packages/script/src/quickjs-loader-browser.ts'),
      '@hm/contracts': p('../../packages/contracts/src/index.ts'),
      '@hm/kernel': p('../../packages/kernel/src/index.ts'),
      '@hm/script': p('../../packages/script/src/index.ts'),
      '@hm/sim': p('../../packages/sim/src/index.ts'),
      '@hm/platform': p('../../packages/platform/src/index.ts'),
      '@hm/physics': p('../../packages/physics/src/index.ts'),
      '@hm/render': p('../../packages/render/src/index.ts'),
      '@hm/ui': p('../../packages/ui/src/index.ts'),
      '@hm/engine': p('../../packages/engine/src/index.ts'),
      '@hm/terrain': p('../../packages/terrain/src/index.ts'),
      '@hm/tools': p('../../packages/tools/src/index.ts'),
    },
  },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
