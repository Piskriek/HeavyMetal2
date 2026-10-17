// A leak on the plot: an S-Space rift (play/rift.ts) standing on the ground, and a soft era aura under it. The rift follows the leak's state:
// open is the violent tear, sealing (the beam held on it) turns amber and narrows, and a sealed leak collapses to its scar. A dormant leak
// never opens, so it reads as a scar too. The junked models around it are the wrecks (play/wrecks.ts). Pure geometry; the state comes from the monsters.
import * as THREE from 'three';
import type { MonsterMarker } from '../play/monsters';
import { createRift, type RiftInstance, type RiftState } from '../play/rift';

export interface LeakVisualFrame {
  readonly dt: number;
  readonly markers: readonly MonsterMarker[];
  /** The leak under the beam's seal hold, or null. */
  readonly sealing: number | null;
  readonly camera: THREE.Camera;
  readonly stage: number;
}

export interface LeakVisuals {
  update(frame: LeakVisualFrame): void;
  dispose(): void;
}

/**
 * The rift's state for one leak: a shut leak is a scar; a leak under the seal hold is sealing (amber), even a dormant one, since the
 * dormant anomaly can be sealed; a dormant leak that is not being sealed is a scar too (it never opens); the rest are open.
 */
export function riftStateFor(mk: Pick<MonsterMarker, 'state' | 'dormant'>, sealing: boolean): RiftState {
  if (mk.state === 'sealed') return 'sealed';
  if (sealing) return 'sealing';
  if (mk.dormant) return 'sealed';
  return 'open';
}

/** The rift's height (m): the old column's, so the leak reads at the same size from the gate. */
const RIFT_HEIGHT = 3.4;
/**
 * Beyond this distance (m) the tear's slices and scanlines are not drawn: a full rift is about 56 more draw calls than the old marker
 * (the base-building check holds the frame to 80 draw calls). The collar and the scar stay, so a far leak still reads as a leak.
 */
export const RIFT_DETAIL_DISTANCE = 40;

interface Entry {
  readonly group: THREE.Group;
  readonly rift: RiftInstance;
  /** The era aura: a soft disc on the ground that drops the ground to the leak's era. */
  readonly aura: THREE.Mesh;
}

export function createLeakVisuals(scene: THREE.Scene, groundHeightAt: (x: number, z: number) => number): LeakVisuals {
  const entries = new Map<number, Entry>();
  let time = 0;

  const create = (id: number, x: number, z: number): Entry => {
    const group = new THREE.Group();
    group.name = `leak:${id}`;
    group.position.set(x, groundHeightAt(x, z), z);
    const rift = createRift({ seed: id, height: RIFT_HEIGHT });
    group.add(rift.group);
    const aura = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.03;
    group.add(aura);
    scene.add(group);
    return { group, rift, aura };
  };

  const dispose = (e: Entry): void => {
    scene.remove(e.group);
    e.rift.dispose();
    e.aura.geometry.dispose();
    (e.aura.material as THREE.Material).dispose();
  };

  return {
    update({ dt, markers, sealing, camera }) {
      time += dt;
      for (const mk of markers) {
        let e = entries.get(mk.id);
        if (!e) {
          e = create(mk.id, mk.x, mk.z);
          entries.set(mk.id, e);
        }
        // the era aura: sprite leaks are white, early 3D cyan-blue, modern 3D cyan; a sealed leak has none
        const eraColour = mk.era === 'early3d' ? 0x7dd3fc : mk.era === 'modern3d' ? 0x3dc8ff : 0xe8e8e8;
        const auraMat = e.aura.material as THREE.MeshBasicMaterial;
        auraMat.color.setHex(eraColour);
        auraMat.opacity = mk.state === 'sealed' ? 0 : mk.state === 'warned' ? 0.6 + 0.2 * Math.abs(Math.sin(time * 6)) : mk.dormant ? 0.3 : 0.45;

        e.rift.setState(riftStateFor(mk, sealing === mk.id), time);
        // the detail level: the tear's draw calls are only spent near the camera (the state above shows it on near leaks)
        const tear = e.rift.group.getObjectByName('rift-tear');
        if (tear) tear.visible = tear.visible && camera.position.distanceTo(e.group.position) <= RIFT_DETAIL_DISTANCE;
      }
      // leaks that are gone from the markers (none are removed in play, but a new plot clears them)
      for (const [id, e] of entries) {
        if (markers.some((m) => m.id === id)) continue;
        dispose(e);
        entries.delete(id);
      }
    },
    dispose() {
      for (const e of entries.values()) dispose(e);
      entries.clear();
    },
  };
}
