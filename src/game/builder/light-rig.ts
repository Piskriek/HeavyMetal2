/**
 * Placed lights for the builder (the dark underground needs them) and the rig that shows them.
 *
 * three.js compiles every lit material for a fixed number of lights, so adding a light object
 * recompiles every material in the scene. The rig avoids that: it owns a fixed pool of point and spot
 * lights, created once, and each frame hands the pool to the placed lights nearest the camera. A
 * course can hold any number of placed lights; the nearest POINT_SLOTS / SPOT_SLOTS of them shine,
 * and one that is about to lose its slot fades rather than blinking off.
 *
 * Units: brightness is roughly how strongly the light lights a surface at half its reach, on the
 * same scale as the course's own ambient light (about 1.6 in daylight, 1.1 underground).
 */
import * as THREE from 'three';
import type { PropDefinition } from './prop-catalog';

export type LightKind = 'point' | 'spot';

export interface LightSettings {
  kind: LightKind;
  /** #rrggbb */
  color: string;
  /** 0..12 */
  brightness: number;
  /** World units: the light reaches nothing past this. */
  reach: number;
  /** Spot only: half-angle of the cone, degrees (5..80). */
  angle: number;
  /** Spot only: 0 = hard cone edge, 1 = very soft. */
  softness: number;
  /** 0 = steady, 1 = a guttering torch. */
  flicker: number;
}

export const LIGHT_PREFIX = 'light_';
export const isLightType = (type: string) => type.startsWith(LIGHT_PREFIX);

const svg = (color: string, body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#f0b85e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="28" r="12" fill="${color}" fill-opacity="0.35" stroke="${color}"/>${body}</svg>`)}`;
const RAYS = '<path d="M32 6v5M32 45v5M10 28h5M49 28h5M16.4 12.4l3.5 3.5M44.1 40.1l3.5 3.5M16.4 43.6l3.5-3.5M44.1 15.9l3.5-3.5"/>';

interface Preset { type: string; name: string; settings: LightSettings; icon: string }
const PRESETS: readonly Preset[] = [
  { type: `${LIGHT_PREFIX}lantern`, name: 'Lantern glow', icon: svg('#ffb35c', RAYS),
    settings: { kind: 'point', color: '#ffb35c', brightness: 4, reach: 1800, angle: 35, softness: 0.4, flicker: 0.12 } },
  { type: `${LIGHT_PREFIX}torch`, name: 'Torch fire', icon: svg('#ff7a2a', `${RAYS}<path d="M32 50v8"/>`),
    settings: { kind: 'point', color: '#ff8a3a', brightness: 5, reach: 1500, angle: 35, softness: 0.4, flicker: 0.45 } },
  { type: `${LIGHT_PREFIX}crystal`, name: 'Crystal glow', icon: svg('#6fe3ff', '<path d="M32 12l6 10-6 12-6-12z"/>'),
    settings: { kind: 'point', color: '#6fe3ff', brightness: 3.5, reach: 1600, angle: 35, softness: 0.4, flicker: 0 } },
  { type: `${LIGHT_PREFIX}lava`, name: 'Lava glow', icon: svg('#ff4d1a', '<path d="M14 50c6-4 10 4 18 0s12 4 18 0"/>'),
    settings: { kind: 'point', color: '#ff5a1a', brightness: 6, reach: 2600, angle: 35, softness: 0.4, flicker: 0.2 } },
  { type: `${LIGHT_PREFIX}worklamp`, name: 'Work lamp (spot)', icon: svg('#fff1d6', '<path d="M24 38 14 58h36L40 38"/>'),
    settings: { kind: 'spot', color: '#fff1d6', brightness: 7, reach: 3200, angle: 32, softness: 0.45, flicker: 0 } },
  { type: `${LIGHT_PREFIX}bulb`, name: 'Plain light', icon: svg('#ffffff', RAYS),
    settings: { kind: 'point', color: '#ffffff', brightness: 3, reach: 2000, angle: 35, softness: 0.4, flicker: 0 } },
];

/** The shelf entries (category 'lights'). The defaults are the light's helper size in the builder. */
export const LIGHT_DEFINITIONS: PropDefinition[] = PRESETS.map((p) => ({
  type: p.type, name: p.name, category: 'lights', url: p.icon, defaultWidth: 80, defaultHeight: 80, alignBottom: false,
}));

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
};

/** The preset for a light prop type (a plain white point light if the type is unknown). */
export const lightPreset = (type: string): LightSettings => (PRESETS.find((p) => p.type === type) ?? PRESETS[PRESETS.length - 1]).settings;

/** A prop's light settings: its own values over its preset's, clamped. */
export function lightSettingsFor(prop: { type: string; light?: unknown }): LightSettings {
  const base = lightPreset(prop.type);
  const o = (prop.light && typeof prop.light === 'object' ? prop.light : {}) as Record<string, unknown>;
  return {
    kind: o.kind === 'spot' || o.kind === 'point' ? o.kind : base.kind,
    color: typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color.toLowerCase() : base.color,
    brightness: clamp(o.brightness, 0, 12, base.brightness),
    reach: clamp(o.reach, 100, 12000, base.reach),
    angle: clamp(o.angle, 5, 80, base.angle),
    softness: clamp(o.softness, 0, 1, base.softness),
    flicker: clamp(o.flicker, 0, 1, base.flicker),
  };
}

/** Spot lights shine along the prop's local −Y (straight down until tilted). */
export function spotDirection(prop: { rotX?: number; rotY?: number; rotZ?: number }, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, -1, 0).applyEuler(new THREE.Euler(prop.rotX ?? 0, prop.rotY ?? 0, prop.rotZ ?? 0, 'YXZ')).normalize();
}

/* ───────────── The rig ───────────── */

export const POINT_SLOTS = 8;
export const SPOT_SLOTS = 4;

interface Source { settings: LightSettings; position: THREE.Vector3; direction: THREE.Vector3; phase: number }

/** Phase for the flicker, from the id (so two torches never flicker in step). */
function phaseOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000 * 100;
}

export class LightRig {
  private readonly points: THREE.PointLight[] = [];
  private readonly spots: THREE.SpotLight[] = [];
  private readonly sources = new Map<string, Source>();
  private readonly scratch = new THREE.Vector3();
  /** How many placed lights were given a slot on the last update. */
  lit = 0;

  constructor(private readonly scene: THREE.Scene) {}

  /** Adds or updates a placed light. */
  set(id: string, settings: LightSettings, position: THREE.Vector3, direction: THREE.Vector3) {
    this.ensurePool();
    const src = this.sources.get(id);
    if (src) { src.settings = settings; src.position.copy(position); src.direction.copy(direction); return; }
    this.sources.set(id, { settings, position: position.clone(), direction: direction.clone(), phase: phaseOf(id) });
  }

  remove(id: string) { this.sources.delete(id); }

  get count() { return this.sources.size; }

  /** Gives the pool to the nearest lights (by distance measured in reaches) and sets their values. */
  update(camera: THREE.Camera, timeSec: number, reducedMotion: boolean) {
    this.lit = 0;
    if (!this.points.length) return;
    const eye = camera.getWorldPosition(this.scratch);
    const ranked = { point: [] as { src: Source; score: number }[], spot: [] as { src: Source; score: number }[] };
    for (const src of this.sources.values()) {
      if (src.settings.brightness <= 0) continue;
      const score = src.position.distanceTo(eye) / src.settings.reach;
      if (score < 4) ranked[src.settings.kind].push({ src, score });
    }
    ranked.point.sort((a, b) => a.score - b.score);
    ranked.spot.sort((a, b) => a.score - b.score);
    this.fill(this.points, ranked.point, timeSec, reducedMotion);
    this.fill(this.spots, ranked.spot, timeSec, reducedMotion);
  }

  dispose() {
    for (const l of [...this.points, ...this.spots]) {
      this.scene.remove(l);
      if (l instanceof THREE.SpotLight) this.scene.remove(l.target);
      l.dispose();
    }
    this.points.length = 0;
    this.spots.length = 0;
    this.sources.clear();
  }

  private ensurePool() {
    if (this.points.length) return;
    for (let i = 0; i < POINT_SLOTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 1000, 1);
      l.name = 'BuilderLightSlot';
      l.castShadow = false;
      this.points.push(l);
      this.scene.add(l);
    }
    for (let i = 0; i < SPOT_SLOTS; i++) {
      const l = new THREE.SpotLight(0xffffff, 0, 1000, Math.PI / 6, 0.4, 1);
      l.name = 'BuilderLightSlot';
      l.castShadow = false;
      l.target.name = 'BuilderLightSlotTarget';
      this.spots.push(l);
      this.scene.add(l, l.target);
    }
  }

  private fill(pool: (THREE.PointLight | THREE.SpotLight)[], ranked: { src: Source; score: number }[], timeSec: number, reducedMotion: boolean) {
    for (let i = 0; i < pool.length; i++) {
      const light = pool[i];
      const entry = ranked[i];
      if (!entry) { light.intensity = 0; light.visible = false; continue; }
      const { src, score } = entry;
      const s = src.settings;
      // Fade out as the camera leaves (3 → 4 reaches away), and fade the last slot's light if a
      // nearer one is about to take it, so lights hand over instead of popping.
      let fade = Math.min(1, Math.max(0, 4 - score));
      const next = ranked[pool.length];
      if (i === pool.length - 1 && next) fade *= Math.min(1, Math.max(0, (next.score - score) * 4));
      let wobble = 1;
      if (s.flicker > 0 && !reducedMotion) {
        const t = timeSec * 9 + src.phase;
        wobble = 1 - s.flicker * 0.5 * (0.5 + 0.5 * Math.sin(t) * Math.sin(t * 2.37 + 1.3) * Math.sin(t * 0.61 + 2.1));
      }
      light.visible = true;
      light.color.set(s.color);
      light.distance = s.reach;
      light.decay = 1;
      light.intensity = s.brightness * s.reach * 0.5 * fade * wobble;
      light.position.copy(src.position);
      if (light instanceof THREE.SpotLight) {
        light.angle = THREE.MathUtils.degToRad(s.angle);
        light.penumbra = s.softness;
        light.target.position.copy(src.position).addScaledVector(src.direction, s.reach * 0.5);
        light.target.updateMatrixWorld();
      }
      this.lit++;
    }
  }
}

/* ───────────── The builder's marker for a light ───────────── */

/** A small glowing bulb (and, for a spot, a cone showing the aim) that the builder can click. */
export function createLightMarker(settings: LightSettings): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(settings.color);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 12), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  bulb.name = 'LightBulb';
  const halo = new THREE.Mesh(new THREE.SphereGeometry(46, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
  halo.name = 'LightHalo';
  group.add(bulb, halo);
  if (settings.kind === 'spot') {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(settings.angle)) * 260, 260, 20, 1, true).translate(0, -130, 0),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.45, toneMapped: false }),
    );
    cone.name = 'LightCone';
    group.add(cone);
  }
  // The reach, drawn only while the light is selected (see setMarkerSelected).
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2), 0, Math.sin((i / 64) * Math.PI * 2)))),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
  );
  ring.name = 'LightReach';
  ring.scale.setScalar(settings.reach);
  ring.visible = false;
  group.add(ring);
  return group;
}

/** Refreshes a marker after its settings changed (colour, reach, cone). */
export function updateLightMarker(marker: THREE.Object3D, settings: LightSettings) {
  const color = new THREE.Color(settings.color);
  marker.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (m && 'color' in m) m.color.copy(color);
  });
  const ring = marker.getObjectByName('LightReach');
  if (ring) ring.scale.setScalar(settings.reach);
  const cone = marker.getObjectByName('LightCone') as THREE.Mesh | undefined;
  if (cone) {
    cone.geometry.dispose();
    cone.geometry = new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(settings.angle)) * 260, 260, 20, 1, true).translate(0, -130, 0);
  }
}

export function setMarkerSelected(marker: THREE.Object3D, selected: boolean) {
  const ring = marker.getObjectByName('LightReach');
  if (ring) ring.visible = selected;
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose?.();
  });
}
