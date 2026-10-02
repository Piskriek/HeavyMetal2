/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 *
 * no hash = the main menu over the galaxy (Play, Multiplayer, My Island, Settings).   #edit  = the build mode editor.   #race = straight into a quick race on the saved map (what "Test drive" does).   no hash = the game from the title screen.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { initQuickJS } from '@hm/script';
import { MapMaker } from './maker/maker';
import { App } from './app';
import { Shell } from './shell/shell';
import { hasSavedMap, loadMap } from './maker/storage';
import { bootPlatform } from './platform/boot';
import { setSoundResolver } from './maker/feedback';
import { packSound, resolveSound } from './sound/bank';
import './shell.css';
import './studio.css';

async function start(): Promise<void> {
  await initQuickJS(); // the script engine is loaded explicitly: no top-level await in the single-file build
  await bootPlatform(); // in RUN.world this installs the cloud-backed save store before anything reads a save
  const editor = location.hash === '#edit';
  const rt = createRuntime({ seed: 1, now: () => Date.now() });
  setSoundResolver((id) => resolveSound(rt, id) ?? packSound(id));
  const root = document.getElementById('app');
  if (root && editor) {
    createRoot(root).render(<MapMaker rt={rt} onTestDrive={() => { location.hash = '#race'; location.reload(); }} />);
  } else if (root) {
    if (location.hash === '#race') {
      // straight into a quick race on the saved map: what Test drive in the editor does
      const fromMap = hasSavedMap() && loadMap(rt) !== null;
      createRoot(root).render(<App rt={rt} fromMap={fromMap} autoStart onEditor={() => { location.hash = '#edit'; location.reload(); }} />);
    } else {
      // everything else starts on the main menu over the galaxy
      createRoot(root).render(<Shell rt={rt} onBuild={() => { location.hash = '#edit'; location.reload(); }} />);
    }
  }
  (window as unknown as { hm: unknown }).hm = rt; // handy in the console: hm.store, hm.vars, hm.commands ...
}
void start();
