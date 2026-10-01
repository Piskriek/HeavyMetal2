import type { EntityId, Vec3 } from '@hm/contracts';
import { add, cross, dot, length, mul, sub, type V3 } from './math';
import type { BallState } from './components';
import { staticContact, type StaticBody } from './statics';

export type ContactCallback = (a: EntityId, b: EntityId, point: Vec3, normal: Vec3, impulse: number) => void;
const friction = (a: number, b: number): number => Math.sqrt(a * b);
const inertiaInverse = (b: BallState): number => 2.5 * b.invMass / (b.radius * b.radius);

export function collidesWithStatic(ball: BallState, s: StaticBody): boolean {
  return ball.tier !== 'trigger' && (s.tier === 'racing' || (ball.tier === 'decor' && s.tier === 'decor'));
}

export function resolveStatic(ball: BallState, s: StaticBody, onContact: ContactCallback): number {
  const hit = staticContact(s, ball.p, ball.radius);
  if (!hit) return 0;
  ball.p = add(ball.p, mul(hit.normal, hit.penetration));
  const n = hit.normal, arm = mul(n, -ball.radius);
  const relative = add(ball.v, cross(ball.w, arm)), vn = dot(relative, n);
  if (vn >= 0) return hit.penetration;
  const restitution = -vn > 1 ? Math.max(ball.restitution, s.restitution) : 0;
  const jn = -(1 + restitution) * vn / ball.invMass;
  ball.v = add(ball.v, mul(n, jn * ball.invMass));
  const tangent = sub(add(ball.v, cross(ball.w, arm)), mul(n, dot(add(ball.v, cross(ball.w, arm)), n)));
  const tangentSpeed = length(tangent);
  if (tangentSpeed > 1e-12) {
    const wanted = tangentSpeed / (ball.invMass + inertiaInverse(ball) * ball.radius * ball.radius);
    const jt = mul(tangent, -Math.min(wanted, friction(ball.friction, s.friction) * jn) / tangentSpeed);
    ball.v = add(ball.v, mul(jt, ball.invMass));
    ball.w = add(ball.w, mul(cross(arm, jt), inertiaInverse(ball)));
  }
  if (jn > 0.5) onContact(ball.id, s.id, hit.point, n, jn);
  return hit.penetration;
}

export function resolvePair(a: BallState, b: BallState, onContact: ContactCallback): void {
  if (a.tier !== b.tier || a.tier === 'trigger') return;
  const delta = sub(a.p, b.p), distance = length(delta), target = a.radius + b.radius;
  if (distance >= target - 1e-10) return;
  const n: V3 = distance > 1e-12 ? mul(delta, 1 / distance) : [1, 0, 0];
  const invSum = a.invMass + b.invMass, correction = (target - distance) / invSum;
  a.p = add(a.p, mul(n, correction * a.invMass));
  b.p = sub(b.p, mul(n, correction * b.invMass));
  const armA = mul(n, -a.radius), armB = mul(n, b.radius);
  const relative = sub(add(a.v, cross(a.w, armA)), add(b.v, cross(b.w, armB)));
  const vn = dot(relative, n);
  if (vn >= 0) return;
  const e = -vn > 1 ? Math.max(a.restitution, b.restitution) : 0;
  const jn = -(1 + e) * vn / invSum;
  a.v = add(a.v, mul(n, jn * a.invMass));
  b.v = sub(b.v, mul(n, jn * b.invMass));
  const vt = sub(relative, mul(n, vn)), speed = length(vt);
  if (speed > 1e-12) {
    const effective = invSum + inertiaInverse(a) * a.radius * a.radius + inertiaInverse(b) * b.radius * b.radius;
    const jt = mul(vt, -Math.min(speed / effective, friction(a.friction, b.friction) * jn) / speed);
    a.v = add(a.v, mul(jt, a.invMass)); b.v = sub(b.v, mul(jt, b.invMass));
    a.w = add(a.w, mul(cross(armA, jt), inertiaInverse(a)));
    b.w = sub(b.w, mul(cross(armB, jt), inertiaInverse(b)));
  }
  if (jn > 0.5) onContact(a.id, b.id, sub(a.p, mul(n, a.radius)), n, jn);
}

export function resolvePairs(bodies: readonly BallState[], onContact: ContactCallback): void {
  if (bodies.length <= 64) {
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      resolvePair(bodies[i]!, bodies[j]!, onContact);
    }
    return;
  }
  // Sweep on X, but resolve candidate pairs in (a,b) entity-id order.
  const maxRadius = bodies.reduce((r, b) => Math.max(r, b.radius), 0);
  const sorted = [...bodies].sort((a, b) => a.p[0] - b.p[0] || a.id - b.id);
  const candidates = new Map<EntityId, BallState[]>();
  for (let i = 0; i < sorted.length; i++) {
    const left = sorted[i]!;
    for (let j = i + 1; j < sorted.length && sorted[j]!.p[0] - left.p[0] < left.radius + maxRadius; j++) {
      const right = sorted[j]!;
      if (Math.abs(right.p[0] - left.p[0]) >= left.radius + right.radius ||
          Math.abs(right.p[1] - left.p[1]) >= left.radius + right.radius ||
          Math.abs(right.p[2] - left.p[2]) >= left.radius + right.radius) continue;
      const a = left.id < right.id ? left : right, b = left.id < right.id ? right : left;
      const list = candidates.get(a.id);
      if (list) list.push(b); else candidates.set(a.id, [b]);
    }
  }
  for (const a of bodies) {
    const list = candidates.get(a.id);
    if (list) for (const b of list.sort((x, y) => x.id - y.id)) resolvePair(a, b, onContact);
  }
}