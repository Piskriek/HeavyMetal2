/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 *
 * Always the main menu over the galaxy (SetMix: My island, Avatars, Community, Settings; Goblin Racing's window); every other place is a screen of the shell.   #race = straight into a quick race on the saved map (what "Test drive" does).   no hash = the game from the title screen.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { initQuickJS } from '@hm/script';
import { Shell } from './shell/shell';
import { bootPlatform } from './platform/boot';
import { initBigStore } from './storage/big-store';
import { setSoundResolver } from './maker/feedback';
import { packSound, resolveSound } from './sound/bank';
import './shell.css';
import './studio.css';

async function start(): Promise<void> {
  await initQuickJS(); // the script engine is loaded explicitly: no top-level await in the single-file build
  const platform = await bootPlatform(); // in RUN.world this installs the cloud-backed save store before anything reads a save
  await initBigStore(platform); // islands and the racetrack: IndexedDB (moved out of localStorage once), all in memory before the first read
  // every island (and the racetrack) gets its own runtime, so their presets can never mix
  let current = createRuntime({ seed: 1, now: () => Date.now() });
  const makeRuntime = (): ReturnType<typeof createRuntime> => {
    const rt = createRuntime({ seed: 1, now: () => Date.now() });
    current = rt;
    (window as unknown as { hm: unknown }).hm = rt;
    return rt;
  };
  setSoundResolver((id) => resolveSound(current, id) ?? packSound(id));
  const root = document.getElementById('app');
  // everything is a screen of the one shell, starting on the main menu over the galaxy: no separate pages to get stranded on
  if (root) createRoot(root).render(<Shell makeRuntime={makeRuntime} />);
  (window as unknown as { hm: unknown }).hm = current; // handy in the console: hm.store, hm.vars, hm.commands ...
}
void start();
