/**
 * SKY: painted billboard clouds floating round the island.
 *
 * **Art.** Ten shapes, `/art/clouds/cloud-01.png` … `cloud-10.png`: white, fluffy, whimsical clouds in
 * the game's hand-painted Blizzard style, keyed from magenta by `scripts/key-art.ts --set sky-clouds`
 * (the Codex prompt is docs/tickets/art/ART-CLOUDS.md). Until a file exists, or when it fails to load,
 * the same shape is painted on a canvas here (soft lobes, a lit white top, a cool lavender-blue belly,
 * a painted rim), so the sky is never empty and nothing changes in code when the art lands.
 *
 * **Layout.** Three rings round the island (which sits at the origin): a near ring high over the shore,
 * a middle ring, and a horizon ring low and small, so they shrink toward the horizon on top of
 * perspective. Seeded, so the same settings always give the same sky. Each cloud bobs and drifts slowly
 * round the island.
 *
 * Sprites: always facing the camera, lit by nothing, faded by the scene's fog like everything far away
 * (the horizon ring melts into the haze). They never write depth and never take a raycast (a brush or a
 * placement click goes straight through them).
 */
import * as THREE from 'three';
import { CLOUD_COUNT_MAX, type SkyClouds } from './sky-settings';

/** A lobe of the painted stand-in: centre (x 0‥1 across, y 0‥1 down) and radius (× width). */
type Lobe = readonly [number, number, number];

export interface CloudShape {
  readonly id: string;
  readonly name: string;
  /** Height ÷ width of the painted stand-in. */
  readonly aspect: number;
  readonly lobes: readonly Lobe[];
}

/** The ten shapes (ids match the Codex art files). */
export const CLOUD_SHAPES: readonly CloudShape[] = Object.freeze([
  { id: 'cloud-01', name: 'Towering cumulus', aspect: 0.72, lobes: [[0.22, 0.56, 0.14], [0.36, 0.44, 0.17], [0.5, 0.3, 0.2], [0.64, 0.42, 0.17], [0.78, 0.55, 0.14], [0.42, 0.6, 0.15], [0.6, 0.6, 0.15], [0.5, 0.52, 0.16]] },
  { id: 'cloud-02', name: 'Long drifter', aspect: 0.34, lobes: [[0.1, 0.62, 0.08], [0.2, 0.5, 0.11], [0.33, 0.42, 0.13], [0.47, 0.46, 0.12], [0.6, 0.38, 0.14], [0.74, 0.47, 0.11], [0.87, 0.58, 0.08], [0.4, 0.62, 0.1], [0.66, 0.62, 0.1]] },
  { id: 'cloud-03', name: 'Twin puffs', aspect: 0.5, lobes: [[0.2, 0.55, 0.13], [0.3, 0.4, 0.15], [0.4, 0.56, 0.12], [0.5, 0.62, 0.07], [0.62, 0.56, 0.12], [0.72, 0.38, 0.16], [0.83, 0.55, 0.12]] },
  { id: 'cloud-04', name: 'Curl', aspect: 0.62, lobes: [[0.2, 0.62, 0.12], [0.34, 0.56, 0.14], [0.5, 0.52, 0.16], [0.64, 0.42, 0.14], [0.72, 0.28, 0.11], [0.64, 0.17, 0.08], [0.53, 0.2, 0.07], [0.78, 0.58, 0.12], [0.5, 0.66, 0.12]] },
  { id: 'cloud-05', name: 'Little puff', aspect: 0.66, lobes: [[0.3, 0.58, 0.18], [0.5, 0.42, 0.24], [0.7, 0.58, 0.18], [0.5, 0.64, 0.18]] },
  { id: 'cloud-06', name: 'Mushroom', aspect: 0.8, lobes: [[0.2, 0.3, 0.13], [0.35, 0.22, 0.16], [0.52, 0.2, 0.17], [0.68, 0.24, 0.15], [0.82, 0.32, 0.12], [0.5, 0.42, 0.13], [0.5, 0.58, 0.11], [0.5, 0.74, 0.1], [0.38, 0.8, 0.08], [0.62, 0.8, 0.08]] },
  { id: 'cloud-07', name: 'Woolly sheep', aspect: 0.62, lobes: [[0.26, 0.5, 0.13], [0.36, 0.34, 0.14], [0.52, 0.28, 0.15], [0.67, 0.35, 0.14], [0.76, 0.5, 0.13], [0.66, 0.64, 0.13], [0.5, 0.68, 0.14], [0.34, 0.64, 0.13], [0.5, 0.48, 0.2]] },
  { id: 'cloud-08', name: 'Cloud castle', aspect: 0.72, lobes: [[0.18, 0.6, 0.12], [0.26, 0.4, 0.11], [0.3, 0.22, 0.09], [0.5, 0.52, 0.16], [0.5, 0.3, 0.13], [0.52, 0.12, 0.09], [0.74, 0.44, 0.12], [0.76, 0.26, 0.1], [0.82, 0.6, 0.12], [0.36, 0.66, 0.12], [0.64, 0.66, 0.12]] },
  { id: 'cloud-09', name: 'Wisp trail', aspect: 0.42, lobes: [[0.2, 0.52, 0.16], [0.32, 0.38, 0.16], [0.44, 0.52, 0.14], [0.56, 0.54, 0.1], [0.66, 0.56, 0.08], [0.75, 0.58, 0.06], [0.83, 0.6, 0.045], [0.9, 0.62, 0.03]] },
  { id: 'cloud-10', name: 'Floating isle', aspect: 0.6, lobes: [[0.14, 0.42, 0.1], [0.28, 0.32, 0.14], [0.45, 0.24, 0.16], [0.62, 0.28, 0.15], [0.78, 0.34, 0.12], [0.88, 0.44, 0.08], [0.4, 0.46, 0.13], [0.58, 0.48, 0.13], [0.5, 0.62, 0.1], [0.5, 0.76, 0.06]] },
]);

export const cloudArtUrl = (shape: CloudShape) => `/art/clouds/${shape.id}.png`;

/* ───────────── layout ───────────── */

/** A ring: how far out, how high the cloud's centre floats, how wide it is (world units), and its share. */
interface Ring { readonly r: [number, number]; readonly y: [number, number]; readonly width: [number, number]; readonly share: number }

/**
 * Near (over the shore) → horizon: each ring further, lower and smaller. Even the horizon ring floats
 * well above a flying camera: lower, and the sea (which runs out past it) would cut it off. Distance
 * alone puts it low in view (10 000 up at 100 000 out is ~6° above the horizon, the near ring ~17°).
 */
export const CLOUD_RINGS: readonly Ring[] = Object.freeze([
  { r: [42000, 64000], y: [15000, 21000], width: [11000, 16000], share: 0.25 },
  { r: [66000, 86000], y: [11500, 15000], width: [7000, 10500], share: 0.35 },
  { r: [88000, 108000], y: [8500, 11000], width: [3800, 6500], share: 0.4 },
]);

export interface CloudPlacement {
  readonly shape: number;
  readonly ring: number;
  /** Angle round the island (radians) and distance from its centre. */
  readonly angle: number;
  readonly radius: number;
  readonly y: number;
  readonly width: number;
  /** Radians per second round the island at drift 1 (a few minutes a degree far out: calm). */
  readonly orbit: number;
  readonly bobAmp: number;
  readonly bobRate: number;
  readonly phase: number;
  readonly flip: boolean;
  /**
   * 0‥1 (the Sky window's Hug horizon × the ring's share): how far this cloud is pulled from `y` onto
   * the horizon line as the camera sees it, `lineOffset` above it (half its own height, so it sits on it).
   */
  readonly hug: number;
  readonly lineOffset: number;
}

/** Small, fast, seeded: the same seed always gives the same sky. */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** How much of Horizon size a ring takes: the far ring all of it, the middle ring half, the near ring none. */
const HORIZON_SHARE = [0, 0.5, 1] as const;
/**
 * Hugging the horizon, each ring floats this high above the line the camera sees (world units): the
 * near ring well up, the middle a little above, the far ring (null) right on it, half its height up.
 */
const RING_LIFT: readonly ([number, number] | null)[] = [[3500, 8000], [1000, 3000], null];

/** Where every cloud floats, for these settings (pure: the tests check it). */
export function cloudLayout(settings: Pick<SkyClouds, 'count' | 'size' | 'height' | 'seed'> & Partial<Pick<SkyClouds, 'horizonSize' | 'horizonHug'>>): CloudPlacement[] {
  const count = Math.max(0, Math.min(CLOUD_COUNT_MAX, Math.round(settings.count)));
  const rand = rng(settings.seed);
  const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
  const out: CloudPlacement[] = [];
  let made = 0;
  CLOUD_RINGS.forEach((ring, ri) => {
    const n = ri === CLOUD_RINGS.length - 1 ? count - made : Math.round(count * ring.share);
    // Even spacing round the ring, jittered, so no two cloud banks pile up on one side.
    const start = rand() * Math.PI * 2;
    const share = HORIZON_SHARE[ri] ?? 1;
    const sizeK = 1 + ((settings.horizonSize ?? 1) - 1) * share;
    const hug = settings.horizonHug ?? 0;
    const lift = RING_LIFT[ri] ?? null;
    for (let k = 0; k < n; k++) {
      const baseY = lerp(ring.y, rand()) * settings.height;
      const width = lerp(ring.width, rand()) * settings.size * sizeK;
      out.push({
        shape: Math.floor(rand() * CLOUD_SHAPES.length) % CLOUD_SHAPES.length,
        ring: ri,
        angle: start + ((k + 0.5 + (rand() - 0.5) * 0.7) / n) * Math.PI * 2,
        radius: lerp(ring.r, rand()) * (1 + 0.15 * hug * share),
        y: baseY,
        width,
        orbit: (0.00035 + rand() * 0.00035) * (rand() < 0.5 ? 1 : -1) * (ri === 0 ? 1.4 : 1),
        bobAmp: (120 + rand() * 260) * (1 + (CLOUD_RINGS.length - 1 - ri) * 0.4),
        bobRate: 0.12 + rand() * 0.14,
        phase: rand() * Math.PI * 2,
        flip: rand() < 0.5,
        hug,
        // The far ring sits on the line (about half its height above it); the others float higher.
        lineOffset: lift ? lerp(lift, rand()) : width * (0.3 + rand() * 0.25),
      });
    }
    made += n;
  });
  return out;
}

/* ───────────── the painted stand-in ───────────── */

/** One shape painted on a canvas, in the same look the Codex art is asked for. Browser only. */
export function paintCloudCanvas(shape: CloudShape, width = 512): HTMLCanvasElement {
  const pad = 0.06;
  const W = width, H = Math.round(width * shape.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const inner = W * (1 - pad * 2);
  const lobes = shape.lobes.map(([x, y, r]) => [W * pad + x * inner, H * pad + y * (H * (1 - pad * 2)), r * inner] as const);
  const union = (grow = 0, lift = 0, shrink = 1) => {
    const p = new Path2D();
    for (const [x, y, r] of lobes) { p.moveTo(x + r * shrink + grow, y - lift * r); p.arc(x, y - lift * r, r * shrink + grow, 0, Math.PI * 2); }
    return p;
  };
  const top = Math.min(...lobes.map(([, y, r]) => y - r)), bottom = Math.max(...lobes.map(([, y, r]) => y + r));

  // Rim: a soft painted edge in deep periwinkle (never pink: the art keys magenta).
  g.save();
  g.filter = 'blur(2px)';
  g.fillStyle = 'rgba(96, 120, 176, 0.85)';
  g.fill(union(3.5));
  g.restore();
  // Belly: the whole silhouette in the cool shade, darker toward the bottom.
  const belly = g.createLinearGradient(0, top, 0, bottom);
  belly.addColorStop(0, '#dfe8fa'); belly.addColorStop(0.55, '#bccbeb'); belly.addColorStop(1, '#9fb0da');
  g.fillStyle = belly;
  g.fill(union());
  // Lit tops: every lobe again, smaller and lifted toward the upper-left sun, clipped to the silhouette.
  g.save();
  g.clip(union());
  for (const [x, y, r] of lobes) {
    const lx = x - r * 0.16, ly = y - r * 0.24;
    const lit = g.createRadialGradient(lx - r * 0.25, ly - r * 0.3, r * 0.1, lx, ly, r * 0.92);
    lit.addColorStop(0, '#ffffff'); lit.addColorStop(0.7, '#fbfdff'); lit.addColorStop(1, 'rgba(244, 248, 255, 0)');
    g.fillStyle = lit;
    g.beginPath(); g.arc(lx, ly, r * 0.92, 0, Math.PI * 2); g.fill();
  }
  // Painted strokes: short curved dabs along each lobe's lit rim, the brushwork of the style.
  const dab = rng(shape.id.length * 7919 + lobes.length);
  g.lineCap = 'round';
  for (const [x, y, r] of lobes) {
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (1.05 + dab() * 0.75);
      g.strokeStyle = `rgba(255, 255, 255, ${0.35 + dab() * 0.4})`;
      g.lineWidth = r * (0.05 + dab() * 0.06);
      g.beginPath(); g.arc(x - r * 0.1, y - r * 0.1, r * (0.62 + dab() * 0.22), a, a + 0.35 + dab() * 0.4); g.stroke();
    }
    // A warm catch-light on the sunward edge.
    g.strokeStyle = 'rgba(255, 246, 226, 0.65)';
    g.lineWidth = r * 0.06;
    g.beginPath(); g.arc(x, y, r * 0.9, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
  }
  // Soft shadow where lobes tuck under each other.
  const under = g.createLinearGradient(0, bottom - (bottom - top) * 0.3, 0, bottom);
  under.addColorStop(0, 'rgba(120, 140, 196, 0)'); under.addColorStop(1, 'rgba(120, 140, 196, 0.45)');
  g.fillStyle = under;
  g.fillRect(0, 0, W, H);
  g.restore();
  return canvas;
}

/* ───────────── the layer ───────────── */

interface Shown { sprite: THREE.Sprite; place: CloudPlacement }

export class CloudLayer {
  readonly group = new THREE.Group();
  private readonly materials: THREE.SpriteMaterial[];
  /** Height ÷ width per shape: the painted stand-in's until the art loads, then the art's. */
  private readonly aspects: number[];
  private shown: Shown[] = [];
  private layoutKey = '';

  constructor(opts: { loadArt?: boolean } = {}) {
    this.group.name = 'Clouds';
    this.aspects = CLOUD_SHAPES.map((s) => s.aspect);
    this.materials = CLOUD_SHAPES.map((shape) => {
      const texture = typeof document !== 'undefined' ? new THREE.CanvasTexture(paintCloudCanvas(shape)) : null;
      if (texture) texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: true });
    });
    if (opts.loadArt !== false && typeof document !== 'undefined') this.loadArt();
  }

  /** The Codex art replaces a stand-in the moment it decodes; a missing file keeps the stand-in. */
  private loadArt() {
    const loader = new THREE.TextureLoader();
    CLOUD_SHAPES.forEach((shape, i) => {
      loader.load(cloudArtUrl(shape), (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        const img = texture.image as { width?: number; height?: number } | undefined;
        if (img?.width && img.height) this.aspects[i] = img.height / img.width;
        const material = this.materials[i]!;
        material.map?.dispose();
        material.map = texture;
        material.needsUpdate = true;
        for (const s of this.shown) if (s.place.shape === i) this.scale(s);
      }, undefined, () => { /* no art yet: the painted stand-in stays */ });
    });
  }

  private scale(s: Shown) {
    const w = s.place.width;
    s.sprite.scale.set(s.place.flip ? -w : w, w * (this.aspects[s.place.shape] ?? 0.6), 1);
  }

  /** Settings from the Sky & Clouds window: rebuilds the layout only when it changed. */
  apply(settings: SkyClouds) {
    this.group.visible = settings.enabled && settings.count > 0;
    const tint = new THREE.Color(settings.tint);
    for (const m of this.materials) { m.opacity = settings.opacity; m.color.copy(tint); }
    const key = `${settings.count}|${settings.size}|${settings.height}|${settings.seed}|${settings.horizonSize}|${settings.horizonHug}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    for (const s of this.shown) this.group.remove(s.sprite);
    this.shown = cloudLayout(settings).map((place) => {
      const sprite = new THREE.Sprite(this.materials[place.shape]);
      sprite.name = `Cloud ${CLOUD_SHAPES[place.shape]!.name}`;
      sprite.raycast = () => {};
      // Far rings first, so a near cloud is drawn over the ones behind it.
      sprite.renderOrder = -500 - place.ring;
      const s = { sprite, place };
      this.scale(s);
      this.group.add(sprite);
      return s;
    });
    this.update(0, 1);
  }

  /**
   * Each frame: drift round the island and bob. `drift` 0 (or reduced motion) holds them still.
   * `eyeY` is the camera's height: the horizon line sits there, so hugging clouds float just on it
   * wherever the camera is (racing on the road or flying high in the editor).
   */
  update(time: number, drift: number, eyeY?: number) {
    for (const { sprite, place } of this.shown) {
      const a = place.angle + time * place.orbit * drift;
      const bob = Math.sin(time * place.bobRate * drift + place.phase) * place.bobAmp * Math.min(1, drift) * (1 - place.hug);
      const y = eyeY === undefined || !place.hug ? place.y : place.y + (eyeY + place.lineOffset - place.y) * place.hug;
      sprite.position.set(Math.sin(a) * place.radius, y + bob, -Math.cos(a) * place.radius);
    }
  }

  get count(): number { return this.shown.length; }

  dispose() {
    for (const m of this.materials) { m.map?.dispose(); m.dispose(); }
    this.group.removeFromParent();
  }
}
