/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { App } from './app';
import { RaceApp } from './race-app';
import { seedDemo } from './seed';
import './shell.css';

const editor = location.hash === '#edit';
const rt = createRuntime({ seed: 1, now: () => Date.now() });
const root = document.getElementById('app');
if (editor) {
  const sceneId = seedDemo(rt);
  rt.loadScene(sceneId);
  if (root) createRoot(root).render(<App rt={rt} sceneId={sceneId} />);
} else if (root) {
  createRoot(root).render(<RaceApp rt={rt} />);
}
(window as unknown as { hm: unknown }).hm = rt; // handy in the console: hm.store, hm.vars, hm.commands ...
