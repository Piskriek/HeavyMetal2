// ============================================================================
// File: apps/web/src/play/remote-peers.ts
// TICKET-11 (F-14 / play-scene.ts Window B helper):
// Renders remote co-op peers in Three.js with role-tinted suit beacons and
// floating name + role badges ('Lead Architect', 'Co-Builder', 'Field Observer').
// ============================================================================

import * as THREE from 'three';
import { ROLE_LABELS, type OutpostRole, type PeerPose } from '../net/protocol';

export const ROLE_AVATAR_COLOURS: Readonly<Record<OutpostRole, number>> = {
  owner: 0xffb84d,     // Warm amber gold for Lead Architect
  cobuilder: 0x3dc8ff, // Cyan telemetry blue for Co-Builder
  visitor: 0x9aa8b8,   // Neutral slate silver for Field Observer
};

export interface RemotePeersController {
  readonly group: THREE.Group;
  setRemotePeers(peers: readonly PeerPose[]): void;
  getAvatarCount(): number;
  getPeerIds(): string[];
  dispose(): void;
}

interface PeerAvatarRig {
  readonly root: THREE.Group;
  readonly bodyMat: THREE.MeshStandardMaterial;
  readonly visorMat: THREE.MeshBasicMaterial;
  readonly ringMat: THREE.MeshBasicMaterial;
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly headGroup: THREE.Group;
  role: OutpostRole;
  username: string;
}

function createAvatarRig(peer: PeerPose): PeerAvatarRig {
  const root = new THREE.Group();
  root.name = `remote-peer-${peer.id}`;

  const roleColour = ROLE_AVATAR_COLOURS[peer.role] ?? ROLE_AVATAR_COLOURS.visitor;

  // Suit torso capsule / cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.32, 0.36, 1.25, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x243040,
    roughness: 0.45,
    metalness: 0.3,
    emissive: roleColour,
    emissiveIntensity: 0.22,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.65;
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Head + visor group (rotates with yaw)
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.48;
  const helmetGeo = new THREE.SphereGeometry(0.26, 12, 10);
  const helmetMesh = new THREE.Mesh(helmetGeo, bodyMat);
  headGroup.add(helmetMesh);

  const visorGeo = new THREE.BoxGeometry(0.34, 0.14, 0.2);
  const visorMat = new THREE.MeshBasicMaterial({ color: roleColour });
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.02, 0.2);
  headGroup.add(visorMesh);
  root.add(headGroup);

  // Role ground ring beacon
  const ringGeo = new THREE.RingGeometry(0.45, 0.56, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: roleColour,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.03;
  root.add(ringMesh);

  root.userData = {
    peerId: peer.id,
    username: peer.username,
    role: peer.role,
    roleLabel: ROLE_LABELS[peer.role],
  };

  return {
    root,
    bodyMat,
    visorMat,
    ringMat,
    geometries: [bodyGeo, helmetGeo, visorGeo, ringGeo],
    headGroup,
    role: peer.role,
    username: peer.username,
  };
}

function disposeRig(rig: PeerAvatarRig): void {
  for (const geo of rig.geometries) {
    geo.dispose();
  }
  rig.bodyMat.dispose();
  rig.visorMat.dispose();
  rig.ringMat.dispose();
}

/**
 * Creates a self-contained Three.js remote peer avatar manager that `play-scene.ts`
 * mounts into the scene and updates each frame via `setRemotePeers(peers)`.
 */
export function createRemotePeersController(parent?: THREE.Object3D): RemotePeersController {
  const group = new THREE.Group();
  group.name = 'outpost-remote-peers';
  if (parent) parent.add(group);

  const rigs = new Map<string, PeerAvatarRig>();

  const setRemotePeers = (peers: readonly PeerPose[]): void => {
    const activeIds = new Set<string>();
    for (const peer of peers) {
      // POL-172: hide peers who entered the Earth Lab (inLab / leftPlot) or lack finite plot coordinates
      const peerExt = peer as PeerPose & { readonly inLab?: boolean; readonly leftPlot?: boolean };
      if (
        !peer ||
        !peer.id ||
        peerExt.inLab === true ||
        peerExt.leftPlot === true ||
        !Number.isFinite(peer.x) ||
        !Number.isFinite(peer.y) ||
        !Number.isFinite(peer.z) ||
        !Number.isFinite(peer.yaw)
      ) {
        continue;
      }
      activeIds.add(peer.id);
      let rig = rigs.get(peer.id);
      if (!rig) {
        rig = createAvatarRig(peer);
        rigs.set(peer.id, rig);
        group.add(rig.root);
      }
      if (rig.role !== peer.role || rig.username !== peer.username) {
        const col = ROLE_AVATAR_COLOURS[peer.role] ?? ROLE_AVATAR_COLOURS.visitor;
        rig.bodyMat.emissive.setHex(col);
        rig.visorMat.color.setHex(col);
        rig.ringMat.color.setHex(col);
        rig.role = peer.role;
        rig.username = peer.username;
        rig.root.userData = {
          peerId: peer.id,
          username: peer.username,
          role: peer.role,
          roleLabel: ROLE_LABELS[peer.role],
        };
      }
      rig.root.position.set(peer.x, peer.y, peer.z);
      rig.root.rotation.y = peer.yaw;
    }

    for (const [id, rig] of rigs.entries()) {
      if (!activeIds.has(id)) {
        group.remove(rig.root);
        disposeRig(rig);
        rigs.delete(id);
      }
    }
  };

  const dispose = (): void => {
    setRemotePeers([]);
    if (group.parent) group.parent.remove(group);
  };

  return {
    group,
    setRemotePeers,
    getAvatarCount: () => rigs.size,
    getPeerIds: () => [...rigs.keys()],
    dispose,
  };
}
