/**
 * The player character's instances. The model is Astro (`../astro/astro-model.ts`); the scientist names stay because
 * the lab, the creator and the animator use them. Astro's GLBs carry their own full clip set (see `adaptClipsForAstro`).
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadAstro, type AstroLevel } from '../astro/astro-model';

export const animsBinUrl = new URL('./anims.bin', import.meta.url);

/** The detail level new instances get; the game sets it from the Graphics quality (astroLevelFor). */
let defaultLevel: AstroLevel = 'mid';
export function setScientistLevel(level: AstroLevel): void { defaultLevel = level; }

/** The template for a level: Astro at 1.70 m, in metres. */
export async function loadScientistTemplate(level: AstroLevel = defaultLevel): Promise<THREE.Group> {
  return (await loadAstro(level)).scene;
}

/**
 * Prepares an instance for the scene: shadows on, and the spine bone the lab leans. Astro's suit is one baked material,
 * so a visor colour has no separate part to tint: `visorMaterials` is empty, and callers that set it change nothing.
 */
export function styleScientistGroup(group: THREE.Group, _visorHex = '#f59e0b'): { visorMaterials: THREE.MeshStandardMaterial[]; spine: THREE.Bone | null } {
  const spine = (group.getObjectByName('mixamorigSpine') as THREE.Bone) ?? null;
  group.userData.spine = spine;
  group.traverse((c) => { const mesh = c as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  return { visorMaterials: [], spine };
}

/** A new instance of the character. */
export async function createScientistInstance(visorHex = '#f59e0b', level: AstroLevel = defaultLevel): Promise<{
  group: THREE.Group;
  visorMaterials: THREE.MeshStandardMaterial[];
  spine: THREE.Bone | null;
}> {
  const astro = await loadAstro(level);
  const group = SkeletonUtils.clone(astro.scene) as THREE.Group;
  group.userData.astroClips = astro.clips;
  const { visorMaterials, spine } = styleScientistGroup(group, visorHex);
  return { group, visorMaterials, spine };
}

/**
 * The clips an Astro instance plays: its own GLB carries the whole set. Walking and Running are Meshy's; the other twelve
 * are the Mixamo set retargeted onto Astro's rig by `scripts/retarget-astro.ts`. The scientist set (`clips`) is only the
 * fallback for a name Astro lacks.
 */
export function adaptClipsForAstro(root: THREE.Object3D, clips: Map<string, THREE.AnimationClip>): Map<string, THREE.AnimationClip> {
  const own = (root.userData.astroClips as readonly THREE.AnimationClip[] | undefined) ?? [];
  const out = new Map<string, THREE.AnimationClip>();
  for (const c of own) out.set(c.name.toLowerCase(), c);
  for (const [name, clip] of clips) if (!out.has(name)) out.set(name, clip);
  return out;
}
