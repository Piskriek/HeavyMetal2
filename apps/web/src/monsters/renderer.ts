// The monster renderer: one object that draws every monster of every era in a scene. Sprite monsters go through one instanced batch per
// skin (sprite-batch.ts); 3D monsters are clones with their own clips (model-instance.ts). Per frame: `sync` takes the simulation's
// monsters (positions, phases, times) and picks their skins; `update` picks the views and frames for the camera, and evaluates the
// nearest 3D monsters' animation up to the budget (the rest hold their pose). A skin that is not loaded is drawn as its fallback.
import * as THREE from 'three';
import type { Archetype, SkinInfo } from './roster';
import { SKINS } from './roster';
import { fallbackFor } from './adapter';
import { loadSkin, skinAsset, skinFailed, type ModelAsset, type SpriteAsset } from './loader';
import { SpriteBatch } from './sprite-batch';
import { ModelInstance } from './model-instance';
import { playFor, yawFromMotion, type Play } from './timing';
import { levelsFor, rimOf, type Look } from './overlay';

/** The part of a leaksim mob the renderer reads (a Mob has all of these). `yaw` overrides the facing taken from the motion. */
export interface MonsterMob {
  readonly id: number;
  readonly kind: Archetype;
  readonly x: number;
  readonly z: number;
  readonly phase: 'roam' | 'chase' | 'windup' | 'attack' | 'recover' | 'pain' | 'dead';
  readonly phaseT: number;
  readonly yaw?: number;
  /** The ground height under the monster (the plot is not flat); 0 when the caller does not give it. */
  readonly y?: number;
}

export interface MonsterRenderBudget {
  /** 3D monsters whose clips are evaluated each frame (the nearest ones); the others hold their pose. */
  readonly animated: number;
  /** Monsters per sprite skin (the batch's capacity). */
  readonly perSkin: number;
}

export interface MonsterRenderStats {
  readonly sprites: number;
  readonly models: number;
  readonly animated: number;
  readonly held: number;
  readonly fallbacks: number;
  readonly dropped: number;
  readonly batches: number;
}

export interface MonsterRenderer {
  /** Takes the monsters of this frame. `skinOf` gives each one's skin id (the adapter's choice). */
  sync(mobs: readonly MonsterMob[], skinOf: (m: MonsterMob) => string): void;
  /** Picks each monster's view and frame for the camera, and evaluates the animations within the budget. */
  update(dt: number, camera: THREE.Camera): void;
  /** The plot's stage: the monsters are quantised to the ground's look (stage 0 is 1-bit, stage 3 and up smooth). */
  setStage(stage: number): void;
  stats(): MonsterRenderStats;
  dispose(): void;
}

interface ModelEntry { readonly id: number; readonly inst: ModelInstance; readonly skin: string; x: number; z: number; play: Play }
interface MotionState { x: number; z: number; yaw: number }

export function createMonsterRenderer(scene: THREE.Scene, opts: { readonly budget: MonsterRenderBudget; readonly roster?: readonly SkinInfo[] }): MonsterRenderer {
  const roster = opts.roster ?? SKINS;
  const budget = opts.budget;
  // a 3D skin turns its native front onto +z (roster turn): the facing is the mobs' yaw plus that turn
  const turns = new Map(roster.map((r) => [r.id, r.turn] as const));
  const turnOf = (id: string): number => turns.get(id) ?? 0;
  const skinInfoById = new Map(roster.map((r) => [r.id, r] as const));
  // the look of a skin: its archetype's rim, its own remap pull, and the quantisation of the stage the plot is on
  // smooth until the owner says the stage (the plot and the bench do; the window's walkers do not yet)
  let levels = 0;
  const lookOf = (id: string): Look => {
    const info = skinInfoById.get(id);
    return { rim: info ? rimOf(info.archetype) : 0x3dc8ff, remap: info?.remapStrength ?? 0.2, levels };
  };
  const batches = new Map<string, SpriteBatch>();
  const models = new Map<number, ModelEntry>();
  const motion = new Map<number, MotionState>();
  const requested = new Set<string>();
  let fallbackCount = 0;
  let entries: ModelEntry[] = [];
  let heldCount = 0;
  let animatedCount = 0;

  /** The drawn skin of a monster: the skin itself when it is loaded, else its fallback (and the load is asked for once). */
  const drawable = (skin: string): { id: string; asset: SpriteAsset | ModelAsset } | null => {
    const own = skinAsset(skin);
    if (own) return { id: skin, asset: own };
    if (!requested.has(skin) && !skinFailed(skin)) {
      requested.add(skin);
      loadSkin(skin, roster).catch(() => { /* logged by the loader; the fallback draws */ });
    }
    const fb = fallbackFor(skin, roster);
    const fa = skinAsset(fb);
    if (fa) {
      fallbackCount++;
      return { id: fb, asset: fa };
    }
    if (!requested.has(fb)) {
      requested.add(fb);
      loadSkin(fb, roster).catch(() => { /* a core fallback that fails leaves the monster unseen */ });
    }
    return null;
  };

  const batchFor = (id: string, asset: SpriteAsset): SpriteBatch => {
    let b = batches.get(id);
    if (!b) {
      b = new SpriteBatch(asset, budget.perSkin, [1, 1, 1], lookOf(id));
      batches.set(id, b);
      scene.add(b.mesh);
    }
    return b;
  };

  return {
    setStage(stage) {
      levels = levelsFor(stage);
      for (const b of batches.values()) b.setLevels(levels);
      for (const e of models.values()) e.inst.setLevels(levels);
    },

    sync(mobs, skinOf) {
      for (const b of batches.values()) b.begin();
      fallbackCount = 0;
      const seen = new Set<number>();
      const drawn = new Set<number>();
      const next: ModelEntry[] = [];
      for (const m of mobs) {
        seen.add(m.id);
        const prev = motion.get(m.id) ?? { x: m.x, z: m.z, yaw: 0 };
        const yaw = m.yaw ?? yawFromMotion(prev.yaw, m.x - prev.x, m.z - prev.z);
        motion.set(m.id, { x: m.x, z: m.z, yaw });
        const play = playFor(m.phase);
        const d = drawable(skinOf(m));
        if (!d) continue;
        drawn.add(m.id);
        if (d.asset.kind === 'sprite') {
          batchFor(d.id, d.asset).push({ x: m.x, z: m.z, y: m.y ?? 0, yaw, play, phaseT: m.phaseT });
          continue;
        }
        let e = models.get(m.id);
        if (!e || e.skin !== d.id) {
          if (e) e.inst.dispose();
          e = { id: m.id, inst: new ModelInstance(d.asset, lookOf(d.id)), skin: d.id, x: m.x, z: m.z, play };
          models.set(m.id, e);
          scene.add(e.inst.root);
        }
        e.x = m.x;
        e.z = m.z;
        e.play = play;
        e.inst.root.position.set(m.x, m.y ?? 0, m.z);
        e.inst.root.rotation.set(0, yaw + turnOf(d.id), 0);
        e.inst.root.visible = true;
        e.inst.setPlay(play, m.phaseT);
        next.push(e);
      }
      // the monsters not drawn this frame (gone, dead and removed, or with no skin to draw): their clones go; forgotten motion goes too
      for (const [id, e] of models) {
        if (!drawn.has(id)) { e.inst.dispose(); models.delete(id); }
      }
      for (const id of motion.keys()) if (!seen.has(id)) motion.delete(id);
      entries = next;
    },

    update(_dt, camera) {
      const cx = camera.position.x, cz = camera.position.z;
      for (const b of batches.values()) b.update(cx, cz);
      // the nearest 3D monsters are evaluated; the rest keep their last pose (held)
      const byDistance = [...entries].sort((a, b) => dist2(a, cx, cz) - dist2(b, cx, cz));
      animatedCount = 0;
      byDistance.forEach((e, i) => {
        if (i < budget.animated) { e.inst.apply(); animatedCount++; }
      });
      heldCount = byDistance.length - animatedCount;
    },

    stats() {
      let sprites = 0, dropped = 0;
      for (const b of batches.values()) { sprites += b.count; dropped += b.dropped; }
      return { sprites, models: entries.length, animated: animatedCount, held: heldCount, fallbacks: fallbackCount, dropped, batches: batches.size };
    },

    dispose() {
      for (const b of batches.values()) { scene.remove(b.mesh); b.dispose(); }
      batches.clear();
      for (const e of models.values()) e.inst.dispose();
      models.clear();
      motion.clear();
      entries = [];
    },
  };
}

const dist2 = (e: { x: number; z: number }, cx: number, cz: number): number => (e.x - cx) ** 2 + (e.z - cz) ** 2;
