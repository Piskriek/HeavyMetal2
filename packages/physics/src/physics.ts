/*
 * Determinism: read dynamic state from World anew each tick; never cache it in the
 * engine. Traverse bodies and statics by ascending entity ID, and pairs by (a,b).
 * The mesh grid is built in index order; a Set is used only for membership checks.
 * There is no clock, randomness, trigonometry, or engine-owned dynamic state.
 */
import type { EntityId, PhysicsService, StepContext, System, Unsubscribe, Vec3, World } from '@hm/contracts';
import { definePhysicsComponents } from './components';
import { Engine } from './engine';

export type PhysWorld = Pick<World, 'defineComponent' | 'components' | 'alive' | 'has' | 'get' | 'set' | 'add' | 'query'>;
export interface PhysicsEngine extends PhysicsService {
  attach(world: PhysWorld): void;
  setGravity(g: Vec3): void;
  onContact(listener: (a: EntityId, b: EntityId, point: Vec3, normal: Vec3, impulse: number) => void): Unsubscribe;
  onTrigger(listener: (entity: EntityId, trigger: EntityId, enter: boolean) => void): Unsubscribe;
}

export { definePhysicsComponents };
export function createPhysics(): PhysicsEngine { return new Engine(); }

/** A System (see contracts) that also accepts the narrower PhysWorld, so tests can drive it with a fake world. */
export type PhysicsSystem = Omit<System, 'update'> & { update(world: PhysWorld, ctx: Pick<StepContext, 'dt' | 'tick'>): void };

export function createPhysicsSystem(engine: PhysicsEngine): PhysicsSystem {
  let attached: PhysWorld | null = null;
  return {
    name: 'physics', order: 100,
    update(world, ctx) {
      if (world !== attached) { engine.attach(world); attached = world; }
      engine.step(ctx.dt);
    },
  };
}