// Each machine of the plot (`@hm/plotsim`) as a prop: the texture mill from `@hm/labkit`, the six others from `@hm/fieldkit`
// (both Arena Battles, built to sheet 12 of the concept art). Where its power comes in, where its pixels come out, and the parts
// that move while it runs.
import * as THREE from 'three';
import * as field from '@hm/fieldkit';
import * as lab from '@hm/labkit';
import * as basegear from '@hm/basegear';
import * as heavygear from '@hm/heavygear';
import { textureMill as consoleMillTextureMill, setLamp as setConsoleMillLamp } from '@hm/consolemill';
import type { MachineKind, Metric } from '@hm/plotsim';

export interface MachineProp {
  readonly group: THREE.Group;
  /** Where its cable comes in (the prop's own frame); a pylon's is the box at its foot. */
  readonly power: THREE.Vector3;
  /** Where its pixels pour out (pixel machines), its steam (the power unit), or null. */
  readonly vent: THREE.Vector3 | null;
  /** A pylon's line attachment, for the spans between pylons. */
  readonly top: THREE.Vector3 | null;
  readonly lamps: readonly THREE.Mesh[];
  /** Moves what moves while it runs (0..1 how hard it runs), t in seconds. */
  animate(t: number, running: number): void;
  /** Lights its lamps, 0..1. */
  light(glow: number): void;
}

/** The metric a machine's pixels raise (null: it pours none). */
export const PIXELS_OF: Readonly<Record<MachineKind, Metric | null>> = {
  drill: null, mill: 'pxd', pylon: null, press: 'vtx', power: null, projector: 'lx', water: 'aq',
  'heavy-mill': 'pxd', 'heavy-press': 'vtx', 'heavy-projector': 'lx', 'heavy-water': 'aq',
};

/** Hardpoint ring top height where heavy machines stand. */
export const RING_TOP_Y = 0.78;

const at = (sockets: readonly { readonly name: string; readonly at: readonly [number, number, number] }[], ...names: string[]): THREE.Vector3 | null => {
  for (const n of names) { const s = sockets.find((x) => x.name === n); if (s) return new THREE.Vector3(...s.at); }
  return null;
};

/** The prop for a machine at a stage (0 or 1: chunky low poly; from 2: full detail). */
export function machineProp(m: lab.LabMaterials, kind: MachineKind, stage: number): MachineProp {
  const st = stage <= 1 ? 1 : 6;
  const still = (): void => undefined;
  switch (kind) {
    case 'heavy-mill': {
      const p = basegear.heavyMill(m as any, { stage: st });
      p.group.position.y += RING_TOP_Y;
      const lift = new THREE.Vector3(0, RING_TOP_Y, 0);
      const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0.1, -1.58);
      const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(1.715, 2.28, -0.48);
      return {
        group: p.group,
        power: rawPower.clone().add(lift),
        vent: rawVent.clone().add(lift),
        top: null,
        lamps: p.lamps,
        animate: still,
        light: (g) => p.lamps.forEach((l) => basegear.setLamp(l, g)),
      };
    }
    case 'heavy-press': {
      const p = heavygear.heavyPress(m as any, { stage: st });
      p.group.position.y += RING_TOP_Y;
      const lift = new THREE.Vector3(0, RING_TOP_Y, 0);
      const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0, 0.76);
      const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(0, 3.2, -0.56);
      const ram = p.parts?.ram;
      const restY = ram?.position.y ?? 0;
      return {
        group: p.group,
        power: rawPower.clone().add(lift),
        vent: rawVent.clone().add(lift),
        top: null,
        lamps: p.lamps,
        animate: (t, run) => {
          if (ram) ram.position.y = restY - Math.max(0, Math.sin(t * 2.0)) * 0.6 * run;
        },
        light: (g) => p.lamps.forEach((l) => heavygear.setLamp(l, g)),
      };
    }
    case 'heavy-projector': {
      const p = heavygear.heavyProjector(m as any, { stage: st });
      p.group.position.y += RING_TOP_Y;
      const lift = new THREE.Vector3(0, RING_TOP_Y, 0);
      const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0, 0.6);
      const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(0, 4.1, -0.66);
      const head = p.parts?.head;
      const restRotX = head?.rotation.x ?? 0;
      return {
        group: p.group,
        power: rawPower.clone().add(lift),
        vent: rawVent.clone().add(lift),
        top: null,
        lamps: p.lamps,
        animate: (t, run) => {
          if (head) head.rotation.x = restRotX + Math.sin(t * 0.35) * 0.08 * run;
        },
        light: (g) => p.lamps.forEach((l) => heavygear.setLamp(l, g)),
      };
    }
    case 'heavy-water': {
      const p = heavygear.heavyWater(m as any, { stage: st });
      p.group.position.y += RING_TOP_Y;
      const lift = new THREE.Vector3(0, RING_TOP_Y, 0);
      const rawPower = at(p.sockets, 'power') ?? new THREE.Vector3(0, 0, 0.6);
      const rawVent = at(p.sockets, 'vent') ?? new THREE.Vector3(0, 3.155, -0.58);
      return {
        group: p.group,
        power: rawPower.clone().add(lift),
        vent: rawVent.clone().add(lift),
        top: null,
        lamps: p.lamps,
        animate: still,
        light: (g) => p.lamps.forEach((l) => heavygear.setLamp(l, g)),
      };
    }
    case 'mill': {
      const p = consoleMillTextureMill(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'stack'), top: null, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => setConsoleMillLamp(l, g)) };
    }
    case 'drill': {
      const p = field.rockDrill(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'power')!, vent: null, top: null, lamps: p.lamps, animate: (t, run) => { p.bit.rotation.y = t * 9 * run; }, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'press': {
      const p = field.shapePress(m, { stage: st });
      const rest = p.rams.map((r) => r.position.y);
      return {
        group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'vent'), top: null, lamps: p.lamps,
        animate: (t, run) => p.rams.forEach((r, i) => { r.position.y = rest[i]! - Math.max(0, Math.sin(t * 3.1 + i * Math.PI)) * 0.18 * run; }),
        light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)),
      };
    }
    case 'projector': {
      const p = field.lightProjector(m, { stage: st });
      const tilt = p.head.rotation.x;
      return { group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'vent'), top: null, lamps: p.lamps, animate: (t, run) => { p.head.rotation.x = tilt + Math.sin(t * 0.35) * 0.08 * run; }, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'water': {
      const p = field.waterMaker(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'power')!, vent: at(p.sockets, 'vent'), top: null, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'power': {
      const p = field.powerUnit(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'out')!, vent: at(p.sockets, 'steam'), top: null, lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
    case 'pylon': {
      const p = field.relayPylon(m, { stage: st });
      return { group: p.group, power: at(p.sockets, 'box')!, vent: null, top: new THREE.Vector3(...p.top), lamps: p.lamps, animate: still, light: (g) => p.lamps.forEach((l) => field.setLamp(l, g)) };
    }
  }
}

/** A sagging line between two pylons' tops (world points). */
export function lineSpan(m: lab.LabMaterials, a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh {
  return field.cableSpan(m, [a.x, a.y, a.z], [b.x, b.y, b.z], Math.max(0.4, a.distanceTo(b) * 0.035));
}

/** Frees a prop's geometry (its materials are shared, or its own lamps', which go with it). */
export function disposeProp(p: MachineProp): void {
  p.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    if (p.lamps.includes(mesh)) (mesh.material as THREE.Material).dispose();
  });
}
