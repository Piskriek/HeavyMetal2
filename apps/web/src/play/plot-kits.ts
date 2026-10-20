/**
 * The plot's kit-built machines (plan 38 section 9; Argo's TICKET-39 kit specs). The heavy Texture Mill, Shape Press
 * and Water Maker keep their generated cores and gain a modular outer frame (skid, columns, crown, doors, vents, bolts),
 * whose detail rank follows the stage and the Graphics tier: the frame's silhouette from the start, its doors and vents
 * from stage 2, its bolts and grilles from stage 3 on Medium or High. The frames draw in Argo's two trim materials
 * (ARGO_NOTE_34 4d), and their parts take part cartridges like the lab's capacitor bank.
 */
import * as THREE from 'three';
import { presetSockets, type Kit, type Overrides } from '@hm/kitspec';
import type { MachineKind } from '@hm/plotsim';
import { type GenLevel, getGenSync } from '../assets/gen';
import { kitMachineProp } from './kit-machine';
import type { MachineProp } from './machine-props';
import { KIT_TRIM_PALETTE } from './kit-trim-palette';
import { MILL_FRAME_KIT } from './kit-mill-frame';
import { PRESS_FRAME_KIT } from './kit-press-frame';
import { WATERMAKER_FRAME_KIT } from './kit-watermaker-frame';
import { PART_SWATCHES } from './part-swatches';

/** The heavy machines built from a kit, and the preset that is the whole machine. */
export const HEAVY_KITS: Partial<Record<MachineKind, { readonly kit: Kit; readonly preset: string }>> = {
  'heavy-mill': { kit: MILL_FRAME_KIT, preset: 'mill-frame' },
  'heavy-press': { kit: PRESS_FRAME_KIT, preset: 'press-frame' },
  'heavy-water': { kit: WATERMAKER_FRAME_KIT, preset: 'watermaker-frame' },
};

/** The kit frames are on by default; the debug switch turns them off to compare with the bare cores. */
let kitFrames = true;
export const setKitFrames = (on: boolean): void => { kitFrames = on; };
export const kitFramesOn = (): boolean => kitFrames;

const PLOT_MAX_METAL = 0.35;
let materials: Record<string, THREE.Material> | null = null;
/**
 * The materials a plot kit draws with, shared by every machine: Argo's two trim materials (their base colours; the
 * trim sheet's bands come with a banded texture later), the part swatches a part cartridge can put on, and a lamp.
 */
export function plotKitMaterials(): Readonly<Record<string, THREE.Material>> {
  if (materials) return materials;
  // the planet scene has no environment map, so a true metal has nothing to reflect and draws black: the plot caps
  // metalness and keeps the palette's colours, which then read under the sun the way the generated cores' textures do
  const plotMetal = (metal: number, rough: number) => ({ metalness: Math.min(PLOT_MAX_METAL, metal), roughness: Math.max(0.5, rough) });
  const out: Record<string, THREE.Material> = {};
  for (const t of Object.values(KIT_TRIM_PALETTE)) {
    out[t.id] = new THREE.MeshStandardMaterial({ color: t.baseHex, ...plotMetal(t.metalness, t.roughness) });
  }
  for (const s of PART_SWATCHES) out[s.id] = new THREE.MeshStandardMaterial({ color: s.color, ...plotMetal(s.metal, s.rough) });
  out.lamp = new THREE.MeshStandardMaterial({ color: '#14181f', emissive: '#7cff4d', emissiveIntensity: 0.2, roughness: 0.3 });
  materials = out;
  return out;
}

/**
 * A heavy machine as a kit-built prop, standing on the hardpoint ring (`ringY`), or null when it has no kit, the frames
 * are switched off, or its generated core has not loaded yet (the caller then builds it as before). The press keeps its
 * two working rams, hung at the kit's ram sockets.
 */
export function heavyKitProp(kind: MachineKind, stage: number, genLevel: GenLevel, ringY: number, overrides?: Overrides): MachineProp | null {
  const spec = HEAVY_KITS[kind];
  if (!spec || !kitFrames) return null;
  const prop = kitMachineProp(spec.kit, spec.preset, {
    materials: plotKitMaterials(),
    gen: (asset) => getGenSync(asset, genLevel),
    stage,
    genLevel,
    ...(overrides ? { overrides } : {}),
  });
  if (!prop) return null;
  const lift = new THREE.Vector3(0, ringY, 0);
  prop.build.group.position.y = ringY;
  const up = (v: THREE.Vector3 | null): THREE.Vector3 | null => (v ? v.clone().add(lift) : null);
  let animate = prop.animate;
  if (kind === 'heavy-press') {
    const sockets = presetSockets(spec.kit, spec.preset);
    const rams = [sockets.ramLeft, sockets.ramRight].map((s) => {
      const ram = s ? getGenSync('press-ram', genLevel) : null;
      if (ram && s) {
        ram.position.set(s.at[0], s.at[1] + ringY, s.at[2]);
        prop.group.add(ram);
      }
      return ram;
    });
    const restY = (sockets.ramLeft?.at[1] ?? 2.1) + ringY;
    animate = (t, run) => {
      rams.forEach((r, i) => { if (r) r.position.y = restY - Math.max(0, Math.sin(t * 3.1 + i * Math.PI)) * 0.35 * run; });
    };
  }
  return {
    ...prop,
    power: up(prop.power)!,
    vent: up(prop.vent),
    feed: up(prop.feed ?? null),
    top: up(prop.top),
    animate,
  };
}
