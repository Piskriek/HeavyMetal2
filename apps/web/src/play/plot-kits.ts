/**
 * The plot's kit-built machines (plan 38 section 9; Argo's TICKET-39 kit specs). The heavy Texture Mill, Shape Press
 * and Water Maker keep their generated cores and gain a modular outer frame (skid, columns, crown, doors, vents, bolts),
 * whose detail rank follows the stage and the Graphics tier: the frame's silhouette from the start, its doors and vents
 * from stage 2, its bolts and grilles from stage 3 on Medium or High. The frames draw in Argo's two trim materials
 * (ARGO_NOTE_34 4d), and their parts take part cartridges like the lab's capacitor bank.
 */
import * as THREE from 'three';
import { flatten, maxRank, presetSockets, transformPoint, type Kit, type Overrides } from '@hm/kitspec';
import type { MachineKind } from '@hm/plotsim';
import { type GenLevel, getGenSync } from '../assets/gen';
import { buildKitPreset } from './kit-build';
import { kitMachineProp, tierOfLevel } from './kit-machine';
import { FABRICATOR_FRAME_KIT } from './kit-fabricator-frame';
import type { MachineProp } from './machine-props';
import { KIT_TRIM_PALETTE } from './kit-trim-palette';
import { MILL_FRAME_KIT } from './kit-mill-frame';
import { PRESS_FRAME_KIT } from './kit-press-frame';
import { WATERMAKER_FRAME_KIT } from './kit-watermaker-frame';
import { PART_SWATCHES } from './part-swatches';
import { vaultSkin } from './vault-skin';
import { lightMaterial } from './light-material';
import { kitLayering, layeredMaterial, type LayeredEnv } from './layered-material';

/** The heavy machines built from a kit, and the preset that is the whole machine. */
export const HEAVY_KITS: Partial<Record<MachineKind, { readonly kit: Kit; readonly preset: string }>> = {
  'heavy-mill': { kit: MILL_FRAME_KIT, preset: 'mill-frame' },
  'heavy-press': { kit: PRESS_FRAME_KIT, preset: 'press-frame' },
  'heavy-water': { kit: WATERMAKER_FRAME_KIT, preset: 'watermaker-frame' },
};

/**
 * The kit frames are off until Argo refits them to the real cores (TICKET-39b): the specs assumed a mill body of
 * +-1.72 m, but the generated mill is a +-1.1 m body on a +-2.0 m plinth, so the door, the status bar and the junction
 * box hang in the air in front of it. The debug switch (__dev.kitFrames) turns them on to test the beam's Apply.
 */
let kitFrames = false;
export const setKitFrames = (on: boolean): void => { kitFrames = on; };
export const kitFramesOn = (): boolean => kitFrames;

/**
 * The reflection plot kits draw with. The planet scene has no environment of its own (its look is the stage's), so,
 * as Astro's suit does there, kit materials carry the lab's room reflection themselves: a true metal then reads as
 * metal under the sun instead of black. Set once by the scene, behind the loading bar.
 */
let plotEnv: LayeredEnv | null = null;
export function setPlotEnvironment(env: LayeredEnv): void {
  plotEnv = env;
  if (materials) for (const m of Object.values(materials)) reflect(m);
}
const reflect = (m: THREE.Material): void => {
  if (!plotEnv || !(m instanceof THREE.MeshStandardMaterial)) return;
  m.envMap = plotEnv.map;
  m.envMapIntensity = plotEnv.intensity;
  m.needsUpdate = true;
};

let materials: Record<string, THREE.Material> | null = null;
/**
 * The materials a plot kit draws with, shared by every machine: Argo's trim materials (their base colours; the trim
 * sheet's bands come with a banded texture later), the part swatches a part cartridge can put on, and a lamp. Each
 * carries the plot's reflection, so its metalness is the palette's own.
 */
export function plotKitMaterials(): Readonly<Record<string, THREE.Material>> {
  if (materials) return materials;
  const out: Record<string, THREE.Material> = {};
  for (const t of Object.values(KIT_TRIM_PALETTE)) {
    out[t.id] = new THREE.MeshStandardMaterial({ color: t.baseHex, metalness: t.metalness, roughness: t.roughness });
  }
  for (const s of PART_SWATCHES) out[s.id] = new THREE.MeshStandardMaterial({ color: s.color, metalness: s.metal, roughness: s.rough });
  out.lamp = new THREE.MeshStandardMaterial({ color: '#14181f', emissive: '#7cff4d', emissiveIntensity: 0.2, roughness: 0.3 });
  for (const m of Object.values(out)) reflect(m);
  materials = out;
  return out;
}

/** How a plot kit resolves a name the record does not hold: a Texture Mill skin, a lamp, a layered material at `rank`. */
const plotResolve = (genLevel: GenLevel, rank: 0 | 1 | 2) => (name: string): THREE.Material | null =>
  vaultSkin(name, genLevel !== 'low') ?? lightMaterial(name) ?? layeredMaterial(name, rank, plotEnv ?? undefined);

/** The kit with one child taken out of an assembly; the later children's `on.child` indices are renumbered. */
export function withoutChild(kit: Kit, assembly: string, key: string): Kit {
  const a = kit.assemblies[assembly];
  const i = a ? a.children.findIndex((c) => c.key === key) : -1;
  if (!a || i < 0) return kit;
  if (a.children.some((c) => c.on?.child === i)) throw new Error(`${key} carries other parts`);
  const children = a.children
    .filter((_, j) => j !== i)
    .map((c) => (c.on && c.on.child > i ? { ...c, on: { ...c.on, child: c.on.child - 1 } } : c));
  return { ...kit, assemblies: { ...kit.assemblies, [assembly]: { ...a, children } } };
}

const FAB_PRESET = 'fabricator-frame';
const FAB_WITHOUT_HEAD = withoutChild(FABRICATOR_FRAME_KIT, FAB_PRESET, 'carriage');
const FAB_HEAD: Kit = {
  parts: { 'head-carriage': FABRICATOR_FRAME_KIT.parts['head-carriage']! },
  assemblies: { carriage: { children: [{ ref: 'head-carriage', key: 'carriage' }] } },
};

/**
 * The vehicle fabricator from Argo's frame kit (TICKET-39): the frame merged as one build, its print-head carriage built
 * on its own and hung where the frame places it, so the scene can slide it along the gantry while it prints. Null while
 * the frames are off. `head` is the carriage's holder (its rest x is 0, as the scene's animation expects).
 */
export function kitFabricator(genLevel: GenLevel, stage: number, ringY: number): {
  readonly group: THREE.Group;
  readonly head: THREE.Object3D;
  readonly sockets: Readonly<Record<string, { readonly at: readonly number[] }>>;
} | null {
  if (!kitFrames) return null;
  const rank = maxRank(stage, tierOfLevel(genLevel));
  const opts = {
    materials: plotKitMaterials(),
    gen: (asset: string) => getGenSync(asset, genLevel),
    resolveMaterial: plotResolve(genLevel, rank),
    layering: kitLayering,
    maxRank: rank,
  };
  const frame = buildKitPreset(FAB_WITHOUT_HEAD, FAB_PRESET, opts);
  const carriage = buildKitPreset(FAB_HEAD, 'carriage', opts);
  const rest = flatten(FABRICATOR_FRAME_KIT, FAB_PRESET).find((p) => p.path === 'carriage');
  if (!frame || !carriage || !rest) return null;
  const group = new THREE.Group();
  group.name = 'kit-fabricator';
  frame.group.position.y = ringY;
  group.add(frame.group);
  const head = new THREE.Group();
  head.name = 'kit-fabricator-head';
  const at = transformPoint(rest.matrix, [0, 0, 0]);
  head.position.set(0, at[1] + ringY, at[2]);
  carriage.group.position.x = at[0];
  head.add(carriage.group);
  group.add(head);
  const sockets: Record<string, { at: readonly number[] }> = {};
  for (const [name, s] of Object.entries(presetSockets(FABRICATOR_FRAME_KIT, FAB_PRESET))) sockets[name] = { at: [s.at[0], s.at[1] + ringY, s.at[2]] };
  return { group, head, sockets };
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
    resolveMaterial: plotResolve(genLevel, maxRank(stage, tierOfLevel(genLevel))),
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
