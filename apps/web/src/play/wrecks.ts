// The wreck sites on the plot, built (TASK-23c, TICKET-07 Item F): each cluster of two to four packed props stands on the ground round its leak,
// settled onto the slope with settleWreck so wreck trucks, vans and transponders sit tilted and half-buried and never float.
import * as THREE from 'three';
import { getGenSync, loadGen, GEN, type GenLevel } from '../assets/gen';
import {
  isBroken,
  rungLevel,
  settleWreck,
  wreckInteract,
  wreckModels,
  wreckRung,
  wreckSites,
  type SettledWreckPose,
  type WreckInteraction,
  type WreckMember,
  type WreckSite,
} from './wreck-sites';

export { settleWreck, wreckInteract, type SettledWreckPose, type WreckInteraction };

export interface AimedWreck {
  readonly id: string;
  readonly member: WreckMember;
  readonly site: number;
  readonly interaction: WreckInteraction;
}

export interface WreckSystem {
  /** The plot's stage: every site's rung follows it (a broken leak one rung below). */
  setStage(stage: number): void;
  /** A leak was sealed: its site's props go up one rung and lose the broken look. */
  seal(site: number): void;
  /** The sealed sites from the save (replaces the set). */
  restore(sites: readonly number[]): void;
  sealedSites(): readonly number[];
  /** The transponder or interactive wreck prop the ray meets within `reach` metres (its lore/wreck id), or null. */
  aimProp(origin: THREE.Vector3, dir: THREE.Vector3, reach: number): string | null;
  /** Full interaction details (salvage + log) for the aimed wreck within `reach` metres, or null. */
  aimWreck?(origin: THREE.Vector3, dir: THREE.Vector3, reach: number): AimedWreck | null;
  /** Marks a salvageable wreck member as salvaged and hides its mesh. */
  salvageWreck?(id: string): WreckInteraction['salvage'] | null;
  /** The rung and the broken look of every site (for the tests and the debug hook). */
  rungs(): readonly { readonly site: number; readonly leak: boolean; readonly sealed: boolean; readonly broken: boolean; readonly rung: number }[];
  /** Loads every wreck model at each level behind the loading bar, then rebuilds the sites with them. */
  preload(): Promise<void>;
  dispose(): void;
}

/** One prop of a site on the scene: its member, its site, its root and the model key it was built with. */
interface Built {
  readonly id: string;
  readonly member: WreckMember;
  readonly site: WreckSite;
  readonly root: THREE.Group;
  readonly interaction: WreckInteraction;
  salvaged: boolean;
  key: string;
}

const LEVELS: readonly GenLevel[] = ['low', 'mid', 'high'];
const GREY = new THREE.Color('#6d7178');

/** The broken look: the model's own materials, cloned for this copy, desaturated and dulled (the leak's column does the rest). */
function junkify(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloneOne = (mat: THREE.Material): THREE.Material => {
      const c = mat.clone() as THREE.MeshStandardMaterial;
      if (c.color) {
        c.color.lerp(GREY, 0.62);
        c.color.multiplyScalar(0.6);
      }
      if ('roughness' in c) c.roughness = 1;
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneOne) : cloneOne(mesh.material);
  });
}

/** A stand-in box for a model that is not loaded yet: its registry size. */
function standIn(id: string): THREE.Mesh {
  const size = (GEN[id]?.size ?? [1, 1, 1]) as readonly [number, number, number];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.9, metalness: 0.3 })
  );
  mesh.position.y = size[1] / 2;
  return mesh;
}

export function createWrecks(o: {
  readonly scene: THREE.Scene;
  readonly groundHeightAt: (x: number, z: number) => number;
  readonly seed: number;
  readonly gate: { readonly x: number; readonly z: number };
  readonly stage: number;
}): WreckSystem {
  const sites: WreckSite[] = wreckSites(o.seed, o.gate);
  const built: Built[] = [];
  const sealed = new Set<number>();
  let stage = Math.max(0, Math.min(6, Math.floor(o.stage)));
  const top = new THREE.Group();
  top.name = 'wrecks';
  o.scene.add(top);

  const rungOf = (site: WreckSite): number => wreckRung(stage, site.leak, sealed.has(site.index));

  const apply = (b: Built): void => {
    if (b.salvaged) {
      b.root.visible = false;
      return;
    }
    const broken = isBroken(b.site.leak, sealed.has(b.site.index));
    const level = rungLevel(rungOf(b.site));
    const key = `${level}|${broken ? 'junk' : 'clean'}`;
    if (b.key === key) return;
    b.key = key;
    const visual: THREE.Object3D = getGenSync(b.member.model, level) ?? standIn(b.member.model);
    if (broken) junkify(visual);
    b.root.clear();
    b.root.add(visual);
  };

  for (const site of sites) {
    site.members.forEach((member, mIdx) => {
      const root = new THREE.Group();
      const id = member.transponder ?? `wreck-${site.index}-${mIdx}`;
      root.name = `wreck:${site.index}:${mIdx}`;
      root.userData.wreckId = id;

      const settled = settleWreck(member, o.groundHeightAt, o.seed + site.index * 31 + mIdx);
      root.position.set(
        member.x,
        o.groundHeightAt(member.x, member.z) - settled.sink,
        member.z
      );
      root.rotation.set(settled.pitch, settled.yaw, settled.roll, 'YXZ');
      top.add(root);

      const interaction = wreckInteract(member);
      built.push({
        id,
        member,
        site,
        root,
        interaction,
        salvaged: false,
        key: '',
      });
    });
  }
  for (const b of built) apply(b);

  const rebuildAll = (): void => {
    for (const b of built) apply(b);
  };

  const hitBuilt = (origin: THREE.Vector3, dir: THREE.Vector3, reach: number, onlyTransponders: boolean): Built | null => {
    const candidates = built.filter((b) => !b.salvaged && (!onlyTransponders || Boolean(b.member.transponder)));
    const roots = candidates.map((b) => b.root);
    for (const r of roots) r.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(origin, dir.clone().normalize(), 0, reach);
    for (const h of ray.intersectObjects(roots, true)) {
      let x: THREE.Object3D | null = h.object;
      while (x && typeof x.userData.wreckId !== 'string') x = x.parent;
      if (x) {
        const hitId = x.userData.wreckId as string;
        const found = candidates.find((b) => b.id === hitId);
        if (found) return found;
      }
    }
    return null;
  };

  return {
    setStage(s) {
      const next = Math.max(0, Math.min(6, Math.floor(s)));
      if (next === stage) return;
      stage = next;
      rebuildAll();
    },
    seal(site) {
      if (sealed.has(site)) return;
      sealed.add(site);
      rebuildAll();
    },
    restore(list) {
      sealed.clear();
      for (const i of list) sealed.add(i);
      rebuildAll();
    },
    sealedSites: () => [...sealed].sort((a, b) => a - b),
    aimProp(origin, dir, reach) {
      const tr = hitBuilt(origin, dir, reach, true);
      if (tr) return tr.id;
      const anyHit = hitBuilt(origin, dir, reach, false);
      return anyHit ? anyHit.id : null;
    },
    aimWreck(origin, dir, reach) {
      const hit = hitBuilt(origin, dir, reach, false);
      if (!hit) return null;
      return {
        id: hit.id,
        member: hit.member,
        site: hit.site.index,
        interaction: hit.interaction,
      };
    },
    salvageWreck(id) {
      const target = built.find((b) => b.id === id);
      if (!target || target.salvaged || !target.interaction.salvage) return null;
      target.salvaged = true;
      target.root.visible = false;
      return target.interaction.salvage;
    },
    rungs() {
      return sites.map((site) => ({
        site: site.index,
        leak: site.leak,
        sealed: sealed.has(site.index),
        broken: isBroken(site.leak, sealed.has(site.index)),
        rung: rungOf(site),
      }));
    },
    async preload() {
      await Promise.all(
        wreckModels(sites).flatMap((id) =>
          LEVELS.map((level) =>
            loadGen(id, level).catch((err: unknown) => {
              console.warn(`[wrecks] ${id} at ${level} stays a box:`, err);
              return null;
            })
          )
        )
      );
      for (const b of built) b.key = '';
      rebuildAll();
    },
    dispose() {
      for (const b of built) b.root.removeFromParent();
      built.length = 0;
      top.removeFromParent();
    },
  };
}
