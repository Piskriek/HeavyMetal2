/**
 * Builder primitives: plain 3D shapes you place like props and dress with a shader from the library
 * (or a flat material from the Shading panel). Each shape is built once at unit size and scaled by
 * the prop's width / height / depth, so resizing never rebuilds geometry. They are scenery only:
 * the race line is not changed by them.
 */
import * as THREE from 'three';
import type { PropDefinition } from './prop-catalog';

export type PrimitiveShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'ramp' | 'plane' | 'rock' | 'capsule' | 'arch';

interface ShapeInfo { shape: PrimitiveShape; name: string; size: [number, number, number]; icon: string }

// Line icons in the builder's amber, as data URIs so the shelf's <img> needs no files.
const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#f0b85e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`)}`;

const SHAPES: readonly ShapeInfo[] = [
  { shape: 'box', name: 'Box', size: [400, 400, 400], icon: svg('<path d="M12 22 32 12l20 10v22L32 54 12 44z"/><path d="M12 22l20 10 20-10M32 32v22"/>') },
  { shape: 'sphere', name: 'Sphere', size: [400, 400, 400], icon: svg('<circle cx="32" cy="32" r="20"/><ellipse cx="32" cy="32" rx="20" ry="7"/>') },
  { shape: 'cylinder', name: 'Cylinder', size: [300, 500, 300], icon: svg('<ellipse cx="32" cy="16" rx="16" ry="6"/><path d="M16 16v32c0 3.3 7.2 6 16 6s16-2.7 16-6V16"/>') },
  { shape: 'cone', name: 'Cone', size: [400, 500, 400], icon: svg('<path d="M32 10 14 48c0 3.3 8 6 18 6s18-2.7 18-6z"/><ellipse cx="32" cy="48" rx="18" ry="6"/>') },
  { shape: 'torus', name: 'Ring', size: [500, 500, 160], icon: svg('<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="9"/>') },
  { shape: 'ramp', name: 'Wedge', size: [400, 200, 600], icon: svg('<path d="M10 46h44V22z"/><path d="M10 46 54 22"/>') },
  { shape: 'plane', name: 'Flat panel', size: [800, 10, 800], icon: svg('<path d="M8 38 30 26l26 8-22 14z"/>') },
  { shape: 'rock', name: 'Rock', size: [420, 320, 380], icon: svg('<path d="M12 44 18 24l14-10 16 6 6 18-8 10H20z"/><path d="M18 24l12 8 18-12M30 32l-2 22"/>') },
  { shape: 'capsule', name: 'Capsule', size: [200, 500, 200], icon: svg('<rect x="22" y="8" width="20" height="48" rx="10"/>') },
  { shape: 'arch', name: 'Arch', size: [600, 400, 160], icon: svg('<path d="M10 54V30a22 22 0 0 1 44 0v24h-10V30a12 12 0 0 0-24 0v24z"/>') },
];

export const PRIMITIVE_PREFIX = 'prim_';
export const isPrimitiveType = (type: string) => type.startsWith(PRIMITIVE_PREFIX);
export const primitiveShape = (type: string): PrimitiveShape | null => {
  const shape = type.slice(PRIMITIVE_PREFIX.length) as PrimitiveShape;
  return SHAPES.some((s) => s.shape === shape) ? shape : null;
};

/** The shelf entries (category 'primitives'). defaultWidth/Height/Depth are the starting size. */
export const PRIMITIVE_DEFINITIONS: PropDefinition[] = SHAPES.map((s) => ({
  type: `${PRIMITIVE_PREFIX}${s.shape}`, name: s.name, category: 'primitives', url: s.icon,
  defaultWidth: s.size[0], defaultHeight: s.size[1], defaultDepth: s.size[2],
}));

/** A deterministic lumpy rock (the same every load, so a track looks the same every time). */
function rockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.5, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 9.1 + v.y * 3.7) * 0.08 + Math.sin(v.y * 7.3 - v.z * 5.1) * 0.06 + Math.sin(v.z * 11.7 + v.x * 2.3) * 0.05;
    v.multiplyScalar(1 + n);
    v.y = Math.max(v.y, -0.42); // a flat-ish base so it sits on the ground
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function archGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0); shape.lineTo(-0.5, 0.5); shape.absarc(0, 0.5, 0.5, Math.PI, 0, true); shape.lineTo(0.5, 0);
  shape.lineTo(0.3, 0); shape.lineTo(0.3, 0.5); shape.absarc(0, 0.5, 0.3, 0, Math.PI, false); shape.lineTo(-0.3, 0); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -0.5); // height 0..1, depth -0.5..0.5
  return geo;
}

function rampGeometry(): THREE.BufferGeometry {
  // A wedge from a triangular prism: low edge at -z, high edge at +z, base on y = 0.
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0); shape.lineTo(0.5, 0); shape.lineTo(0.5, 1); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geo.translate(0, 0, -0.5);
  geo.rotateY(-Math.PI / 2); // the slope rises along +z
  return geo;
}

/** Unit geometries (1 × 1 × 1, base on y = 0), built once and shared by every placed primitive. */
const cache = new Map<PrimitiveShape, THREE.BufferGeometry>();
export function primitiveGeometry(shape: PrimitiveShape): THREE.BufferGeometry {
  let geo = cache.get(shape);
  if (geo) return geo;
  switch (shape) {
    case 'box': geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); break;
    case 'sphere': geo = new THREE.SphereGeometry(0.5, 40, 24).translate(0, 0.5, 0); break;
    case 'cylinder': geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 40).translate(0, 0.5, 0); break;
    case 'cone': geo = new THREE.ConeGeometry(0.5, 1, 40).translate(0, 0.5, 0); break;
    case 'torus': geo = new THREE.TorusGeometry(0.4, 0.1, 20, 48).scale(1, 1, 5).translate(0, 0.5, 0); break;
    case 'ramp': geo = rampGeometry(); break;
    case 'plane': geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); break;
    case 'rock': geo = rockGeometry().translate(0, 0.42, 0); break;
    case 'capsule': geo = new THREE.CapsuleGeometry(0.5, 1, 8, 24).scale(1, 0.5, 1).translate(0, 0.5, 0); break;
    case 'arch': geo = archGeometry(); break;
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  cache.set(shape, geo);
  return geo;
}

/** The prop's size in world units: explicit width/height/depth, else the shape's default × scale. */
export function primitiveSize(prop: { type: string; scale: number; width?: number; height?: number; depth?: number }): [number, number, number] {
  const def = PRIMITIVE_DEFINITIONS.find((d) => d.type === prop.type);
  const s = prop.scale || 1;
  return [
    prop.width ?? (def?.defaultWidth ?? 400) * s,
    prop.height ?? (def?.defaultHeight ?? 400) * s,
    prop.depth ?? (def?.defaultDepth ?? 400) * s,
  ];
}

/** Position, rotation and size of a primitive's mesh from its prop. */
export function applyPrimitiveTransform(mesh: THREE.Object3D, prop: { type: string; x: number; y: number; z: number; rotY: number; rotX?: number; rotZ?: number; scale: number; width?: number; height?: number; depth?: number; flipX?: boolean }) {
  const [w, h, d] = primitiveSize(prop);
  mesh.position.set(prop.x, prop.y, prop.z);
  mesh.rotation.set(prop.rotX ?? 0, prop.rotY ?? 0, prop.rotZ ?? 0, 'YXZ');
  mesh.scale.set(w * (prop.flipX ? -1 : 1), h, d);
}
