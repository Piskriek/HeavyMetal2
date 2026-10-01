/**
 * The deployable shell: ONE static html file. Wires the harness runtime to the renderer and the inspector.
 * Packages that use Node APIs (the script type-checker) are intentionally not imported here.
 */
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@hm/engine';
import { App } from './app';
import { seedDemo } from './seed';
import './shell.css';

const rt = createRuntime({ seed: 1, now: () => Date.now() });
const sceneId = seedDemo(rt);
rt.loadScene(sceneId);

const root = document.getElementById('app');
if (root) createRoot(root).render(<App rt={rt} sceneId={sceneId} />);
(window as unknown as { hm: unknown }).hm = rt; // handy in the console: hm.store, hm.vars, hm.commands ...
