// Smooth animals (STATUS SM12): @hm/fauna decides how they move (boid steering, gait, legs placed by IK with planted feet);
// their bodies are voxel models meshed smooth by @hm/smoothvox, their legs smooth limbs set joint to joint every frame.
// Herds stay near home (a soft leash), so a view always has its animals in it.
import * as THREE from 'three';
import { FAUNA, poseCreature, steerCreature, type AgentCtx, type Creature, type FaunaId } from '@hm/fauna';
import { createModel, ellipsoid, line, speckle, sphere, type Entry, type Model } from '@hm/voxelart';
import { meshModel } from '@hm/smoothvox';
import { hash } from './moon';
import { toGeometry } from './smooth-models';

/** The animals drawn so far (the shoal swims under water, not yet drawn). */
export type Animal = Exclude<FaunaId, 'GLIMMER_SHOAL'>;

const entry = (r: number, g: number, b: number, roughness = 0.75): Entry => ({ name: 'hide', color: [r, g, b], roughness, metalness: 0, emissive: 0, alpha: 1 });
const hex = (c: string): [number, number, number] => { const n = parseInt(c.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// Bodies face +x (the way the animal walks), y up, z across. Pivot: the middle of the body's underside.
function striderModel(): Model {
  const [r, g, b] = hex(FAUNA.MOON_STRIDER.colour);
  const m = createModel('strider', 'Moon Strider', [32, 20, 14], [15, 0, 7], [entry(r, g, b), entry(r * 0.55, g * 0.5, b * 0.45), entry(0.12, 0.1, 0.09)]);
  ellipsoid(m, [15, 9, 7], [11, 4.5, 4.6], 1);
  line(m, [23, 10, 7], [28, 15, 7], 1, 2.6);
  ellipsoid(m, [29, 16, 7], [3, 2, 1.9], 1);
  line(m, [5, 9, 7], [1, 7, 7], 1, 1.4);
  speckle(m, 5, 2, 0.22, 1);
  sphere(m, [30.5, 16.6, 5.8], 0.6, 3); sphere(m, [30.5, 16.6, 8.2], 0.6, 3);
  return m;
}

function tortoiseModel(): Model {
  const [r, g, b] = hex(FAUNA.CRYSTAL_TORTOISE.colour);
  const m = createModel('tortoise', 'Crystal Tortoise', [36, 20, 26], [17, 0, 13], [entry(0.36, 0.33, 0.28), entry(r, g, b, 0.25), entry(r * 0.6, g * 0.8, b, 0.3)]);
  ellipsoid(m, [17, 6, 13], [15, 7, 11], 1);
  ellipsoid(m, [32, 6, 13], [3.5, 2.6, 2.6], 1);
  // crystals grow out of the shell
  for (let k = 0; k < 9; k++) {
    const a = hash(k, 1, 17) * Math.PI * 2, d = hash(k, 2, 17) * 8;
    const x = 17 + Math.cos(a) * d, z = 13 + Math.sin(a) * d * 0.8, h = 4 + hash(k, 3, 17) * 6;
    line(m, [x, 9, z], [x + (hash(k, 4, 17) - 0.5) * 3, 9 + h, z + (hash(k, 5, 17) - 0.5) * 3], k % 3 === 0 ? 3 : 2, 1.3 + hash(k, 6, 17) * 0.8);
  }
  return m;
}

function mantaModel(): Model {
  const [r, g, b] = hex(FAUNA.SKY_MANTA.colour);
  const m = createModel('manta', 'Sky Manta', [30, 6, 50], [15, 0, 25], [entry(r, g, b, 0.5), entry(r * 0.4, g * 0.35, b * 0.6, 0.5)]);
  ellipsoid(m, [15, 3, 25], [9, 2, 6], 1);
  // the wings: thinning towards their tips, swept back
  for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 20; k++) {
    const t = k / 19, z = 25 + s * (5 + t * 19), x = 17 - t * 7;
    ellipsoid(m, [x, 3, z], [6 * (1 - t * 0.75), 1.4 * (1 - t * 0.5), 1.4], 1);
  }
  line(m, [6, 3, 25], [0, 3, 25], 2, 1);
  speckle(m, 9, 2, 0.18, 1);
  return m;
}

/** Metres per voxel, so each body is the size @hm/fauna says. */
const SPEC: Readonly<Record<Animal, { build: () => Model; metres: number; leg: number; legColour: string }>> = {
  MOON_STRIDER: { build: striderModel, metres: FAUNA.MOON_STRIDER.bodyM / 22, leg: 0.07, legColour: '#5c4321' },
  CRYSTAL_TORTOISE: { build: tortoiseModel, metres: FAUNA.CRYSTAL_TORTOISE.bodyM / 30, leg: 0.2, legColour: '#4a453c' },
  SKY_MANTA: { build: mantaModel, metres: FAUNA.SKY_MANTA.bodyM / 40, leg: 0, legColour: '#000000' },
};

const bodies = new Map<Animal, THREE.BufferGeometry>();
/** An animal's body, meshed the first time it is asked for (behind a loading bar). */
export function animalBody(id: Animal): THREE.BufferGeometry {
  let g = bodies.get(id);
  if (!g) {
    const m = SPEC[id].build();
    const mesh = meshModel({ size: m.size, pivot: m.pivot, palette: m.palette.map((e) => ({ color: e.color, alpha: e.alpha, roughness: e.roughness, metalness: e.metalness, emissive: e.emissive })), cells: m.cells }, { scale: 1, blur: 0.8, preserveThin: true, smoothIterations: 2 });
    for (let i = 0; i < mesh.positions.length; i++) mesh.positions[i] = mesh.positions[i]! * SPEC[id].metres;
    g = toGeometry(mesh);
    bodies.set(id, g);
  }
  return g;
}

/** A herd: which animal, where its home is, how many, how far they roam. */
export interface Herd { readonly id: Animal; readonly x: number; readonly z: number; readonly count: number; readonly roam: number }

export interface Creatures { update(now: number, dt: number): void; dispose(): void }

/** Puts herds in a scene. `ground` is the curved ground's height (what the feet stand on). */
export function createCreatures(scene: THREE.Scene, herds: readonly Herd[], ground: (x: number, z: number) => number, reducedMotion: boolean): Creatures {
  const owned: { dispose(): void }[] = [];
  const groups = herds.map((herd, h) => {
    const s = FAUNA[herd.id], spec = SPEC[herd.id];
    const members: Creature[] = [];
    for (let k = 0; k < herd.count; k++) {
      const a = hash(h, k, 71) * Math.PI * 2, d = Math.sqrt(hash(h, k, 72)) * herd.roam * 0.6;
      const x = herd.x + Math.cos(a) * d, z = herd.z + Math.sin(a) * d;
      members.push({
        uid: h * 1000 + k, id: herd.id, x, z, y: ground(x, z), vx: 0, vz: 0, heading: hash(h, k, 73) * Math.PI * 2,
        gaitPhase: hash(h, k, 74), gait: s.legs === 0 ? 'GLIDE' : 'WALK', state: 'WANDER', energy: 0.6 + hash(h, k, 75) * 0.4,
        age: hash(h, k, 76), variant: hash(h, k, 77), lod: 1,
      });
    }
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
    owned.push(material);
    const body = new THREE.InstancedMesh(animalBody(herd.id), material, herd.count);
    body.frustumCulled = false;
    scene.add(body);
    let legs: THREE.InstancedMesh | null = null;
    if (s.legs > 0) {
      const limb = new THREE.CapsuleGeometry(0.5, 1, 4, 10), legMaterial = new THREE.MeshStandardMaterial({ color: spec.legColour, roughness: 0.6 });
      owned.push(limb, legMaterial);
      legs = new THREE.InstancedMesh(limb, legMaterial, herd.count * s.legs * 2);
      legs.frustumCulled = false;
      scene.add(legs);
    }
    return { herd, members, body, legs };
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  /** A limb from joint a to joint b, `r` thick. */
  const limb = (from: readonly number[], to: readonly number[], r: number): THREE.Matrix4 => {
    a.set(from[0]!, from[1]!, from[2]!); b.set(to[0]!, to[1]!, to[2]!);
    dir.subVectors(b, a);
    const len = Math.max(0.01, dir.length());
    q.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
    return m.compose(p.addVectors(a, b).multiplyScalar(0.5), q, sc.set(r * 2, len, r * 2));
  };
  const ctx: AgentCtx = { biomass: () => 0.85, water: () => 0.6, heightAt: ground, timeOfDay: 0.45, threats: [], dt: 0 };

  const draw = (): void => {
    for (const { herd, members, body, legs } of groups) {
      const s = FAUNA[herd.id], spec = SPEC[herd.id];
      members.forEach((c, k) => {
        const pose = poseCreature(c, ground);
        // the body: centred over the hips, pitched with the ground under the feet, facing where it walks
        const lift = s.legs === 0 ? 0 : -spec.metres * (herd.id === 'MOON_STRIDER' ? 7 : 4);
        // the body faces +x: turning is about y, pitch (nose up) about z, roll about x
        e.set(s.legs === 0 ? Math.sin(c.gaitPhase * 6.283) * 0.15 : pose.spineBend * 0.3, -c.heading, pose.spinePitch);
        body.setMatrixAt(k, m.compose(p.set(c.x, pose.bodyY + lift, c.z), q.setFromEuler(e), sc.set(1, 1, 1)));
        if (legs) pose.legs.forEach((leg, i) => {
          legs.setMatrixAt((k * s.legs + i) * 2, limb(leg.hip, leg.knee, spec.leg));
          legs.setMatrixAt((k * s.legs + i) * 2 + 1, limb(leg.knee, leg.foot, spec.leg * 0.8));
        });
      });
      body.instanceMatrix.needsUpdate = true;
      if (legs) legs.instanceMatrix.needsUpdate = true;
    }
  };
  draw();

  return {
    update(_now, dt) {
      if (reducedMotion || dt <= 0) return;
      ctx.dt = Math.min(0.05, dt);
      for (const g of groups) {
        g.members = g.members.map((c) => {
          const n = steerCreature(c, g.members, ctx);
          // a soft leash: past its roam the animal turns for home
          const hx = g.herd.x - n.x, hz = g.herd.z - n.z, d = Math.hypot(hx, hz);
          if (d > g.herd.roam) { const pull = Math.min(1, (d - g.herd.roam) / 20) * ctx.dt * 2; n.vx += (hx / d) * FAUNA[n.id].speedMs * pull; n.vz += (hz / d) * FAUNA[n.id].speedMs * pull; }
          return n;
        });
      }
      draw();
    },
    dispose() {
      for (const g of groups) { scene.remove(g.body); g.body.dispose(); if (g.legs) { scene.remove(g.legs); g.legs.dispose(); } }
      for (const x of owned) x.dispose();
    },
  };
}
