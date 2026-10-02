import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/** The deployable app: ONE static html file (RUN loads a static build; no server). base './' so it works from a sub-path. */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [viteSingleFile()],
  resolve: {
    alias: {
      // browser build: the script host uses the transpile-only compiler (no TypeScript program, no Node fs)
      // the RUN SDK only exists in a RUN build (`npm run build:run`); everywhere else it is a harmless stub
      ...(mode === 'run' ? {} : { '@series-inc/rundot-game-sdk/api': p('./src/platform/sdk-stub.ts') }),
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
      '@hm/game': p('../../packages/game/src/index.ts'),
      '@hm/racing': p('../../packages/racing/src/index.ts'),
      '@hm/racers': p('../../packages/racers/src/index.ts'),
      '@hm/trackgen': p('../../packages/trackgen/src/index.ts'),
      '@hm/content': p('../../packages/content/src/index.ts'),
      '@hm/looks': p('../../packages/looks/src/index.ts'),
      '@hm/raceflow': p('../../packages/raceflow/src/index.ts'),
      '@hm/input': p('../../packages/input/src/index.ts'),
      '@hm/goblins': p('../../packages/goblins/src/index.ts'),
      '@hm/audio': p('../../packages/audio/src/index.ts'),
      '@hm/trackedit': p('../../packages/trackedit/src/index.ts'),
      '@hm/terrainops': p('../../packages/terrainops/src/index.ts'),
      '@hm/scatter': p('../../packages/scatter/src/index.ts'),
      '@hm/modulation': p('../../packages/modulation/src/index.ts'),
      '@hm/modui': p('../../packages/modui/src/index.ts'),
      '@hm/soundlab': p('../../packages/soundlab/src/index.ts'),
      '@hm/screens': p('../../packages/screens/src/index.ts'),
      '@hm/itemdefs': p('../../packages/itemdefs/src/index.ts'),
      '@hm/hudlayout': p('../../packages/hudlayout/src/index.ts'),
      '@hm/soundpack': p('../../packages/soundpack/src/index.ts'),
      '@hm/texgraph': p('../../packages/texgraph/src/index.ts'),
      '@hm/tools': p('../../packages/tools/src/index.ts'),
    },
  },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
}));
