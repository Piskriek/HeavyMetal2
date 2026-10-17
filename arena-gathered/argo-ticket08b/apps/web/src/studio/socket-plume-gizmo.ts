// ============================================================================
// File: apps/web/src/studio/socket-plume-gizmo.ts
// TICKET-08b (OPUS_NOTE_15 Item C):
// The sockets and plumes gizmo:
//   socketPlumeGizmo(object: THREE.Object3D, entry: RegistryEntry): { group: THREE.Group; dispose(): void }
// - Small square markers at the registry entry's sockets, labelled in the panel only, never on the art.
// - A vertical arrow at the plume vent found by findMachineVent, coloured per machine kind
//   using the plume colours from ARGO_NOTE_08.
// ============================================================================

import * as THREE from 'three';
import type { MachineKind } from '@hm/plotsim';
import { findMachineVent } from '../play/machine-props';

export type Vec3Tuple = readonly [number, number, number];

export interface SocketSpec {
  readonly name: string;
  readonly at: Vec3Tuple;
}

export type RawSocketsInput =
  | readonly {
      readonly name: string;
      readonly at?: Vec3Tuple;
      readonly pos?: Vec3Tuple;
      readonly position?: Vec3Tuple;
    }[]
  | Readonly<Record<string, Vec3Tuple | { readonly at?: Vec3Tuple; readonly pos?: Vec3Tuple; readonly position?: Vec3Tuple }>>;

export interface RegistryEntry {
  readonly id?: string;
  readonly kind?: MachineKind | string;
  readonly class?: string;
  readonly size?: Vec3Tuple;
  readonly box?: readonly [Vec3Tuple, Vec3Tuple];
  readonly sockets?: RawSocketsInput;
  readonly plume?: boolean | MachineKind | string;
}

/** Per-machine-kind pixel plume hex colours from ARGO_NOTE_08. */
export const PLUME_COLOURS: Readonly<Record<MachineKind, string>> = {
  mill: '#ff3d8a',
  'heavy-mill': '#ff3d8a',
  press: '#7cff4d',
  'heavy-press': '#7cff4d',
  projector: '#ffc13d',
  'heavy-projector': '#ffc13d',
  water: '#3dc8ff',
  'heavy-water': '#3dc8ff',
  drill: '#ff7b3d',
  power: '#b46bff',
  pylon: '#5ce1e6',
};

const ALL_MACHINE_KINDS: readonly MachineKind[] = [
  'heavy-mill',
  'mill',
  'heavy-press',
  'press',
  'heavy-projector',
  'projector',
  'heavy-water',
  'water',
  'drill',
  'power',
  'pylon',
];

/**
 * Resolves the `MachineKind` for a registry entry or 3D object name.
 * Returns null if the entry is not a machine and has no machine kind identifier.
 */
export function resolveMachineKind(entry: RegistryEntry, object?: THREE.Object3D): MachineKind | null {
  const candidates = [
    typeof entry.plume === 'string' ? entry.plume : '',
    entry.kind ?? '',
    entry.id ?? '',
    object?.name ?? '',
  ]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);

  for (const c of candidates) {
    if ((ALL_MACHINE_KINDS as readonly string[]).includes(c)) {
      return c as MachineKind;
    }
    if (c.includes('heavy-mill')) return 'heavy-mill';
    if (c.includes('mill')) return 'mill';
    if (c.includes('heavy-press')) return 'heavy-press';
    if (c.includes('press')) return 'press';
    if (c.includes('heavy-projector')) return 'heavy-projector';
    if (c.includes('projector')) return 'projector';
    if (c.includes('heavy-water')) return 'heavy-water';
    if (c.includes('water')) return 'water';
    if (c.includes('drill')) return 'drill';
    if (c.includes('pylon')) return 'pylon';
    if (c.includes('power') || c.includes('fabricator') || c.includes('generator')) return 'power';
  }

  if (entry.class === 'machine' || entry.plume === true) {
    return 'mill';
  }
  return null;
}

/** Returns the ARGO_NOTE_08 hex colour for a machine kind or registry entry, or null if not a machine. */
export function plumeColourFor(entryOrKind: RegistryEntry | MachineKind | string, object?: THREE.Object3D): string | null {
  if (typeof entryOrKind === 'string') {
    const k = resolveMachineKind({ kind: entryOrKind }, object);
    return k ? PLUME_COLOURS[k] : null;
  }
  const k = resolveMachineKind(entryOrKind, object);
  return k ? PLUME_COLOURS[k] : null;
}

function isVec3Tuple(v: unknown): v is Vec3Tuple {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

/** Normalizes `entry.sockets` (whether array or record map) into an ordered list of `{ name, at }`. */
export function normalizeSockets(entry: RegistryEntry | null | undefined): SocketSpec[] {
  if (!entry || !entry.sockets) return [];
  const raw = entry.sockets;
  const out: SocketSpec[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const coord = item.at ?? item.pos ?? item.position;
      if (name && isVec3Tuple(coord)) {
        out.push({ name, at: [coord[0], coord[1], coord[2]] });
      }
    }
    return out;
  }

  if (typeof raw === 'object') {
    for (const [name, val] of Object.entries(raw)) {
      if (!name.trim()) continue;
      if (isVec3Tuple(val)) {
        out.push({ name: name.trim(), at: [val[0], val[1], val[2]] });
      } else if (val && typeof val === 'object') {
        const coord = (val as { at?: unknown; pos?: unknown; position?: unknown }).at ??
          (val as { pos?: unknown }).pos ??
          (val as { position?: unknown }).position;
        if (isVec3Tuple(coord)) {
          out.push({ name: name.trim(), at: [coord[0], coord[1], coord[2]] });
        }
      }
    }
  }

  return out;
}

export interface SocketPlumeGizmoHandle {
  readonly group: THREE.Group;
  readonly sockets: readonly SocketSpec[];
  readonly vent: THREE.Vector3 | null;
  readonly plumeColour: string | null;
  readonly machineKind: MachineKind | null;
  dispose(): void;
}

const SOCKET_FILL_HEX = 0xffc53d;
const SOCKET_RIM_HEX = 0x5fd4ff;

/**
 * Builds the 3D sockets and plumes gizmo for a studio asset (`TICKET-08b` Item C):
 * - Small square markers at each of `entry.sockets` (no 3D labels on the art; labels belong in the UI panel only).
 * - A vertical arrow at the plume vent found by `findMachineVent(object, ...)`, coloured per machine kind
 *   using the `ARGO_NOTE_08` palette.
 */
export function socketPlumeGizmo(object: THREE.Object3D, entry: RegistryEntry): SocketPlumeGizmoHandle {
  const group = new THREE.Group();
  group.name = 'socket-plume-gizmo';

  const disposables: { dispose(): void }[] = [];
  const sockets = normalizeSockets(entry);

  if (sockets.length > 0) {
    const innerGeo = new THREE.BoxGeometry(0.16, 0.03, 0.16);
    const outerGeo = new THREE.BoxGeometry(0.24, 0.016, 0.24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: SOCKET_FILL_HEX,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const outerMat = new THREE.MeshBasicMaterial({
      color: SOCKET_RIM_HEX,
      wireframe: true,
      depthTest: false,
    });
    disposables.push(innerGeo, outerGeo, innerMat, outerMat);

    for (const s of sockets) {
      const marker = new THREE.Group();
      marker.name = `socket-marker:${s.name}`;
      marker.position.set(s.at[0], s.at[1], s.at[2]);
      marker.userData = {
        kind: 'socket-marker',
        shape: 'square',
        socketName: s.name,
        at: s.at,
      };

      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.name = 'socket-square-fill';
      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.name = 'socket-square-rim';
      marker.add(inner, outer);
      group.add(marker);
    }
  }

  const machineKind = resolveMachineKind(entry, object);
  const plumeColour = machineKind ? PLUME_COLOURS[machineKind] : null;
  let vent: THREE.Vector3 | null = null;

  if (machineKind && plumeColour && entry.plume !== false) {
    const ventSocket = sockets.find((s) => s.name === 'vent' || s.name === 'stack' || s.name === 'steam');
    const prefX = ventSocket ? ventSocket.at[0] : 0;
    const prefZ = ventSocket ? ventSocket.at[2] : 0;
    const detected = findMachineVent(object, 0, prefX, prefZ);
    vent = ventSocket
      ? new THREE.Vector3(ventSocket.at[0], Math.max(ventSocket.at[1], detected.y), ventSocket.at[2])
      : detected;

    const arrowGroup = new THREE.Group();
    arrowGroup.name = 'plume-vent-arrow';
    arrowGroup.position.copy(vent);
    arrowGroup.userData = {
      kind: 'plume-arrow',
      machineKind,
      colour: plumeColour,
      vent: [vent.x, vent.y, vent.z] as const,
      direction: [0, 1, 0] as const,
    };

    const arrowCol = new THREE.Color(plumeColour);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: arrowCol,
      depthTest: false,
    });
    const basePadGeo = new THREE.BoxGeometry(0.18, 0.025, 0.18);
    const shaftGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.68, 10);
    const headGeo = new THREE.ConeGeometry(0.1, 0.26, 12);
    disposables.push(arrowMat, basePadGeo, shaftGeo, headGeo);

    const basePad = new THREE.Mesh(basePadGeo, arrowMat);
    basePad.name = 'plume-arrow-pad';

    const shaft = new THREE.Mesh(shaftGeo, arrowMat);
    shaft.name = 'plume-arrow-shaft';
    shaft.position.set(0, 0.34, 0);

    const head = new THREE.Mesh(headGeo, arrowMat);
    head.name = 'plume-arrow-head';
    head.position.set(0, 0.81, 0);

    arrowGroup.add(basePad, shaft, head);
    group.add(arrowGroup);
  }

  return {
    group,
    sockets,
    vent,
    plumeColour,
    machineKind,
    dispose(): void {
      if (group.parent) {
        group.parent.remove(group);
      }
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
