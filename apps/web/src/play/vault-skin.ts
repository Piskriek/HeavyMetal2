/**
 * A Texture Mill material as a part's skin (plan 39 step 2: material cartridges also apply to a part's skin, through the
 * same Apply path as the ground). A kit part names it `vault:<preset id>` as its material. On Medium and High it carries
 * the preset's own evaluated texture tile (64 px a metre, the parts' box UVs) and roughness; on Low its flat look, the
 * same colour the ground paint uses. One material per preset and tier, shared by every part that wears it.
 */
import * as THREE from 'three';
import { evaluateGraph, tileBytes } from '@hm/texgraph';
import { VAULT_BY_ID } from '@hm/vault';
import type { PartOverride, PlacedPart } from '@hm/kitspec';
import { GENERATORS } from '@hm/partgen';
import { presetLook } from './beam-port';

export const SKIN_PREFIX = 'vault:';
export const skinName = (presetId: string): string => `${SKIN_PREFIX}${presetId}`;
export const isSkin = (material: string): boolean => material.startsWith(SKIN_PREFIX);

const TILE = 64;
const cache = new Map<string, THREE.MeshStandardMaterial>();

/** The material for a `vault:<preset>` name, or null for any other name or an unknown preset. */
export function vaultSkin(name: string, textured: boolean): THREE.Material | null {
  if (!isSkin(name)) return null;
  const key = `${name}|${textured ? 'tex' : 'flat'}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const id = name.slice(SKIN_PREFIX.length);
  const cart = VAULT_BY_ID.get(id);
  const look = presetLook(id);
  if (!cart || !look) return null;
  const m = new THREE.MeshStandardMaterial({ color: look.colour, roughness: look.roughness, metalness: 0.08 });
  if (textured) {
    const { colour, maps } = tileBytes(evaluateGraph(cart.graph, { size: TILE, relief: TILE * 0.1 }));
    const tex = (data: Uint8Array, srgb: boolean): THREE.DataTexture => {
      const t = new THREE.DataTexture(data, TILE, TILE, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.needsUpdate = true;
      return t;
    };
    m.color.set('#ffffff');
    m.map = tex(colour, true);
    // the maps tile holds height in red and roughness in green, where three reads a roughness map
    m.roughnessMap = tex(maps, false);
    m.roughness = 1;
  }
  cache.set(key, m);
  return m;
}

/** The slot a skin goes on: a Shape Press part's first slot (its body: a panel's plate, a can's body), or null for a box. */
export function bodySlot(p: PlacedPart): string | null {
  return p.source.kind === 'param' ? (GENERATORS[p.source.gen]?.slots[0] ?? null) : null;
}

/** What a part wears on its body now (its body slot's material, or its material). */
export const bodyMaterial = (p: PlacedPart): string => {
  const slot = bodySlot(p);
  return (slot ? p.slotMaterials?.[slot] : undefined) ?? p.material;
};

/**
 * The override that puts a material (any name: a skin, `vault:<preset>`; a layered material, `mat:` or `matc:`) on a
 * placed part, kept on top of what the part already had (a printed part keeps its shape). A Shape Press part takes it
 * on its body slot only: a painted panel keeps its bolts. A box takes it whole. A generated core takes none (null): its
 * own texture is its skin.
 */
export function bodyOverride(material: string, p: PlacedPart, existing?: PartOverride): PartOverride | null {
  if (p.source.kind === 'gen') return null;
  if (p.source.kind === 'box') return { ...existing, material };
  const slots = GENERATORS[p.source.gen]?.slots ?? [];
  const body = slots[0];
  if (!body) return { ...existing, material };
  const slotMaterials: Record<string, string> = {};
  for (const s of slots) slotMaterials[s] = s === body ? material : (p.slotMaterials?.[s] ?? p.material);
  return { ...existing, slotMaterials };
}

/** The override that puts a Texture Mill skin on a placed part (bodyOverride with `vault:<preset>`). */
export const skinOverride = (presetId: string, p: PlacedPart, existing?: PartOverride): PartOverride | null =>
  bodyOverride(skinName(presetId), p, existing);
