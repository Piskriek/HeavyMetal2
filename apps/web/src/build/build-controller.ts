import { cmd, type PresetId } from '@hm/contracts';
import type { DecorPlacement, Runtime } from '@hm/engine';
import type { SfxId } from '@hm/audio';
import { THINGS, plugsFor, type PlugEvent, type PlugKind, type ToolPreset } from '@hm/buildkit';
import type { ThreeRenderer } from '@hm/render';
import { applyStroke, encodeTerrain, heightAt, mirroredDab, paintWay, sculptWay, type DirtyRect, type SculptDab } from '@hm/terrain';
import { stamp, type StampKind } from '@hm/terrainops';
import { encodeModel } from '@hm/voxel';
import { GROUND_NAMES, SURFACE_IDS, packDecor, rectToArea, respondToSculpt, settlePlants, surfaceAt, type WorldRules } from '@hm/worldrules';
import { fx } from '../maker/feedback';
import { saveMap } from '../maker/storage';
import { focusTargetOf } from '../maker/focus';
import { plantsOf, rulesOf } from '../world';
import { voxelModelById } from './cards';
import { spriteDef } from './sprites';

/**
 * What using a tool preset does where you aim. Ground tools paint and sculpt (one undo step per press, and the world rules respond when you
 * let go); Things tools place voxel models; Select tools look at, move, turn, size, copy, delete, focus on and hide the things you placed.
 * Every use sets off the tool's plugs (its sprites, sounds, goblin moves and camera shakes) for that moment: use, the opposite (right click),
 * and letting go. Picking the slot is the island's job (it fires the 'pick' plugs through `fire`).
 */
export interface Aim { readonly point: readonly [number, number, number]; readonly normal: readonly [number, number, number] | null }

/** Metres per voxel for each placeable model (size 1 on the tool). */
const PLACE_BLOCK: Readonly<Record<string, number>> = { 'block-cube': 0.125, 'block-ball': 0.125, 'block-cylinder': 0.125, 'block-wedge': 0.125, 'block-stairs': 0.125, 'block-hollow-box': 0.125, 'block-arch': 0.125, 'block-plank': 0.125, 'block-pillar': 0.125, goblin: 0.04, 'goblin-ball-racer': 0.05, palm: 0.13, barrel: 0.08, rock: 0.12, trophy: 0.1, 'statue-plinth': 0.2, bush: 0.17, 'grass-clump': 0.11, flowers: 0.1 };
const STAMPS: Readonly<Partial<Record<ToolPreset['action'], StampKind>>> = { mound: 'mound', crater: 'crater', plateau: 'plateau', ridge: 'ridge', dune: 'dune' };
/** A small seeded random (mulberry32). */
function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const union = (a: DirtyRect | null, b: DirtyRect | null): DirtyRect | null => (!a ? b : !b ? a : { c0: Math.min(a.c0, b.c0), r0: Math.min(a.r0, b.r0), c1: Math.max(a.c1, b.c1), r1: Math.max(a.r1, b.r1) });
/** What the island grows by itself (the Eraser puts it back): under the sea what sunk ground becomes, sand at the waterline, rock on the steep, grass elsewhere. */
export function naturalSurface(height: number, flatness: number, rules: WorldRules): number {
  if (height < rules.waterLevel) return rules.underwaterBecomes;
  if (height < rules.waterLevel + 0.9) return SURFACE_IDS.sand;
  if (flatness < 0.72) return SURFACE_IDS.rock;
  return SURFACE_IDS.grass;
}

export interface ControllerHooks {
  readonly onModels: () => void;
  readonly say: (text: string) => void;
  readonly onDecorPreview: (placements: readonly DecorPlacement[] | null) => void;
  readonly onFocus: (id: PresetId | null) => void;
  readonly onIsolate: (id: PresetId | null) => void;
  /** An animation plug: the goblin plays this move. */
  readonly onAnim: (id: string) => void;
  /** A camera-shake plug. */
  readonly onShake: (id: string, amount: number) => void;
  /** Select picked something (docs/HOTBAR.md, Select: "select anything and change it"): the island opens what changes it. */
  readonly onSelect?: (what: Selected) => void;
}
/** What Select picked where you pointed. */
export type Selected =
  | { readonly kind: 'thing'; readonly ref: PresetId }
  | { readonly kind: 'plant'; readonly plant: string }
  | { readonly kind: 'water' }
  | { readonly kind: 'ground'; readonly surface: number; readonly height: number };
export interface FireOptions {
  /** Scales sprite counts (a big stamp bursts more than one brush tick). */
  readonly scale?: number;
  /** False for the repeats while a brush is held: moves and shakes play once per press, sprites and sounds every tick. */
  readonly first?: boolean;
  readonly sound?: { readonly volume?: number; readonly pitch?: number; readonly minGapMs?: number };
  readonly only?: readonly PlugKind[];
}

export class BuildController {
  private dirty: DirtyRect | null = null;
  private last: { x: number; z: number } | null = null;
  private lastUse = 0;
  private flattenTo: number | null = null;
  private strokeLabel = '';
  private before: Float32Array | null = null;
  private lastPreview = 0;
  /** The thing the Move tool is carrying. */
  carrying: PresetId | null = null;
  /** Clone: where it copies from (right-click), and the offset fixed when a stroke starts. */
  private cloneSource: { x: number; z: number } | null = null;
  private cloneOffset: { dx: number; dz: number } | null = null;
  /** Things, Row: where the row starts (the next click ends it). */
  private rowFrom: [number, number] | null = null;
  private seq = 0;
  /** Grab: where the press began (the ground there follows the pointer). */
  private grabFrom: { x: number; z: number } | null = null;

  constructor(private readonly rt: Runtime, private readonly renderer: ThreeRenderer, private readonly sceneId: PresetId, private readonly terrainId: PresetId, private readonly hooks: ControllerHooks) {}

  private lastAim: Aim | null = null;
  private pressed: ToolPreset | null = null;

  /** Set off a tool's plugs for one moment. The right button falls back to the use plugs when the tool has none of its own for it. */
  fire(tool: ToolPreset, on: PlugEvent, a: Aim | null, o: FireOptions = {}): void {
    let plugs = plugsFor(tool.plugs, on);
    if (on === 'opposite' && !plugs.length) plugs = plugsFor(tool.plugs, 'use');
    for (const p of plugs) {
      if (p.amount <= 0 || (o.only && !o.only.includes(p.kind))) continue;
      if (p.kind === 'sprite') {
        if (!a) continue;
        const s = spriteDef(p.ref);
        this.renderer.burst({ ...s, count: Math.max(1, Math.round(s.count * (o.scale ?? 1) * p.amount)), position: [a.point[0], a.point[1] + 0.1, a.point[2]], ...(a.normal ? { normal: a.normal } : {}) });
      } else if (p.kind === 'sound') fx(p.ref as SfxId, { ...o.sound, volume: (o.sound?.volume ?? 1) * Math.min(1.5, p.amount) });
      else if (o.first !== false) { if (p.kind === 'anim') this.hooks.onAnim(p.ref); else this.hooks.onShake(p.ref, p.amount); }
    }
  }

  /** The placed model under the aim point (the nearest whose footprint holds it), with its slot index. */
  modelAt(a: Aim): { ref: PresetId; index: number } | null {
    const refs = this.rt.store.get(this.sceneId)?.children['models'] ?? [];
    let best: { ref: PresetId; index: number; d: number } | null = null;
    for (let i = 0; i < refs.length; i++) {
      const t = focusTargetOf(this.rt, refs[i]!.ref);
      if (!t) continue;
      const d = Math.hypot(t.center[0] - a.point[0], t.center[2] - a.point[2]);
      if (d <= Math.max(0.8, t.radius) && (!best || d < best.d)) best = { ref: refs[i]!.ref, index: i, d };
    }
    return best ? { ref: best.ref, index: best.index } : null;
  }
  /** The plant nearest where you point (within about a metre), by kind. */
  private plantAt(a: Aim): string | null {
    const d = this.rt.binder.decor();
    if (!d) return null;
    let best: { kind: string; dist: number } | null = null;
    for (const p of d.placements) {
      const dist = Math.hypot(p.x - a.point[0], p.z - a.point[2]);
      // about the plant itself (a trunk, a tuft), not the ground round it: grass beside a palm is still grass
      if (dist < 0.35 + 0.3 * p.scale && (!best || dist < best.dist)) best = { kind: p.kind, dist };
    }
    return best?.kind ?? null;
  }
  private param(ref: PresetId, key: string, fallback: number): number { const v = Number(this.rt.store.resolve(ref).params[key]); return Number.isFinite(v) ? v : fallback; }

  /** Called every frame the button is held (and once on press). `alt` is the right button: the opposite action. */
  use(tool: ToolPreset, aim: Aim, alt: boolean, now: number, first: boolean): void {
    const ts = this.rt.binder.terrain();
    const oneShot = !['paint', 'raise', 'lower', 'smooth', 'flatten', 'dig'].includes(tool.action);
    if (oneShot && !first) return;
    if (!first && now - this.lastUse < 70) return;
    this.lastUse = now;
    this.lastAim = aim;
    if (first) this.pressed = tool;
    const on: PlugEvent = alt ? 'opposite' : 'use';
    const x = aim.point[0], z = aim.point[2];
    switch (tool.action) {
      case 'inspect': {
        // Select: a thing you placed, else a plant, else the sea, else the ground (its surface); the island opens what changes it
        const m = this.modelAt(aim);
        const surface = ts ? surfaceAt(ts.terrain, x, z) : 0;
        const ground = GROUND_NAMES[surface - 1] ?? 'ground';
        const plant = m ? null : this.plantAt(aim);
        const water = !m && !plant && aim.point[1] < rulesOf(this.rt, this.sceneId).waterLevel;
        const picked: Selected = m ? { kind: 'thing', ref: m.ref } : plant ? { kind: 'plant', plant } : water ? { kind: 'water' } : { kind: 'ground', surface, height: aim.point[1] };
        this.hooks.say(m ? `${this.rt.store.get(m.ref)?.name ?? 'A thing'}, on ${ground}`
          : plant ? `A ${plant.replace(/-/g, ' ')}: how this kind of plant grows`
          : water ? 'The sea: the world rules'
          : `${ground[0]!.toUpperCase()}${ground.slice(1)}, ${aim.point[1].toFixed(1)} m up`);
        this.hooks.onSelect?.(picked);
        this.fire(tool, on, aim, { scale: 0.5 });
        return;
      }
      case 'move': {
        if (alt) { if (this.carrying) { this.carrying = null; this.hooks.say('Put back'); } return; }
        if (this.carrying) {
          const ref = this.carrying;
          this.carrying = null;
          if (!this.rt.store.get(ref)) return;
          this.rt.commands.transaction('Move', () => {
            this.rt.commands.execute(cmd.setParam(`${ref}.x`, x, 'Move'));
            this.rt.commands.execute(cmd.setParam(`${ref}.y`, aim.point[1], 'Move'));
            this.rt.commands.execute(cmd.setParam(`${ref}.z`, z, 'Move'));
          });
          this.done(tool, aim, 'Moved', on);
          return;
        }
        const m = this.modelAt(aim);
        if (!m) { this.hooks.say('Point at something you placed to pick it up'); return; }
        this.carrying = m.ref;
        this.hooks.say(`Carrying ${this.rt.store.get(m.ref)?.name ?? 'it'}: click where it goes`);
        this.fire(tool, on, aim, { only: ['sound', 'anim'] });
        return;
      }
      case 'turn': case 'resize': case 'copy': case 'delete': case 'focus': case 'isolate': {
        const m = this.modelAt(aim);
        if (tool.action === 'isolate') { this.hooks.onIsolate(alt || !m ? null : m.ref); this.fire(tool, on, aim); return; }
        if (tool.action === 'focus') { this.hooks.onFocus(alt || !m ? null : m.ref); this.fire(tool, on, aim); return; }
        if (!m) { this.hooks.say('Point at something you placed'); fx('ui-error', { volume: 0.4 }); return; }
        if (tool.action === 'delete') { this.removeAt(aim, tool); return; }
        if (tool.action === 'turn') {
          const yaw = this.param(m.ref, 'yaw', 0) + (alt ? -1 : 1) * Math.max(1, tool.strength * 360);
          this.rt.commands.execute(cmd.setParam(`${m.ref}.yaw`, ((yaw + 540) % 360) - 180, 'Turn'));
          this.done(tool, aim, '', on);
          return;
        }
        if (tool.action === 'resize') {
          const s = this.param(m.ref, 'scale', 0.1) * (alt ? 1 / (1 + tool.strength) : 1 + tool.strength);
          this.rt.commands.execute(cmd.setParam(`${m.ref}.scale`, Math.min(5, Math.max(0.01, s)), alt ? 'Smaller' : 'Bigger'));
          this.done(tool, aim, '', on);
          return;
        }
        // copy: the same model a little to the side
        const src = this.rt.store.get(m.ref);
        if (!src) return;
        const id = `model-${Date.now().toString(36)}`;
        const params = { ...this.rt.store.resolve(m.ref).params, x: this.param(m.ref, 'x', x) + 1.5, z: this.param(m.ref, 'z', z) + 0.5 };
        this.rt.commands.transaction('Copy', () => {
          this.rt.commands.execute(cmd.put({ id, kind: 'model', name: src.name, params: params as never, tier: 'build' }, 'Copy'));
          this.rt.commands.execute(cmd.addChild(this.sceneId, 'models', id, undefined, 'Copy'));
        });
        this.done(tool, aim, `${src.name} copied`, on);
        return;
      }
      case 'things': {
        this.thingsWithWay(tool, aim, alt);
        return;
      }
      case 'place': {
        if (alt) { if (!this.removeAt(aim, tool)) this.hooks.say('Nothing here to take away'); return; }
        this.place(tool, aim);
        return;
      }
      case 'mound': case 'crater': case 'plateau': case 'ridge': case 'dune': {
        if (!ts) return;
        const kind: StampKind = alt && tool.action === 'mound' ? 'crater' : STAMPS[tool.action]!;
        this.before = ts.terrain.heights.slice();
        this.strokeLabel = tool.name;
        const rect = stamp(ts.terrain as never, kind, [x, z], Math.max(2, tool.size), { height: Math.max(0.2, tool.strength * tool.size * 0.6), seed: Math.floor(now) % 99991, rotation: (now % 6283) / 1000 });
        if (rect) { this.dirty = rect; this.renderer.refreshTerrain(rect); }
        this.fire(tool, on, aim, { scale: 1.2 });
        return;
      }
    }
    // ways to paint (the surface is the palette's, set on the tool by the island)
    if (tool.action === 'paint' && tool.way) { this.paintWithWay(tool, aim, alt, now, first, on); return; }
    // ways to sculpt (Stamp's shape is the palette's)
    if (tool.action === 'sculpt' && tool.sculpt) { this.sculptWithWay(tool, aim, alt, now, first, on); return; }
    // brushes: paint and sculpt
    if (!ts) return;
    if (first) { this.dirty = null; this.last = null; this.flattenTo = tool.action === 'flatten' ? heightAt(ts.terrain, x, z) : null; this.strokeLabel = tool.name; this.before = ts.terrain.heights.slice(); }
    const kind = tool.action === 'paint' ? 'paint'
      : tool.action === 'raise' ? (alt ? 'lower' : 'raise')
      : tool.action === 'lower' ? (alt ? 'raise' : 'lower')
      : tool.action === 'dig' ? (alt ? 'raise' : 'lower')
      : tool.action === 'flatten' ? 'flatten' : 'smooth';
    const radius = tool.action === 'paint' && alt ? tool.size * 0.5 : tool.size;
    const from = this.last ?? { x, z };
    const rect = applyStroke(ts.terrain, { kind, x, z, radius, strength: tool.strength, falloff: tool.falloff, ...(tool.action === 'paint' ? { surface: tool.surface } : {}), ...(this.flattenTo !== null ? { target: this.flattenTo } : {}) }, from, { x, z }, Math.max(0.5, radius * 0.3));
    this.last = { x, z };
    if (!rect) return;
    this.dirty = this.dirty ? { c0: Math.min(this.dirty.c0, rect.c0), r0: Math.min(this.dirty.r0, rect.r0), c1: Math.max(this.dirty.c1, rect.c1), r1: Math.max(this.dirty.r1, rect.r1) } : rect;
    this.renderer.refreshTerrain(rect);
    if (now - this.lastPreview > 200 && this.dirty) {
      this.lastPreview = now;
      const d = this.rt.binder.decor();
      if (d) this.hooks.onDecorPreview(settlePlants(d.placements, ts.terrain, rectToArea(ts.terrain, this.dirty, 1), { ...rulesOf(this.rt, this.sceneId), plantsReact: false }, plantsOf(this.rt, this.sceneId)).items);
    }
    this.fire(tool, on, aim, { scale: kind === 'paint' ? 0.4 : 0.6, first, sound: { minGapMs: 85, volume: 0.6, pitch: 0.9 + Math.random() * 0.2 } });
  }

  /** One tick of a way to paint, dabbed along the stroke so a quick drag leaves no gaps. Fill and Stamp act once per press. */
  private paintWithWay(tool: ToolPreset, aim: Aim, alt: boolean, now: number, first: boolean, on: PlugEvent): void {
    const ts = this.rt.binder.terrain();
    if (!ts || !tool.way) return;
    const way = tool.way, x = aim.point[0], z = aim.point[2];
    if (way === 'clone' && alt) {
      if (first) { this.cloneSource = { x, z }; this.hooks.say('Copying from here. Now paint where the copy goes.'); this.fire(tool, on, aim, { only: ['sound'] }); }
      return;
    }
    if ((way === 'fill' || way === 'stamp') && !first) return;
    if (way === 'clone' && !this.cloneSource) { if (first) this.hooks.say('Right-click where to copy from first'); return; }
    if (first) {
      this.dirty = null; this.last = null; this.strokeLabel = tool.name; this.before = ts.terrain.heights.slice();
      this.cloneOffset = way === 'clone' && this.cloneSource ? { dx: this.cloneSource.x - x, dz: this.cloneSource.z - z } : null;
    }
    const radius = alt && way !== 'fill' ? tool.size * 0.5 : tool.size;
    const rules = rulesOf(this.rt, this.sceneId);
    const dab = (px: number, pz: number): DirtyRect | null => paintWay(ts.terrain, {
      way, x: px, z: pz, radius, strength: alt && way === 'smudge' ? tool.strength * 0.5 : tool.strength, falloff: tool.falloff, surface: tool.surface,
      seed: (Math.floor(now) ^ Math.floor(px * 7.3 + pz * 13.1)) >>> 0,
      ...(tool.shape ? { shape: tool.shape } : {}), ...(tool.pattern ? { pattern: tool.pattern } : {}), ...(this.cloneOffset ? { from: this.cloneOffset } : {}),
      natural: (h: number, flat: number) => naturalSurface(h, flat, rules),
    });
    const from = this.last ?? { x, z };
    const steps = way === 'fill' || way === 'stamp' ? 0 : Math.min(40, Math.floor(Math.hypot(x - from.x, z - from.z) / Math.max(0.5, radius * 0.35)));
    let rect: DirtyRect | null = null;
    for (let k = 1; k <= steps; k++) rect = union(rect, dab(from.x + ((x - from.x) * k) / (steps + 1), from.z + ((z - from.z) * k) / (steps + 1)));
    rect = union(rect, dab(x, z));
    this.last = { x, z };
    if (!rect) return;
    this.dirty = union(this.dirty, rect);
    this.renderer.refreshTerrain(rect);
    this.fire(tool, on, aim, { scale: way === 'fill' ? 1.4 : 0.4, first, sound: { minGapMs: 85, volume: 0.6, pitch: 0.9 + Math.random() * 0.2 } });
  }

  /**
   * One tick of a way to sculpt. Grab pulls the ground held at the press along with the pointer (from the ground as it was, so it never
   * smears); the others dab along the stroke. Symmetry mirrors each dab across the island's middle; Smooth after softens behind it.
   */
  private sculptWithWay(tool: ToolPreset, aim: Aim, alt: boolean, now: number, first: boolean, on: PlugEvent): void {
    const ts = this.rt.binder.terrain();
    if (!ts || !tool.sculpt) return;
    const way = tool.sculpt, x = aim.point[0], z = aim.point[2], t = ts.terrain;
    const mirrorX = t.spec.originX + ((t.spec.cols - 1) * t.spec.cell) / 2;
    if (way === 'stamp') {
      if (!first) return;
      this.before = t.heights.slice(); this.strokeLabel = tool.name;
      const shape = (tool.stampShape ?? 'mound') as StampKind;
      const kind: StampKind = alt ? (shape === 'mound' ? 'crater' : shape === 'crater' ? 'mound' : shape) : shape;
      const opts = { height: Math.max(0.2, tool.strength * tool.size * 0.6) * (alt && kind === shape ? -1 : 1), seed: Math.floor(now) % 99991, rotation: (now % 6283) / 1000 };
      let rect = stamp(t as never, kind, [x, z], Math.max(2, tool.size), opts) as DirtyRect | null;
      if (tool.mirror) rect = union(rect, stamp(t as never, kind, [2 * mirrorX - x, z], Math.max(2, tool.size), opts) as DirtyRect | null);
      if (rect) { this.dirty = rect; this.renderer.refreshTerrain(rect); }
      this.fire(tool, on, aim, { scale: 1.2 });
      return;
    }
    if (first) { this.dirty = null; this.last = null; this.strokeLabel = tool.name; this.before = t.heights.slice(); this.grabFrom = { x, z }; }
    const radius = alt && (way === 'grab' || way === 'noise' || way === 'erode') ? tool.size * 0.5 : tool.size;
    const dabAt = (px: number, pz: number): DirtyRect | null => {
      const d: SculptDab = {
        way, x: px, z: pz, radius, strength: tool.strength, falloff: tool.falloff, invert: alt && (way === 'clay' || way === 'crease' || way === 'pinch'),
        seed: (Math.floor(px * 7.3) * 31 + Math.floor(pz * 13.1)) >>> 0,
        ...(way === 'grab' && this.before && this.grabFrom ? { grab: { x: this.grabFrom.x, z: this.grabFrom.z, base: this.before, dx: px - this.grabFrom.x, dz: pz - this.grabFrom.z } } : {}),
      };
      let rect = sculptWay(t, d);
      if (tool.mirror) rect = union(rect, sculptWay(t, mirroredDab(d, mirrorX)));
      if (tool.smoothAfter && way !== 'grab') rect = union(rect, sculptWay(t, { ...d, way: 'smooth', strength: 0.15 }));
      return rect;
    };
    const from = this.last ?? { x, z };
    const steps = way === 'grab' ? 0 : Math.min(40, Math.floor(Math.hypot(x - from.x, z - from.z) / Math.max(0.5, radius * 0.3)));
    let rect: DirtyRect | null = null;
    for (let k = 1; k <= steps; k++) rect = union(rect, dabAt(from.x + ((x - from.x) * k) / (steps + 1), from.z + ((z - from.z) * k) / (steps + 1)));
    rect = union(rect, dabAt(x, z));
    this.last = { x, z };
    if (!rect) return;
    this.dirty = union(this.dirty, rect);
    this.renderer.refreshTerrain(rect);
    this.fire(tool, on, aim, { scale: 0.6, first, sound: { minGapMs: 85, volume: 0.6, pitch: 0.9 + Math.random() * 0.2 } });
  }

  private done(tool: ToolPreset, aim: Aim, text: string, on: PlugEvent = 'use'): void {
    this.hooks.onModels(); this.fire(tool, on, aim); saveMap(this.rt, this.sceneId);
    if (text) this.hooks.say(text);
  }

  /**
   * The button was released. The world responds (world-rules and plant presets): dug ground shows soil or rock, sunk ground becomes sea bed,
   * plants follow the ground or go when their ground no longer suits them. Ground and plants are committed together as ONE undo step.
   */
  /** A ground change made elsewhere (a road, a river, rain): put it in, paint what it paints, let the world respond: one undo step. */
  applyHeights(next: Float32Array, rect: DirtyRect, label: string, paint?: { readonly cells: readonly number[]; readonly surface: number }): void {
    const ts = this.rt.binder.terrain();
    if (!ts || next.length !== ts.terrain.heights.length) return;
    this.before = ts.terrain.heights.slice();
    ts.terrain.heights.set(next);
    if (paint) for (const i of paint.cells) { ts.terrain.surfaceA[i] = paint.surface; ts.terrain.blend[i] = 0; }
    this.dirty = rect;
    this.strokeLabel = label;
    this.renderer.refreshTerrain(rect);
    this.end();
  }

  end(): void {
    if (this.pressed) { this.fire(this.pressed, 'release', this.lastAim); this.pressed = null; }
    if (!this.dirty) return;
    const ts = this.rt.binder.terrain();
    const dirty = this.dirty, before = this.before;
    this.dirty = null; this.last = null; this.before = null;
    if (!ts) return;
    const rules = rulesOf(this.rt, this.sceneId);
    if (before) { if (respondToSculpt(ts.terrain, before, dirty, rules) > 0) this.renderer.refreshTerrain(dirty); }
    const decor = this.rt.binder.decor();
    const settled = decor ? settlePlants(decor.placements, ts.terrain, rectToArea(ts.terrain, dirty, 1), rules, plantsOf(this.rt, this.sceneId), before ?? undefined) : null;
    const label = this.strokeLabel || 'Sculpt';
    const moves = this.settleMoves(ts.terrain, dirty);
    this.rt.commands.transaction(label, () => {
      this.rt.commands.execute(cmd.setParam(`${this.terrainId}.data`, encodeTerrain(ts.terrain) as never, label));
      for (const [ref, g] of moves) this.rt.commands.execute(cmd.setParam(`${ref}.y`, g, label));
      if (decor && settled && (settled.removed > 0 || settled.moved > 0)) {
        const packed = packDecor(settled.items);
        this.rt.commands.execute(cmd.setParam(`${decor.presetId}.kinds`, packed.kinds as never, label));
        this.rt.commands.execute(cmd.setParam(`${decor.presetId}.items`, packed.items as never, label));
      }
    });
    // placed models stand on the ground too (moved inside the step above)
    if (moves.length) this.hooks.onModels();
    this.hooks.onDecorPreview(null);
    if (settled && settled.removed > 0) this.hooks.say(settled.removed === 1 ? 'One plant dug up' : `${settled.removed} plants dug up`);
    saveMap(this.rt, this.sceneId);
  }

  /** Things you placed by hand follow the ground under them (they are props: they never disappear on their own). */
  private settleMoves(terrain: Parameters<typeof heightAt>[0], dirty: DirtyRect): [PresetId, number][] {
    if (!rulesOf(this.rt, this.sceneId).plantsFollowGround) return [];
    const area = rectToArea(terrain, dirty, 1);
    const refs = this.rt.store.get(this.sceneId)?.children['models'] ?? [];
    const moves: [PresetId, number][] = [];
    for (const r of refs) {
      const x = this.param(r.ref, 'x', NaN), z = this.param(r.ref, 'z', NaN), y = this.param(r.ref, 'y', 0);
      if (!Number.isFinite(x) || !Number.isFinite(z) || x < area.x0 || x > area.x1 || z < area.z0 || z > area.z1) continue;
      const g = heightAt(terrain, x, z);
      if (Math.abs(g - y) > 1e-3) moves.push([r.ref, g]);
    }
    return moves;
  }

  /** Put one model into the scene (inside the caller's transaction). */
  private putModel(modelId: string, size: number, x: number, y: number, z: number, yaw: number, label: string): PresetId | null {
    const model = voxelModelById(modelId);
    if (!model) return null;
    const id = `model-${Date.now().toString(36)}-${(this.seq++).toString(36)}`;
    const name = THINGS.find((t) => t.id === modelId)?.name ?? 'Thing';
    const block = (PLACE_BLOCK[modelId] ?? 0.1) * size;
    this.rt.commands.execute(cmd.put({ id, kind: 'model', name, params: { data: encodeModel(model), scale: block, x, y, z, yaw, ao: true, greedy: true, castShadow: true } as never, tier: 'build' }, label));
    this.rt.commands.execute(cmd.addChild(this.sceneId, 'models', id, undefined, label));
    return id;
  }

  /**
   * The ways to place (docs/HOTBAR.md, Things), the thing from the palette: Place one where you point; Scatter a few round it, each turned
   * and sized a little differently; Row, between two clicks; Swap the thing you point at for the palette's, in its place and turn. Each is
   * one undo step.
   */
  private thingsWithWay(tool: ToolPreset, aim: Aim, alt: boolean): void {
    const way = tool.placeWay ?? 'one', name = THINGS.find((t) => t.id === tool.model)?.name ?? 'Thing';
    const ts = this.rt.binder.terrain();
    const groundY = (x: number, z: number): number => (ts ? heightAt(ts.terrain, x, z) : aim.point[1]);
    const done = (text: string): void => { this.hooks.onModels(); this.fire(tool, 'use', aim, { scale: 1.2 }); saveMap(this.rt, this.sceneId); this.hooks.say(text); };
    if (way === 'one') {
      if (alt) { if (!this.removeAt(aim, tool)) this.hooks.say('Nothing here to take away'); return; }
      this.rt.commands.transaction(`Place ${name}`, () => { this.putModel(tool.model, tool.size, aim.point[0], aim.point[1], aim.point[2], Math.round(Math.random() * 360 - 180), `Place ${name}`); });
      done(`${name} placed`);
      return;
    }
    if (way === 'scatter') {
      const count = Math.max(2, Math.round((alt ? 2 : 3) + tool.strength * (alt ? 3 : 9)));
      const radius = 2 + tool.strength * 5;
      const rnd = mulberry(Math.floor(performance.now()) >>> 0);
      this.rt.commands.transaction(`Scatter ${name}`, () => {
        for (let k = 0; k < count; k++) {
          // spread evenly round the point (a sunflower spiral), each one nudged, turned and sized a little differently
          const a = k * 2.39996 + rnd() * 0.6, r = radius * Math.sqrt((k + 0.5) / count) * (0.8 + rnd() * 0.4);
          const x = aim.point[0] + Math.cos(a) * r, z = aim.point[2] + Math.sin(a) * r;
          this.putModel(tool.model, tool.size * (0.75 + rnd() * 0.5), x, groundY(x, z), z, Math.round(rnd() * 360 - 180), `Scatter ${name}`);
        }
      });
      done(`${count} ${name.toLowerCase()}s scattered`);
      return;
    }
    if (way === 'row') {
      if (alt) { this.rowFrom = null; this.hooks.say('Row cancelled'); return; }
      if (!this.rowFrom) { this.rowFrom = [aim.point[0], aim.point[2]]; this.hooks.say('The row starts here: click where it ends'); this.fire(tool, 'use', aim, { only: ['sound'] }); return; }
      const [x0, z0] = this.rowFrom, x1 = aim.point[0], z1 = aim.point[2];
      this.rowFrom = null;
      const len = Math.hypot(x1 - x0, z1 - z0), gap = 1 + (1 - tool.strength) * 4 * Math.max(0.5, tool.size);
      const count = Math.min(60, Math.max(2, Math.floor(len / gap) + 1));
      const yaw = Math.round((Math.atan2(x1 - x0, z1 - z0) * 180) / Math.PI);
      this.rt.commands.transaction(`Row of ${name}`, () => {
        for (let k = 0; k < count; k++) { const f = count === 1 ? 0 : k / (count - 1), x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; this.putModel(tool.model, tool.size, x, groundY(x, z), z, yaw, `Row of ${name}`); }
      });
      done(`A row of ${count}`);
      return;
    }
    // swap: the same place and turn, the palette's thing
    const m = this.modelAt(aim);
    if (!m) { this.hooks.say('Point at a thing you placed to swap it'); return; }
    const x = this.param(m.ref, 'x', aim.point[0]), y = this.param(m.ref, 'y', aim.point[1]), z = this.param(m.ref, 'z', aim.point[2]), yaw = this.param(m.ref, 'yaw', 0);
    const was = this.rt.store.get(m.ref)?.name ?? 'it';
    this.rt.commands.transaction(`Swap for ${name}`, () => {
      this.rt.commands.execute(cmd.removeChild(this.sceneId, 'models', m.index, `Swap for ${name}`));
      this.putModel(tool.model, tool.size, x, y, z, yaw, `Swap for ${name}`);
    });
    done(`${was} became a ${name.toLowerCase()}`);
  }

  private place(tool: ToolPreset, aim: Aim): void {
    const model = voxelModelById(tool.model);
    if (!model) return;
    const id = `model-${Date.now().toString(36)}`;
    const yaw = Math.round(Math.random() * 360 - 180);
    const block = (PLACE_BLOCK[tool.model] ?? 0.1) * tool.size;
    this.rt.commands.transaction(`Place ${tool.name}`, () => {
      this.rt.commands.execute(cmd.put({ id, kind: 'model', name: tool.name, params: { data: encodeModel(model), scale: block, x: aim.point[0], y: aim.point[1], z: aim.point[2], yaw, ao: true, greedy: true, castShadow: true } as never, tier: 'build' }, `Place ${tool.name}`));
      this.rt.commands.execute(cmd.addChild(this.sceneId, 'models', id, undefined, `Place ${tool.name}`));
    });
    this.hooks.onModels();
    this.fire(tool, 'use', aim, { scale: 1.4 });
    saveMap(this.rt, this.sceneId);
  }

  /** Remove the placed model the aim is on, if any. Returns whether something was removed. */
  removeAt(aim: Aim, tool?: ToolPreset): boolean {
    const m = this.modelAt(aim);
    if (!m) return false;
    this.rt.commands.execute(cmd.removeChild(this.sceneId, 'models', m.index, 'Delete'));
    if (this.carrying === m.ref) this.carrying = null;
    this.hooks.onModels();
    if (tool) this.fire(tool, 'opposite', aim, { scale: 1.2, only: ['sprite', 'anim', 'shake'] });
    fx('delete'); saveMap(this.rt, this.sceneId);
    this.hooks.say('Taken away');
    return true;
  }

  undo(): void {
    if (this.rt.commands.undo()) { this.hooks.onModels(); fx('undo'); saveMap(this.rt, this.sceneId); } else fx('ui-error');
  }
}
