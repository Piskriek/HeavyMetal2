import test from 'node:test';
import assert from 'node:assert/strict';
import type { ComponentDef, EntityId, Value, WorldChange } from '@hm/contracts';
import { MAX_PITCH, MIN_DIST, orbit, project, rayFromPixel, stateFromPositionTarget, type OrbitState } from '../src/camera-math';
import { pickScene, rayHitBox, rayHitPlaneY, rayHitSphere } from '../src/pick-math';
import { createSceneSync, defineRenderComponents, type RenderDesc, type SceneAdapter, type RenderWorld } from '../src/scene-sync';

type TestWorld = RenderWorld & {
  spawn(components: Record<string, Record<string, Value>>): EntityId;
  setC(id: EntityId, component: string, value: Record<string, Value>): void;
  removeC(id: EntityId, component: string): void;
};

const fakeWorld = (): TestWorld => {
  const defs = new Map<string, ComponentDef>();
  const entities = new Map<EntityId, Map<string, Record<string, Value>>>();
  let changes: WorldChange[] = [];
  let nextId = 1;
  return {
    tick: 0,
    defineComponent(def: ComponentDef): void { defs.set(def.name, def); },
    components: () => [...defs.values()],
    alive: (id) => entities.has(id),
    has: (id, component) => entities.get(id)?.has(component) ?? false,
    get: (id, component) => entities.get(id)?.get(component),
    query: (...components) => [...entities.keys()].filter((id) => components.every((name) => entities.get(id)?.has(name))).sort((a, b) => a - b),
    drainChanges: () => { const result = changes; changes = []; return result; },
    spawn(components): EntityId {
      const id = nextId++;
      const values = new Map<string, Record<string, Value>>();
      for (const [name, value] of Object.entries(components)) values.set(name, { ...(defs.get(name)?.defaults ?? {}), ...value });
      entities.set(id, values);
      changes.push({ type: 'spawn', id });
      return id;
    },
    setC(id, component, value): void {
      const entity = entities.get(id)!;
      entity.set(component, { ...(entity.get(component) ?? defs.get(component)?.defaults ?? {}), ...value });
      changes.push({ type: 'set', id, component });
    },
    removeC(id, component): void { entities.get(id)?.delete(component); },
  };
};

const adapter = (): { service: SceneAdapter; values: Map<EntityId, RenderDesc>; updates: number[] } => {
  const values = new Map<EntityId, RenderDesc>();
  const updates: number[] = [];
  return {
    values, updates,
    service: {
      create: (id, desc) => { values.set(id, desc); },
      update: (id, desc) => { values.set(id, desc); updates.push(id); },
      remove: (id) => { values.delete(id); },
    },
  };
};

const base: OrbitState = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10, fov: 60 };
const visible = { renderable: { shape: 'sphere', size: 1, color: '#fff' } };

test('a coincident camera and target uses the minimum distance', () => {
  const state = stateFromPositionTarget([2, 3, 4], [2, 3, 4], 45);
  assert.equal(state.distance, MIN_DIST);
  assert.equal(state.yaw, 0);
  assert.equal(state.pitch, 0);
});

test('orbit clamps both pitch limits after repeated input', () => {
  assert.equal(orbit(orbit(base, 0, 100), 0, 1).pitch, MAX_PITCH);
  assert.equal(orbit(orbit(base, 0, -100), 0, -1).pitch, -MAX_PITCH);
});

test('projection remains stable for a very distant point', () => {
  const point = project(base, [1000, 500, -1_000_000], 1920, 1080);
  assert.ok(point);
  assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
  assert.ok(Math.abs(point[0] - 960) < 2);
});

test('projection rejects empty viewports', () => {
  assert.equal(project(base, [0, 0, 0], 0, 100), null);
  assert.equal(project(base, [0, 0, 0], 100, 0), null);
});

test('corner rays are normalized', () => {
  const ray = rayFromPixel(base, 0, 0, 800, 600);
  assert.ok(Math.abs(Math.hypot(...ray.direction) - 1) < 1e-12);
  assert.ok(ray.direction[0] < 0 && ray.direction[1] > 0 && ray.direction[2] < 0);
});

test('zero-length directions do not invent intersections', () => {
  assert.equal(rayHitSphere([0, 0, 3], [0, 0, 0], [0, 0, 0], 1), null);
  assert.equal(rayHitBox([3, 0, 0], [0, 0, 0], [0, 0, 0], [1, 1, 1]), null);
  assert.equal(rayHitBox([0, 0, 0], [0, 0, 0], [0, 0, 0], [1, 1, 1]), 0);
});

test('a ray beginning on the ground hits at zero', () => {
  assert.equal(rayHitPlaneY([2, 0, 3], [0, 1, 0], 0), 0);
});

test('cylinders pick as spheres and planes pick as thin boxes', () => {
  const cylinder = pickScene({ origin: [0, 0, 5], direction: [0, 0, -1] }, [{ entity: 3, shape: 'cylinder', center: [0, 0, 0], size: 1 }], null);
  assert.equal(cylinder.entity, 3);
  assert.deepEqual(cylinder.normal, [0, 0, 1]);
  const plane = pickScene({ origin: [0, 2, 0], direction: [0, -1, 0] }, [{ entity: 4, shape: 'plane', center: [0, 0, 0], size: 2 }], null);
  assert.equal(plane.entity, 4);
  assert.deepEqual(plane.normal, [0, 1, 0]);
});

test('scene sync reconciles many entities in ascending query order', () => {
  const world = fakeWorld(); defineRenderComponents(world);
  for (let i = 0; i < 100; i += 1) world.spawn({ transform: { x: i }, ...visible });
  const output = adapter();
  const sync = createSceneSync(world, output.service);
  sync.step();
  assert.equal(output.values.size, 100);
  assert.equal(sync.items().length, 100);
  assert.deepEqual(sync.items()[99]?.center, [99, 0, 0]);
});

test('interpolation at alpha zero and one reaches both endpoints', () => {
  const world = fakeWorld(); defineRenderComponents(world);
  const id = world.spawn({ transform: { x: 2 }, ...visible });
  const output = adapter();
  const sync = createSceneSync(world, output.service);
  sync.step();
  world.setC(id, 'transform', { x: 8 });
  sync.step(); sync.present(0);
  assert.equal(output.values.get(id)?.position[0], 2);
  sync.present(1);
  assert.equal(output.values.get(id)?.position[0], 8);
});

test('invisible entities stay synchronized but are omitted from pick items', () => {
  const world = fakeWorld(); defineRenderComponents(world);
  const id = world.spawn({ transform: {}, renderable: { visible: false } });
  const output = adapter();
  const sync = createSceneSync(world, output.service);
  sync.step();
  assert.ok(output.values.has(id));
  assert.deepEqual(sync.items(), []);
});

test('quaternion nlerp takes the shortest equivalent path', () => {
  const world = fakeWorld(); defineRenderComponents(world);
  const id = world.spawn({ transform: { qw: 1 }, ...visible });
  const output = adapter();
  const sync = createSceneSync(world, output.service);
  sync.step();
  world.setC(id, 'transform', { qw: -1 });
  sync.step(); sync.present(0.5);
  assert.deepEqual(output.values.get(id)?.rotation, [0, 0, 0, 1]);
});

test('component removal is found even without a queued change', () => {
  const world = fakeWorld(); defineRenderComponents(world);
  const id = world.spawn({ transform: {}, ...visible });
  const output = adapter();
  const sync = createSceneSync(world, output.service);
  sync.step(); world.removeC(id, 'renderable'); sync.step();
  assert.ok(!output.values.has(id));
});