// ============================================================================
// File: apps/web/src/play/turret-view.ts
// TASK-32 / TICKET-13 (Window C): 3D Split-Part Perimeter Defense Turret Assembly
// (`turret-base`, `turret-yoke`, `turret-gun` + procedural code round barrel &
// square muzzle shroud per 20-turret-s6.png) + #ffc13d Targeting Laser
// ============================================================================

import * as THREE from 'three';
import {
  stepTurretBrain,
  TURRET_LASER_HEX,
  TURRET_SOCKET_CONSTANTS,
  type TurretBrainInput,
  type TurretBrainOutput,
} from '../../../../packages/plotsim/src/turret-brain';

export { TURRET_SOCKET_CONSTANTS, stepTurretBrain };

export interface TurretInstance3D {
  readonly id: number;
  readonly root: THREE.Group;
  readonly baseGroup: THREE.Group;
  readonly yokePivot: THREE.Group;
  readonly gunPivot: THREE.Group;
  readonly barrelGroup: THREE.Group;
  readonly laserLine: THREE.Line;
  update(input: Omit<TurretBrainInput, 'turret'>): TurretBrainOutput;
  dispose(): void;
}

/**
 * Builds the procedural round barrel + square muzzle shroud + under-barrel #ffc13d laser emitter
 * box in code (since round tubes break quadric mesh reduction on generated GLBs).
 */
export function createCodeBarrelAndShroud(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'turret-code-barrel';

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x2b3038,
    roughness: 0.45,
    metalness: 0.75,
  });
  const shroudMat = new THREE.MeshStandardMaterial({
    color: 0x3d4450,
    roughness: 0.55,
    metalness: 0.65,
  });
  const amberMat = new THREE.MeshBasicMaterial({ color: TURRET_LASER_HEX });

  const len = TURRET_SOCKET_CONSTANTS.BARREL_CYLINDER_LENGTH_M;
  const rad = TURRET_SOCKET_CONSTANTS.BARREL_CYLINDER_RADIUS_M;
  const cylGeo = new THREE.CylinderGeometry(rad, rad, len, 16);
  cylGeo.rotateX(Math.PI / 2);
  cylGeo.translate(0, 0, len / 2);
  const barrelMesh = new THREE.Mesh(cylGeo, barrelMat);
  g.add(barrelMesh);

  // Square muzzle shroud at the front tip of the round barrel (Rule 11)
  const [sw, sh, sd] = TURRET_SOCKET_CONSTANTS.MUZZLE_SHROUD_SIZE_M;
  const shroudGeo = new THREE.BoxGeometry(sw, sh, sd);
  const shroudMesh = new THREE.Mesh(shroudGeo, shroudMat);
  shroudMesh.position.set(0, 0, len - sd * 0.35);
  g.add(shroudMesh);

  // Under-barrel #ffc13d laser emitter box
  const laserBoxGeo = new THREE.BoxGeometry(0.08, 0.06, 0.14);
  const laserBox = new THREE.Mesh(laserBoxGeo, shroudMat);
  laserBox.position.set(0, -0.09, 0.12);
  const lensGeo = new THREE.BoxGeometry(0.04, 0.03, 0.02);
  const lensMesh = new THREE.Mesh(lensGeo, amberMat);
  lensMesh.position.set(0, 0, 0.075);
  laserBox.add(lensMesh);
  g.add(laserBox);

  return g;
}

/**
 * Assembles a 3-part Perimeter Defense Turret at a Sheet-13 wall corner/roof socket
 * or Hauler rear socket.
 * - `baseMesh`: `turret-base` (0.9 m bolted plate + hazard pedestal, fixed)
 * - `yokeMesh`: `turret-yoke` (0.75 m square U-yoke, yaws around +Y at YAW_AXIS_HEIGHT_M)
 * - `gunMesh`:  `turret-gun` (0.9 m receiver + left ammo box, pitches at TRUNNION_HEIGHT_ON_YOKE_M)
 */
export function createTurretInstance3D(opts: {
  readonly id: number;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly parent?: THREE.Object3D;
  readonly baseMesh?: THREE.Object3D | null;
  readonly yokeMesh?: THREE.Object3D | null;
  readonly gunMesh?: THREE.Object3D | null;
}): TurretInstance3D {
  const root = new THREE.Group();
  root.name = `perimeter-turret-${opts.id}`;
  root.position.set(opts.position.x, opts.position.y, opts.position.z);
  if (opts.parent) opts.parent.add(root);

  const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x454c57, roughness: 0.65, metalness: 0.45 });

  // 1. Fixed Base (`turret-base`)
  const baseGroup = new THREE.Group();
  baseGroup.name = 'turret-base';
  if (opts.baseMesh) {
    baseGroup.add(opts.baseMesh);
  } else {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.9), fallbackMat);
    plate.position.y = 0.14;
    baseGroup.add(plate);
  }
  root.add(baseGroup);

  // 2. Yawing U-Yoke (`turret-yoke`)
  const yokePivot = new THREE.Group();
  yokePivot.name = 'turret-yoke';
  yokePivot.position.set(0, TURRET_SOCKET_CONSTANTS.YAW_AXIS_HEIGHT_M, 0);
  if (opts.yokeMesh) {
    yokePivot.add(opts.yokeMesh);
  } else {
    const yokeBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 0.42), fallbackMat);
    yokeBox.position.y = 0.27;
    yokePivot.add(yokeBox);
  }
  root.add(yokePivot);

  // 3. Pitching Gun Receiver (`turret-gun`) at trunnions
  const gunPivot = new THREE.Group();
  gunPivot.name = 'turret-gun';
  gunPivot.position.set(0, TURRET_SOCKET_CONSTANTS.TRUNNION_HEIGHT_ON_YOKE_M, 0);
  if (opts.gunMesh) {
    gunPivot.add(opts.gunMesh);
  } else {
    const gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.9), fallbackMat);
    gunPivot.add(gunBox);
  }

  // 4. Procedural Code Barrel + Square Muzzle Shroud at BARREL_COLLAR_OFFSET_M
  const barrelGroup = createCodeBarrelAndShroud();
  const [bx, by, bz] = TURRET_SOCKET_CONSTANTS.BARREL_COLLAR_OFFSET_M;
  barrelGroup.position.set(bx, by, bz);
  gunPivot.add(barrelGroup);
  yokePivot.add(gunPivot);

  // 5. #ffc13d Targeting Laser Line in world space
  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, 1),
  ]);
  const laserMat = new THREE.LineBasicMaterial({
    color: TURRET_LASER_HEX,
    transparent: true,
    opacity: 0.88,
  });
  const laserLine = new THREE.Line(laserGeo, laserMat);
  laserLine.name = 'turret-laser';
  laserLine.visible = false;
  laserLine.frustumCulled = false;
  root.add(laserLine);

  let currentYaw = 0;
  let currentPitch = 0;
  let cooldownLeftS = 0;

  return {
    id: opts.id,
    root,
    baseGroup,
    yokePivot,
    gunPivot,
    barrelGroup,
    laserLine,
    update(input) {
      const out = stepTurretBrain({
        ...input,
        turret: {
          x: root.position.x,
          y: root.position.y,
          z: root.position.z,
          currentYaw,
          currentPitch,
          cooldownLeftS,
        },
      });
      currentYaw = out.yaw;
      currentPitch = out.pitch;
      cooldownLeftS = out.nextCooldownS;

      yokePivot.rotation.y = currentYaw;
      gunPivot.rotation.x = -currentPitch;

      if (out.laserActive && out.laserTo) {
        laserLine.visible = true;
        const posAttr = laserGeo.getAttribute('position') as THREE.BufferAttribute;
        posAttr.setXYZ(
          0,
          out.laserFrom.x - root.position.x,
          out.laserFrom.y - root.position.y,
          out.laserFrom.z - root.position.z,
        );
        posAttr.setXYZ(
          1,
          out.laserTo.x - root.position.x,
          out.laserTo.y - root.position.y,
          out.laserTo.z - root.position.z,
        );
        posAttr.needsUpdate = true;
      } else {
        laserLine.visible = false;
      }

      return out;
    },
    dispose() {
      laserGeo.dispose();
      laserMat.dispose();
      if (root.parent) root.parent.remove(root);
    },
  };
}
