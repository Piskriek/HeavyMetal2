import type { BodySpec, EntityId, Unsubscribe, Vec3 } from '@hm/contracts';
import type { PhysicsEngine, PhysWorld } from './physics';
import { definePhysicsComponents, numberField, readBall, writeBall, type BallState } from './components';
import { add, clamp, integrateQuat, length, mul, type V3 } from './math';
import { collidesWithStatic, resolvePairs, resolveStatic, type ContactCallback } from './collision';
import { insideBox } from './boxes';
import { makeStatic, staticContact, staticRay, type StaticBody } from './statics';

type TriggerCallback = (entity: EntityId, trigger: EntityId, enter: boolean) => void;

export class Engine implements PhysicsEngine {
  private world: PhysWorld | null = null;
  private gravity: V3 = [0, -9.81, 0];
  private readonly statics = new Map<EntityId, StaticBody>();
  private readonly forces = new Map<EntityId, V3>();
  private readonly inside = new Map<EntityId, Set<EntityId>>();
  // Listener subscription order is deterministic; physics objects are always traversed by ID.
  private readonly contactListeners = new Set<ContactCallback>();
  private readonly triggerListeners = new Set<TriggerCallback>();

  attach(world: PhysWorld): void {
    definePhysicsComponents(world);
    if (world !== this.world) { this.forces.clear(); this.inside.clear(); }
    this.world = world;
  }

  private requireWorld(): PhysWorld {
    if (!this.world) throw new Error('Physics must attach a world before use');
    return this.world;
  }

  setGravity(g: Vec3): void {
    if (!g.every(Number.isFinite)) throw new Error('Physics gravity must be finite');
    this.gravity = [g[0], g[1], g[2]];
  }

  addBody(entity: EntityId, spec: BodySpec): void {
    const world = this.requireWorld();
    if (!world.alive(entity)) throw new Error(`Physics entity ${entity} is not alive`);
    if (spec.kind !== 'dynamic') {
      const collider = makeStatic(entity, spec);
      if (world.has(entity, 'body')) this.removeBody(entity);
      this.statics.set(entity, collider);
      this.inside.delete(entity);
      return;
    }
    if (spec.collider.shape !== 'sphere') throw new Error('Dynamic physics bodies must be spheres');
    const q = spec.rotation ?? [0, 0, 0, 1];
    const put = (name: string, data: Record<string, number | string | boolean>): void => {
      if (world.has(entity, name)) world.set(entity, name, data);
      else world.add(entity, name, data);
    };
    this.statics.delete(entity);
    this.inside.delete(entity);
    this.forces.delete(entity);
    put('transform', { x: spec.position[0], y: spec.position[1], z: spec.position[2], qx: q[0], qy: q[1], qz: q[2], qw: q[3] });
    put('velocity', { vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
    // Explicit specs without damping preserve un-damped game motion; editor-added bodies use component defaults.
    put('body', {
      mass: spec.mass ?? 1, radius: spec.collider.radius, friction: spec.friction ?? 0.5,
      restitution: spec.restitution ?? 0, linearDamping: spec.linearDamping ?? 0,
      angularDamping: spec.angularDamping ?? 0, tier: spec.tier ?? 'racing',
    });
  }

  removeBody(entity: EntityId): void {
    this.statics.delete(entity);
    this.inside.delete(entity);
    this.forces.delete(entity);
    const world = this.world;
    if (!world || !world.has(entity, 'body')) return;
    // PhysWorld does not require remove(); the real World has it, fake worlds may not.
    const removable = world as PhysWorld & { remove?: (id: EntityId, component: string) => void };
    if (removable.remove) { removable.remove(entity, 'body'); removable.remove(entity, 'velocity'); }
    else {
      // No remove(): the component stays (inert only if the caller despawns the entity). Real worlds always have remove.
    }
  }

  applyForce(entity: EntityId, force: Vec3): void {
    const world = this.requireWorld(), body = world.get(entity, 'body');
    if (!body) throw new Error(`Physics entity ${entity} is not a dynamic body`);
    if (!force.every(Number.isFinite)) throw new Error(`Physics entity ${entity}: invalid force`);
    this.forces.set(entity, add(this.forces.get(entity) ?? [0, 0, 0], force));
  }

  applyImpulse(entity: EntityId, impulse: Vec3): void {
    const world = this.requireWorld(), body = world.get(entity, 'body'), velocity = world.get(entity, 'velocity');
    if (!body || !velocity) throw new Error(`Physics entity ${entity} is not a dynamic body`);
    if (!impulse.every(Number.isFinite)) throw new Error(`Physics entity ${entity}: invalid impulse`);
    const rawMass = numberField(entity, body, 'mass'), mass = rawMass === 0 ? 1 : rawMass;
    if (mass < 0) throw new Error(`Physics entity ${entity}: invalid mass`);
    world.set(entity, 'velocity', {
      vx: numberField(entity, velocity, 'vx') + impulse[0] / mass,
      vy: numberField(entity, velocity, 'vy') + impulse[1] / mass,
      vz: numberField(entity, velocity, 'vz') + impulse[2] / mass,
    });
  }

  onContact(listener: ContactCallback): Unsubscribe {
    this.contactListeners.add(listener);
    return () => { this.contactListeners.delete(listener); };
  }

  onTrigger(listener: TriggerCallback): Unsubscribe {
    this.triggerListeners.add(listener);
    return () => { this.triggerListeners.delete(listener); };
  }

  raycast(origin: Vec3, direction: Vec3, maxDistance: number): { entity: EntityId; distance: number; point: Vec3; normal: Vec3 } | null {
    const magnitude = length(direction);
    if (!Number.isFinite(magnitude) || magnitude === 0 || !Number.isFinite(maxDistance) || maxDistance < 0) return null;
    const dir = mul(direction, 1 / magnitude);
    let result: { entity: EntityId; distance: number; point: Vec3; normal: Vec3 } | null = null;
    for (const s of this.sortedStatics()) {
      if (s.tier === 'trigger') continue;
      const hit = staticRay(s, origin, dir, result?.distance ?? maxDistance);
      if (hit && (!result || hit.distance < result.distance)) result = { entity: s.id, ...hit };
    }
    return result;
  }

  private sortedStatics(): StaticBody[] {
    return [...this.statics.values()].sort((a, b) => a.id - b.id);
  }

  private triggers(bodies: readonly BallState[], statics: readonly StaticBody[]): void {
    for (const s of statics) {
      if (s.tier !== 'trigger' || s.shape !== 'box') continue;
      let inside = this.inside.get(s.id);
      if (!inside) { inside = new Set(); this.inside.set(s.id, inside); }
      for (const b of bodies) {
        const now = insideBox(s, b.p), before = inside.has(b.id);
        if (now === before) continue;
        if (now) inside.add(b.id); else inside.delete(b.id);
        for (const listener of this.triggerListeners) listener(b.id, s.id, now);
      }
      for (const id of [...inside].sort((a, b) => a - b)) {
        if (bodies.some((b) => b.id === id)) continue;
        inside.delete(id);
        for (const listener of this.triggerListeners) listener(id, s.id, false);
      }
    }
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) throw new Error('Physics dt must be finite and positive');
    const world = this.requireWorld();
    const bodies = [...world.query('transform', 'velocity', 'body')].sort((a, b) => a - b)
      .map((id) => readBall(world, id)).filter((b): b is BallState => b !== null);
    const statics = this.sortedStatics();
    let steps = 1;
    for (const b of bodies) steps = Math.max(steps, clamp(Math.ceil(length(b.v) * dt / (0.5 * b.radius)), 1, 16));
    const h = dt / steps;
    const notify: ContactCallback = (a, b, point, normal, impulse) => {
      for (const listener of this.contactListeners) listener(a, b, point, normal, impulse);
    };
    this.triggers(bodies, statics);
    for (let substep = 0; substep < steps; substep++) {
      for (const b of bodies) {
        const force = this.forces.get(b.id) ?? [0, 0, 0];
        b.v = mul(add(b.v, mul(add(this.gravity, mul(force, b.invMass)), h)), 1 / (1 + b.linearDamping * h));
        b.w = mul(b.w, 1 / (1 + b.angularDamping * h));
        b.p = add(b.p, mul(b.v, h));
        b.q = integrateQuat(b.q, b.w, h);
        for (let contact = 0; contact < 8; contact++) {
          let chosen: StaticBody | null = null, depth = 0;
          for (const s of statics) {
            if (!collidesWithStatic(b, s)) continue;
            const hit = staticContactDepth(s, b);
            if (hit > depth) { depth = hit; chosen = s; }
          }
          if (!chosen) break;
          resolveStatic(b, chosen, notify);
        }
      }
      resolvePairs(bodies, notify);
      this.triggers(bodies, statics);
    }
    for (const b of bodies) writeBall(world, b);
    this.forces.clear();
  }
}

function staticContactDepth(s: StaticBody, b: BallState): number {
  return staticContact(s, b.p, b.radius)?.penetration ?? 0;
}