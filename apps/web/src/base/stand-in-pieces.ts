/**
 * STAND-IN BASE-BUILDING PIECES (Temporary Visual Scaffolding)
 *
 * NOTE FOR REVIEWERS & CLAUDE OPUS:
 * These are procedural stand-in placeholder meshes for structural lattice testing.
 * Official production-grade high-fidelity assets (@hm/basekit) will be supplied via
 * the Arena 3D mesh pipeline following approval of concept art sheet 13/14.
 */

import * as THREE from 'three';
import type { PieceKind } from './view';

const GHOST_MATERIALS = {
  grounded: new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.6,
    wireframe: false,
  }),
  ok: new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.6,
    wireframe: false,
  }),
  weak: new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.6,
    wireframe: false,
  }),
  bad: new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.6,
    wireframe: false,
  }),
};

export type GhostTint = 'grounded' | 'ok' | 'weak' | 'bad';

export function createStandInPiece(kind: PieceKind, tint: GhostTint = 'ok'): THREE.Group {
  const group = new THREE.Group();
  group.name = `standin-${kind}`;

  const material = GHOST_MATERIALS[tint] || GHOST_MATERIALS.ok;

  switch (kind) {
    case 'foundation': {
      // 4m x 0.5m x 4m slab
      const geo = new THREE.BoxGeometry(4, 0.5, 4);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 0.25;
      group.add(mesh);
      break;
    }

    case 'floor': {
      // 4m x 0.15m x 4m floor tile
      const geo = new THREE.BoxGeometry(4, 0.15, 4);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 0.075;
      group.add(mesh);
      break;
    }

    case 'wall': {
      // 4m x 3m x 0.2m wall
      const geo = new THREE.BoxGeometry(4, 3, 0.2);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 1.5;
      group.add(mesh);
      break;
    }

    case 'airlock': {
      // Wall with doorway cutout
      const postGeo = new THREE.BoxGeometry(1, 3, 0.2);
      const lintelGeo = new THREE.BoxGeometry(2, 0.8, 0.2);

      const left = new THREE.Mesh(postGeo, material);
      left.position.set(-1.5, 1.5, 0);

      const right = new THREE.Mesh(postGeo, material);
      right.position.set(1.5, 1.5, 0);

      const top = new THREE.Mesh(lintelGeo, material);
      top.position.set(0, 2.6, 0);

      group.add(left, right, top);
      break;
    }

    case 'pillar': {
      // 0.4m x 3m x 0.4m column
      const geo = new THREE.BoxGeometry(0.4, 3, 0.4);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 1.5;
      group.add(mesh);
      break;
    }

    case 'ramp': {
      // 4m wide x 3m high x 4m long inclined wedge
      const geo = new THREE.BoxGeometry(4, 0.2, 5);
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = Math.atan2(3, 4);
      mesh.position.set(0, 1.5, 0);
      group.add(mesh);
      break;
    }

    default: {
      // Generic bounding box
      const geo = new THREE.BoxGeometry(2, 2, 2);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = 1.0;
      group.add(mesh);
      break;
    }
  }

  return group;
}
