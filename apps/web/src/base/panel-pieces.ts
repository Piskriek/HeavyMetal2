// ============================================================================
// File: apps/web/src/base/panel-pieces.ts
// TICKET-05 (OPUS_NOTE_12 Items B & C — BB-06, BB-08):
// - gunmetalPanel(kind: 'windowWall' | 'door' | 'halfWall' | 'gable', o: { w, h, d }):
//   { group: THREE.Group; colliders: Box[]; leaf?: THREE.Object3D }
//   Square-section frames, recessed gunmetal panels, dark smoked glazing pane for
//   windowWall, and a separate sliding leaf for door. Zero lettering, zero tubes/cages.
// - slideDoor(leaf: THREE.Object3D, open: number /* 0..1 */, travel: number): void
//   Slides the door leaf sideways into the pocket frame instead of swinging on a hinge.
// ============================================================================

import * as THREE from 'three';

export interface Box {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export type PanelKind = 'windowWall' | 'door' | 'halfWall' | 'gable';

export interface PanelSize {
  readonly w: number;
  readonly h: number;
  readonly d: number;
}

export interface GunmetalPanelResult {
  readonly group: THREE.Group;
  readonly colliders: Box[];
  readonly leaf?: THREE.Object3D;
}

/** Default sideways travel (metres) for a standard 1.4 m wide sliding door leaf. */
export const DEFAULT_DOOR_TRAVEL = 1.32;

interface SharedPanelMaterials {
  readonly frame: THREE.MeshStandardMaterial;
  readonly panel: THREE.MeshStandardMaterial;
  readonly trim: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshStandardMaterial;
}

let sharedMats: SharedPanelMaterials | null = null;

export function getPanelMaterials(): SharedPanelMaterials {
  if (!sharedMats) {
    sharedMats = {
      frame: new THREE.MeshStandardMaterial({
        color: 0x242a34,
        roughness: 0.62,
        metalness: 0.46,
      }),
      panel: new THREE.MeshStandardMaterial({
        color: 0x313946,
        roughness: 0.56,
        metalness: 0.38,
      }),
      trim: new THREE.MeshStandardMaterial({
        color: 0x3d4758,
        roughness: 0.48,
        metalness: 0.52,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x0d1b2a,
        roughness: 0.14,
        metalness: 0.22,
        transparent: true,
        opacity: 0.74,
      }),
    };
  }
  return sharedMats;
}

function makeBoxMesh(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  mat: THREE.Material,
  name?: string
): THREE.Mesh {
  const sx = Math.max(0.004, x1 - x0);
  const sy = Math.max(0.004, y1 - y0);
  const sz = Math.max(0.004, z1 - z0);
  const geom = new THREE.BoxGeometry(sx, sy, sz);
  geom.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
  const mesh = new THREE.Mesh(geom, mat);
  if (name) mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a right-triangular wedge prism spanning x in [x0, x1], rising from y0 at x0 to y1 at x1,
 * and z in [z0, z1] (8 triangles, square-edged faces).
 */
function makeGableWedgeMesh(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  mat: THREE.Material,
  name?: string
): THREE.Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const pushTri = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    n: readonly [number, number, number]
  ) => {
    const base = positions.length / 3;
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    normals.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    indices.push(base, base + 1, base + 2);
  };

  const pushQuad = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    d: readonly [number, number, number],
    n: readonly [number, number, number]
  ) => {
    pushTri(a, b, c, n);
    pushTri(a, c, d, n);
  };

  // Front face (+Z)
  pushTri([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [0, 0, 1]);
  // Back face (-Z)
  pushTri([x1, y0, z0], [x0, y0, z0], [x1, y1, z0], [0, 0, -1]);
  // Bottom face (-Y)
  pushQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  // Right vertical face (+X)
  pushQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
  // Sloped top face
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  pushQuad([x0, y0, z1], [x1, y1, z1], [x1, y1, z0], [x0, y0, z0], [nx, ny, 0]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const mesh = new THREE.Mesh(geom, mat);
  if (name) mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds square-section gunmetal panels for 'windowWall' | 'door' | 'halfWall' | 'gable'
 * in raw kit space (x in [0, w], y in [0, h], z in [-d/2, +d/2]), preserving existing colliders.
 */
export function gunmetalPanel(kind: PanelKind, o: PanelSize): GunmetalPanelResult {
  const w = o.w > 0 ? o.w : 4;
  const h = o.h > 0 ? o.h : kind === 'halfWall' ? 1.5 : 3;
  const d = o.d > 0 ? o.d : 0.28;
  const hz = d * 0.5;
  const recessHz = hz * 0.58;
  const trimHz = hz * 0.82;
  const mats = getPanelMaterials();

  const group = new THREE.Group();
  group.name = `panel-${kind}`;

  if (kind === 'halfWall') {
    const postW = 0.18;
    const sillH = 0.14;
    const capH = 0.16;
    const midW = 0.14;
    const midX = w * 0.5;

    // Outer square-section frame: left post, right post, bottom sill, top coping rail, centre mullion
    group.add(
      makeBoxMesh(0, 0, -hz, postW, h, hz, mats.frame, 'frame-left'),
      makeBoxMesh(w - postW, 0, -hz, w, h, hz, mats.frame, 'frame-right'),
      makeBoxMesh(postW, 0, -hz, w - postW, sillH, hz, mats.frame, 'frame-sill'),
      makeBoxMesh(0, h - capH, -hz * 1.08, w, h, hz * 1.08, mats.trim, 'frame-cap'),
      makeBoxMesh(midX - midW * 0.5, sillH, -trimHz, midX + midW * 0.5, h - capH, trimHz, mats.frame, 'frame-mid'),
      // Recessed gunmetal bays (left and right)
      makeBoxMesh(postW, sillH, -recessHz, midX - midW * 0.5, h - capH, recessHz, mats.panel, 'panel-left'),
      makeBoxMesh(midX + midW * 0.5, sillH, -recessHz, w - postW, h - capH, recessHz, mats.panel, 'panel-right'),
      // Horizontal stiffener rib across each bay
      makeBoxMesh(postW, h * 0.48 - 0.04, -trimHz, midX - midW * 0.5, h * 0.48 + 0.04, trimHz, mats.trim, 'rib-left'),
      makeBoxMesh(midX + midW * 0.5, h * 0.48 - 0.04, -trimHz, w - postW, h * 0.48 + 0.04, trimHz, mats.trim, 'rib-right')
    );

    const colliders: Box[] = [{ min: [0, 0, -hz], max: [w, h, hz] }];
    return { group, colliders };
  }

  if (kind === 'windowWall') {
    const sx = w / 4;
    const sy = h / 3;
    const winX0 = 0.8 * sx;
    const winX1 = 3.2 * sx;
    const winY0 = 1.0 * sy;
    const winY1 = 2.2 * sy;
    const postW = 0.18 * sx;
    const jambW = 0.12 * sx;
    const sillH = 0.14 * sy;
    const glassHz = Math.min(0.035, hz * 0.3);

    group.add(
      // Outer structural posts and horizontal rails
      makeBoxMesh(0, 0, -hz, postW, h, hz, mats.frame, 'post-left'),
      makeBoxMesh(w - postW, 0, -hz, w, h, hz, mats.frame, 'post-right'),
      makeBoxMesh(postW, 0, -hz, w - postW, sillH, hz, mats.frame, 'rail-bottom'),
      makeBoxMesh(postW, h - sillH, -hz, w - postW, h, hz, mats.frame, 'rail-top'),
      // Window vertical jambs & horizontal sill/lintel beams
      makeBoxMesh(winX0 - jambW, sillH, -hz, winX0, h - sillH, hz, mats.frame, 'jamb-left'),
      makeBoxMesh(winX1, sillH, -hz, winX1 + jambW, h - sillH, hz, mats.frame, 'jamb-right'),
      makeBoxMesh(winX0, winY0 - 0.1 * sy, -hz * 1.05, winX1, winY0, hz * 1.05, mats.trim, 'window-sill'),
      makeBoxMesh(winX0, winY1, -hz * 1.05, winX1, winY1 + 0.1 * sy, hz * 1.05, mats.trim, 'window-lintel'),
      // Central square-section window mullion
      makeBoxMesh(w * 0.5 - 0.045 * sx, winY0, -trimHz, w * 0.5 + 0.045 * sx, winY1, trimHz, mats.trim, 'window-mullion'),
      // Recessed gunmetal infill panels (left flank, right flank, lower wainscot, upper spandrel)
      makeBoxMesh(postW, sillH, -recessHz, winX0 - jambW, h - sillH, recessHz, mats.panel, 'panel-flank-left'),
      makeBoxMesh(winX1 + jambW, sillH, -recessHz, w - postW, h - sillH, recessHz, mats.panel, 'panel-flank-right'),
      makeBoxMesh(winX0, sillH, -recessHz, winX1, winY0 - 0.1 * sy, recessHz, mats.panel, 'panel-wainscot'),
      makeBoxMesh(winX0, winY1 + 0.1 * sy, -recessHz, winX1, h - sillH, recessHz, mats.panel, 'panel-spandrel'),
      // Dark smoked glazing pane
      makeBoxMesh(winX0, winY0, -glassHz, winX1, winY1, glassHz, mats.glass, 'window-pane')
    );

    const colliders: Box[] = [
      { min: [0, 0, -hz], max: [winX0, h, hz] },
      { min: [winX1, 0, -hz], max: [w, h, hz] },
      { min: [winX0, 0, -hz], max: [winX1, winY0, hz] },
      { min: [winX0, winY1, -hz], max: [winX1, h, hz] },
      { min: [winX0, winY0, -0.1], max: [winX1, winY1, 0.1] },
    ];
    return { group, colliders };
  }

  if (kind === 'door') {
    const sx = w / 4;
    const sy = h / 3;
    const doorX0 = 1.3 * sx;
    const doorX1 = 2.7 * sx;
    const doorY1 = 2.3 * sy;
    const postW = 0.18 * sx;
    const jambW = 0.12 * sx;
    const sillH = 0.14 * sy;

    // Stationary bulkhead frame
    group.add(
      makeBoxMesh(0, 0, -hz, postW, h, hz, mats.frame, 'post-left'),
      makeBoxMesh(w - postW, 0, -hz, w, h, hz, mats.frame, 'post-right'),
      makeBoxMesh(doorX0 - jambW, 0, -hz, doorX0, h, hz, mats.frame, 'jamb-left'),
      makeBoxMesh(doorX1, 0, -hz, doorX1 + jambW, h, hz, mats.frame, 'jamb-right'),
      // Overhead lintel transceiver beam & pocket slide track
      makeBoxMesh(doorX0, doorY1, -hz * 1.06, doorX1, doorY1 + 0.14 * sy, hz * 1.06, mats.trim, 'door-lintel-track'),
      makeBoxMesh(postW, h - sillH, -hz, w - postW, h, hz, mats.frame, 'rail-top'),
      // Recessed gunmetal bulkhead flanks & transom
      makeBoxMesh(postW, 0, -recessHz, doorX0 - jambW, h - sillH, recessHz, mats.panel, 'panel-flank-left'),
      makeBoxMesh(doorX1 + jambW, 0, -recessHz, w - postW, h - sillH, recessHz, mats.panel, 'panel-flank-right'),
      makeBoxMesh(doorX0, doorY1 + 0.14 * sy, -recessHz, doorX1, h - sillH, recessHz, mats.panel, 'panel-transom')
    );

    // Separate sliding door leaf (slides sideways along X when slideDoor is called)
    const leaf = new THREE.Group();
    leaf.name = 'door-leaf';
    const leafHz = Math.min(0.085, hz * 0.62);
    const leafPanelHz = leafHz * 0.65;
    const stileW = 0.11 * sx;
    const railH = 0.12 * sy;
    const midY = doorY1 * 0.48;
    const slitX0 = (doorX0 + doorX1) * 0.5 - 0.08 * sx;
    const slitX1 = (doorX0 + doorX1) * 0.5 + 0.08 * sx;
    const slitY0 = doorY1 * 0.58;
    const slitY1 = doorY1 * 0.84;

    leaf.add(
      // Perimeter square-section stiles and rails
      makeBoxMesh(doorX0, 0.01, -leafHz, doorX0 + stileW, doorY1, leafHz, mats.trim, 'leaf-stile-left'),
      makeBoxMesh(doorX1 - stileW, 0.01, -leafHz, doorX1, doorY1, leafHz, mats.trim, 'leaf-stile-right'),
      makeBoxMesh(doorX0 + stileW, 0.01, -leafHz, doorX1 - stileW, railH, leafHz, mats.trim, 'leaf-rail-bottom'),
      makeBoxMesh(doorX0 + stileW, doorY1 - railH, -leafHz, doorX1 - stileW, doorY1, leafHz, mats.trim, 'leaf-rail-top'),
      makeBoxMesh(doorX0 + stileW, midY - 0.05 * sy, -leafHz, doorX1 - stileW, midY + 0.05 * sy, leafHz, mats.trim, 'leaf-rail-mid'),
      // Recessed lower and upper blast panels
      makeBoxMesh(doorX0 + stileW, railH, -leafPanelHz, doorX1 - stileW, midY - 0.05 * sy, leafPanelHz, mats.panel, 'leaf-panel-lower'),
      makeBoxMesh(doorX0 + stileW, midY + 0.05 * sy, -leafPanelHz, slitX0, doorY1 - railH, leafPanelHz, mats.panel, 'leaf-panel-upper-l'),
      makeBoxMesh(slitX1, midY + 0.05 * sy, -leafPanelHz, doorX1 - stileW, doorY1 - railH, leafPanelHz, mats.panel, 'leaf-panel-upper-r'),
      makeBoxMesh(slitX0, midY + 0.05 * sy, -leafPanelHz, slitX1, slitY0, leafPanelHz, mats.panel, 'leaf-panel-slit-bot'),
      makeBoxMesh(slitX0, slitY1, -leafPanelHz, slitX1, doorY1 - railH, leafPanelHz, mats.panel, 'leaf-panel-slit-top'),
      // Smoked viewport slit in upper door leaf
      makeBoxMesh(slitX0, slitY0, -leafPanelHz * 0.8, slitX1, slitY1, leafPanelHz * 0.8, mats.glass, 'leaf-viewport')
    );

    group.add(leaf);

    const colliders: Box[] = [
      { min: [0, 0, -hz], max: [doorX0, h, hz] },
      { min: [doorX1, 0, -hz], max: [w, h, hz] },
      { min: [doorX0, doorY1, -hz], max: [doorX1, h, hz] },
    ];
    return { group, colliders, leaf };
  }

  // 'gable': right-triangle pitched end wall rising from y = 0 at x = 0 to y = h at x = w
  const sillH = 0.14;
  const postW = 0.18;
  group.add(
    // Recessed triangular gunmetal infill wedge
    makeGableWedgeMesh(0, w, 0, h, -recessHz, recessHz, mats.panel, 'gable-infill'),
    // Bottom square-section sill beam
    makeBoxMesh(0, 0, -hz, w, sillH, hz, mats.frame, 'gable-sill'),
    // High-side vertical square-section post
    makeBoxMesh(w - postW, 0, -hz, w, h, hz, mats.frame, 'gable-post-high'),
    // Two intermediate vertical stiffener mullions clipped below the roof slope
    makeBoxMesh(w * 0.36 - 0.06, sillH, -trimHz, w * 0.36 + 0.06, h * 0.34, trimHz, mats.trim, 'gable-stiffener-1'),
    makeBoxMesh(w * 0.68 - 0.06, sillH, -trimHz, w * 0.68 + 0.06, h * 0.66, trimHz, mats.trim, 'gable-stiffener-2')
  );

  // Sloped top rafter cap beam (square cross-section rotated along the roof pitch)
  const hypLen = Math.hypot(w, h);
  const pitchAngle = Math.atan2(h, w);
  const rafterGeom = new THREE.BoxGeometry(hypLen, 0.15, d);
  const rafterMesh = new THREE.Mesh(rafterGeom, mats.frame);
  rafterMesh.name = 'gable-rafter';
  rafterMesh.position.set(w * 0.5, h * 0.5 - 0.04, 0);
  rafterMesh.rotation.z = pitchAngle;
  rafterMesh.castShadow = true;
  rafterMesh.receiveShadow = true;
  group.add(rafterMesh);

  const colliders: Box[] = [{ min: [0, 0, -hz], max: [w, h, hz] }];
  return { group, colliders };
}

/**
 * Slides a door leaf sideways into the pocket frame by `open * travel` metres (clamped to 0..1),
 * zeroing any hinge rotation so the leaf moves strictly linearly along X.
 */
export function slideDoor(leaf: THREE.Object3D, open: number, travel: number = DEFAULT_DOOR_TRAVEL): void {
  const t = Number.isFinite(open) ? Math.max(0, Math.min(1, open)) : 0;
  const dist = Number.isFinite(travel) ? travel : DEFAULT_DOOR_TRAVEL;
  const ud = (leaf.userData ??= {}) as Record<string, unknown>;
  if (typeof ud.restX !== 'number') {
    ud.restX = leaf.position.x;
  }
  const restX = ud.restX as number;
  leaf.position.x = restX + t * dist;
  leaf.rotation.y = 0;
}

/**
 * Computes the pivoted door leaf collider box as the leaf slides open (`open` in 0..1).
 * When fully open (`open >= 0.95`), returns null so the doorway is clear.
 */
export function slidingDoorCollider(open: number, travel: number = DEFAULT_DOOR_TRAVEL): Box | null {
  const t = Number.isFinite(open) ? Math.max(0, Math.min(1, open)) : 0;
  if (t >= 0.95) return null;
  const shift = t * (Number.isFinite(travel) ? travel : DEFAULT_DOOR_TRAVEL);
  return {
    min: [-0.7 + shift, 0, -0.125],
    max: [0.7 + shift, 2.3, 0.125],
  };
}
