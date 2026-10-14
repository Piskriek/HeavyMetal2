// The wreck sites on the plot, built (TASK-23c): each cluster of two to four packed props stands on the ground round its leak, a
// transponder tipped and half buried among them. A broken leak's props read as broken junk; sealing the leak lifts them one rung on
// the junk-model ladder (wreck-sites.ts holds the rules). The sites are laid out from the plot's seed and gate, the same as the leaks.
import * as THREE from 'three';
import { getGenSync, loadGen, GEN, type GenLevel } from '../assets/gen';
import { isBroken, rungLevel, wreckModels, wreckRung, wreckSites, type WreckMember, type WreckSite } from './wreck-sites';

export interface WreckSystem {
  /** The plot's stage: every site's rung follows it (a broken leak one rung below). */
  setStage(stage: number): void;
  /** A leak was sealed: its site's props go up one rung and lose the broken look. */
  seal(site: number): void;
  /** The sealed sites from the save (replaces the set). */
  restore(sites: readonly number[]): void;
  sealedSites(): readonly number[];
  /** The transponder the ray meets within `reach` metres (its lore id), or null. */
  aimProp(origin: THREE.Vector3, dir: THREE.Vector3, reach: number): string | null;
  /** The rung and the broken look of every site (for the tests and the debug hook). */
  rungs(): readonly { readonly site: number; readonly leak: boolean; readonly sealed: boolean; readonly broken: boolean; readonly rung: number }[];
  /** Loads every wreck model at each level behind the loading bar, then rebuilds the sites with them. */
  preload(): Promise<void>;
  dispose(): void;
}

/** One prop of a site on the scene: its member, its site, its root and the model key it was built with. */
interface Built {
  readonly member: WreckMember;
  readonly site: WreckSite;
  readonly root: THREE.Group;
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
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.9, metalness: 0.3 }));
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

  /** Puts a member's model at its site's rung: the broken look while its leak is open, the rung's level otherwise. Rebuilt only when
   *  the level or the look changes. */
  const apply = (b: Built): void => {
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
    for (const member of site.members) {
      const root = new THREE.Group();
      root.name = `wreck:${site.index}`;
      if (member.transponder) root.userData.wreckId = member.transponder;
      root.position.set(member.x, o.groundHeightAt(member.x, member.z) - member.sink, member.z);
      root.rotation.set(member.tilt, member.yaw, 0, 'YXZ');
      top.add(root);
      built.push({ member, site, root, key: '' });
    }
  }
  for (const b of built) apply(b);

  const rebuildAll = (): void => {
    for (const b of built) apply(b);
  };
  const transponderRoots = (): THREE.Object3D[] => built.filter((b) => b.member.transponder).map((b) => b.root);

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
      const roots = transponderRoots();
      for (const r of roots) r.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(origin, dir.clone().normalize(), 0, reach);
      for (const h of ray.intersectObjects(roots, true)) {
        let x: THREE.Object3D | null = h.object;
        while (x && typeof x.userData.wreckId !== 'string') x = x.parent;
        if (x) return x.userData.wreckId as string;
      }
      return null;
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
      await Promise.all(wreckModels(sites).flatMap((id) => LEVELS.map((level) => loadGen(id, level).catch((err: unknown) => {
        console.warn(`[wrecks] ${id} at ${level} stays a box:`, err);
        return null;
      }))));
      // the stand-ins were built under the same keys: clear them, so every prop takes its loaded model
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
