import * as THREE from 'three';

/**
 * Particle bursts: the little puffs, sparkles and chips that make every edit satisfying. One pooled point cloud, soft round points that fade and shrink,
 * simple ballistic physics. A burst is data (BurstDef), so a `sprite` preset is just one of these.
 */
export interface BurstDef {
  readonly position: readonly [number, number, number];
  /** Direction the burst leans (a surface normal). Default up. */
  readonly normal?: readonly [number, number, number];
  readonly count: number;
  readonly colors: readonly string[];
  readonly size: number;
  readonly lifeMs: number;
  readonly speed: number;
  /** 0 = a narrow jet along the normal, 1 = a full hemisphere */
  readonly spread: number;
  readonly gravity: number;
  readonly additive?: boolean;
}

const MAX = 3000;
const VERT = `
attribute float aAlpha; attribute float aSize; attribute vec3 aColor; varying float vAlpha; varying vec3 vColor;
void main() { vAlpha = aAlpha; vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (420.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying float vAlpha; varying vec3 vColor;
void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.15, d) * vAlpha; gl_FragColor = vec4(vColor, a); }`;

export class Bursts {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly alpha = new Float32Array(MAX);
  private readonly size = new Float32Array(MAX);
  private readonly base = new Float32Array(MAX);
  private readonly age = new Float32Array(MAX);
  private readonly life = new Float32Array(MAX);
  private readonly grav = new Float32Array(MAX);
  private next = 0;
  private seed = 1234567;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    this.life.fill(0);
  }

  private rnd(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  emit(d: BurstDef): void {
    const n = Math.min(d.count, 400);
    const nx = d.normal?.[0] ?? 0, ny = d.normal?.[1] ?? 1, nz = d.normal?.[2] ?? 0;
    const colors = d.colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const k = this.next; this.next = (this.next + 1) % MAX;
      // a random direction in a cone around the normal
      const a = this.rnd() * Math.PI * 2, r = Math.sqrt(this.rnd()) * d.spread;
      let dx = Math.cos(a) * r, dz = Math.sin(a) * r, dy = Math.sqrt(Math.max(0.05, 1 - r * r));
      // rotate (0,1,0) onto the normal
      const t = new THREE.Vector3(dx, dy, dz).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz).normalize()));
      const sp = d.speed * (0.45 + this.rnd() * 0.75);
      this.pos.set([d.position[0], d.position[1], d.position[2]], k * 3);
      this.vel.set([t.x * sp, t.y * sp, t.z * sp], k * 3);
      const c = colors[Math.floor(this.rnd() * colors.length)] ?? colors[0]!;
      const sh = 0.85 + this.rnd() * 0.3;
      this.col.set([c.r * sh, c.g * sh, c.b * sh], k * 3);
      this.base[k] = d.size * (0.6 + this.rnd() * 0.8); this.size[k] = this.base[k]!;
      this.life[k] = d.lifeMs * (0.7 + this.rnd() * 0.6); this.age[k] = 0; this.grav[k] = d.gravity; this.alpha[k] = 1;
    }
    this.flag();
  }

  private flag(): void {
    const g = this.points.geometry;
    for (const a of ['position', 'aColor', 'aAlpha', 'aSize']) (g.getAttribute(a) as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const life = this.life[i]!;
      if (life <= 0) { if (this.alpha[i]! !== 0) { this.alpha[i] = 0; any = true; } continue; }
      any = true;
      this.age[i]! += dtMs;
      const t = this.age[i]! / life;
      if (t >= 1) { this.life[i] = 0; this.alpha[i] = 0; continue; }
      this.vel[i * 3 + 1]! -= this.grav[i]! * dt;
      this.pos[i * 3]! += this.vel[i * 3]! * dt; this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt; this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.vel[i * 3]! *= 1 - dt * 1.4; this.vel[i * 3 + 2]! *= 1 - dt * 1.4;
      this.alpha[i] = 1 - t * t; this.size[i] = this.base[i]! * (1 - t * 0.5);
    }
    if (any) this.flag();
  }

  dispose(): void { this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); }
}
