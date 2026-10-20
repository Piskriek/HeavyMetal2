/**
 * A kit-built plot machine (plan 38 sections 5 and 9; Argo's TICKET-39 kit specs): the adapter from a @hm/kitspec preset to
 * the MachineProp the plot scene uses. The kit's top-level sockets name the machine's points: `power` (where the cable comes
 * in), `vent` (where the pixels pour), `feed` (where the ore drops) and `top` (a pylon's line). The detail rank is the
 * lower of the stage's and the Graphics tier's, so a machine gains its parts as reality upgrades.
 */
import * as THREE from 'three';
import { maxRank, presetSockets, type Kit, type Overrides, type Tier } from '@hm/kitspec';
import type { GenLevel } from '../assets/gen';
import { buildKitPreset, type KitBuild } from './kit-build';
import type { MachineProp } from './machine-props';

export interface KitMachineOptions {
  readonly materials: Readonly<Record<string, THREE.Material>>;
  readonly gen: (asset: string) => THREE.Object3D | null;
  readonly stage: number;
  readonly genLevel: GenLevel;
  readonly overrides?: Overrides;
}

/** The Graphics tier a generated-asset level stands for. */
export const tierOfLevel = (level: GenLevel): Tier => (level === 'high' ? 'high' : level === 'mid' ? 'medium' : 'low');

/** The machine as a MachineProp, or null while a generated part of it is not loaded yet. */
export function kitMachineProp(kit: Kit, preset: string, o: KitMachineOptions): (MachineProp & { readonly build: KitBuild }) | null {
  const rank = maxRank(o.stage, tierOfLevel(o.genLevel));
  const build = buildKitPreset(kit, preset, {
    materials: o.materials,
    gen: o.gen,
    maxRank: rank,
    ...(o.overrides ? { overrides: o.overrides } : {}),
  });
  if (!build) return null;
  const sockets = presetSockets(kit, preset);
  const point = (name: string): THREE.Vector3 | null => {
    const s = sockets[name];
    return s ? new THREE.Vector3(s.at[0], s.at[1], s.at[2]) : null;
  };
  // its lamps are the meshes drawn with a 'lamp' material (glow follows how hard the machine runs)
  const lamps = build.group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && c.name.startsWith('kit:lamp'));
  // each machine glows on its own: its lamps get their own material (disposeProp disposes a prop's lamp materials)
  for (const l of lamps) l.material = (l.material as THREE.Material).clone();
  const group = new THREE.Group();
  group.name = `kit-machine:${preset}`;
  group.add(build.group);
  return {
    build,
    group,
    power: point('power') ?? new THREE.Vector3(0, 0.2, 0),
    vent: point('vent'),
    feed: point('feed'),
    top: point('top'),
    lamps,
    animate: () => undefined,
    light(glow) {
      for (const l of lamps) {
        const m = l.material as THREE.MeshStandardMaterial;
        if ('emissiveIntensity' in m) m.emissiveIntensity = Math.max(0, Math.min(1, glow)) * 1.6;
      }
    },
  };
}
