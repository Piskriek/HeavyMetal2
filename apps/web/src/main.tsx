/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 *
 * #edit  = the Map Maker.   #race = straight into a quick race on the saved map (what "Test drive" does).   no hash = the game from the title screen.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { MapMaker } from './maker/maker';
import { App } from './app';
import { hasSavedMap, loadMap } from './maker/storage';
import { bootPlatform } from './platform/boot';
import { setSoundResolver } from './maker/feedback';
import { resolveSound } from './sound/bank';
import './shell.css';

async function start(): Promise<void> {
  await bootPlatform(); // in RUN.world this installs the cloud-backed save store before anything reads a save
  const editor = location.hash === '#edit';
  const rt = createRuntime({ seed: 1, now: () => Date.now() });
  setSoundResolver((id) => resolveSound(rt, id));
  const root = document.getElementById('app');
  if (root && editor) {
    createRoot(root).render(<MapMaker rt={rt} onTestDrive={() => { location.hash = '#race'; location.reload(); }} />);
  } else if (root) {
    const fromMap = hasSavedMap() && loadMap(rt) !== null;
    createRoot(root).render(<App rt={rt} fromMap={fromMap} autoStart={location.hash === '#race'} onEditor={() => { location.hash = '#edit'; location.reload(); }} />);
  }
  (window as unknown as { hm: unknown }).hm = rt; // handy in the console: hm.store, hm.vars, hm.commands ...
}
void start();
