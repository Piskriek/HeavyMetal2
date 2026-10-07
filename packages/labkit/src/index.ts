import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** An axis-aligned box in the prop's own frame, for walking collisions. */
export interface Box { min: [number, number, number]; max: [number, number, number] }
/** A named point where a cable or a pipe connects, in the prop's own frame. */
export interface Socket { name: string; at: [number, number, number] }

export interface Prop {
  group: THREE.Group;          // the prop, standing on y = 0 (or hanging from its wall mount)
  colliders: Box[];            // at least one; together they cover the prop's footprint
  sockets: Socket[];
  /** Lamps and glowing parts that light up when the prop is powered, in the order they come on. Their material is their own (not shared), so each can be lit alone. */
  lamps: THREE.Mesh[];
}

/** The shared materials. Call once; every builder takes it. */
export interface LabMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial; // hazard: diagonal yellow/black stripes from a DataTexture
  glass: THREE.MeshPhysicalMaterial;
  concrete: THREE.MeshStandardMaterial;
}

/** Deterministic pseudo-random number generator (no Math.random). */
export function seededRandom(seed: number): () => number {
  let s = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create procedural diagonal hazard texture without DOM canvas. */
function createHazardTexture(): THREE.DataTexture {
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  const stripeWidth = 8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const diagonal = Math.floor((x + y) / stripeWidth) % 2 === 0;
      if (diagonal) {
        // Safety yellow
        data[idx] = 232;
        data[idx + 1] = 185;
        data[idx + 2] = 25;
        data[idx + 3] = 255;
      } else {
        // Industrial black / dark charcoal
        data[idx] = 28;
        data[idx + 1] = 30;
        data[idx + 2] = 32;
        data[idx + 3] = 255;
      }
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;
  return texture;
}

export function createMaterials(): LabMaterials {
  const hazardTex = createHazardTexture();

  return {
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x33373d,
      metalness: 0.85,
      roughness: 0.35,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x22262a,
      metalness: 0.9,
      roughness: 0.28,
    }),
    paint: new THREE.MeshStandardMaterial({
      color: 0xa8b0b8,
      metalness: 0.15,
      roughness: 0.55,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xd97543,
      metalness: 0.92,
      roughness: 0.25,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x181a1c,
      metalness: 0.05,
      roughness: 0.85,
    }),
    hazard: new THREE.MeshStandardMaterial({
      map: hazardTex,
      metalness: 0.2,
      roughness: 0.45,
    }),
    // see-through by plain transparency, not transmission: any transmissive material makes three.js draw the whole scene a second
    // time every frame (the lab fell from 60 to 44 fps on the laptop's Intel HD 530); a clear coat keeps the glassy highlight
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xddeeff,
      metalness: 0,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x828488,
      metalness: 0.05,
      roughness: 0.9,
    }),
  };
}

export function setLamp(lamp: THREE.Mesh, glow: number): void {
  const mat = lamp.material as THREE.MeshStandardMaterial;
  if (mat && 'emissiveIntensity' in mat) {
    mat.emissiveIntensity = Math.max(0, glow);
  }
}

export function triangles(p: Prop): number {
  let count = 0;
  p.group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry;
      if (geo.index) {
        count += geo.index.count / 3;
      } else if (geo.attributes['position']) {
        count += geo.attributes['position'].count / 3;
      }
    }
  });
  return Math.round(count);
}

// Geometry helper utilities
function ensureAttributes(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.attributes['normal']) {
    geo.computeVertexNormals();
  }
  if (!geo.attributes['uv']) {
    const pos = geo.attributes['position'];
    if (pos) {
      const uvs = new Float32Array(pos.count * 2);
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
  }
  return geo;
}

class PropBuilder {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geo: THREE.BufferGeometry, mat: THREE.Material): void {
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo.clone();
    ensureAttributes(nonIndexed);
    let list = this.buckets.get(mat);
    if (!list) {
      list = [];
      this.buckets.set(mat, list);
    }
    list.push(nonIndexed);
  }

  build(targetGroup: THREE.Group): void {
    for (const [mat, list] of this.buckets.entries()) {
      if (list.length === 0) continue;
      const merged = list.length === 1 ? list[0]! : mergeGeometries(list, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        targetGroup.add(mesh);
      }
    }
  }
}

/** Chamfered Box geometry with bevels for high-end industrial look. */
function createChamferBox(
  width: number,
  height: number,
  depth: number,
  chamfer: number,
  segments: number = 2
): THREE.BufferGeometry {
  const c = Math.min(chamfer, width * 0.18, height * 0.18, depth * 0.18);
  if (c <= 0.0001) {
    return new THREE.BoxGeometry(width, height, depth);
  }
  const innerW = width - 2 * c;
  const innerH = height - 2 * c;
  const innerD = depth - 2 * c;
  const hw = innerW / 2;
  const hh = innerH / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + c, -hh);
  shape.lineTo(hw - c, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + c);
  shape.lineTo(hw, hh - c);
  shape.quadraticCurveTo(hw, hh, hw - c, hh);
  shape.lineTo(-hw + c, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - c);
  shape.lineTo(-hw, -hh + c);
  shape.quadraticCurveTo(-hw, -hh, -hw + c, -hh);

  const extrudeSettings = {
    steps: 1,
    depth: innerD,
    bevelEnabled: true,
    bevelThickness: c,
    bevelSize: c,
    bevelOffset: 0,
    bevelSegments: Math.max(1, segments),
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();

  // Normalize bounds to exactly match target width, height, depth
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const curW = bb.max.x - bb.min.x;
  const curH = bb.max.y - bb.min.y;
  const curD = bb.max.z - bb.min.z;
  if (curW > 0 && curH > 0 && curD > 0) {
    geo.scale(width / curW, height / curH, depth / curD);
  }
  return geo;
}

/** Creates a bolt/gland/hex geometry */
function createBoltGeo(radius: number, height: number, sides = 6): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, height, sides);
  return geo;
}

/** Creates an indicator lamp mesh with its own unique material */
function createLampMesh(colorHex: number, radius = 0.022, height = 0.015): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.9, height, 16);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.0,
    roughness: 0.15,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

/** Ensures prop is grounded exactly at y = 0 */
function groundProp(group: THREE.Group, sockets: Socket[], colliders: Box[]): void {
  group.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(group);
  const diffY = -b.min.y;
  if (Math.abs(diffY) > 0.0001) {
    for (const child of group.children) {
      child.position.y += diffY;
    }
    for (const s of sockets) {
      s.at[1] += diffY;
    }
    for (const c of colliders) {
      c.min[1] += diffY;
      c.max[1] += diffY;
    }
  }
}

/* ==========================================================================
   1. THE GATE
   ========================================================================== */
export function gate(
  m: LabMaterials,
  o?: { twin?: boolean; stage?: number }
): Prop & {
  opening: { width: number; height: number; sill: number; z: number };
  coils: THREE.Mesh[];
} {
  const isTwin = !!o?.twin;
  const stage = o?.stage ?? 6;
  const isChunky = stage <= 2;
  // stage 1 is chunky low poly: plain boxes (a chamfered box costs about 410 triangles even with one bevel segment)
  const cbox = (w: number, h: number, d: number, c: number, seg: number): THREE.BufferGeometry => (isChunky ? new THREE.BoxGeometry(w, h, d) : createChamferBox(w, h, d, c, seg));

  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];
  const coils: THREE.Mesh[] = [];

  const openW = 1.7;
  const openH = 2.6;
  const plinthH = 0.15;
  const stepH = 0.04;
  const sillY = plinthH + stepH; // 0.19m
  const openingZ = 0;

  // 1. Base plinth (or concrete footing pad for twin)
  const plinthW = 2.68;
  const plinthD = 1.1;
  const baseMat = isTwin ? m.concrete : m.darkSteel;
  const baseGeo = cbox(plinthW, plinthH, plinthD, isChunky ? 0.01 : 0.025, isChunky ? 1 : 2);
  baseGeo.translate(0, plinthH / 2, 0);
  builder.add(baseGeo, baseMat);

  // Rim on plinth: hazard stripes
  if (!isTwin) {
    const rimThick = 0.02;
    const rimH = plinthH * 0.7;
    const rimFront = new THREE.BoxGeometry(plinthW - 0.04, rimH, rimThick);
    rimFront.translate(0, plinthH / 2, plinthD / 2);
    builder.add(rimFront, m.hazard);

    const rimBack = new THREE.BoxGeometry(plinthW - 0.04, rimH, rimThick);
    rimBack.translate(0, plinthH / 2, -plinthD / 2);
    builder.add(rimBack, m.hazard);
  }

  // Sill step plate
  const stepGeo = cbox(openW + 0.1, stepH, 0.45, 0.008, 1);
  stepGeo.translate(0, plinthH + stepH / 2, 0);
  builder.add(stepGeo, m.gunmetal);

  // Anchor bolts into plinth
  if (!isChunky) {
    for (let bx = -1.2; bx <= 1.2; bx += 0.6) {
      for (const bz of [-0.46, 0.46]) {
        const bolt = createBoltGeo(0.016, 0.02, 6);
        bolt.translate(bx, plinthH + 0.01, bz);
        builder.add(bolt, m.darkSteel);
      }
    }
  }

  // 2. Uprights (Left at x = -(1.7/2 + 0.45/2) = -1.075, Right at +1.075)
  const uprightW = 0.45;
  const uprightD = 0.6;
  const uprightH = openH + stepH;
  const uprightY = plinthH + uprightH / 2;

  for (const side of [-1, 1]) {
    const ux = side * (openW / 2 + uprightW / 2);
    const uGeo = cbox(uprightW, uprightH, uprightD, isChunky ? 0.01 : 0.02, isChunky ? 1 : 2);
    uGeo.translate(ux, uprightY, 0);
    builder.add(uGeo, m.gunmetal);

    // Side buttress / gusset bracing upright
    const gussetW = 0.035;
    const gussetH = 1.1;
    const gussetD = 0.8;
    // a triangular plate against the upright's outer face, its base along the plinth (fore and aft), its apex up the upright
    const shape = new THREE.Shape();
    shape.moveTo(-gussetD / 2, 0);
    shape.lineTo(gussetD / 2, 0);
    shape.lineTo(0, gussetH);
    shape.closePath();
    const gExt = new THREE.ExtrudeGeometry(shape, {
      depth: gussetW,
      bevelEnabled: !isChunky,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 1,
    });
    gExt.center();
    gExt.rotateY(Math.PI / 2);
    // flush with the upright's outer face and inside the plinth's edge (the plinth is 2.68 m, the frame 2.6 m)
    const gx = side * (openW / 2 + uprightW + 0.02);
    gExt.translate(gx, plinthH + gussetH / 2, 0);
    builder.add(gExt, m.darkSteel);

    // Inner emitter channel with recessed ribs
    const emitW = 0.06;
    const emitH = openH;
    const emitGeo = new THREE.BoxGeometry(emitW, emitH, 0.2);
    emitGeo.translate(side * (openW / 2 + emitW / 2), sillY + emitH / 2, 0);
    builder.add(emitGeo, m.darkSteel);

    if (!isChunky) {
      for (let r = 0; r < 14; r++) {
        const ry = sillY + 0.1 + r * 0.18;
        const rib = new THREE.BoxGeometry(emitW + 0.01, 0.02, 0.16);
        rib.translate(side * (openW / 2 + emitW / 2), ry, 0);
        builder.add(rib, m.copper);
      }

      // Service hatch on front face
      const hatchGeo = cbox(0.28, 0.4, 0.02, 0.005, 1);
      hatchGeo.translate(ux, sillY + 0.35, uprightD / 2 + 0.01);
      builder.add(hatchGeo, m.darkSteel);

      for (const hbx of [-0.11, 0.11]) {
        for (const hby of [-0.17, 0.17]) {
          const hb = createBoltGeo(0.008, 0.01, 6);
          hb.rotateX(Math.PI / 2);
          hb.translate(ux + hbx, sillY + 0.35 + hby, uprightD / 2 + 0.02);
          builder.add(hb, m.gunmetal);
        }
      }
    }
  }

  // 3. Lintel block
  const lintelH = 3.2 - (plinthH + uprightH); // ~0.41m
  const lintelW = openW + uprightW * 2; // 2.6m
  const lintelD = uprightD + 0.04;
  const lintelY = plinthH + uprightH + lintelH / 2;
  const lintelGeo = cbox(lintelW, lintelH, lintelD, isChunky ? 0.01 : 0.025, isChunky ? 1 : 2);
  lintelGeo.translate(0, lintelY, 0);
  builder.add(lintelGeo, m.gunmetal);

  if (!isChunky) {
    const topCap = cbox(lintelW - 0.2, 0.05, lintelD - 0.1, 0.01, 1);
    topCap.translate(0, lintelY + lintelH / 2 + 0.025, 0);
    builder.add(topCap, m.darkSteel);

    const busConduit = new THREE.CylinderGeometry(0.025, 0.025, lintelW - 0.4, 12);
    busConduit.rotateZ(Math.PI / 2);
    busConduit.translate(0, lintelY + lintelH / 2 + 0.07, 0);
    builder.add(busConduit, m.copper);
  }

  // 4. Coils: 3 stacked on each upright's front face
  const coilW = 0.32;
  const coilH = 0.46;
  const coilD = 0.18;
  const ySpans = [
    sillY + 0.85,
    sillY + 1.48,
    sillY + 2.11,
  ];

  const coilConfigs: { side: number; y: number }[] = [
    { side: -1, y: ySpans[0]! }, // left bottom [0]
    { side: 1, y: ySpans[0]! },  // right bottom [1]
    { side: -1, y: ySpans[1]! }, // left middle [2]
    { side: 1, y: ySpans[1]! },  // right middle [3]
    { side: -1, y: ySpans[2]! }, // left top [4]
    { side: 1, y: ySpans[2]! },  // right top [5]
  ];

  for (const cfg of coilConfigs) {
    const cx = cfg.side * (openW / 2 + uprightW / 2);
    const cz = uprightD / 2 + coilD / 2;

    const finCount = isChunky ? 3 : 10;
    const finGeoList: THREE.BufferGeometry[] = [];
    const mainCore = new THREE.BoxGeometry(coilW * 0.7, coilH * 0.9, coilD * 0.6);
    finGeoList.push(mainCore);

    for (let f = 0; f < finCount; f++) {
      const fy = -coilH / 2 + (f + 0.5) * (coilH / finCount);
      const fin = new THREE.BoxGeometry(coilW, coilH / finCount * 0.45, coilD);
      fin.translate(0, fy, 0);
      finGeoList.push(fin);
    }

    const mergedCoil = mergeGeometries(finGeoList.map((g) => ensureAttributes(g)), false)!;
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0xdf8438,
      emissive: new THREE.Color(0xff8811),
      emissiveIntensity: 0.0,
      metalness: 0.9,
      roughness: 0.25,
    });
    const coilMesh = new THREE.Mesh(mergedCoil, coilMat);
    coilMesh.position.set(cx, cfg.y, cz);
    coilMesh.castShadow = true;
    group.add(coilMesh);
    coils.push(coilMesh);
    lamps.push(coilMesh);

    const mountGeo = new THREE.BoxGeometry(coilW + 0.04, coilH + 0.04, 0.04);
    mountGeo.translate(cx, cfg.y, uprightD / 2 + 0.02);
    builder.add(mountGeo, m.darkSteel);
  }

  // 5. Rear junction box at the back of the right upright's foot with 6 round cable glands
  const jBoxW = 0.32;
  const jBoxH = 0.36;
  const jBoxD = 0.16;
  const jBoxX = openW / 2 + uprightW / 2;
  const jBoxY = plinthH + jBoxH / 2 + 0.04;
  const jBoxZ = -uprightD / 2 - jBoxD / 2;

  const jBoxGeo = cbox(jBoxW, jBoxH, jBoxD, 0.015, 1);
  jBoxGeo.translate(jBoxX, jBoxY, jBoxZ);
  builder.add(jBoxGeo, m.paint);

  const glandZ = jBoxZ - jBoxD / 2 - 0.02;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const gx = jBoxX - 0.08 + col * 0.08;
      const gy = jBoxY - 0.06 + row * 0.12;
      const gland = createBoltGeo(0.018, 0.035, 8);
      gland.rotateX(Math.PI / 2);
      gland.translate(gx, gy, glandZ);
      builder.add(gland, m.copper);

      const glandNut = createBoltGeo(0.024, 0.015, 6);
      glandNut.rotateX(Math.PI / 2);
      glandNut.translate(gx, gy, glandZ + 0.015);
      builder.add(glandNut, m.darkSteel);
    }
  }
  sockets.push({ name: 'rear-junction', at: [jBoxX, jBoxY, glandZ - 0.02] });

  // the uprights (with their gussets and the plinth's edge) are solid; the opening between them is a doorway you walk through
  const frameTop = plinthH + uprightH + lintelH;
  for (const side of [-1, 1]) {
    const inner = openW / 2, outer = plinthW / 2;
    colliders.push({
      min: [side < 0 ? -outer : inner, 0, -plinthD / 2],
      max: [side < 0 ? -inner : outer, frameTop, plinthD / 2],
    });
  }

  builder.build(group);
  groundProp(group, sockets, colliders);

  return {
    group,
    colliders,
    sockets,
    lamps,
    coils,
    opening: { width: openW, height: openH, sill: sillY, z: openingZ },
  };
}

/* ==========================================================================
   2. RELAY CABINET
   ========================================================================== */
export function relayCabinet(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const W = 0.6;
  const H = 1.9;
  const D = 0.5;

  const plinthH = 0.06;
  const plinthGeo = createChamferBox(W - 0.02, plinthH, D - 0.02, 0.01, 1);
  plinthGeo.translate(0, plinthH / 2, 0);
  builder.add(plinthGeo, m.darkSteel);

  const bodyH = H - plinthH;
  const bodyGeo = createChamferBox(W, bodyH, D, 0.02, 2);
  bodyGeo.translate(0, plinthH + bodyH / 2, 0);
  builder.add(bodyGeo, m.paint);

  // Door panel
  const doorW = W - 0.08;
  const doorH = bodyH - 0.12;
  const doorGeo = createChamferBox(doorW, doorH, 0.025, 0.01, 1);
  doorGeo.translate(0, plinthH + bodyH / 2, D / 2 + 0.012);
  builder.add(doorGeo, m.paint);

  // Door handle
  const handleGeo = new THREE.BoxGeometry(0.02, 0.14, 0.04);
  handleGeo.translate(doorW / 2 - 0.06, plinthH + bodyH / 2, D / 2 + 0.04);
  builder.add(handleGeo, m.darkSteel);

  // Hinges
  for (const hy of [plinthH + bodyH * 0.25, plinthH + bodyH * 0.75]) {
    const hinge = new THREE.CylinderGeometry(0.012, 0.012, 0.07, 12);
    hinge.translate(-doorW / 2 - 0.02, hy, D / 2 + 0.015);
    builder.add(hinge, m.darkSteel);
  }

  // Louvres
  const louvreCount = 14;
  for (let i = 0; i < louvreCount; i++) {
    const ly = plinthH + 0.18 + i * 0.028;
    const louvre = new THREE.BoxGeometry(doorW - 0.14, 0.014, 0.015);
    louvre.rotateX(0.4);
    louvre.translate(0, ly, D / 2 + 0.022);
    builder.add(louvre, m.gunmetal);
  }

  // 3 indicator lamps along top front
  const lampColors = [0x22ee44, 0xffaa00, 0xee2222];
  const lampSpacing = 0.11;
  const lampY = H - 0.12;
  for (let i = 0; i < 3; i++) {
    const lx = (i - 1) * lampSpacing;
    const lMesh = createLampMesh(lampColors[i]!, 0.018, 0.02);
    lMesh.position.set(lx, lampY, D / 2 + 0.025);
    group.add(lMesh);
    lamps.push(lMesh);

    const bezel = createBoltGeo(0.028, 0.01, 12);
    bezel.rotateX(Math.PI / 2);
    bezel.translate(lx, lampY, D / 2 + 0.02);
    builder.add(bezel, m.darkSteel);
  }

  // Top cable gland
  const topGland = createBoltGeo(0.045, 0.05, 12);
  topGland.translate(0, H + 0.025, 0);
  builder.add(topGland, m.copper);
  sockets.push({ name: 'cable-top', at: [0, H + 0.05, 0] });

  // Cable bottom socket
  sockets.push({ name: 'cable-bottom', at: [0, 0.02, -D / 2 + 0.06] });

  // Hex corner bolts
  for (const bx of [-W / 2 + 0.03, W / 2 - 0.03]) {
    for (const by of [plinthH + 0.06, H - 0.06]) {
      const b = createBoltGeo(0.009, 0.012, 6);
      b.rotateX(Math.PI / 2);
      b.translate(bx, by, D / 2 + 0.005);
      builder.add(b, m.darkSteel);
    }
  }

  colliders.push({ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   3. BREAKER PANEL
   ========================================================================== */
export function breakerPanel(m: LabMaterials): Prop & { handle: THREE.Object3D } {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const W = 0.9;
  const H = 1.6;
  const D = 0.35;
  const legH = 0.25;

  // Short legs
  for (const lx of [-W / 2 + 0.06, W / 2 - 0.06]) {
    for (const lz of [-D / 2 + 0.05, D / 2 - 0.05]) {
      const leg = new THREE.BoxGeometry(0.05, legH, 0.05);
      leg.translate(lx, legH / 2, lz);
      builder.add(leg, m.darkSteel);

      const foot = new THREE.BoxGeometry(0.09, 0.01, 0.09);
      foot.translate(lx, 0.005, lz);
      builder.add(foot, m.darkSteel);
    }
  }

  const boxH = H - legH;
  const boxGeo = createChamferBox(W, boxH, D, 0.02, 2);
  boxGeo.translate(0, legH + boxH / 2, 0);
  builder.add(boxGeo, m.paint);

  // Rotary isolator on yellow hazard plate
  const isoPlate = new THREE.BoxGeometry(0.24, 0.24, 0.015);
  const isoY = legH + boxH * 0.45;
  const isoX = 0;
  isoPlate.translate(isoX, isoY, D / 2 + 0.01);
  builder.add(isoPlate, m.hazard);

  const knobBase = new THREE.CylinderGeometry(0.065, 0.07, 0.03, 20);
  knobBase.rotateX(Math.PI / 2);
  knobBase.translate(isoX, isoY, D / 2 + 0.03);
  builder.add(knobBase, m.darkSteel);

  const handlePivot = new THREE.Group();
  handlePivot.position.set(isoX, isoY, D / 2 + 0.045);

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xcc2222,
    metalness: 0.3,
    roughness: 0.3,
  });
  const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.035), redMat);
  handleBar.position.set(0, 0.05, 0);
  handlePivot.add(handleBar);
  group.add(handlePivot);

  // Gauges
  for (let g = 0; g < 2; g++) {
    const gx = -0.22 + g * 0.44;
    const gy = legH + boxH * 0.78;

    const bezel = new THREE.CylinderGeometry(0.09, 0.095, 0.025, 24);
    bezel.rotateX(Math.PI / 2);
    bezel.translate(gx, gy, D / 2 + 0.015);
    builder.add(bezel, m.gunmetal);

    const glassDisc = new THREE.CylinderGeometry(0.08, 0.08, 0.005, 24);
    glassDisc.rotateX(Math.PI / 2);
    glassDisc.translate(gx, gy, D / 2 + 0.025);
    builder.add(glassDisc, m.glass);

    const lMesh = createLampMesh(g === 0 ? 0x22cc44 : 0xffaa00, 0.014, 0.015);
    lMesh.position.set(gx, gy + 0.12, D / 2 + 0.015);
    group.add(lMesh);
    lamps.push(lMesh);
  }

  // Louvres
  for (let s = 0; s < 10; s++) {
    const sy = legH + 0.12 + s * 0.028;
    const lLeft = new THREE.BoxGeometry(0.015, 0.015, D * 0.6);
    lLeft.rotateZ(0.3);
    lLeft.translate(-W / 2 - 0.005, sy, 0);
    builder.add(lLeft, m.darkSteel);

    const lRight = new THREE.BoxGeometry(0.015, 0.015, D * 0.6);
    lRight.rotateZ(-0.3);
    lRight.translate(W / 2 + 0.005, sy, 0);
    builder.add(lRight, m.darkSteel);
  }

  // Sockets: 'in' at bottom left, 'out' at top right
  const inGland = createBoltGeo(0.035, 0.04, 12);
  inGland.translate(-W * 0.3, legH, 0);
  builder.add(inGland, m.copper);
  sockets.push({ name: 'in', at: [-W * 0.3, legH - 0.02, 0] });

  const outGland = createBoltGeo(0.035, 0.04, 12);
  outGland.translate(W * 0.3, H + 0.02, 0);
  builder.add(outGland, m.copper);
  sockets.push({ name: 'out', at: [W * 0.3, H + 0.04, 0] });

  colliders.push({ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps, handle: handlePivot };
}

/* ==========================================================================
   4. CAPACITOR BANK
   ========================================================================== */
export function capacitorBank(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const skidW = 2.0;
  const skidD = 1.0;
  const skidH = 0.14;

  const skidGeo = createChamferBox(skidW, skidH, skidD, 0.02, 2);
  skidGeo.translate(0, skidH / 2, 0);
  builder.add(skidGeo, m.darkSteel);

  const hzH = skidH * 0.7;
  const hzFront = new THREE.BoxGeometry(skidW - 0.02, hzH, 0.02);
  hzFront.translate(0, skidH / 2, skidD / 2);
  builder.add(hzFront, m.hazard);

  const hzBack = new THREE.BoxGeometry(skidW - 0.02, hzH, 0.02);
  hzBack.translate(0, skidH / 2, -skidD / 2);
  builder.add(hzBack, m.hazard);

  // 4 Lifting eyes
  for (const ex of [-skidW / 2 + 0.08, skidW / 2 - 0.08]) {
    for (const ez of [-skidD / 2 + 0.08, skidD / 2 - 0.08]) {
      const eyeTorus = new THREE.TorusGeometry(0.035, 0.01, 10, 16);
      eyeTorus.translate(ex, skidH + 0.035, ez);
      builder.add(eyeTorus, m.gunmetal);
    }
  }

  // 6 capacitor cylinders
  const capD = 0.35;
  const capR = capD / 2;
  const capH = 1.5;
  const xs = [-0.6, 0.0, 0.6];
  const zs = [-0.25, 0.25];

  for (const cx of xs) {
    for (const cz of zs) {
      const can = new THREE.CylinderGeometry(capR, capR, capH, 20);
      can.translate(cx, skidH + capH / 2, cz);
      builder.add(can, m.paint);

      for (let r = 0; r < 5; r++) {
        const ry = skidH + 0.2 + r * 0.26;
        const rib = new THREE.CylinderGeometry(capR + 0.012, capR + 0.012, 0.035, 20);
        rib.translate(cx, ry, cz);
        builder.add(rib, m.darkSteel);
      }

      const topCap = new THREE.CylinderGeometry(capR - 0.015, capR, 0.05, 20);
      topCap.translate(cx, skidH + capH + 0.025, cz);
      builder.add(topCap, m.gunmetal);

      const ins = new THREE.CylinderGeometry(0.04, 0.05, 0.1, 16);
      ins.translate(cx, skidH + capH + 0.1, cz);
      builder.add(ins, m.rubber);

      const lug = createBoltGeo(0.025, 0.03, 6);
      lug.translate(cx, skidH + capH + 0.16, cz);
      builder.add(lug, m.copper);
    }
  }

  // Bus bars
  for (const cz of zs) {
    const busBar = new THREE.BoxGeometry(1.4, 0.018, 0.04);
    busBar.translate(0, skidH + capH + 0.165, cz);
    builder.add(busBar, m.copper);
  }

  for (const cx of xs) {
    const crossBar = new THREE.BoxGeometry(0.04, 0.018, 0.54);
    crossBar.translate(cx, skidH + capH + 0.18, 0);
    builder.add(crossBar, m.copper);
  }

  const outTerm = createBoltGeo(0.05, 0.06, 12);
  outTerm.translate(0.9, skidH + capH * 0.5, 0);
  builder.add(outTerm, m.copper);
  sockets.push({ name: 'out', at: [skidW / 2 + 0.02, skidH + capH * 0.5, 0] });

  const warnLamp = createLampMesh(0xff2222, 0.022, 0.03);
  warnLamp.position.set(-skidW / 2 + 0.15, skidH + 0.05, skidD / 2 - 0.1);
  group.add(warnLamp);
  lamps.push(warnLamp);

  colliders.push({
    min: [-skidW / 2, 0, -skidD / 2],
    max: [skidW / 2, skidH + capH + 0.2, skidD / 2],
  });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   5. OPERATOR CONSOLE
   ========================================================================== */
export function operatorConsole(m: LabMaterials): Prop & { lever: THREE.Object3D; screen: THREE.Mesh } {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const baseH = 0.06;
  const baseGeo = createChamferBox(0.7, baseH, 0.55, 0.015, 1);
  baseGeo.translate(0, baseH / 2, 0);
  builder.add(baseGeo, m.darkSteel);

  for (const bx of [-0.3, 0.3]) {
    for (const bz of [-0.22, 0.22]) {
      const b = createBoltGeo(0.014, 0.015, 6);
      b.translate(bx, baseH + 0.008, bz);
      builder.add(b, m.gunmetal);
    }
  }

  const colW = 0.5;
  const colD = 0.36;
  const colH = 0.69;
  const colGeo = createChamferBox(colW, colH, colD, 0.02, 2);
  colGeo.translate(0, baseH + colH / 2, 0);
  builder.add(colGeo, m.paint);

  const headW = 0.85;
  const headD = 0.65;
  const headH = 0.32;
  const headGeo = createChamferBox(headW, headH, headD, 0.025, 2);
  headGeo.rotateX(-0.25);
  headGeo.translate(0, 0.98, 0.05);
  builder.add(headGeo, m.gunmetal);

  const screenW = 0.28;
  const screenH = 0.18;
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x113322,
    emissive: new THREE.Color(0x22ee88),
    emissiveIntensity: 0.4,
    roughness: 0.1,
    metalness: 0.1,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.rotateX(-0.25);
  screenMesh.position.set(-0.2, 1.07, 0.12);
  group.add(screenMesh);
  lamps.push(screenMesh);

  const scrBezel = new THREE.BoxGeometry(screenW + 0.03, screenH + 0.03, 0.015);
  scrBezel.rotateX(-0.25);
  scrBezel.translate(-0.2, 1.07, 0.115);
  builder.add(scrBezel, m.darkSteel);

  for (let g = 0; g < 2; g++) {
    const gx = 0.14 + g * 0.14;
    const gy = 1.08;
    const gz = 0.12;

    const bezel = new THREE.CylinderGeometry(0.055, 0.06, 0.018, 20);
    bezel.rotateX(Math.PI / 2 - 0.25);
    bezel.translate(gx, gy, gz);
    builder.add(bezel, m.gunmetal);

    const gGlass = new THREE.CylinderGeometry(0.048, 0.048, 0.005, 20);
    gGlass.rotateX(Math.PI / 2 - 0.25);
    gGlass.translate(gx, gy, gz + 0.01);
    builder.add(gGlass, m.glass);
  }

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const swX = -0.3 + c * 0.12;
      const swY = 0.94 - r * 0.07;
      const swZ = 0.22 - r * 0.03;

      const swBase = new THREE.CylinderGeometry(0.015, 0.018, 0.01, 12);
      swBase.rotateX(Math.PI / 2 - 0.25);
      swBase.translate(swX, swY, swZ);
      builder.add(swBase, m.darkSteel);

      const swLamp = createLampMesh(r === 0 ? 0x22cc44 : 0xffaa00, 0.009, 0.01);
      swLamp.rotation.x = -0.25;
      swLamp.position.set(swX, swY + 0.03, swZ);
      group.add(swLamp);
      lamps.push(swLamp);
    }
  }

  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.24, 0.96, 0.22);

  const pBracket = new THREE.BoxGeometry(0.08, 0.06, 0.08);
  pBracket.translate(0.24, 0.96, 0.22);
  builder.add(pBracket, m.darkSteel);

  const pPin = new THREE.CylinderGeometry(0.016, 0.016, 0.1, 16);
  pPin.rotateZ(Math.PI / 2);
  pPin.translate(0.24, 0.96, 0.22);
  builder.add(pPin, m.copper);

  const leverArmGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.28, 16);
  leverArmGeo.translate(0, 0.14, 0);
  const armMat = m.gunmetal;
  const armMesh = new THREE.Mesh(leverArmGeo, armMat);
  leverPivot.add(armMesh);

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0xcc2222,
    roughness: 0.35,
    metalness: 0.1,
  });
  const gripGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.11, 20);
  gripGeo.translate(0, 0.24, 0);
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  leverPivot.add(gripMesh);

  leverPivot.rotation.x = 0;
  group.add(leverPivot);

  const gland = createBoltGeo(0.035, 0.04, 12);
  gland.rotateX(Math.PI / 2);
  gland.translate(0, 0.35, -colD / 2 - 0.02);
  builder.add(gland, m.copper);
  sockets.push({ name: 'cable', at: [0, 0.35, -colD / 2 - 0.05] });

  colliders.push({ min: [-0.45, 0, -0.35], max: [0.45, 1.25, 0.4] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps, lever: leverPivot, screen: screenMesh };
}

/* ==========================================================================
   6. CONTROL BOX
   ========================================================================== */
export function controlBox(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const flangeGeo = createChamferBox(0.26, 0.02, 0.26, 0.01, 1);
  flangeGeo.translate(0, 0.01, 0);
  builder.add(flangeGeo, m.darkSteel);

  for (const bx of [-0.09, 0.09]) {
    for (const bz of [-0.09, 0.09]) {
      const bolt = createBoltGeo(0.012, 0.015, 6);
      bolt.translate(bx, 0.02, bz);
      builder.add(bolt, m.gunmetal);
    }
  }

  const postH = 0.95;
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, postH, 20);
  postGeo.translate(0, 0.02 + postH / 2, 0);
  builder.add(postGeo, m.gunmetal);

  const brkGeo = new THREE.BoxGeometry(0.18, 0.12, 0.12);
  brkGeo.translate(0, 0.02 + postH, 0);
  builder.add(brkGeo, m.darkSteel);

  const boxW = 0.35;
  const boxH = 0.45;
  const boxD = 0.2;
  const boxY = 1.2;

  const boxGeo = createChamferBox(boxW, boxH, boxD, 0.015, 2);
  boxGeo.translate(0, boxY, 0.04);
  builder.add(boxGeo, m.paint);

  const lampColors = [0x22cc44, 0xee2222];
  for (let i = 0; i < 2; i++) {
    const lx = -0.07 + i * 0.14;
    const ly = boxY + 0.11;
    const lMesh = createLampMesh(lampColors[i]!, 0.018, 0.02);
    lMesh.position.set(lx, ly, 0.04 + boxD / 2 + 0.01);
    group.add(lMesh);
    lamps.push(lMesh);

    const bezel = createBoltGeo(0.025, 0.01, 12);
    bezel.rotateX(Math.PI / 2);
    bezel.translate(lx, ly, 0.04 + boxD / 2 + 0.005);
    builder.add(bezel, m.darkSteel);
  }

  const btnColors = [0x111111, 0xbb8822];
  for (let i = 0; i < 2; i++) {
    const bx = -0.07 + i * 0.14;
    const by = boxY - 0.06;

    const collar = new THREE.CylinderGeometry(0.024, 0.024, 0.015, 16);
    collar.rotateX(Math.PI / 2);
    collar.translate(bx, by, 0.04 + boxD / 2 + 0.01);
    builder.add(collar, m.darkSteel);

    const btnMat = new THREE.MeshStandardMaterial({
      color: btnColors[i]!,
      roughness: 0.4,
      metalness: 0.1,
    });
    const btn = new THREE.CylinderGeometry(0.017, 0.017, 0.02, 16);
    btn.rotateX(Math.PI / 2);
    btn.translate(bx, by, 0.04 + boxD / 2 + 0.02);
    builder.add(btn, btnMat);
  }

  // Side vent louvres
  for (let s = 0; s < 4; s++) {
    const vy = boxY - 0.1 + s * 0.03;
    const vSlot = new THREE.BoxGeometry(0.01, 0.012, 0.1);
    vSlot.translate(-boxW / 2 - 0.002, vy, 0.04);
    builder.add(vSlot, m.darkSteel);
  }

  const gland = createBoltGeo(0.024, 0.04, 12);
  gland.translate(0, boxY - boxH / 2 - 0.02, 0.04);
  builder.add(gland, m.copper);
  sockets.push({ name: 'cable', at: [0, boxY - boxH / 2 - 0.04, 0.04] });

  colliders.push({ min: [-boxW / 2, 0, -boxD / 2], max: [boxW / 2, boxY + boxH / 2, boxD / 2 + 0.04] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   7. FLOOR COVER
   ========================================================================== */
export function floorCover(
  m: LabMaterials,
  path: [number, number][],
  width = 0.35
): Prop & { pulse: THREE.Mesh; length: number } {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const height = 0.045;

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i]!;
    const p1 = path[i + 1]!;
    const dx = p1[0] - p0[0];
    const dz = p1[1] - p0[1];
    const len = Math.hypot(dx, dz);
    segLens.push(len);
    totalLen += len;
  }

  const pulseGeos: THREE.BufferGeometry[] = [];
  let distSoFar = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i]!;
    const p1 = path[i + 1]!;
    const len = segLens[i]!;
    if (len <= 0.0001) continue;

    const angle = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    const mx = (p0[0] + p1[0]) / 2;
    const mz = (p0[1] + p1[1]) / 2;

    const bodyGeo = createChamferBox(width, height, len, 0.012, 1);
    bodyGeo.rotateY(angle);
    bodyGeo.translate(mx, height / 2, mz);
    builder.add(bodyGeo, m.darkSteel);

    const hzEdgeW = 0.03;
    const hzGeoL = new THREE.BoxGeometry(hzEdgeW, 0.006, len);
    hzGeoL.rotateY(angle);
    const offsetLX = Math.cos(angle) * (width / 2 - hzEdgeW / 2);
    const offsetLZ = -Math.sin(angle) * (width / 2 - hzEdgeW / 2);
    hzGeoL.translate(mx - offsetLX, height, mz - offsetLZ);
    builder.add(hzGeoL, m.hazard);

    const slotW = 0.05;
    const pPlane = new THREE.PlaneGeometry(slotW, len, 1, Math.max(1, Math.round(len * 2)));
    pPlane.rotateX(-Math.PI / 2);
    pPlane.rotateY(angle);
    pPlane.translate(mx, height + 0.001, mz);

    const posAttr = pPlane.attributes['position']!;
    const uvs = new Float32Array(posAttr.count * 2);
    for (let v = 0; v < posAttr.count; v++) {
      const vx = posAttr.getX(v);
      const vz = posAttr.getZ(v);
      const dx = p1[0] - p0[0];
      const dz = p1[1] - p0[1];
      const t = Math.max(0, Math.min(1, ((vx - p0[0]) * dx + (vz - p0[1]) * dz) / (len * len)));
      const dist = distSoFar + t * len;
      uvs[v * 2] = dist;
      uvs[v * 2 + 1] = v % 2 === 0 ? 0 : 1;
    }
    pPlane.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    pulseGeos.push(pPlane);

    distSoFar += len;
  }

  const mergedPulseGeo = mergeGeometries(pulseGeos.map((g) => ensureAttributes(g)), false)!;
  const pulseMat = new THREE.MeshStandardMaterial({
    color: 0x2288ff,
    emissive: new THREE.Color(0x22ccff),
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.1,
  });
  const pulseMesh = new THREE.Mesh(mergedPulseGeo, pulseMat);
  group.add(pulseMesh);
  lamps.push(pulseMesh);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const pt of path) {
    minX = Math.min(minX, pt[0] - width / 2);
    maxX = Math.max(maxX, pt[0] + width / 2);
    minZ = Math.min(minZ, pt[1] - width / 2);
    maxZ = Math.max(maxZ, pt[1] + width / 2);
  }
  colliders.push({ min: [minX, 0, minZ], max: [maxX, height, maxZ] });

  builder.build(group);
  return { group, colliders, sockets, lamps, pulse: pulseMesh, length: totalLen };
}

/* ==========================================================================
   8. CABLE TRAY
   ========================================================================== */
export function cableTray(
  m: LabMaterials,
  from: [number, number],
  to: [number, number],
  y: number,
  ceiling: number
): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const trayW = 0.45;
  const railH = 0.08;
  const railThick = 0.02;

  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;

  for (const side of [-1, 1]) {
    const rx = side * (trayW / 2 - railThick / 2);
    const rail = new THREE.BoxGeometry(railThick, railH, length);
    rail.rotateY(angle);
    const wx = mx + Math.cos(angle) * rx;
    const wz = mz - Math.sin(angle) * rx;
    rail.translate(wx, y + railH / 2, wz);
    builder.add(rail, m.gunmetal);
  }

  const rungSpacing = 0.3;
  const numRungs = Math.max(2, Math.floor(length / rungSpacing));
  for (let i = 0; i <= numRungs; i++) {
    const t = (i / numRungs - 0.5) * (length - 0.1);
    const rung = new THREE.BoxGeometry(trayW - 0.04, 0.015, 0.03);
    rung.rotateY(angle);
    const rx = mx + Math.sin(angle) * t;
    const rz = mz + Math.cos(angle) * t;
    rung.translate(rx, y + 0.01, rz);
    builder.add(rung, m.darkSteel);
  }

  const cableR = 0.022;
  const cableMats = [m.rubber, m.darkSteel, m.rubber];
  for (let c = 0; c < 3; c++) {
    const cx = (c - 1) * 0.11;
    const cable = new THREE.CylinderGeometry(cableR, cableR, length, 12);
    cable.rotateX(Math.PI / 2);
    cable.rotateY(angle);
    const wx = mx + Math.cos(angle) * cx;
    const wz = mz - Math.sin(angle) * cx;
    cable.translate(wx, y + 0.035, wz);
    builder.add(cable, cableMats[c]!);
  }

  const rodSpacing = 1.8;
  const numRods = Math.max(2, Math.ceil(length / rodSpacing));
  const dropH = ceiling - (y + railH);

  for (let i = 0; i <= numRods; i++) {
    const t = (i / numRods - 0.5) * (length - 0.2);
    const rx = mx + Math.sin(angle) * t;
    const rz = mz + Math.cos(angle) * t;

    const trapeze = new THREE.BoxGeometry(trayW + 0.12, 0.03, 0.04);
    trapeze.rotateY(angle);
    trapeze.translate(rx, y - 0.015, rz);
    builder.add(trapeze, m.darkSteel);

    for (const side of [-1, 1]) {
      const rodOffX = Math.cos(angle) * side * (trayW / 2 + 0.04);
      const rodOffZ = -Math.sin(angle) * side * (trayW / 2 + 0.04);

      const rod = new THREE.CylinderGeometry(0.008, 0.008, dropH, 8);
      rod.translate(rx + rodOffX, y + railH + dropH / 2, rz + rodOffZ);
      builder.add(rod, m.gunmetal);

      const cFlange = new THREE.BoxGeometry(0.08, 0.015, 0.08);
      cFlange.translate(rx + rodOffX, ceiling - 0.0075, rz + rodOffZ);
      builder.add(cFlange, m.darkSteel);
    }
  }

  colliders.push({
    min: [Math.min(from[0], to[0]) - trayW / 2, y - 0.05, Math.min(from[1], to[1]) - trayW / 2],
    max: [Math.max(from[0], to[0]) + trayW / 2, ceiling, Math.max(from[1], to[1]) + trayW / 2],
  });

  builder.build(group);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   9. PLANET TABLE
   ========================================================================== */
export function planetTable(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const diameter = 2.4;
  const radius = diameter / 2;
  const topY = 0.95;

  const baseR = 0.65;
  const baseH = 0.04;
  const baseGeo = new THREE.CylinderGeometry(baseR * 0.95, baseR, baseH, 48);
  baseGeo.translate(0, baseH / 2, 0);
  builder.add(baseGeo, m.darkSteel);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const b = createBoltGeo(0.016, 0.02, 6);
    b.translate(Math.cos(angle) * (baseR - 0.05), baseH + 0.01, Math.sin(angle) * (baseR - 0.05));
    builder.add(b, m.gunmetal);
  }

  const colGeo = new THREE.CylinderGeometry(0.38, 0.44, topY - baseH - 0.1, 48);
  colGeo.translate(0, baseH + (topY - baseH - 0.1) / 2, 0);
  builder.add(colGeo, m.paint);

  const rimThick = 0.1;
  const rimGeo = new THREE.CylinderGeometry(radius, radius * 0.92, rimThick, 64);
  rimGeo.translate(0, topY - rimThick / 2, 0);
  builder.add(rimGeo, m.gunmetal);

  const subRim = new THREE.CylinderGeometry(radius * 0.92, radius * 0.7, 0.08, 64);
  subRim.translate(0, topY - rimThick - 0.04, 0);
  builder.add(subRim, m.darkSteel);

  // Glowing projection disc in top (lamps[0])
  const holoR = radius * 0.78;
  const holoDiscGeo = new THREE.CylinderGeometry(holoR, holoR, 0.01, 64);
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x1166aa,
    emissive: new THREE.Color(0x33ccff),
    emissiveIntensity: 0.7,
    roughness: 0.15,
    metalness: 0.1,
  });
  const holoDiscMesh = new THREE.Mesh(holoDiscGeo, holoMat);
  holoDiscMesh.position.set(0, topY + 0.005, 0);
  group.add(holoDiscMesh);
  lamps.push(holoDiscMesh);

  for (let p = 0; p < 4; p++) {
    const angle = (p / 4) * Math.PI * 2;
    const pr = radius - 0.12;
    const px = Math.cos(angle) * pr;
    const pz = Math.sin(angle) * pr;

    const panelGeo = new THREE.BoxGeometry(0.24, 0.015, 0.14);
    panelGeo.rotateY(-angle);
    panelGeo.translate(px, topY + 0.008, pz);
    builder.add(panelGeo, m.darkSteel);

    const pLamp = createLampMesh(p % 2 === 0 ? 0x22cc44 : 0xffaa00, 0.01, 0.01);
    pLamp.position.set(px, topY + 0.02, pz);
    group.add(pLamp);
    lamps.push(pLamp);
  }

  colliders.push({ min: [-radius, 0, -radius], max: [radius, topY + 0.02, radius] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   10. PRESET RACK
   ========================================================================== */
export function presetRack(m: LabMaterials, cols = 8, rows = 6): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const W = 3.0;
  const H = 2.4;
  const D = 0.4;
  const zCenter = -0.2 + D / 2;

  const footH = 0.1;
  for (const fx of [-W / 2 + 0.15, -W * 0.16, W * 0.16, W / 2 - 0.15]) {
    const foot = createChamferBox(0.12, footH, D - 0.04, 0.01, 1);
    foot.translate(fx, footH / 2, zCenter);
    builder.add(foot, m.darkSteel);
  }

  const frameH = H - footH;
  const frameGeo = createChamferBox(W, frameH, D, 0.025, 2);
  frameGeo.translate(0, footH + frameH / 2, zCenter);
  builder.add(frameGeo, m.paint);

  const bayW = W - 0.24;
  const bayH = frameH - 0.24;
  const bayGeo = new THREE.BoxGeometry(bayW, bayH, 0.06);
  bayGeo.translate(0, footH + frameH / 2, zCenter + D / 2 - 0.02);
  builder.add(bayGeo, m.gunmetal);

  const slotW = bayW / cols;
  const slotH = bayH / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = -bayW / 2 + (c + 0.5) * slotW;
      const sy = footH + 0.12 + (r + 0.5) * slotH;
      const sz = zCenter + D / 2;

      const border = new THREE.BoxGeometry(slotW * 0.88, slotH * 0.82, 0.03);
      border.translate(sx, sy, sz + 0.005);
      builder.add(border, m.darkSteel);

      const lampColor = (r + c) % 3 === 0 ? 0x22cc44 : (r + c) % 3 === 1 ? 0xffaa00 : 0x4488ff;
      const slotLamp = createLampMesh(lampColor, 0.009, 0.012);
      slotLamp.position.set(sx + slotW * 0.3, sy + slotH * 0.25, sz + 0.025);
      group.add(slotLamp);
      lamps.push(slotLamp);
    }
  }

  colliders.push({ min: [-W / 2, 0, -0.2], max: [W / 2, H, -0.2 + D] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   11. PRESET BENCH
   ========================================================================== */
export function presetBench(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const tableW = 1.8;
  const tableD = 0.9;
  const tableTopH = 0.85;
  const topThick = 0.08;

  const legSize = 0.07;
  const legH = tableTopH - topThick;
  for (const lx of [-tableW / 2 + 0.1, tableW / 2 - 0.1]) {
    for (const lz of [-tableD / 2 + 0.1, tableD / 2 - 0.1]) {
      const leg = createChamferBox(legSize, legH, legSize, 0.008, 1);
      leg.translate(lx, legH / 2, lz);
      builder.add(leg, m.darkSteel);

      const pad = createBoltGeo(0.045, 0.015, 6);
      pad.translate(lx, 0.0075, lz);
      builder.add(pad, m.gunmetal);
    }
  }

  const stretchY = 0.2;
  const stFront = new THREE.BoxGeometry(tableW - 0.2, 0.04, 0.04);
  stFront.translate(0, stretchY, -tableD / 2 + 0.1);
  builder.add(stFront, m.darkSteel);

  const stBack = new THREE.BoxGeometry(tableW - 0.2, 0.04, 0.04);
  stBack.translate(0, stretchY, tableD / 2 - 0.1);
  builder.add(stBack, m.darkSteel);

  const topGeo = createChamferBox(tableW, topThick, tableD, 0.015, 2);
  topGeo.translate(0, tableTopH - topThick / 2, 0);
  builder.add(topGeo, m.paint);

  // Glowing light-table top (lamps[0])
  const ltW = 0.95;
  const ltD = 0.55;
  const ltGeo = new THREE.BoxGeometry(ltW, 0.01, ltD);
  const ltMat = new THREE.MeshStandardMaterial({
    color: 0x99ccff,
    emissive: new THREE.Color(0xddeeff),
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.1,
  });
  const lightTableMesh = new THREE.Mesh(ltGeo, ltMat);
  lightTableMesh.position.set(-0.15, tableTopH + 0.005, 0);
  group.add(lightTableMesh);
  lamps.push(lightTableMesh);

  // Cartridge slot at side
  const slotGeo = createChamferBox(0.25, 0.04, 0.12, 0.006, 1);
  slotGeo.translate(tableW / 2 - 0.22, tableTopH + 0.02, -0.15);
  builder.add(slotGeo, m.gunmetal);

  const slotInner = new THREE.BoxGeometry(0.18, 0.02, 0.05);
  slotInner.translate(tableW / 2 - 0.22, tableTopH + 0.03, -0.15);
  builder.add(slotInner, m.darkSteel);

  // Articulated anglepoise lamp
  const armBaseX = tableW / 2 - 0.15;
  const armBaseZ = -tableD / 2 + 0.15;
  const armMount = new THREE.CylinderGeometry(0.03, 0.035, 0.05, 16);
  armMount.translate(armBaseX, tableTopH + 0.025, armBaseZ);
  builder.add(armMount, m.darkSteel);

  const arm1 = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 12);
  arm1.rotateZ(0.4);
  arm1.translate(armBaseX - 0.06, tableTopH + 0.2, armBaseZ);
  builder.add(arm1, m.gunmetal);

  const arm2 = new THREE.CylinderGeometry(0.008, 0.008, 0.32, 12);
  arm2.rotateZ(-0.5);
  arm2.translate(armBaseX - 0.18, tableTopH + 0.42, armBaseZ + 0.05);
  builder.add(arm2, m.gunmetal);

  const shade = new THREE.ConeGeometry(0.07, 0.1, 20, 1, true);
  shade.rotateX(Math.PI * 0.7);
  shade.translate(armBaseX - 0.26, tableTopH + 0.45, armBaseZ + 0.1);
  builder.add(shade, m.darkSteel);

  const bulb = createLampMesh(0xfff4d0, 0.022, 0.02);
  bulb.position.set(armBaseX - 0.26, tableTopH + 0.43, armBaseZ + 0.1);
  group.add(bulb);
  lamps.push(bulb);

  colliders.push({ min: [-tableW / 2, 0, -tableD / 2], max: [tableW / 2, tableTopH + 0.55, tableD / 2] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   12. PRESET COMBINER
   ========================================================================== */
export function presetCombiner(m: LabMaterials): Prop {
  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const totalH = 1.3;
  const baseR = 0.45;
  const baseH = 0.12;

  const baseGeo = createChamferBox(baseR * 2, baseH, baseR * 2, 0.02, 2);
  baseGeo.translate(0, baseH / 2, 0);
  builder.add(baseGeo, m.darkSteel);

  const hzRim = new THREE.BoxGeometry(baseR * 1.9, baseH * 0.7, 0.02);
  hzRim.translate(0, baseH / 2, baseR);
  builder.add(hzRim, m.hazard);

  const colH = 0.75;
  const colGeo = new THREE.CylinderGeometry(0.28, 0.35, colH, 28);
  colGeo.translate(0, baseH + colH / 2, 0);
  builder.add(colGeo, m.paint);

  for (let f = 0; f < 8; f++) {
    const angle = (f / 8) * Math.PI * 2;
    const fin = new THREE.BoxGeometry(0.015, colH * 0.7, 0.12);
    fin.rotateY(angle);
    fin.translate(Math.cos(angle) * 0.32, baseH + colH / 2, Math.sin(angle) * 0.32);
    builder.add(fin, m.gunmetal);
  }

  const collarH = 0.08;
  const collarGeo = new THREE.CylinderGeometry(0.38, 0.3, collarH, 28);
  collarGeo.translate(0, baseH + colH + collarH / 2, 0);
  builder.add(collarGeo, m.darkSteel);

  for (let s = 0; s < 4; s++) {
    const angle = (s / 4) * Math.PI * 2;
    const slotX = Math.cos(angle) * 0.32;
    const slotZ = Math.sin(angle) * 0.32;

    const slotBox = createChamferBox(0.14, 0.05, 0.08, 0.008, 1);
    slotBox.rotateY(-angle);
    slotBox.translate(slotX, baseH + colH + 0.02, slotZ);
    builder.add(slotBox, m.gunmetal);

    const sLamp = createLampMesh(0x22eeaa, 0.01, 0.01);
    sLamp.position.set(slotX * 1.15, baseH + colH + 0.06, slotZ * 1.15);
    group.add(sLamp);
    lamps.push(sLamp);
  }

  const coreH = 0.18;
  const coreGeo = new THREE.OctahedronGeometry(0.09, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xaa22ff,
    emissive: new THREE.Color(0xc044ff),
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.1,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, baseH + colH + collarH + coreH / 2, 0);
  group.add(coreMesh);
  lamps.push(coreMesh);

  const domeR = 0.25;
  const domeGeo = new THREE.SphereGeometry(domeR, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMesh = new THREE.Mesh(domeGeo, m.glass);
  domeMesh.position.set(0, baseH + colH + collarH, 0);
  group.add(domeMesh);

  colliders.push({ min: [-baseR, 0, -baseR], max: [baseR, totalH, baseR] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}

/* ==========================================================================
   13. TEXTURE MILL
   ========================================================================== */
export function textureMill(m: LabMaterials, o?: { stage?: number }): Prop {
  const stage = o?.stage ?? 6;
  const isChunky = stage <= 2;
  // stage 1 is chunky low poly: plain boxes (a chamfered box costs about 410 triangles even with one bevel segment)
  const cbox = (w: number, h: number, d: number, c: number, seg: number): THREE.BufferGeometry => (isChunky ? new THREE.BoxGeometry(w, h, d) : createChamferBox(w, h, d, c, seg));

  const group = new THREE.Group();
  const builder = new PropBuilder();
  const colliders: Box[] = [];
  const sockets: Socket[] = [];
  const lamps: THREE.Mesh[] = [];

  const skidW = 1.4;
  const skidD = 1.6;
  const skidH = 0.12;

  const skidGeo = cbox(skidW, skidH, skidD, isChunky ? 0.01 : 0.025, isChunky ? 1 : 2);
  skidGeo.translate(0, skidH / 2, 0);
  builder.add(skidGeo, m.darkSteel);

  if (!isChunky) {
    for (const fx of [-skidW / 2 + 0.1, skidW / 2 - 0.1]) {
      for (const fz of [-skidD / 2 + 0.1, skidD / 2 - 0.1]) {
        const foot = createBoltGeo(0.045, 0.02, 6);
        foot.translate(fx, skidH + 0.01, fz);
        builder.add(foot, m.gunmetal);
      }
    }
  }

  const hzH = skidH * 0.7;
  const hzSideL = new THREE.BoxGeometry(0.02, hzH, skidD - 0.1);
  hzSideL.translate(-skidW / 2, skidH / 2, 0);
  builder.add(hzSideL, m.hazard);

  const hzSideR = new THREE.BoxGeometry(0.02, hzH, skidD - 0.1);
  hzSideR.translate(skidW / 2, skidH / 2, 0);
  builder.add(hzSideR, m.hazard);

  const bodyW = 1.0;
  const bodyH = 0.95;
  const bodyD = 1.0;
  const bodyY = skidH + bodyH / 2;
  const bodyZ = -0.05;

  const bodyGeo = cbox(bodyW, bodyH, bodyD, isChunky ? 0.01 : 0.03, isChunky ? 1 : 2);
  bodyGeo.translate(0, bodyY, bodyZ);
  builder.add(bodyGeo, m.paint);

  const sDoor = cbox(0.02, 0.55, 0.6, 0.01, 1);
  sDoor.translate(bodyW / 2 + 0.01, bodyY, bodyZ);
  builder.add(sDoor, m.gunmetal);

  const labelPlate = new THREE.BoxGeometry(0.01, 0.2, 0.4);
  labelPlate.translate(-bodyW / 2 - 0.005, bodyY + 0.15, bodyZ);
  builder.add(labelPlate, m.darkSteel);

  // Hopper at FRONT
  const hopW = 0.55;
  const hopH = 0.5;
  const hopD = 0.45;
  const hopY = skidH + 0.45;
  const hopZ = bodyZ + bodyD / 2 + hopD / 2 - 0.05;

  const hopGeo = new THREE.CylinderGeometry(hopW * 0.55, hopW * 0.35, hopH, isChunky ? 6 : 20);
  hopGeo.translate(0, hopY, hopZ);
  builder.add(hopGeo, m.gunmetal);

  const hopMouthY = hopY + hopH / 2;
  sockets.push({ name: 'hopper', at: [0, hopMouthY, hopZ] });

  // Stack at TOP REAR
  const stackR = 0.18;
  const stackH = 0.75;
  const stackY = skidH + bodyH + stackH / 2;
  const stackZ = bodyZ - 0.2;

  const stackGeo = new THREE.CylinderGeometry(stackR, stackR * 1.1, stackH, isChunky ? 8 : 24);
  stackGeo.translate(0, stackY, stackZ);
  builder.add(stackGeo, m.gunmetal);

  const grilleGeo = new THREE.CylinderGeometry(stackR * 0.95, stackR * 0.95, 0.02, isChunky ? 8 : 20);
  grilleGeo.translate(0, stackY + stackH / 2, stackZ);
  builder.add(grilleGeo, m.darkSteel);

  const stackMouthY = stackY + stackH / 2 + 0.02;
  sockets.push({ name: 'stack', at: [0, stackMouthY, stackZ] });

  // Cartridge slot
  const slotW = 0.05;
  const slotH = 0.25;
  const slotD = 0.14;
  const slotGeo = cbox(slotW, slotH, slotD, 0.008, 1);
  slotGeo.translate(-bodyW / 2 - 0.02, bodyY - 0.1, bodyZ + 0.15);
  builder.add(slotGeo, m.gunmetal);

  // Power gland at back
  const glandZ = bodyZ - bodyD / 2 - 0.03;
  const glandY = skidH + 0.25;
  const gland = createBoltGeo(0.035, 0.05, 12);
  gland.rotateX(Math.PI / 2);
  gland.translate(0.2, glandY, glandZ);
  builder.add(gland, m.copper);
  sockets.push({ name: 'power', at: [0.2, glandY, glandZ - 0.03] });

  const millLamp = createLampMesh(0xffaa22, 0.02, 0.02);
  millLamp.position.set(-0.35, skidH + bodyH + 0.05, bodyZ + bodyD / 2 - 0.05);
  group.add(millLamp);
  lamps.push(millLamp);

  colliders.push({ min: [-skidW / 2, 0, -skidD / 2], max: [skidW / 2, stackMouthY, skidD / 2] });

  builder.build(group);
  groundProp(group, sockets, colliders);
  return { group, colliders, sockets, lamps };
}
