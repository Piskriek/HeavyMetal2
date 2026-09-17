import { Mesh, add, mix, mul, unit, vec, type Material, type Vec3 } from './geometry';
import type { Materials } from './materials';
import { GROUND, LAUNCHER, START_X, loopGeometry, rampSurface, type Obstacle } from './scene';

const TAU = Math.PI * 2;

function bolt(mesh: Mesh, at: Vec3, material: Material, radius = 3.6) {
  mesh.cylinder(at, add(at, vec(0, 0, -3)), radius, material, 6);
}

function gear(mesh: Mesh, center: Vec3, radius: number, material: Material, teeth = 12) {
  const outline = Array.from({ length: teeth * 4 }, (_, index) => {
    const angle = index / (teeth * 4) * TAU;
    const r = radius * (index % 4 < 2 ? 1 : 0.86);
    return vec(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r, center.z);
  });
  mesh.face(outline, { ...material, image: undefined }, vec(0, 0, -1));
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    mesh.face([a, b, add(b, vec(0, 0, 7)), add(a, vec(0, 0, 7))], material, unit(vec((a.x + b.x) / 2 - center.x, (a.y + b.y) / 2 - center.y, 0)));
  }
  mesh.cylinder(add(center, vec(0, 0, -3)), add(center, vec(0, 0, -7)), radius * 0.32, { color: '#263930', edge: '#e0c68b66' }, 10);
}

export class Machinery {
  readonly launcher: Mesh;
  private readonly obstacles = new WeakMap<Obstacle, Mesh>();
  private crankMesh: Mesh | null = null;
  private crankAngle = Infinity;

  constructor(private readonly materials: Materials) {
    this.launcher = this.makeLauncher();
  }

  obstacle(obstacle: Obstacle) {
    let mesh = this.obstacles.get(obstacle);
    if (!mesh) {
      mesh = obstacle.kind === 'loop' ? this.makeLoop(obstacle) : this.makeRamp(obstacle);
      this.obstacles.set(obstacle, mesh);
    }
    return mesh;
  }

  private makeLauncher() {
    const mesh = new Mesh();
    const m = this.materials;
    const { x, tipY, halfWidth, baseRear, baseFront } = LAUNCHER;

    // The forks span Z, perpendicular to the +X firing line. The winch is on -X,
    // so this is physically the loading/rear side from every supported camera angle.
    for (const z of [-88, 88]) {
      mesh.box(vec(baseRear - 9, GROUND - 17, z - 17), vec(baseFront + 7, GROUND - 3, z + 17), m.iron);
      mesh.box(vec(baseRear, GROUND - 32, z - 13), vec(baseFront, GROUND - 15, z + 13), m.timberDark);
    }
    for (let index = 0; index < 8; index++) {
      const at = baseRear + index * 32;
      mesh.box(vec(at, GROUND - 42, -102), vec(at + 30, GROUND - 28, 102), index % 3 ? m.timber : m.timberDark);
    }
    for (const at of [baseRear + 8, x - 20, baseFront - 7]) {
      mesh.box(vec(at - 5, GROUND - 46, -104), vec(at + 5, GROUND - 40, 104), m.iron);
      for (const z of [-87, 87]) mesh.cylinder(vec(at, GROUND - 47, z), vec(at, GROUND - 50, z), 4.4, m.brass, 6);
    }

    mesh.box(vec(x - 24, GROUND - 70, -36), vec(x + 22, GROUND - 40, 36), m.iron);
    const root = vec(x, GROUND - 50, 0);
    const split = vec(x + 2, GROUND - 131, 0);
    mesh.beam(root, split, 45, 51, m.timber, 0.91);
    mesh.beam(mix(root, split, 0.13), mix(root, split, 0.25), 48, 55, m.iron);
    mesh.beam(mix(root, split, 0.72), mix(root, split, 0.82), 43, 49, m.iron);

    for (const side of [-1, 1]) {
      const elbow = vec(x + 9, GROUND - 177, side * 56);
      const tip = vec(x + 16, tipY, side * halfWidth);
      mesh.beam(split, elbow, 31, 35, m.timber, 0.97);
      mesh.beam(elbow, tip, 30, 34, m.timber, 0.81);
      mesh.beam(mix(split, elbow, 0.42), mix(split, elbow, 0.58), 35, 39, m.iron);
      mesh.beam(mix(elbow, tip, 0.19), mix(elbow, tip, 0.35), 32, 37, m.iron);
      mesh.beam(mix(elbow, tip, 0.84), mix(elbow, tip, 1.035), 28, 33, m.iron);
      mesh.cylinder(add(tip, vec(-16, 0, 0)), add(tip, vec(-22, 0, 0)), 8.7, m.brass, 10);
      mesh.beam(vec(baseRear + 53, GROUND - 47, side * 79), vec(x + 1, GROUND - 125, side * 23), 15, 17, m.timberDark);
      mesh.box(vec(x - 28, GROUND - 56, side * 79 - 14), vec(x + 29, GROUND - 43, side * 79 + 14), m.iron);
      bolt(mesh, vec(x + 4, GROUND - 93, side < 0 ? -29 : 23), m.brass, 5);
    }

    const winchX = START_X - 35;
    const winchY = GROUND - 89;
    for (const z of [-52, 52]) {
      mesh.box(vec(winchX - 17, winchY - 13, z - 8), vec(winchX + 17, GROUND - 42, z + 8), m.timberDark);
      mesh.box(vec(winchX - 19, winchY - 17, z - 10), vec(winchX + 19, winchY - 7, z + 10), m.iron);
    }
    mesh.cylinder(vec(winchX, winchY, -69), vec(winchX, winchY, 62), 9, m.iron);
    mesh.cylinder(vec(winchX, winchY, -43), vec(winchX, winchY, 43), 24, m.timberDark, 16);
    for (let z = -37; z < 40; z += 7) mesh.cylinder(vec(winchX, winchY, z), vec(winchX, winchY, z + 4), 27, m.rope, 14);
    gear(mesh, vec(winchX, winchY, -68), 37, m.brass, 12);
    gear(mesh, vec(winchX + 42, winchY + 26, -62), 17, m.iron, 8);

    mesh.box(vec(baseRear + 13, GROUND - 68, -77), vec(baseRear + 64, GROUND - 43, -52), m.iron);
    for (let i = 0; i < 4; i++) {
      mesh.box(vec(baseRear + 21 + i * 9, GROUND - 71, -74), vec(baseRear + 24 + i * 9, GROUND - 68, -54), m.brass);
    }
    for (const at of [baseRear + 13, x - 4, baseFront - 15]) bolt(mesh, vec(at, GROUND - 24, -108), m.brass, 4.3);

    const pipeA = vec(baseRear + 35, GROUND - 66, 79);
    const pipeB = vec(baseRear + 35, GROUND - 113, 79);
    mesh.cylinder(pipeA, pipeB, 8, m.iron, 10);
    mesh.cylinder(pipeB, add(pipeB, vec(-15, -7, 0)), 9, m.iron, 10, 10);
    mesh.cylinder(add(pipeB, vec(-15, -7, 0)), add(pipeB, vec(-20, -9, 0)), 11, m.brass, 10);
    return mesh;
  }

  crank(power: number, releaseTime: number, moving: boolean) {
    const angle = -0.9 + power * 2.5 + (moving ? Math.sin(releaseTime * 18) * Math.exp(-releaseTime * 6) * 0.24 : 0);
    if (this.crankMesh && Math.abs(angle - this.crankAngle) < 0.08) return this.crankMesh;
    this.crankAngle = angle;
    const mesh = new Mesh();
    const m = this.materials;
    const center = vec(START_X - 35, GROUND - 89, -79);
    const end = add(center, vec(Math.cos(angle) * 30, Math.sin(angle) * 30, 0));
    mesh.beam(center, end, 7, 8, m.iron);
    mesh.cylinder(end, add(end, vec(0, 0, -21)), 5.5, m.timber, 9);
    bolt(mesh, center, m.brass, 6);
    this.crankMesh = mesh;
    return mesh;
  }

  private makeRamp(obstacle: Obstacle) {
    const mesh = new Mesh();
    const m = this.materials;
    const halfWidth = 66;
    const count = 16;
    const step = obstacle.width / count;
    for (let i = 0; i < count; i++) {
      const x = obstacle.x + i * step;
      const next = x + step;
      const y = rampSurface(obstacle, x);
      const ny = rampSurface(obstacle, next);
      const normal = unit(vec(ny - y, -(next - x), 0));
      mesh.face([vec(x, y, halfWidth), vec(next, ny, halfWidth), vec(next, ny, -halfWidth), vec(x, y, -halfWidth)], i % 4 === 0 ? m.timberDark : m.timber, normal);
      for (const z of [-halfWidth, halfWidth]) {
        mesh.face([vec(x, y, z), vec(next, ny, z), vec(next, ny + 13, z), vec(x, y + 13, z)], m.timberDark, vec(0, 0, Math.sign(z)));
        mesh.face([vec(x, y - 2, z - 3), vec(next, ny - 2, z - 3), vec(next, ny - 2, z + 3), vec(x, y - 2, z + 3)], m.iron, normal);
      }
      if (i % 4 === 2) for (const z of [-57, 57]) mesh.cylinder(vec(x + 5, y - 1, z), vec(x + 5, y - 3, z), 3.1, m.brass, 6);
    }
    for (const z of [-60, 60]) {
      mesh.box(vec(obstacle.x - 10, GROUND - 9, z - 9), vec(obstacle.x + obstacle.width + 13, GROUND - 1, z + 9), m.timberDark);
      for (const t of [0.36, 0.66, 0.98]) {
        const x = obstacle.x + obstacle.width * t;
        mesh.beam(vec(x, GROUND - 9, z), vec(x, rampSurface(obstacle, x) + 12, z), 12, 14, m.timberDark);
        if (z < 0) bolt(mesh, vec(x, rampSurface(obstacle, x) + 16, z - 9), m.brass, 3.2);
      }
      mesh.beam(vec(obstacle.x + obstacle.width * 0.33, GROUND - 10, z), vec(obstacle.x + obstacle.width * 0.96, GROUND - obstacle.height + 20, z), 10, 11, m.iron);
    }
    return mesh;
  }

  private makeLoop(obstacle: Obstacle) {
    const mesh = new Mesh();
    const m = this.materials;
    const loop = loopGeometry(obstacle);
    const count = 40;
    const point = (angle: number, radius: number, z: number) => vec(loop.x + Math.sin(angle) * radius, loop.y + Math.cos(angle) * radius, z);
    const outer = loop.radius + 8;
    const inner = loop.radius - 8;
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU;
      const b = (i + 1) / count * TAU;
      const middle = (a + b) / 2;
      const radial = vec(Math.sin(middle), Math.cos(middle), 0);
      mesh.face([point(a, inner, loop.halfWidth), point(b, inner, loop.halfWidth), point(b, inner, -loop.halfWidth), point(a, inner, -loop.halfWidth)], i % 5 ? m.timber : m.timberDark, mul(radial, -1));
      mesh.face([point(a, outer, -loop.halfWidth), point(b, outer, -loop.halfWidth), point(b, outer, loop.halfWidth), point(a, outer, loop.halfWidth)], m.timberDark, radial);
      for (const z of [-loop.halfWidth, loop.halfWidth]) {
        mesh.face([point(a, inner, z), point(b, inner, z), point(b, outer, z), point(a, outer, z)], m.timber, vec(0, 0, Math.sign(z)));
        mesh.face([point(a, inner - 2, z + Math.sign(z)), point(b, inner - 2, z + Math.sign(z)), point(b, inner + 1, z + Math.sign(z)), point(a, inner + 1, z + Math.sign(z))], m.iron, vec(0, 0, Math.sign(z)));
      }
      if (i % 5 === 0) {
        const end = a + 0.044;
        mesh.face([point(a, outer + 1, -loop.halfWidth - 1), point(end, outer + 1, -loop.halfWidth - 1), point(end, outer + 1, loop.halfWidth + 1), point(a, outer + 1, loop.halfWidth + 1)], m.iron, radial);
        mesh.face([point(a, inner - 1, -loop.halfWidth - 1), point(end, inner - 1, -loop.halfWidth - 1), point(end, outer + 1, -loop.halfWidth - 1), point(a, outer + 1, -loop.halfWidth - 1)], m.iron, vec(0, 0, -1));
        bolt(mesh, point(a + 0.022, loop.radius, -loop.halfWidth - 3), m.brass, 3.2);
      }
    }

    for (const side of [-1, 1]) {
      const z = side * (loop.halfWidth + 8);
      mesh.box(vec(loop.x - loop.radius * 0.96, GROUND - 10, z - 11), vec(loop.x + loop.radius * 0.96, GROUND - 1, z + 11), m.timberDark);
      for (const direction of [-1, 1]) {
        mesh.beam(vec(loop.x + direction * loop.radius * 0.86, GROUND - 10, z), vec(loop.x + direction * loop.radius * 0.93, loop.y + 23, z), 16, 20, m.timberDark);
        mesh.beam(vec(loop.x + direction * loop.radius * 0.33, GROUND - 9, z), vec(loop.x + direction * loop.radius * 0.93, loop.y + 26, z), 10, 13, m.iron);
        if (side < 0) bolt(mesh, vec(loop.x + direction * loop.radius * 0.91, loop.y + 28, z - 12), m.brass, 4.8);
      }
    }
    for (const direction of [-1, 1]) {
      const a = vec(loop.x, GROUND - 16, -51);
      const b = vec(loop.x + direction * (loop.radius + 32), GROUND - 1, -51);
      const c = add(b, vec(0, 0, 102));
      const d = add(a, vec(0, 0, 102));
      mesh.face([a, b, c, d], m.timber, vec(0, -1, 0));
    }
    return mesh;
  }
}