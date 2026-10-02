import * as THREE from 'three';

/** A painted strip draped on the ground: the start line, rumble strips and boost pads. Points carry their own ground height. */
export interface RoadDecalDef {
  readonly kind: 'startLine' | 'rumble' | 'boostPad';
  readonly points: readonly (readonly [number, number, number])[];
  readonly width: number;
  /** Metres along the strip for one repeat of the pattern. */
  readonly period: number;
}

const LIFT = 0.05;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

/** A little seeded noise so the paint looks worn instead of flat (deterministic: no Math.random). */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  let s = 12345;
  for (let i = 0; i < (w * h) / 6; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const x = s % w, y = (s >>> 12) % h;
    ctx.fillStyle = `rgba(0,0,0,${((s >>> 24) / 255) * amount})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 2x2 black and white checks (a tile = 2 squares across and 2 along). */
function checkerTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#17191c'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  grain(g, 128, 128, 0.35);
  return finish(c);
}

/** One red band and one white band along the strip, with ribbing lines. */
function rumbleTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 128);
  g.fillStyle = '#d6372f'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#f1eee4'; g.fillRect(0, 64, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (const y of [0, 63, 64, 127]) g.fillRect(0, y, 64, 2);
  grain(g, 64, 128, 0.4);
  return finish(c);
}

/** Dark pad with two glowing cyan chevrons pointing along the strip (canvas top = forward). */
function chevronTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const draw = (glowOnly: boolean): HTMLCanvasElement => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = glowOnly ? '#000' : '#15191d'; g.fillRect(0, 0, 128, 128);
    for (const y0 of [64, 0]) {
      g.beginPath();
      g.moveTo(14, y0 + 52); g.lineTo(64, y0 + 8); g.lineTo(114, y0 + 52);
      g.lineTo(114, y0 + 58); g.lineTo(64, y0 + 24); g.lineTo(14, y0 + 58);
      g.closePath();
      g.shadowColor = '#37f5ff'; g.shadowBlur = glowOnly ? 12 : 6;
      g.fillStyle = '#4ff3ff'; g.fill();
    }
    if (!glowOnly) grain(g, 128, 128, 0.3);
    return c;
  };
  return { map: finish(draw(false)), glow: finish(draw(true)) };
}

/** The decals of one track. Build once per track; call `animate(ms)` each frame for the pulsing boost glow. */
export class RoadDecalView {
  readonly group = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private readonly glowMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(defs: readonly RoadDecalDef[]) {
    this.group.name = 'road-decals';
    if (typeof document === 'undefined') return;
    let checker: THREE.Texture | null = null;
    let rumble: THREE.Texture | null = null;
    const chev = defs.some((d) => d.kind === 'boostPad') ? chevronTextures() : null;
    const material = (d: RoadDecalDef): THREE.MeshStandardMaterial => {
      const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      if (d.kind === 'startLine') m.map = (checker ??= checkerTexture());
      else if (d.kind === 'rumble') m.map = (rumble ??= rumbleTexture());
      else if (chev) { m.map = chev.map; m.emissiveMap = chev.glow; m.emissive = new THREE.Color('#37f5ff'); m.emissiveIntensity = 1.4; m.roughness = 0.4; this.glowMaterials.push(m); }
      this.disposables.push(m);
      return m;
    };
    for (const d of defs) {
      const geo = this.strip(d);
      if (!geo) continue;
      this.disposables.push(geo);
      const mesh = new THREE.Mesh(geo, material(d));
      mesh.receiveShadow = true;
      mesh.renderOrder = 2;
      this.group.add(mesh);
    }
    if (checker) this.disposables.push(checker);
    if (rumble) this.disposables.push(rumble);
    if (chev) this.disposables.push(chev.map, chev.glow);
  }

  private strip(d: RoadDecalDef): THREE.BufferGeometry | null {
    const n = d.points.length;
    if (n < 2) return null;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let along = 0;
    const repeatU = d.kind === 'startLine' ? Math.max(1, Math.round(d.width / 3)) : 1;
    for (let i = 0; i < n; i++) {
      const p = d.points[i]!, a = d.points[Math.max(0, i - 1)]!, b = d.points[Math.min(n - 1, i + 1)]!;
      let tx = b[0] - a[0], tz = b[2] - a[2];
      const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
      if (i > 0) along += Math.hypot(p[0] - d.points[i - 1]![0], p[2] - d.points[i - 1]![2]);
      const lx = -tz * (d.width / 2), lz = tx * (d.width / 2);
      pos.push(p[0] + lx, p[1] + LIFT, p[2] + lz, p[0] - lx, p[1] + LIFT, p[2] - lz);
      const v = along / d.period;
      uv.push(0, v, repeatU, v);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(idx);
    return g;
  }

  animate(timeMs: number): void {
    const k = 1.1 + 0.55 * Math.sin(timeMs / 260);
    for (const m of this.glowMaterials) m.emissiveIntensity = k;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
