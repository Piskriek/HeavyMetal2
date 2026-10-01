import type { PresetStore } from '@hm/contracts';
import { attachOrbitControls, createThreeRenderer } from '@hm/render';
import { createWorld } from '@hm/sim';
import './demo.css';

const host = document.querySelector<HTMLElement>('#viewport');
if (!host) throw new Error('Missing demo viewport');

const world = createWorld({ seed: 1 });
const emptyStore = {
  get: () => undefined,
  resolve: (id: string) => { throw new Error(`Unknown preset: ${id}`); },
} as unknown as PresetStore;
const renderer = createThreeRenderer({ shadows: true, background: 'sky' });
renderer.mount(host, world, emptyStore);
const detachControls = attachOrbitControls(host, renderer, { touchOrbit: true });

const platform = world.spawn(undefined, {
  transform: { y: 0.55, sx: 5.2, sy: 0.42, sz: 5.2 },
  renderable: { shape: 'box', size: 1, color: '#252b31', roughness: 0.42, metalness: 0.32 },
});
const colors = ['#ff6b4a', '#ffb84a', '#d8e45b', '#65d59a', '#55c7df', '#6897f5', '#9b7af0', '#e46fbb'];
const spheres = Array.from({ length: 16 }, (_, index) => {
  const angle = index / 16 * Math.PI * 2;
  return world.spawn(undefined, {
    transform: { x: Math.cos(angle) * 3.7, y: 1.55, z: Math.sin(angle) * 3.7 },
    renderable: { shape: 'sphere', size: 0.56, color: colors[index % colors.length]!, roughness: 0.2, metalness: 0.16 },
  });
});
renderer.step();

let start = performance.now();
let animation = 0;
const frame = (now: number): void => {
  const time = (now - start) / 1000;
  world.set(platform, 'transform', { y: 0.52 + Math.sin(time * 0.8) * 0.08 });
  spheres.forEach((id, index) => {
    const angle = index / spheres.length * Math.PI * 2 + time * 0.18;
    world.set(id, 'transform', {
      x: Math.cos(angle) * 3.7,
      y: 1.48 + Math.sin(time * 1.7 + index * 0.55) * 0.38,
      z: Math.sin(angle) * 3.7,
    });
  });
  renderer.step();
  renderer.render(1);
  animation = requestAnimationFrame(frame);
};
animation = requestAnimationFrame(frame);

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animation);
  detachControls();
  renderer.unmount();
}, { once: true });