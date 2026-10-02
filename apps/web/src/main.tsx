/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 *
 * #island = My Island (walk about as the goblin; Esc -> menu -> Edit my island).   #edit  = the Map Maker.   #race = straight into a quick race on the saved map (what "Test drive" does).   no hash = the game from the title screen.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { MapMaker } from './maker/maker';
import { App } from './app';
import { IslandWalk } from './island';
import { hasSavedMap, loadMap } from './maker/storage';
import { bootPlatform } from './platform/boot';
import { setSoundResolver } from './maker/feedback';
import { packSound, resolveSound } from './sound/bank';
import './shell.css';
import './studio.css';

async function start(): Promise<void> {
  await bootPlatform(); // in RUN.world this installs the cloud-backed save store before anything reads a save
  const editor = location.hash === '#edit';
  const island = location.hash === '#island';
  const rt = createRuntime({ seed: 1, now: () => Date.now() });
  setSoundResolver((id) => resolveSound(rt, id) ?? packSound(id));
  const root = document.getElementById('app');
  if (root && editor) {
    createRoot(root).render(<MapMaker rt={rt} onTestDrive={() => { location.hash = '#race'; location.reload(); }} />);
  } else if (root && island) {
    const go = (h: string): void => { location.hash = h; location.reload(); };
    createRoot(root).render(<IslandWalk rt={rt} onEdit={() => go('#edit')} onRace={() => go('#race')} onTitle={() => go('')} />);
  } else if (root) {
    const fromMap = hasSavedMap() && loadMap(rt) !== null;
    createRoot(root).render(<App rt={rt} fromMap={fromMap} autoStart={location.hash === '#race'} onEditor={() => { location.hash = '#island'; location.reload(); }} />);
  }
  (window as unknown as { hm: unknown }).hm = rt; // handy in the console: hm.store, hm.vars, hm.commands ...
}
void start();
