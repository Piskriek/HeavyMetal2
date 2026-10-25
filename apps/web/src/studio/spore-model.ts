/** One kit builder and matstack path for Spore beauty shots, imports, and preset player rigs. */
import * as THREE from 'three';
import { buildCreatureKit, CREATURE_PRESET, creatureGenomeById } from '@hm/creature';
import type { SporeCreation } from '@hm/cartlab';
import { flatten, type Kit, type Overrides } from '@hm/kitspec';
import { resolveCreatureMaterial } from '../monsters/loader';
import { GEN, getGenRawSync, loadGenRaw } from '../assets/gen';
import { buildKitPreset, type KitBuild } from '../play/kit-build';
import { MATSTACK_TEST_PIECE_KIT, TEST_PIECE_PRESET, withMaterial } from '../play/kit-modules';
import { gameRigKit } from '../play/game-presets';
import { plotKitMaterials } from '../play/plot-kits';
import { kitLayering, layeredMaterial, materialForSpec, type LayeredEnv } from '../play/layered-material';

export function sporeModelBinding(creation: SporeCreation): { readonly kit: Kit; readonly preset: string } {
  const binding = creation.kind === 'material' ? { kit: withMaterial(MATSTACK_TEST_PIECE_KIT, 'spore-material'), preset: TEST_PIECE_PRESET }
    : creation.kind === 'kit' ? { kit: creation.spec, preset: creation.preset }
    : creation.kind === 'creature' ? { kit: buildCreatureKit(creation.spec), preset: CREATURE_PRESET }
    : gameRigKit(creation.spec.playerRigId);
  if (!binding) throw new Error('Unknown Spore player rig');
  return binding;
}

/** Only registered local assets can load; a card cannot turn a gen id into an arbitrary URL. Reuses gen.ts's cache. */
export async function preloadSporeCreation(creation: SporeCreation): Promise<void> {
  const binding = sporeModelBinding(creation);
  const assets = new Set(flatten(binding.kit, binding.preset).flatMap((p) => p.source.kind === 'gen' ? [p.source.asset] : []));
  for (const id of assets) if (!Object.hasOwn(GEN, id)) throw new Error(`Unknown Spore generated asset: ${id}`);
  await Promise.all([...assets].map((id) => loadGenRaw(id, 'low')));
}

export function buildSporeModel(creation: SporeCreation, keep: <T extends { dispose(): void }>(x: T) => T, env?: LayeredEnv, overrides?: Overrides): KitBuild {
  const binding = sporeModelBinding(creation);
  // Check before the shared builder allocates any geometry; its generated-asset wait path is intentionally non-owning.
  for (const p of flatten(binding.kit, binding.preset)) if (p.source.kind === 'gen' && !getGenRawSync(p.source.asset)) throw new Error(`Spore asset not preloaded: ${p.source.asset}`);
  const neutral = keep(new THREE.MeshStandardMaterial({ color: '#829aab', metalness: 0.35, roughness: 0.55 }));
  const paints = new Map<string, THREE.MeshStandardMaterial>();
  const genome = creation.kind === 'creature' ? creation.spec : creation.kind === 'game' ? creatureGenomeById(creation.spec.playerRigId === 'kit:astro-suit' ? 'astro-suit' : creation.spec.playerRigId) : undefined;
  // Own the trim clones: a closed play world's env map must not bleed into a Studio capture (or vice versa).
  const materials = Object.fromEntries(Object.entries(plotKitMaterials()).map(([name, original]) => {
    const material = keep(original.clone());
    if (material instanceof THREE.MeshStandardMaterial) { material.envMap = env?.map ?? null; material.envMapIntensity = env?.intensity ?? 1; }
    return [name, material];
  }));
  const build = buildKitPreset(binding.kit, binding.preset, {
    materials, maxRank: 2, gen: getGenRawSync, keep, layering: kitLayering, overrides,
    resolveMaterial: (name) => {
      if (creation.kind === 'material' && name === 'spore-material') return materialForSpec(creation.spec, 2, env);
      const layered = layeredMaterial(name, 2, env);
      if (layered) return layered;
      if (!genome) return neutral;
      const mat = resolveCreatureMaterial(name, genome.skinPaletteId, paints); keep(mat);
      if (env) { mat.envMap = env.map; mat.envMapIntensity = env.intensity; }
      return mat;
    },
  });
  if (!build) throw new Error('Spore creation has no renderable parts');
  return build;
}
