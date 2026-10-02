/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { MapMaker } from './maker/maker';
import { RaceApp } from './race-app';
import { hasSavedMap, loadMap } from './maker/storage';
import { setSoundResolver } from './maker/feedback';
import { resolveSound } from './sound/bank';
import './shell.css';

const editor = location.hash === '#edit';
const rt = createRuntime({ seed: 1, now: () => Date.now() });
setSoundResolver((id) => resolveSound(rt, id));
const root = document.getElementById('app');
if (editor) {
  if (root) createRoot(root).render(<MapMaker rt={rt} onTestDrive={() => { location.hash = ''; location.reload(); }} />);
} else if (root) {
  const fromMap = hasSavedMap() && loadMap(rt) !== null;
  createRoot(root).render(<RaceApp rt={rt} fromMap={fromMap} />);
}
(window as unknown as { hm: unknown }).hm = rt; // handy in the console: hm.store, hm.vars, hm.commands ...
