/**
 * The plot's kit-built machines (plan 38 section 9; Argo's TICKET-39 kit specs). Every machine now comes from its own
 * machine kit (`kit-machines.ts`, JOB-08), so this module holds what the plot builds *beside* the machines: the shared
 * trim and swatch materials a kit draws with, the Quantum Archway Gate as a kit, and the vehicle fabricator's frame.
 * What the module no longer holds is the legacy stopgap — a modular frame wrapped around a generated `.glb` core, and
 * the ray-measured status-light mount that went with it (`machine-props.ts` reads a declared `statusLed` socket now).
 */
import * as THREE from 'three';
import { flatten, maxRank, presetSockets, transformPoint, type Kit, type Overrides } from '@hm/kitspec';
import { type GenLevel, getGenSync } from '../assets/gen';
import { buildKitPreset } from './kit-build';
import { tierOfLevel } from './kit-machine';
import { FABRICATOR_FRAME_KIT } from './kit-fabricator-frame';
import { KIT_TRIM_PALETTE } from './kit-trim-palette';
import { PART_SWATCHES } from './part-swatches';
import { vaultSkin } from './vault-skin';
import { lightMaterial } from './light-material';
import { kitLayering, layeredMaterial, type LayeredEnv } from './layered-material';
import type { GateAccessMode } from '@hm/coopnet/gate-dialer';
import { STARGATE_PRESET, stargateKit } from './kit-stargate';
import { VEHICLE_KITS, VEHICLE_PRESET, type VehicleKind } from './kit-vehicles';
import type { KitBuild } from './kit-build';

/**
 * The kit frames are off until Argo refits them to the real cores (TICKET-39b): the gate and the vehicle fabricator keep
 * their own visuals from the twin. The debug switch (`__dev.kitFrames`) turns them on to test the beam's Apply.
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
/** A closed world must not keep its reflection alive in shared trim/material caches. */
export function clearPlotEnvironment(map: THREE.Texture): void {
  if (plotEnv?.map !== map) return;
  plotEnv = null;
  if (materials) for (const m of Object.values(materials)) if (m instanceof THREE.MeshStandardMaterial) {
    m.envMap = null; m.needsUpdate = true;
  }
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
export const plotResolve = (genLevel: GenLevel, rank: 0 | 1 | 2) => (name: string): THREE.Material | null =>
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
 * The plot's Quantum Archway Gate as a kit build (plan 42 section 4.3, JOB-07 item 1): the ring, its nine chevron lamps, the
 * ramp, the dialing pedestal, and the iris when the gate is not open. The scene hangs this around the twin gate's opening
 * and aims the beam at it like a machine, so the gate takes part, material and light cartridges with the same rules.
 *
 * Null while the kit frames are off (the twin keeps its own visual) or when a part cannot be built, so a failed build
 * never leaves the plot gateless.
 */
export function plotStargate(o: {
  readonly access: GateAccessMode;
  readonly stage: number;
  readonly genLevel: GenLevel;
  readonly overrides?: Overrides;
  readonly ringY?: number;
}): { readonly group: THREE.Group; readonly build: KitBuild; readonly chevrons: readonly THREE.Mesh[] } | null {
  if (!kitFrames) return null;
  const rank = maxRank(o.stage, tierOfLevel(o.genLevel));
  const kit = stargateKit(o.access);
  const build = buildKitPreset(kit, STARGATE_PRESET, {
    materials: plotKitMaterials(),
    // every part of the gate is a @hm/partgen primitive: no generated assets to wait on
    gen: () => null,
    resolveMaterial: plotResolve(o.genLevel, rank),
    layering: kitLayering,
    maxRank: rank,
    ...(o.overrides ? { overrides: o.overrides } : {}),
  });
  if (!build) return null;
  const group = new THREE.Group();
  group.name = 'plot-stargate';
  group.add(build.group);
  if (o.ringY) group.position.y = o.ringY;
  // the chevrons are the meshes drawn with their own light cartridge (one unique Kelvin each, so nine stay nine)
  const chevrons = build.group.children.filter(
    (c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && c.name.startsWith('kit:lx:'),
  );
  return { group, build, chevrons };
}

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
 * A vehicle as a kit build (JOB-08v): the same five-group blueprint `kit-vehicles.ts` audited, dressed in the plot's
 * materials and built at the stage's detail rank. The plot hangs this at the vehicle's pose so a Beam Rifle cartridge
 * can name any part of it (`kit-target.ts`), while the procedural rover keeps the wheel and steering animation the
 * merged kit cannot (a kit's wheels are one mesh with the hull).
 */
export function plotVehicleKit(kind: VehicleKind, genLevel: GenLevel, stage: number): KitBuild | null {
  const rank = maxRank(stage, tierOfLevel(genLevel));
  return buildKitPreset(VEHICLE_KITS[kind], VEHICLE_PRESET, {
    materials: plotKitMaterials(),
    // every part of a vehicle is a @hm/partgen primitive or a box: no generated asset to wait on
    gen: () => null,
    resolveMaterial: plotResolve(genLevel, rank),
    layering: kitLayering,
    maxRank: rank,
  });
}
