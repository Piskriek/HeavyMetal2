import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { ThreeRenderer } from '@hm/render';
import { applyStroke, encodeTerrain, heightAt, type DirtyRect } from '@hm/terrain';
import { encodeModel, type VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { fx } from '../maker/feedback';
import { saveMap } from '../maker/storage';
import { focusTargetOf } from '../maker/focus';
import { SPRITES, type HotItem } from './hotbar';

/**
 * What using a hotbar slot does. The crosshair finds the point on the ground; the tool changes the world there, a sprite bursts and a sound plays.
 * Terrain strokes are committed as one undoable edit when the button is released; placing a model is its own undo step.
 */
const BLOCK: Readonly<Record<string, number>> = { goblin: 0.04, palm: 0.25, barrel: 0.08, rock: 0.15, trophy: 0.1, 'statue-plinth': 0.2 };

export interface Aim { readonly point: readonly [number, number, number]; readonly normal: readonly [number, number, number] | null }

export class BuildController {
  private dirty: DirtyRect | null = null;
  private last: { x: number; z: number } | null = null;
  private lastUse = 0;
  private flattenTo: number | null = null;
  private strokeLabel = '';

  constructor(private readonly rt: Runtime, private readonly renderer: ThreeRenderer, private readonly sceneId: PresetId, private readonly terrainId: PresetId, private readonly onModels: () => void, private readonly say: (text: string) => void) {}

  private sprite(item: HotItem, a: Aim, scale = 1): void {
    const s = SPRITES[item.sprite];
    this.renderer.burst({ ...s, count: Math.round(s.count * scale), position: [a.point[0], a.point[1] + 0.1, a.point[2]], ...(a.normal ? { normal: a.normal } : {}) });
  }

  /** Called every frame the button is held (and once on press). `alt` flips raise to lower. */
  use(item: HotItem, aim: Aim, alt: boolean, now: number, first: boolean): void {
    const ts = this.rt.binder.terrain();
    const every = item.kind === 'place' || item.kind === 'pick' ? 1e9 : 70; // brushes repeat, one-shot tools fire once per press
    if (!first && now - this.lastUse < every) return;
    this.lastUse = now;
    const x = aim.point[0], z = aim.point[2];
    if (item.kind === 'pick') {
      this.sprite(item, aim, 0.5); fx(item.sound);
      this.say(`Ground at ${aim.point[1].toFixed(1)} m`);
      return;
    }
    if (item.kind === 'place') {
      if (!first) return;
      this.place(item, aim);
      return;
    }
    if (!ts) return;
    if (first) { this.dirty = null; this.last = null; this.flattenTo = item.kind === 'flatten' ? heightAt(ts.terrain, x, z) : null; this.strokeLabel = item.label; }
    const kind = item.kind === 'dig' ? 'lower' : item.kind === 'sculpt' ? (alt ? 'lower' : 'raise') : item.kind === 'flatten' ? 'flatten' : item.kind === 'smooth' ? 'smooth' : 'paint';
    const strength = kind === 'paint' ? 1 : kind === 'smooth' ? 0.5 : item.kind === 'dig' ? 0.55 : 0.4;
    const from = this.last ?? { x, z };
    const rect = applyStroke(ts.terrain, { kind, x, z, radius: item.size, strength, falloff: 'smooth', ...(item.surface !== undefined ? { surface: item.surface } : {}), ...(this.flattenTo !== null ? { target: this.flattenTo } : {}) }, from, { x, z }, Math.max(0.5, item.size * 0.3));
    this.last = { x, z };
    if (!rect) return;
    this.dirty = this.dirty ? { c0: Math.min(this.dirty.c0, rect.c0), r0: Math.min(this.dirty.r0, rect.r0), c1: Math.max(this.dirty.c1, rect.c1), r1: Math.max(this.dirty.r1, rect.r1) } : rect;
    this.renderer.refreshTerrain(rect);
    this.sprite(item, aim, kind === 'paint' ? 0.4 : 0.6);
    fx(item.sound, { minGapMs: 85, volume: 0.6, pitch: 0.9 + Math.random() * 0.2 });
  }

  /** The button was released: commit the stroke as one undo step and save. */
  end(): void {
    if (!this.dirty) return;
    const ts = this.rt.binder.terrain();
    this.dirty = null; this.last = null;
    if (!ts) return;
    this.rt.commands.execute(cmd.setParam(`${this.terrainId}.data`, encodeTerrain(ts.terrain) as never, this.strokeLabel || 'Sculpt'));
    saveMap(this.rt, this.sceneId);
  }

  private place(item: HotItem, aim: Aim): void {
    const entry = MODELS.find((m) => m.id === item.model);
    if (!entry) return;
    const model = entry.build() as unknown as VoxelModel;
    const id = `model-${Date.now().toString(36)}`;
    const yaw = Math.round(Math.random() * 360 - 180);
    this.rt.commands.transaction(`Place ${item.label}`, () => {
      this.rt.commands.execute(cmd.put({ id, kind: 'model', name: entry.name, params: { data: encodeModel(model), scale: BLOCK[model.id] ?? 0.1, x: aim.point[0], y: aim.point[1], z: aim.point[2], yaw, ao: true, greedy: true, castShadow: true } as never, tier: 'build' }, `Place ${item.label}`));
      this.rt.commands.execute(cmd.addChild(this.sceneId, 'models', id, undefined, `Place ${item.label}`));
    });
    this.onModels();
    this.sprite(item, aim, 1.4); fx(item.sound);
    saveMap(this.rt, this.sceneId);
    this.say(`${entry.name} placed`);
  }

  /** Remove the placed model the crosshair is on, if any. Returns whether something was removed. */
  removeAt(aim: Aim, item: HotItem): boolean {
    const refs = this.rt.store.get(this.sceneId)?.children['models'] ?? [];
    for (let i = 0; i < refs.length; i++) {
      const t = focusTargetOf(this.rt, refs[i]!.ref);
      if (t && Math.hypot(t.center[0] - aim.point[0], t.center[2] - aim.point[2]) <= t.radius) {
        this.rt.commands.execute(cmd.removeChild(this.sceneId, 'models', i, 'Delete model'));
        this.onModels(); this.sprite(item, aim, 1.2); fx('delete'); saveMap(this.rt, this.sceneId);
        return true;
      }
    }
    return false;
  }

  undo(): void {
    if (this.rt.commands.undo()) { this.onModels(); fx('undo'); saveMap(this.rt, this.sceneId); } else fx('ui-error');
  }
}
