// ============================================================================
// File: apps/web/src/play/armory-rack.ts
// TICKET-07 (OPUS_NOTE_14 Item D — MC-02):
// - armoryRack(m): { group; colliders; pickupAt; sidearm; setTaken(taken): void }
//   in lab-room style with an interactive sidearm on the East wall armory rail;
//   picking it up equips the sidearm ('wpn-shotgun' / 'wpn-frame' in equipment.sidearm).
// - shouldShowAmmoBadge(equipment, monstersEquipped): boolean
//   Ensures the SEMI 8/8 ammo badge shows ONLY when a sidearm is equipped.
// ============================================================================

import * as THREE from 'three';
import type * as kit from '@hm/labkit';
import type { Box } from '@hm/labkit';

/** Lab coordinates of the East-wall armory rack (`x = 7.75, y = 1.3, z = 0.6`). */
export const ARMORY_RAIL_POS = { x: 7.75, y: 1.3, z: 0.6 } as const;
export const ARMORY_PICKUP_REACH = 2.6;
export const SIDEARM_ITEM_ID = 'wpn-shotgun';

export interface ArmoryRackResult {
  readonly group: THREE.Group;
  readonly colliders: Box[];
  readonly pickupAt: { readonly x: number; readonly y: number; readonly z: number };
  readonly sidearm: THREE.Group;
  isTaken(): boolean;
  setTaken(taken: boolean): void;
}

/**
 * Builds the South-East Armory Nook wall rack (`armoryRack(m)`) with both the
 * top extraction beam cradle and a lower tactical sidearm holster holding the
 * pickupable Combat Sidearm (`wpn-shotgun`).
 */
export function armoryRack(m: kit.LabMaterials): ArmoryRackResult {
  const group = new THREE.Group();
  group.name = 'armory-rack';

  // Upper and lower square-section mounting bars along the wall (z axis)
  const upperBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.4), m.gunmetal);
  upperBar.position.set(0, 0.14, 0);
  const lowerBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.4), m.gunmetal);
  lowerBar.position.set(0, -0.18, 0);
  group.add(upperBar, lowerBar);

  for (const rz of [-0.48, 0.48]) {
    const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.08), m.darkSteel);
    backplate.position.set(0.06, -0.02, rz);
    const upperPeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), m.gunmetal);
    upperPeg.position.set(-0.06, 0.16, rz);
    const lowerPeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), m.gunmetal);
    lowerPeg.position.set(-0.06, -0.16, rz);
    group.add(backplate, upperPeg, lowerPeg);
  }

  // Upper extraction tool frame
  const beamMock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.56), m.paint);
  beamMock.name = 'armory-beam-cradle';
  beamMock.position.set(-0.08, 0.22, 0);
  group.add(beamMock);

  // Lower pickupable Combat Sidearm on the rail
  const sidearm = new THREE.Group();
  sidearm.name = 'armory-sidearm';
  sidearm.userData.pickupId = SIDEARM_ITEM_ID;
  sidearm.userData.isSidearmPickup = true;

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.34), m.darkSteel);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.045, 0.38), m.gunmetal);
  barrel.position.set(0, 0.018, -0.26);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.12, 0.09), m.copper ?? m.paint);
  grip.position.set(0, -0.075, 0.14);
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.024, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xffc13d })
  );
  beacon.position.set(-0.036, 0.03, 0);

  sidearm.add(receiver, barrel, grip, beacon);
  sidearm.position.set(-0.08, -0.12, 0);
  group.add(sidearm);

  const colliders: Box[] = [{ min: [-0.2, -0.28, -0.75], max: [0.1, 0.32, 0.75] }];
  const pickupAt = {
    x: ARMORY_RAIL_POS.x - 0.08,
    y: ARMORY_RAIL_POS.y - 0.12,
    z: ARMORY_RAIL_POS.z,
  };

  let taken = false;

  return {
    group,
    colliders,
    pickupAt,
    sidearm,
    isTaken: () => taken,
    setTaken(next) {
      taken = Boolean(next);
      sidearm.visible = !taken;
    },
  };
}

/**
 * Pure predicate gating the HUD `SEMI 8/8` weapon ammo badge (TICKET-07 Item D — MC-02):
 * Returns `true` ONLY when the player actually has a sidearm item in `equipment.sidearm`
 * AND the sidearm is currently drawn/equipped.
 */
export function shouldShowAmmoBadge(
  sidearmSlot: { readonly item: unknown | null } | string | null | undefined,
  sidearmActive = true
): boolean {
  if (!sidearmActive) return false;
  if (!sidearmSlot) return false;
  if (typeof sidearmSlot === 'string') return sidearmSlot.length > 0;
  return Boolean(sidearmSlot.item);
}
