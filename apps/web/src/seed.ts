import type { Runtime } from '@hm/engine';
import type { Params, PresetId } from '@hm/contracts';

/** A small starter scene so the shell shows something real: ground, materials, balls, decoration. */
export function seedDemo(rt: Runtime): PresetId {
  const mat = (name: string, params: Params): PresetId => rt.store.put({ kind: 'material', name, params, tags: ['starter'], tier: 'play' }).id;
  const gold = mat('Gold', { color: '#ffc23d', metalness: 1, roughness: 0.28 });
  const red = mat('Red plastic', { color: '#e8402a', metalness: 0, roughness: 0.35 });
  const stone = mat('Basalt', { color: '#4b5058', metalness: 0, roughness: 0.85 });
  const jade = mat('Jade', { color: '#2fb07a', metalness: 0.1, roughness: 0.3 });

  const put = (name: string, params: Params): PresetId => rt.store.put({ kind: 'entity', name, params, tier: 'play' }).id;
  const ids = [
    put('Ground', { shape: 'box', size: 30, scaleY: 0.04, y: -1.2, body: 'static', material: { ref: stone }, friction: 0.8 }),
    put('Wall A', { shape: 'box', size: 1, scaleX: 12, scaleY: 1.2, scaleZ: 0.4, y: 0.2, z: -9, body: 'static', material: { ref: stone } }),
    put('Wall B', { shape: 'box', size: 1, scaleX: 0.4, scaleY: 1.2, scaleZ: 9, y: 0.2, x: 12, z: 0, body: 'static', material: { ref: stone } }),
    put('Gold ball', { shape: 'sphere', size: 0.6, x: -3, y: 4, body: 'dynamic', restitution: 0.55, material: { ref: gold } }),
    put('Red ball', { shape: 'sphere', size: 0.5, x: 0, y: 6, z: 1, body: 'dynamic', restitution: 0.4, material: { ref: red } }),
    put('Jade ball', { shape: 'sphere', size: 0.7, x: 3, y: 8, z: -1, body: 'dynamic', restitution: 0.3, mass: 3, material: { ref: jade } }),
    put('Post 1', { shape: 'cylinder', size: 0.35, scaleY: 2.5, x: -6, z: 4, y: 0.7, material: { ref: gold } }),
    put('Post 2', { shape: 'cylinder', size: 0.35, scaleY: 2.5, x: 6, z: 4, y: 0.7, material: { ref: gold } }),
  ];
  const cam = rt.store.put({ kind: 'camera', name: 'Overview', params: { fov: 50, distance: 20, yaw: 0.5, pitch: 0.55, targetY: 1 } });
  return rt.store.put({
    kind: 'scene', name: 'Starter arena', params: { gravity: 9.81, camera: { ref: cam.id } },
    children: { entities: ids.map((id) => ({ ref: id })) },
  }).id;
}
