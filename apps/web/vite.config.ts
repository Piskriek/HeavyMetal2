import { defineConfig, type Plugin, type PluginOption } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studioWriteBack } from './studio-server/vite-plugin';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/**
 * The single file's cap (Argo's DEC-10, approved by the owner on 13 October 2026), in MB of 1024² bytes as POL-27 measures.
 * Above it the build fails after writing, so the file can still be inspected. Room comes from moving detail levels or
 * vista-only props to the HD pack or a fetched side file, never from raising the cap without the owner.
 */
const MAX_MB = 16;
function sizeGate(): Plugin {
  let file = '';
  return {
    name: 'hm-size-gate',
    apply: 'build',
    configResolved(c) { file = path.resolve(c.root, c.build.outDir, 'index.html'); },
    closeBundle() {
      if (!existsSync(file)) return;
      const mb = statSync(file).size / 1024 / 1024;
      const line = `single file ${mb.toFixed(2)} MB of the ${MAX_MB} MB cap`;
      if (mb > MAX_MB) throw new Error(`${line}: move detail levels or vista-only props out to the HD pack or a side file (POL-27).`);
      console.log(`\n  ${line}`);
    },
  };
}

/**
 * The RUN multiplayer plugin (the room server on port 9001 under `vite --mode run`, and the room bundle at build time), loaded ONLY in
 * RUN mode (`npm run build:run`). The plain single-file build never imports the SDK's vite entry. A failed import fails the build:
 * a RUN build without its rooms is a co-op that cannot connect.
 */
async function runMultiplayerPlugins(mode: string): Promise<PluginOption[]> {
  if (mode !== 'run') return [];
  const { rundotMultiplayerPlugin } = await import('@series-inc/rundot-game-sdk/vite');
  return [rundotMultiplayerPlugin(), requireRoomBundle()];
}

/** RUN builds only: the room bundle must exist once the build is written. The SDK logs its own bundle errors and carries on. */
function requireRoomBundle(): Plugin {
  let root = '';
  return {
    name: 'hm-run-room-bundle',
    apply: 'build',
    configResolved(c) { root = c.root; },
    async closeBundle() {
      // the SDK writes the room bundle in its own closeBundle, which runs beside this one: wait for the file it writes last
      const bundle = path.resolve(root, 'dist', 'server-bundle.js');
      const written = path.resolve(root, 'dist', 'rooms.config.json');
      for (let waited = 0; waited < 120_000 && !existsSync(written); waited += 250) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!existsSync(bundle) || !existsSync(written)) throw new Error(`RUN build: ${bundle} was not written, so the outpost room did not bundle (see the [RUN:multiplayer] lines above).`);
      console.log(`\n  RUN room bundle ${(statSync(bundle).size / 1024).toFixed(1)} KB`);
    },
  };
}

/** The deployable app: ONE static html file (RUN loads a static build; no server). base './' so it works from a sub-path. */
export default defineConfig(async ({ mode }) => ({
  base: './',
  // Arena's live preview is reverse-proxied; keep Vite's host protection while admitting that preview domain.
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  plugins: [...(await runMultiplayerPlugins(mode)), viteSingleFile(), studioWriteBack(), sizeGate()],
  // which game this build is (src/edition.ts): `HM_EDITION=goblin-racing npm run build` for the Goblin Racing launch; SetMix by default
  define: { __HM_EDITION__: JSON.stringify(process.env.HM_EDITION ?? 'setmix') },
  resolve: {
    alias: {
      // browser build: the script host uses the transpile-only compiler (no TypeScript program, no Node fs)
      // the RUN SDK only exists in a RUN build (`npm run build:run`); everywhere else it is a harmless stub
      ...(mode === 'run' ? {} : { '@series-inc/rundot-game-sdk/api': p('./src/platform/sdk-stub.ts') }),
      './compile.js': p('../../packages/script/src/compile-lite.ts'),
      './quickjs-loader.js': p('../../packages/script/src/quickjs-loader-browser.ts'),
      './qjs.js': p('../../packages/script/src/qjs-browser.ts'),
      '@hm/contracts': p('../../packages/contracts/src/index.ts'),
      '@hm/hudmath/toast-queue-and-compass': p('../../packages/hudmath/src/toast-queue-and-compass.ts'),
      '@hm/hudmath/ega-palette-and-degauss': p('../../packages/hudmath/src/ega-palette-and-degauss.ts'),
      '@hm/hudmath': p('../../packages/hudmath/src/index.ts'),
      '@hm/coopnet/sculpt-and-pad-sync': p('../../packages/coopnet/src/sculpt-and-pad-sync.ts'),
      '@hm/coopnet/gate-dialer': p('../../packages/coopnet/src/gate-dialer.ts'),
      '@hm/coopnet': p('../../packages/coopnet/src/index.ts'),
      '@hm/bridgekit/game-detector': p('../../packages/bridgekit/src/game-detector.ts'),
      '@hm/bridgekit': p('../../packages/bridgekit/src/index.ts'),
      '@hm/orbital/flight-and-transfer': p('../../packages/orbital/src/flight-and-transfer.ts'),
      '@hm/orbital': p('../../packages/orbital/src/index.ts'),
      '@hm/beamkit/hybrid-cartridge-modes': p('../../packages/beamkit/src/hybrid-cartridge-modes.ts'),
      '@hm/groundshader/yaw-stable-dither': p('../../packages/groundshader/src/yaw-stable-dither.ts'),
      '@hm/groundshader/blob47-autotile': p('../../packages/groundshader/src/blob47-autotile.ts'),
      '@hm/plotsim/machine-led-and-hopper': p('../../packages/plotsim/src/machine-led-and-hopper.ts'),
      '@hm/content/diegetic-radio-and-tapes': p('../../packages/content/src/diegetic-radio-and-tapes.ts'),
      '@hm/tooljuice/beat-synced-plume-and-turbobass': p('../../packages/tooljuice/src/beat-synced-plume-and-turbobass.ts'),
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
      '@hm/tracklayouts': p('../../packages/tracklayouts/src/index.ts'),
      '@hm/evolve': p('../../packages/evolve/src/index.ts'),
      '@hm/lineage': p('../../packages/lineage/src/index.ts'),
      '@hm/voxelart': p('../../packages/voxelart/src/index.ts'),
      '@hm/camerarig': p('../../packages/camerarig/src/index.ts'),
      '@hm/plugs': p('../../packages/plugs/src/index.ts'),
      '@hm/islands': p('../../packages/islands/src/index.ts'),
      '@hm/lighting': p('../../packages/lighting/src/index.ts'),
      '@hm/buildkit': p('../../packages/buildkit/src/index.ts'),
      '@hm/gizmo': p('../../packages/gizmo/src/index.ts'),
      '@hm/triggers': p('../../packages/triggers/src/index.ts'),
      '@hm/primitives': p('../../packages/primitives/src/index.ts'),
      '@hm/physmat': p('../../packages/physmat/src/index.ts'),
      '@hm/keyframes': p('../../packages/keyframes/src/index.ts'),
      '@hm/erosion': p('../../packages/erosion/src/index.ts'),
      '@hm/wiregraph': p('../../packages/wiregraph/src/index.ts'),
      '@hm/splineroad': p('../../packages/splineroad/src/index.ts'),
      '@hm/camtrack': p('../../packages/camtrack/src/index.ts'),
      '@hm/walkpath': p('../../packages/walkpath/src/index.ts'),
      '@hm/smoothvox2': p('../../packages/smoothvox2/src/index.ts'),
      '@hm/toolanims': p('../../packages/toolanims/src/index.ts'),
      '@hm/tooljuice': p('../../packages/tooljuice/src/index.ts'),
      '@hm/vox': p('../../packages/vox/src/index.ts'),
      '@hm/schematic': p('../../packages/schematic/src/index.ts'),
      '@hm/puppet': p('../../packages/puppet/src/index.ts'),
      '@hm/decals': p('../../packages/decals/src/index.ts'),
      '@hm/kart': p('../../packages/kart/src/index.ts'),
      '@hm/kinematic': p('../../packages/kinematic/src/index.ts'),
      '@hm/musicbox': p('../../packages/musicbox/src/index.ts'),
      '@hm/skin': p('../../packages/skin/src/index.ts'),
      '@hm/chunkworld': p('../../packages/chunkworld/src/index.ts'),
      '@hm/pixels': p('../../packages/pixels/src/index.ts'),
      '@hm/questline': p('../../packages/questline/src/index.ts'),
      '@hm/machines': p('../../packages/machines/src/index.ts'),
      '@hm/market': p('../../packages/market/src/index.ts'),
      '@hm/rocket': p('../../packages/rocket/src/index.ts'),
      '@hm/ragdoll': p('../../packages/ragdoll/src/index.ts'),
      '@hm/navgrid': p('../../packages/navgrid/src/index.ts'),
      '@hm/hull': p('../../packages/hull/src/index.ts'),
      '@hm/remesh': p('../../packages/remesh/src/index.ts'),
      '@hm/lightplace': p('../../packages/lightplace/src/index.ts'),
      '@hm/voxelcsg': p('../../packages/voxelcsg/src/index.ts'),
      '@hm/soundscape': p('../../packages/soundscape/src/index.ts'),
      '@hm/audiomix': p('../../packages/audiomix/src/index.ts'),
      '@hm/npcbrain': p('../../packages/npcbrain/src/index.ts'),
      '@hm/particles': p('../../packages/particles/src/index.ts'),
      '@hm/selectset': p('../../packages/selectset/src/index.ts'),
      '@hm/voxelnature': p('../../packages/voxelnature/src/index.ts'),
      '@hm/worldrules': p('../../packages/worldrules/src/index.ts'),
      '@hm/anim': p('../../packages/anim/src/index.ts'),
      '@hm/avatarlook': p('../../packages/avatarlook/src/index.ts'),
      '@hm/assembler': p('../../packages/assembler/src/index.ts'),
      '@hm/pbrgrass': p('../../packages/pbrgrass/src/index.ts'),
      '@hm/voxpartshead': p('../../packages/voxpartshead/src/index.ts'),
      '@hm/toolcatalog': p('../../packages/toolcatalog/src/index.ts'),
      '@hm/smoothvox': p('../../packages/smoothvox/src/index.ts'),
      '@hm/voxpartsbody': p('../../packages/voxpartsbody/src/index.ts'),
      '@hm/uistack': p('../../packages/uistack/src/index.ts'),
      '@hm/tutorial': p('../../packages/tutorial/src/index.ts'),
      '@hm/juice': p('../../packages/juice/src/index.ts'),
      '@hm/activities': p('../../packages/activities/src/index.ts'),
      '@hm/voxelsculpt': p('../../packages/voxelsculpt/src/index.ts'),
      '@hm/motion': p('../../packages/motion/src/index.ts'),
      '@hm/voxel': p('../../packages/voxel/src/index.ts'),
      '@hm/tools': p('../../packages/tools/src/index.ts'),
      '@hm/fauna': p('../../packages/fauna/src/index.ts'),
      '@hm/flora': p('../../packages/flora/src/index.ts'),
      '@hm/vault': p('../../packages/vault/src/index.ts'),
      '@hm/fidelity': p('../../packages/fidelity/src/index.ts'),
      '@hm/plotterrain': p('../../packages/plotterrain/src/index.ts'),
      '@hm/groundshader': p('../../packages/groundshader/src/index.ts'),
      '@hm/plume': p('../../packages/plume/src/index.ts'),
      '@hm/labkit': p('../../packages/labkit/src/index.ts'),
      '@hm/plotsim': p('../../packages/plotsim/src/index.ts'),
      '@hm/structure': p('../../packages/structure/src/index.ts'),
      '@hm/lattice': p('../../packages/lattice/src/index.ts'),
      '@hm/kitspec/audit': p('../../packages/kitspec/src/audit.ts'),
      '@hm/gamepreset': p('../../packages/gamepreset/src/index.ts'),
      '@hm/kitspec': p('../../packages/kitspec/src/index.ts'),
      '@hm/creature': p('../../packages/creature/src/index.ts'),
      '@hm/matstack': p('../../packages/matstack/src/index.ts'),
      '@hm/partgen': p('../../packages/partgen/src/index.ts'),
      '@hm/meshops': p('../../packages/meshops/src/index.ts'),
      '@hm/substrate': p('../../packages/substrate/src/index.ts'),
      '@hm/basegear': p('../../packages/basegear/src/index.ts'),
      '@hm/heavygear': p('../../packages/heavygear/src/index.ts'),
      '@hm/basekit2': p('../../packages/basekit2/src/index.ts'),
      '@hm/navpath': p('../../packages/navpath/src/index.ts'),
      '@hm/mobsim': p('../../packages/mobsim/src/index.ts'),
      '@hm/narrator': p('../../packages/narrator/src/index.ts'),
      '@hm/rover': p('../../packages/rover/src/index.ts'),
      '@hm/rovergear': p('../../packages/rovergear/src/index.ts'),
      '@hm/batcher': p('../../packages/batcher/src/index.ts'),
      '@hm/basekit': p('../../packages/basekit/src/index.ts'),
      '@hm/fieldkit': p('../../packages/fieldkit/src/index.ts'),
      '@hm/cartlab': p('../../packages/cartlab/src/index.ts'),
      '@hm/plotcodec': p('../../packages/plotcodec/src/index.ts'),
      '@hm/consolemill': p('../../packages/consolemill/src/index.ts'),
      '@hm/shareware': p('../../packages/shareware/src/index.ts'),
      '@hm/beamkit': p('../../packages/beamkit/src/index.ts'),
      '@hm/terrainbrush': p('../../packages/terrainbrush/src/index.ts'),
      '@hm/leaksim': p('../../packages/leaksim/src/index.ts'),
      '@hm/sky': p('../../packages/sky/src/index.ts'),
      '@hm/plotbiome': p('../../packages/plotbiome/src/index.ts'),
      '@hm/harness': p('../../packages/harness/src/index.ts'),
    },
  },
  assetsInclude: ['**/*.fbx', '**/*.bin'],
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
}));
