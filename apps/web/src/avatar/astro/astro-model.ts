/**
 * Astro, the player character — as an assembled creature, not a GLB.
 *
 * `ASTRO_SUIT_CREATURE_KIT` is the suit as plan 44's five-group organism: the `@hm/creature` genome
 * (`ASTRO_SUIT_GENOME`) compiled into 45 audited `@hm/kitspec` parts, every joint a coaxial knuckle. There is no mesh
 * asset and no skinning here at all:
 *
 *  - each part is built from its `@hm/partgen` generator, transformed into the local frame of the one Mixamo bone it binds
 *    to (`creaturePartBones()`), and parented onto that bone, so a clip turning `mixamorigLeftLeg` carries the shin;
 *  - the bone hierarchy is the rest rig table in `mixamo-rig.ts` — the same names the packed clips animate — so the
 *    animator, the rifle mount (`mixamorigRightHand`) and the lab's lean (`mixamorigSpine`) all keep working;
 *  - one mesh per part, each carrying its kit path, so the beam and the Studio's cartridges can name the exact part they hit
 *    (there are no vertex weights anywhere and nothing is solved on the CPU per frame).
 *
 * Colour is sampled through `@hm/matstack`'s linear-light pipeline (`hexToLinear`), with the visor as a gold film.
 *
 * The old `astro-low.glb` (1.2 MiB of Meshy geometry plus its HD pack) is gone: the suit is code.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flatten, type DetailRank, type PartDef, type PartSource } from '@hm/kitspec';
import type { KitBuild } from '../../play/kit-build';
import { buildPart, type Rank } from '@hm/partgen';
import { hexToLinear } from '@hm/matstack';
import { ASTRO_SUIT_GENOME, CREATURE_PRESET, creatureAssembly, creaturePartBones } from '@hm/creature';
import { buildMixamoRig, type MixamoRig } from './mixamo-rig';

/** low = the Light material rank, mid = Standard, high = Full (the avatar creator's own view). */
export type AstroLevel = 'low' | 'mid' | 'high';

/** The rest height of Astro's hips, metres: the scale for clips authored on other Mixamo rigs. */
export const ASTRO_HIPS_Y = 0.916;

const ASTRO_ASSEMBLY = creatureAssembly(ASTRO_SUIT_GENOME);

/**
 * The suit, as a kit: the five-group assembly, the preset it is flattened from, and which host bone each placed part
 * binds to. Everything the Studio turntable, the lab's beam and the animator need to treat the player as a creature.
 */
export const ASTRO_SUIT_CREATURE_KIT = Object.freeze({
  kit: ASTRO_ASSEMBLY.kit,
  preset: CREATURE_PRESET,
  genome: ASTRO_SUIT_GENOME,
  skeleton: ASTRO_ASSEMBLY.skeleton,
  /** `path → mixamorig bone name`: the rigid binding, one per part. */
  bones: creaturePartBones(ASTRO_SUIT_GENOME),
});

export interface AstroTemplate { readonly scene: THREE.Group; readonly clips: readonly THREE.AnimationClip[] }

/* ------------------------------------------------------------------ the suit's materials */

interface SuitPaint { readonly colour: string; readonly metalness: number; readonly roughness: number; readonly emissive?: string }

/**
 * The suit's paint, keyed by the material ids `ASTRO_SUIT_GENOME` names (see `ASTRO_MATERIALS` in `@hm/creature`).
 * Values are sRGB hex, converted to the linear-light the renderer wants by `@hm/matstack`.
 */
const SUIT_PAINT: Readonly<Record<string, SuitPaint>> = Object.freeze({
  'suit-shell': { colour: '#cfd6dd', metalness: 0.15, roughness: 0.62 },
  'suit-dark': { colour: '#39404a', metalness: 0.35, roughness: 0.48 },
  'suit-gold': { colour: '#d9a514', metalness: 0.95, roughness: 0.24 },
  'suit-lens': { colour: '#2a1206', metalness: 0.6, roughness: 0.12, emissive: '#f59e0b' },
  'effector-boot': { colour: '#24282f', metalness: 0.25, roughness: 0.7 },
});

const FALLBACK_PAINT: SuitPaint = { colour: '#b9c0c8', metalness: 0.2, roughness: 0.6 };

/** A material for a suit palette id, in the renderer's linear-light space. */
function suitMaterial(name: string, cache: Map<string, THREE.MeshStandardMaterial>): THREE.MeshStandardMaterial {
  const hit = cache.get(name);
  if (hit) return hit;
  const paint = SUIT_PAINT[name] ?? FALLBACK_PAINT;
  const [r, g, b] = hexToLinear(paint.colour);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(r, g, b), metalness: paint.metalness, roughness: paint.roughness });
  material.name = name;
  if (paint.emissive) {
    const [er, eg, eb] = hexToLinear(paint.emissive);
    material.emissive = new THREE.Color(er, eg, eb);
    material.emissiveIntensity = 1.15;
  }
  cache.set(name, material);
  return material;
}

/* ------------------------------------------------------------------ part → geometry */

/** One buffer geometry per material slot of a part, in the part's own frame. */
function slotGeometries(source: PartSource, def: PartDef, rank: Rank): { slot: string; geometry: THREE.BufferGeometry }[] {
  const out: { slot: string; geometry: THREE.BufferGeometry }[] = [];
  if (source.kind === 'box') {
    const [x, y, z] = source.size;
    const geometry = new THREE.BoxGeometry(x, y, z);
    geometry.translate(0, y / 2, 0);
    out.push({ slot: 'box', geometry });
    return out;
  }
  if (source.kind === 'param') {
    const md = buildPart(source.gen, source.params, rank);
    if (!md) return out;
    for (const slot of md.slots) {
      if (slot.count === 0) continue;
      // each slot gets its own compacted geometry: sharing the whole part's vertex buffer would inflate every mesh's
      // bounding box to the other slots' extent, and the beam's aim and the Studio's part picking read those boxes
      const remap = new Map<number, number>();
      const index = new Uint32Array(slot.count);
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      for (let i = 0; i < slot.count; i += 1) {
        const from = md.indices[slot.start + i] as number;
        let to = remap.get(from);
        if (to === undefined) {
          to = remap.size;
          remap.set(from, to);
          positions.push(md.positions[from * 3] as number, md.positions[from * 3 + 1] as number, md.positions[from * 3 + 2] as number);
          normals.push(md.normals[from * 3] as number, md.normals[from * 3 + 1] as number, md.normals[from * 3 + 2] as number);
          uvs.push(md.uvs[from * 2] as number, md.uvs[from * 2 + 1] as number);
        }
        index[i] = to;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
      out.push({ slot: slot.name, geometry });
    }
    return out;
  }
  // a generated asset has no geometry in code: the suit is built from generators only, so nothing to add
  void def;
  return out;
}

const RANK_FOR: Readonly<Record<AstroLevel, Rank>> = Object.freeze({ low: 1, mid: 2, high: 2 });

/* ------------------------------------------------------------------ the assembled suit */

/**
 * Builds the suit: the Mixamo rest rig with the compiled kit's parts parented onto it. Pure — the same call gives the
 * same hierarchy, part for part.
 */
export function buildAstroSuit(level: AstroLevel = 'high'): THREE.Group {
  const rank = RANK_FOR[level];
  const rig: MixamoRig = buildMixamoRig();
  const rootBone = rig.bones.get('mixamorigHips');
  if (!rootBone) throw new Error('@hm/creature: the Astro rig has no hips');
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  const boneLocal = new THREE.Matrix4();
  const presetMatrix = new THREE.Matrix4();

  for (const placed of flatten(ASTRO_SUIT_CREATURE_KIT.kit, ASTRO_SUIT_CREATURE_KIT.preset)) {
    const def = ASTRO_SUIT_CREATURE_KIT.kit.parts[placed.part];
    if (!def) continue;
    const boneName = ASTRO_SUIT_CREATURE_KIT.bones[placed.path];
    const bone = (boneName ? rig.bones.get(boneName) : null) ?? rootBone;
    // from the preset frame into the bone's own frame: the part then rides the bone exactly as it was fitted
    boneLocal.copy(bone.matrixWorld).invert();
    presetMatrix.fromArray(placed.matrix as unknown as number[]);
    const intoBone = boneLocal.clone().multiply(presetMatrix);

    // one mesh per (part, material): the part stays a separate object, so a beam hit still names it exactly
    const byMaterial = new Map<string, THREE.BufferGeometry[]>();
    for (const { slot, geometry } of slotGeometries(placed.source, def, rank)) {
      const materialName = placed.slotMaterials?.[slot] ?? placed.material;
      geometry.applyMatrix4(intoBone);
      const list = byMaterial.get(materialName) ?? [];
      list.push(geometry);
      byMaterial.set(materialName, list);
    }
    for (const [materialName, list] of byMaterial) {
      const geometry = list.length === 1 ? list[0]! : mergeGeometries(list, false);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, suitMaterial(materialName, materials));
      mesh.name = `${placed.path}:${materialName}`;
      mesh.userData[ASTRO_PART_PATH] = placed.path;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      bone.add(mesh);
    }
  }
  const scene = rig.root;
  scene.name = 'astro-suit';
  scene.updateMatrixWorld(true);
  return scene;
}

/** The `userData` key a suit mesh carries its kit path under (one mesh per placed part). */
export const ASTRO_PART_PATH = 'astroPartPath';

/**
 * The suit as a `KitBuild`, so the beam, the part cartridges and the Studio turntable treat the player like any other kit:
 * the hit test walks the same per-part meshes the avatar renders, and each mesh carries its placed part's path.
 */
export function astroSuitBuild(level: AstroLevel = 'high'): KitBuild {
  return astroSuitBuildFor(buildAstroSuit(level));
}

/**
 * Wraps an *existing* suit instance (the player's, built by `createScientistInstance`) as a `KitBuild`, so the beam aims
 * at the meshes actually on screen. The build holds no geometry of its own: `partAt` reads the path each mesh carries.
 */
export function astroSuitBuildFor(group: THREE.Group): KitBuild {
  const placed = flatten(ASTRO_SUIT_CREATURE_KIT.kit, ASTRO_SUIT_CREATURE_KIT.preset);
  const byPath = new Map(placed.map((part) => [part.path, part]));
  let meshes = 0;
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes += 1; });
  return {
    group,
    placed,
    setMaxRank: () => undefined,
    calls: () => meshes,
    partAt: (mesh: THREE.Object3D): (typeof placed)[number] | null => {
      const path = mesh.userData[ASTRO_PART_PATH];
      return typeof path === 'string' ? byPath.get(path) ?? null : null;
    },
  };
}

/** The pose data the animator reads: the rig carries every clip's bone, so `clips` is empty (the lab loads them). */
const cache = new Map<AstroLevel, Promise<AstroTemplate>>();

/**
 * Astro at a level. Every level is one procedural suit (there is no GLB to stream); the level only picks the partgen
 * detail rank, so Low builds the same organism with coarser generator variants.
 */
export function loadAstro(level: AstroLevel): Promise<AstroTemplate> {
  const hit = cache.get(level);
  if (hit) return hit;
  const loading = Promise.resolve({ scene: buildAstroSuit(level), clips: [] });
  cache.set(level, loading);
  return loading;
}

/** The level a graphics tier gets: Low on the min-spec laptop, Medium, High. */
export function astroLevelFor(tier: string | undefined): AstroLevel {
  return tier === 'high' || tier === 'ultra' ? 'high' : tier === 'low' || tier === 'potato' ? 'low' : 'mid';
}

export type { DetailRank };
