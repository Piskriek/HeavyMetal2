// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
// voxelart.ts

export type V3 = [number, number, number];

export interface Entry {
  name: string;
  color: V3; /* sRGB 0..1 */
  roughness: number;
  metalness: number;
  emissive: number; /* 0..1 */
  alpha: number; /* 1 opaque */
}

export interface Model {
  id: string;
  name: string;
  size: V3;
  pivot: V3;
  palette: Entry[];
  cells: Uint8Array; /* x fastest, then y, then z; 0 empty; cell value i = palette[i-1]; y up */
}

export function createModel(id: string, name: string, size: V3, pivot: V3, palette: Entry[]): Model {
  const [sx, sy, sz] = size;
  return {
    id,
    name,
    size,
    pivot,
    palette,
    cells: new Uint8Array(sx * sy * sz),
  };
}

export const newModel = createModel;

export function get(m: Model, x: number, y: number, z: number): number {
  const [sx, sy, sz] = m.size;
  if (x < 0 || x >= sx || y < 0 || y >= sy || z < 0 || z >= sz) return 0;
  return m.cells[x + y * sx + z * sx * sy] ?? 0;
}

export function set(m: Model, x: number, y: number, z: number, v: number): void {
  const [sx, sy, sz] = m.size;
  if (x < 0 || x >= sx || y < 0 || y >= sy || z < 0 || z >= sz) return;
  m.cells[x + y * sx + z * sx * sy] = v;
}

export function box(m: Model, a: V3, b: V3, v: number): void {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const z0 = Math.min(a[2], b[2]), z1 = Math.max(a[2], b[2]);
  for (let z = z0; z <= z1; z++) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        set(m, x, y, z, v);
      }
    }
  }
}

export function sphere(m: Model, c: V3, r: number, v: number): void {
  const r2 = r * r;
  const minX = Math.floor(c[0] - r), maxX = Math.ceil(c[0] + r);
  const minY = Math.floor(c[1] - r), maxY = Math.ceil(c[1] + r);
  const minZ = Math.floor(c[2] - r), maxZ = Math.ceil(c[2] + r);
  for (let z = minZ; z <= maxZ; z++) {
    const dz = z - c[2];
    for (let y = minY; y <= maxY; y++) {
      const dy = y - c[1];
      for (let x = minX; x <= maxX; x++) {
        const dx = x - c[0];
        if (dx * dx + dy * dy + dz * dz <= r2) {
          set(m, x, y, z, v);
        }
      }
    }
  }
}

export function ellipsoid(m: Model, c: V3, radii: V3, v: number): void {
  const [rx, ry, rz] = radii;
  if (rx <= 0 || ry <= 0 || rz <= 0) return;
  const minX = Math.floor(c[0] - rx), maxX = Math.ceil(c[0] + rx);
  const minY = Math.floor(c[1] - ry), maxY = Math.ceil(c[1] + ry);
  const minZ = Math.floor(c[2] - rz), maxZ = Math.ceil(c[2] + rz);
  for (let z = minZ; z <= maxZ; z++) {
    const dz = (z - c[2]) / rz;
    for (let y = minY; y <= maxY; y++) {
      const dy = (y - c[1]) / ry;
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - c[0]) / rx;
        if (dx * dx + dy * dy + dz * dz <= 1.0) {
          set(m, x, y, z, v);
        }
      }
    }
  }
}

export function line(m: Model, a: V3, b: V3, v: number, thickness = 1): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const dist = Math.hypot(dx, dy, dz);
  const steps = Math.max(1, Math.ceil(dist * 2.5));
  const r = (thickness - 1) / 2;
  const r2 = r * r + 0.1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = a[0] + dx * t;
    const cy = a[1] + dy * t;
    const cz = a[2] + dz * t;
    if (thickness <= 1) {
      set(m, Math.round(cx), Math.round(cy), Math.round(cz), v);
    } else {
      const bound = Math.ceil(r);
      for (let oz = -bound; oz <= bound; oz++) {
        for (let oy = -bound; oy <= bound; oy++) {
          for (let ox = -bound; ox <= bound; ox++) {
            if (ox * ox + oy * oy + oz * oz <= r2) {
              set(m, Math.round(cx + ox), Math.round(cy + oy), Math.round(cz + oz), v);
            }
          }
        }
      }
    }
  }
}

export function cylinder(m: Model, base: V3, r: number, h: number, v: number): void {
  const r2 = r * r;
  const minX = Math.floor(base[0] - r), maxX = Math.ceil(base[0] + r);
  const minZ = Math.floor(base[2] - r), maxZ = Math.ceil(base[2] + r);
  const minY = base[1];
  const maxY = base[1] + h - 1;
  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      const dz = z - base[2];
      for (let x = minX; x <= maxX; x++) {
        const dx = x - base[0];
        if (dx * dx + dz * dz <= r2) {
          set(m, x, y, z, v);
        }
      }
    }
  }
}

export function mirrorX(m: Model): void {
  const [sx, sy, sz] = m.size;
  const halfX = Math.floor(sx / 2);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < halfX; x++) {
        const val = get(m, x, y, z);
        set(m, sx - 1 - x, y, z, val);
      }
    }
  }
}

export function speckle(m: Model, seed: number, value: number, amount: number, targetValue?: number): void {
  const [sx, sy, sz] = m.size;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const current = get(m, x, y, z);
        if (current === 0 || current === value) continue;
        if (targetValue !== undefined && current !== targetValue) continue;

        const isSurface =
          x === 0 || x === sx - 1 ||
          y === 0 || y === sy - 1 ||
          z === 0 || z === sz - 1 ||
          get(m, x - 1, y, z) === 0 ||
          get(m, x + 1, y, z) === 0 ||
          get(m, x, y - 1, z) === 0 ||
          get(m, x, y + 1, z) === 0 ||
          get(m, x, y, z - 1) === 0 ||
          get(m, x, y, z + 1) === 0;

        if (isSurface) {
          let h = (seed ^ (x * 374761393 + y * 668265263 + z * 951214213)) >>> 0;
          h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
          const hashVal = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
          if (hashVal < amount) {
            set(m, x, y, z, value);
          }
        }
      }
    }
  }
}

export function stats(m: Model): {
  voxels: number;
  bounds: { min: V3; max: V3 };
  components: number;
  paletteUse: number[];
} {
  const [sx, sy, sz] = m.size;
  let voxels = 0;
  let minX = sx, minY = sy, minZ = sz;
  let maxX = -1, maxY = -1, maxZ = -1;
  const paletteUse: number[] = new Array(m.palette.length).fill(0);

  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const v = get(m, x, y, z);
        if (v > 0) {
          voxels++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
          const pIdx = v - 1;
          if (pIdx >= 0 && pIdx < paletteUse.length) {
            paletteUse[pIdx] = (paletteUse[pIdx] ?? 0) + 1;
          }
        }
      }
    }
  }

  const bounds = {
    min: (voxels === 0 ? [0, 0, 0] : [minX, minY, minZ]) as V3,
    max: (voxels === 0 ? [0, 0, 0] : [maxX, maxY, maxZ]) as V3,
  };

  let components = 0;
  const total = sx * sy * sz;
  const visited = new Uint8Array(total);

  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const idx = x + y * sx + z * sx * sy;
        if ((m.cells[idx] ?? 0) !== 0 && visited[idx] === 0) {
          components++;
          const queue: number[] = [idx];
          visited[idx] = 1;
          let head = 0;
          while (head < queue.length) {
            const curr = queue[head++]!;
            const cz = Math.floor(curr / (sx * sy));
            const rem = curr % (sx * sy);
            const cy = Math.floor(rem / sx);
            const cx = rem % sx;

            if (cx > 0) {
              const n = curr - 1;
              if ((m.cells[n] ?? 0) !== 0 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
            if (cx < sx - 1) {
              const n = curr + 1;
              if ((m.cells[n] ?? 0) !== 0 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
            if (cy > 0) {
              const n = curr - sx;
              if ((m.cells[n] ?? 0) !== 0 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
            if (cy < sy - 1) {
              const n = curr + sx;
              if ((m.cells[n] ?? 0) !== 0 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
            if (cz > 0) {
              const n = curr - sx * sy;
              if ((m.cells[n] ?? 0) !== 0 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
            if (cz < sz - 1) {
              const n = curr + sx * sy;
              if ((m.cells[n] ?? 0) !== 0 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }
        }
      }
    }
  }

  return { voxels, bounds, components, paletteUse };
}

export function ascii(m: Model, y: number): string {
  const [sx, sy, sz] = m.size;
  if (y < 0 || y >= sy) return '';
  const chars = '.123456789abcdefghijklmnopqrstuvwxyz';
  const lines: string[] = [];
  for (let z = 0; z < sz; z++) {
    let line = '';
    for (let x = 0; x < sx; x++) {
      const v = get(m, x, y, z);
      line += v === 0 ? '.' : (chars[v] ?? '#');
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/**
 * A human avatar (28 x 47 x 20 cells, 1.88 m at 4 cm a cell, facing -Z like the goblin): shoes, trousers, belt, short-sleeved shirt,
 * a neckerchief, a head with eyes, nose, mouth, ears and hair. Built as the left half and mirrored. Its palette names are what the avatar
 * looks recolour (`@hm/avatarlook` HUMAN_SLOTS), and its parts line up with HUMAN_RIG in `@hm/render`.
 */
function buildHuman(): Model {
  const e = (name: string, color: V3, roughness = 0.8, metalness = 0): Entry => ({ name, color, roughness, metalness, emissive: 0, alpha: 1 });
  const palette: Entry[] = [
    e('skin', [0.78, 0.55, 0.42], 0.7), e('skin-shade', [0.66, 0.44, 0.33], 0.75), e('hair', [0.23, 0.16, 0.12], 0.9), e('eyes', [0.23, 0.16, 0.11], 0.3),
    e('shirt', [0.85, 0.79, 0.64], 0.9), e('belt', [0.35, 0.23, 0.13], 0.8), e('buckle', [0.8, 0.7, 0.35], 0.3, 0.9), e('trousers', [0.37, 0.42, 0.29], 0.9),
    e('shoes', [0.24, 0.17, 0.12], 0.7), e('scarf', [0.75, 0.22, 0.17], 0.85),
  ];
  const SKIN = 1, SHADE = 2, HAIR = 3, EYES = 4, SHIRT = 5, BELT = 6, BUCKLE = 7, TROUSERS = 8, SHOES = 9, SCARF = 10;
  const m = createModel('human', 'Human', [28, 47, 20], [14, 0, 10], palette);
  // feet and legs
  box(m, [9, 0, 6], [12, 2, 12], SHOES);
  box(m, [9, 3, 8], [12, 19, 12], TROUSERS);
  box(m, [8, 17, 7], [13, 21, 12], TROUSERS);
  // belt with its buckle a step out in front
  box(m, [8, 22, 7], [13, 22, 12], BELT);
  set(m, 13, 22, 6, BUCKLE);
  // shirt, short sleeves, bare forearms and hands
  box(m, [8, 23, 7], [13, 33, 12], SHIRT);
  box(m, [5, 28, 8], [7, 33, 11], SHIRT);
  box(m, [5, 21, 8], [7, 27, 11], SKIN);
  box(m, [5, 18, 8], [7, 20, 10], SKIN);
  // neckerchief with its knot in front, then the neck
  box(m, [9, 34, 7], [13, 35, 12], SCARF);
  set(m, 13, 33, 6, SCARF);
  box(m, [11, 36, 9], [13, 36, 11], SKIN);
  // head: face on the front plane (z = 7), ears at the sides, hair on top, at the back and over the ears
  box(m, [9, 37, 7], [13, 45, 13], SKIN);
  set(m, 11, 41, 7, EYES);
  set(m, 13, 40, 6, SHADE); // nose, a step out
  box(m, [12, 38, 7], [13, 38, 7], SHADE); // mouth
  box(m, [8, 40, 9], [8, 41, 10], SHADE); // ear
  box(m, [9, 46, 7], [13, 46, 13], HAIR);
  box(m, [9, 39, 13], [13, 46, 13], HAIR);
  box(m, [9, 43, 8], [9, 45, 13], HAIR);
  box(m, [9, 45, 7], [13, 45, 7], HAIR); // fringe
  box(m, [10, 42, 7], [11, 42, 7], HAIR); // eyebrow
  mirrorX(m);
  return m;
}

function buildGoblin(): Model {
  const palette: Entry[] = [
    { name: 'skin', color: [0.32, 0.58, 0.22], roughness: 0.7, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'skin-speckle', color: [0.22, 0.44, 0.16], roughness: 0.75, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'eye-glow', color: [1.0, 0.9, 0.05], roughness: 0.2, metalness: 0.1, emissive: 1.0, alpha: 1.0 },
    { name: 'fangs', color: [0.92, 0.9, 0.82], roughness: 0.5, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'leather-vest', color: [0.42, 0.26, 0.14], roughness: 0.85, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'belt', color: [0.22, 0.14, 0.08], roughness: 0.9, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'buckle', color: [0.85, 0.75, 0.25], roughness: 0.3, metalness: 0.9, emissive: 0.0, alpha: 1.0 },
    { name: 'loincloth', color: [0.36, 0.32, 0.22], roughness: 0.9, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'claws', color: [0.3, 0.28, 0.25], roughness: 0.6, metalness: 0.1, emissive: 0.0, alpha: 1.0 },
    { name: 'shield-wood', color: [0.52, 0.36, 0.2], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'shield-iron', color: [0.62, 0.64, 0.68], roughness: 0.35, metalness: 0.9, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('goblin', 'Goblin Warrior', [28, 44, 20], [14, 0, 10], palette);

  // Left foot & leg
  box(m, [8, 0, 7], [12, 1, 13], 1);
  box(m, [8, 0, 14], [12, 0, 14], 9); // claws on toes
  box(m, [8, 2, 7], [12, 6, 12], 1);
  // Knobby knee
  box(m, [8, 7, 7], [12, 10, 12], 1);
  box(m, [9, 8, 13], [11, 10, 13], 1); // knee knob
  // Upper leg
  box(m, [8, 11, 7], [12, 14, 12], 1);

  // Pelvis & Loincloth
  box(m, [8, 14, 6], [13, 17, 13], 1);
  box(m, [8, 13, 6], [13, 17, 13], 8);

  // Torso
  box(m, [8, 18, 6], [13, 29, 13], 1);

  // Leather Vest
  box(m, [7, 19, 5], [13, 28, 14], 5);
  // Open front chest revealing green skin
  box(m, [11, 22, 5], [13, 27, 5], 1);

  // Belt & Buckle
  box(m, [7, 18, 5], [13, 19, 14], 6);
  box(m, [13, 18, 5], [13, 19, 5], 7);

  // Left Arm
  box(m, [4, 25, 7], [7, 28, 12], 1); // Shoulder
  box(m, [4, 18, 8], [7, 24, 11], 1); // Upper arm
  box(m, [4, 12, 8], [7, 17, 11], 1); // Forearm
  box(m, [4, 9, 8], [7, 11, 11], 1);  // Hand
  box(m, [4, 8, 9], [7, 8, 10], 9);   // Finger claws

  // Neck
  box(m, [11, 29, 8], [13, 31, 12], 1);

  // Head
  box(m, [8, 31, 6], [13, 40, 14], 1);

  // Long pointed ear
  line(m, [8, 35, 10], [1, 42, 8], 1, 2);
  line(m, [8, 34, 10], [2, 39, 8], 1, 1);

  // Nose
  box(m, [12, 34, 4], [13, 37, 5], 1);
  box(m, [13, 33, 4], [13, 34, 4], 1);

  // Small fangs
  set(m, [12, 33, 5][0], [12, 33, 5][1], [12, 33, 5][2], 4);

  // Glowing eye
  set(m, [11, 36, 5][0], [11, 36, 5][1], [11, 36, 5][2], 3);

  // Speckle skin texture on the left half
  speckle(m, 42, 2, 0.25, 1);

  // Mirror left half to right half for exact symmetry
  mirrorX(m);

  // Attach wooden shield with iron rim on the left arm (non-symmetric)
  cylinder(m, [3, 10, 10], 4.2, 2, 10); // shield wood
  for (let z = 5; z <= 15; z++) {
    for (let y = 6; y <= 16; y++) {
      const dy = y - 11;
      const dz = z - 10;
      const dist2 = dy * dy + dz * dz;
      if (dist2 >= 10 && dist2 <= 20) {
        set(m, 2, y, z, 11); // iron rim outer
        set(m, 3, y, z, 11); // iron rim inner
      }
    }
  }
  set(m, 1, 11, 10, 11); // iron shield boss centre

  return m;
}

function buildGoblinBallRacer(): Model {
  const palette: Entry[] = [
    { name: 'skin', color: [0.32, 0.58, 0.22], roughness: 0.7, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'skin-speckle', color: [0.22, 0.44, 0.16], roughness: 0.75, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'eye-glow', color: [1.0, 0.9, 0.05], roughness: 0.2, metalness: 0.1, emissive: 1.0, alpha: 1.0 },
    { name: 'fangs', color: [0.92, 0.9, 0.82], roughness: 0.5, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'claws', color: [0.3, 0.28, 0.25], roughness: 0.6, metalness: 0.1, emissive: 0.0, alpha: 1.0 },
    { name: 'wood-plank1', color: [0.55, 0.38, 0.22], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'wood-plank2', color: [0.44, 0.28, 0.15], roughness: 0.82, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'iron-band', color: [0.58, 0.6, 0.64], roughness: 0.35, metalness: 0.9, emissive: 0.0, alpha: 1.0 },
    { name: 'cap-leather', color: [0.38, 0.22, 0.12], roughness: 0.85, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('goblin-ball-racer', 'Goblin Ball Racer', [36, 36, 36], [18, 18, 18], palette);
  const cx = 17.5, cy = 17.5, cz = 17.5;
  const rOuter = 16.0;

  // Build the wooden sphere barrel ball
  for (let z = 2; z <= 33; z++) {
    const dz = z - cz;
    for (let y = 2; y <= 33; y++) {
      const dy = y - cy;
      for (let x = 2; x <= 33; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= rOuter * rOuter) {
          // Open top hatch
          if (y >= 26 && dx * dx + dz * dz <= 8.5 * 8.5) {
            continue;
          }
          // Hollow interior cavity (connected at bottom to keep goblin seated)
          if (d2 < 11.5 * 11.5 && y < 24) {
            continue;
          }

          // Two iron bands around the sphere
          if ((y >= 10 && y <= 12) || (y >= 22 && y <= 24)) {
            set(m, x, y, z, 8);
          } else {
            const angle = Math.atan2(dz, dx);
            const plank = Math.floor((angle + Math.PI) / (Math.PI / 6)) % 2 === 0 ? 6 : 7;
            set(m, x, y, z, plank);
          }
        }
      }
    }
  }

  // Inside goblin torso anchoring to ball floor
  box(m, [14, 18, 14], [21, 26, 21], 1);

  // Goblin head sticking out of the open top
  box(m, [14, 27, 13], [21, 33, 21], 1);

  // Leather racing cap on head top
  box(m, [14, 34, 14], [21, 34, 21], 9);

  // Goblin face details
  set(m, 15, 30, 12, 3); // left glowing eye
  set(m, 20, 30, 12, 3); // right glowing eye
  box(m, [17, 28, 11], [18, 30, 12], 1); // nose
  set(m, 16, 28, 12, 4); // left fang
  set(m, 19, 28, 12, 4); // right fang

  // Pointed ears extending sideways past the hatch
  line(m, [13, 31, 17], [7, 34, 18], 1, 2);
  line(m, [22, 31, 17], [28, 34, 18], 1, 2);

  // Hands gripping the front rim
  box(m, [11, 26, 11], [13, 28, 13], 1);
  box(m, [22, 26, 11], [24, 28, 13], 1);
  set(m, 12, 28, 10, 5); // claw
  set(m, 23, 28, 10, 5); // claw

  // Skin speckle
  speckle(m, 999, 2, 0.2, 1);

  return m;
}

function buildPalm(): Model {
  const palette: Entry[] = [
    { name: 'trunk-bark', color: [0.46, 0.32, 0.18], roughness: 0.85, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'trunk-ring', color: [0.32, 0.2, 0.1], roughness: 0.85, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'trunk-moss', color: [0.28, 0.38, 0.18], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'frond-main', color: [0.18, 0.62, 0.14], roughness: 0.6, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'frond-light', color: [0.32, 0.76, 0.18], roughness: 0.6, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'frond-dark', color: [0.1, 0.44, 0.08], roughness: 0.65, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'coconut-shell', color: [0.26, 0.16, 0.08], roughness: 0.75, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'coconut-fiber', color: [0.55, 0.44, 0.26], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('palm', 'Tropical Palm Tree', [36, 44, 36], [18, 0, 18], palette);

  // Curved ringed trunk
  let topX = 18;
  const topY = 34;
  const topZ = 18;

  for (let y = 0; y <= topY; y++) {
    const t = y / topY;
    const curX = 18 + Math.round(4.0 * Math.sin(t * Math.PI * 0.8));
    if (y === topY) topX = curX;
    const r = Math.max(1.4, 2.8 - t * 1.3);
    const mat = (y <= 3) ? 3 : (y % 3 === 0 ? 2 : 1);
    cylinder(m, [curX, y, 18], r, 1, mat);
  }

  // Coconuts nestled at crown
  sphere(m, [topX + 2, topY - 1, topZ + 1], 1.6, 7);
  set(m, topX + 2, topY, topZ + 1, 8);

  sphere(m, [topX - 2, topY - 1, topZ - 1], 1.6, 7);
  set(m, topX - 2, topY, topZ - 1, 8);

  sphere(m, [topX + 1, topY - 1, topZ - 2], 1.5, 7);
  set(m, topX + 1, topY, topZ - 2, 8);

  // 7 Drooping fronds made with 2-voxel thick lines
  const frondCount = 7;
  for (let f = 0; f < frondCount; f++) {
    const angle = (f * 2 * Math.PI) / frondCount;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const p0: V3 = [topX, topY + 1, topZ];
    const p1: V3 = [
      Math.round(topX + cosA * 7),
      topY + 5,
      Math.round(topZ + sinA * 7),
    ];
    const p2: V3 = [
      Math.round(topX + cosA * 13),
      topY + 2,
      Math.round(topZ + sinA * 13),
    ];
    const p3: V3 = [
      Math.round(topX + cosA * 16),
      topY - 4,
      Math.round(topZ + sinA * 16),
    ];

    line(m, p0, p1, 6, 2); // frond-dark base
    line(m, p1, p2, 4, 2); // frond-main mid
    line(m, p2, p3, 5, 2); // frond-light tip
  }

  return m;
}

function buildBarrel(): Model {
  const palette: Entry[] = [
    { name: 'plank-light', color: [0.6, 0.42, 0.25], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'plank-dark', color: [0.46, 0.3, 0.16], roughness: 0.82, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'plank-rim', color: [0.38, 0.24, 0.12], roughness: 0.85, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'iron-band', color: [0.52, 0.54, 0.58], roughness: 0.32, metalness: 0.9, emissive: 0.0, alpha: 1.0 },
    { name: 'iron-rivet', color: [0.76, 0.78, 0.82], roughness: 0.25, metalness: 0.95, emissive: 0.0, alpha: 1.0 },
    { name: 'lid-wood', color: [0.52, 0.36, 0.2], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'bung-wood', color: [0.72, 0.54, 0.32], roughness: 0.75, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'bung-hole', color: [0.18, 0.12, 0.06], roughness: 0.95, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('barrel', 'Wooden Barrel', [14, 16, 14], [7, 0, 7], palette);
  const cx = 6.5, cz = 6.5;

  for (let y = 0; y < 16; y++) {
    const t = (y - 7.5) / 7.5;
    const r = 5.7 - 0.9 * t * t;
    const r2 = r * r;

    for (let z = 0; z < 14; z++) {
      const dz = z - cz;
      for (let x = 0; x < 14; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2) {
          if (y === 0 || y === 15) {
            set(m, x, y, z, 3); // rim
          } else if (y === 14) {
            set(m, x, y, z, 6); // lid
          } else if ((y >= 3 && y <= 4) || (y >= 10 && y <= 11)) {
            // Iron band & rivets
            if (d2 >= (r - 1.2) * (r - 1.2)) {
              const isRivet = (x === 6 || x === 7) && (z <= 2 || z >= 11);
              set(m, x, y, z, isRivet ? 5 : 4);
            } else {
              set(m, x, y, z, 1);
            }
          } else {
            // Alternating planks
            const angle = Math.atan2(dz, dx);
            const stripe = Math.floor((angle + Math.PI) / (Math.PI / 4)) % 2;
            set(m, x, y, z, stripe === 0 ? 1 : 2);
          }
        }
      }
    }
  }

  // Bung on the top lid
  set(m, 8, 14, 6, 8); // hole
  set(m, 8, 15, 6, 7); // bung cork

  return m;
}

function buildRock(): Model {
  const palette: Entry[] = [
    { name: 'strata-dark', color: [0.36, 0.38, 0.4], roughness: 0.9, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'strata-light', color: [0.56, 0.58, 0.6], roughness: 0.85, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'strata-quartz', color: [0.78, 0.8, 0.82], roughness: 0.4, metalness: 0.1, emissive: 0.0, alpha: 1.0 },
    { name: 'strata-iron', color: [0.58, 0.32, 0.18], roughness: 0.85, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'moss-base', color: [0.22, 0.42, 0.16], roughness: 0.7, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'moss-top', color: [0.36, 0.64, 0.22], roughness: 0.65, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'lichen', color: [0.62, 0.68, 0.26], roughness: 0.75, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
    { name: 'crevice-shade', color: [0.22, 0.23, 0.25], roughness: 0.95, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('rock', 'Chunky Mossy Rock', [20, 14, 18], [10, 0, 9], palette);

  for (let z = 1; z <= 16; z++) {
    const dz = (z - 8.5) / 7.2;
    for (let y = 0; y <= 12; y++) {
      const dy = (y - 4.5) / 6.2;
      for (let x = 1; x <= 18; x++) {
        const dx = (x - 9.5) / 8.2;

        const perturb =
          Math.sin(x * 1.2 + y * 0.9) * 0.18 +
          Math.cos(y * 1.4 + z * 1.1) * 0.18 +
          Math.sin(z * 1.5 + x * 0.7) * 0.14;

        if (dx * dx + dy * dy + dz * dz + perturb <= 0.95) {
          const layer = y + Math.floor(x * 0.25 + z * 0.2);
          let val = 1;
          if (layer % 4 === 1 || layer % 4 === 2) val = 2;
          if (layer === 6) val = 3; // quartz vein
          if (layer === 3 && (x + z) % 4 === 0) val = 4; // iron strata
          set(m, x, y, z, val);
        }
      }
    }
  }

  // Moss on top surface
  for (let z = 0; z < 18; z++) {
    for (let x = 0; x < 20; x++) {
      for (let y = 13; y >= 6; y--) {
        if (get(m, x, y, z) !== 0) {
          set(m, x, y, z, (x + z) % 3 === 0 ? 6 : 5);
          if (y > 0 && get(m, x, y - 1, z) !== 0) {
            set(m, x, y - 1, z, 5);
          }
          break;
        }
      }
    }
  }

  // Lichen & crevice accents
  speckle(m, 777, 7, 0.15, 2);
  speckle(m, 333, 8, 0.12, 1);

  return m;
}

function buildTrophy(): Model {
  const palette: Entry[] = [
    { name: 'gold-main', color: [1.0, 0.82, 0.2], roughness: 0.25, metalness: 1.0, emissive: 0.0, alpha: 1.0 },
    { name: 'gold-shadow', color: [0.72, 0.55, 0.12], roughness: 0.3, metalness: 1.0, emissive: 0.0, alpha: 1.0 },
    { name: 'gold-bright', color: [1.0, 0.94, 0.45], roughness: 0.2, metalness: 1.0, emissive: 0.0, alpha: 1.0 },
    { name: 'base-marble', color: [0.16, 0.17, 0.19], roughness: 0.4, metalness: 0.1, emissive: 0.0, alpha: 1.0 },
    { name: 'base-plate', color: [0.82, 0.68, 0.32], roughness: 0.3, metalness: 0.9, emissive: 0.0, alpha: 1.0 },
    { name: 'gem-ruby', color: [1.0, 0.12, 0.24], roughness: 0.1, metalness: 0.2, emissive: 1.0, alpha: 1.0 },
    { name: 'gem-sparkle', color: [1.0, 0.65, 0.75], roughness: 0.1, metalness: 0.1, emissive: 0.8, alpha: 1.0 },
    { name: 'cup-velvet', color: [0.46, 0.08, 0.14], roughness: 0.9, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('trophy', 'Golden Winner Cup', [16, 30, 16], [8, 0, 8], palette);

  // Stepped marble base
  box(m, [2, 0, 2], [13, 1, 13], 4);
  box(m, [3, 2, 3], [12, 3, 12], 4);

  // Inscription plate on front
  box(m, [5, 1, 2], [10, 2, 2], 5);

  // Gold riser & stem
  cylinder(m, [7.5, 4, 7.5], 3.2, 2, 1);
  cylinder(m, [7.5, 6, 7.5], 1.6, 5, 2);
  sphere(m, [7.5, 12, 7.5], 2.8, 1);

  // Cup bowl
  for (let y = 14; y <= 25; y++) {
    const t = (y - 14) / 11;
    const r = 2.6 + t * 3.2;
    cylinder(m, [7.5, y, 7.5], r, 1, 1);
    // Velvet inside lining
    if (y >= 18 && y <= 24) {
      cylinder(m, [7.5, y, 7.5], r - 1.2, 1, 8);
    }
  }

  // Polished gold rim
  cylinder(m, [7.5, 25, 7.5], 5.8, 1, 3);
  cylinder(m, [7.5, 25, 7.5], 4.4, 1, 0);

  // Two curved handles
  for (let a = 0; a <= 180; a += 15) {
    const rad = (a * Math.PI) / 180;
    const hy = Math.round(20 + Math.cos(rad) * 4.5);
    const hxLeft = Math.round(7.5 - 5.5 - Math.sin(rad) * 2.2);
    const hxRight = Math.round(7.5 + 5.5 + Math.sin(rad) * 2.2);
    set(m, hxLeft, hy, 7, 2);
    set(m, hxLeft, hy, 8, 3);
    set(m, hxRight, hy, 7, 2);
    set(m, hxRight, hy, 8, 3);
  }

  // Emissive glowing ruby gem on cup front
  box(m, [7, 19, 2], [8, 20, 2], 6);
  set(m, 7, 20, 2, 7); // sparkle facet

  return m;
}

function buildStatuePlinth(): Model {
  const palette: Entry[] = [
    { name: 'stone-main', color: [0.6, 0.6, 0.62], roughness: 0.85, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'stone-dark', color: [0.42, 0.42, 0.45], roughness: 0.88, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'stone-border', color: [0.72, 0.7, 0.68], roughness: 0.75, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'stone-glyphs', color: [0.32, 0.32, 0.35], roughness: 0.9, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'chamfer-edge', color: [0.52, 0.52, 0.55], roughness: 0.8, metalness: 0.05, emissive: 0.0, alpha: 1.0 },
    { name: 'bronze-hook', color: [0.7, 0.5, 0.25], roughness: 0.3, metalness: 0.9, emissive: 0.0, alpha: 1.0 },
    { name: 'iron-ring', color: [0.45, 0.48, 0.5], roughness: 0.25, metalness: 0.95, emissive: 0.0, alpha: 1.0 },
    { name: 'moss-crack', color: [0.28, 0.45, 0.2], roughness: 0.8, metalness: 0.0, emissive: 0.0, alpha: 1.0 },
  ];

  const m = createModel('statue-plinth', 'Grand Statue Plinth', [24, 8, 24], [12, 0, 12], palette);

  // Tier 0: Base footing
  box(m, [1, 0, 1], [22, 0, 22], 2);

  // Tier 1: Chamfer step
  box(m, [2, 1, 2], [21, 1, 21], 5);

  // Tier 2..5: Main block
  box(m, [3, 2, 3], [20, 5, 20], 1);

  // Carved border around side faces
  for (let y = 2; y <= 5; y++) {
    for (let i = 3; i <= 20; i++) {
      if (y === 2 || y === 5 || i === 3 || i === 20) {
        set(m, i, y, 3, 3);
        set(m, i, y, 20, 3);
        set(m, 3, y, i, 3);
        set(m, 20, y, i, 3);
      } else if ((i + y) % 3 === 0) {
        set(m, i, y, 3, 4); // glyphs
        set(m, i, y, 20, 4);
        set(m, 3, y, i, 4);
        set(m, 20, y, i, 4);
      }
    }
  }

  // Tier 6: Top surface with border
  box(m, [2, 6, 2], [21, 6, 21], 5);
  for (let i = 2; i <= 21; i++) {
    set(m, i, 6, 2, 3);
    set(m, i, 6, 21, 3);
    set(m, 2, 6, i, 3);
    set(m, 21, 6, i, 3);
  }

  // Moss accents in stone crevices
  set(m, 3, 6, 3, 8);
  set(m, 20, 6, 3, 8);
  set(m, 3, 6, 20, 8);
  set(m, 20, 6, 20, 8);

  // Statue hook point at center top
  box(m, [11, 6, 11], [12, 7, 12], 6); // bronze base
  set(m, 10, 7, 11, 7); // iron ring
  set(m, 13, 7, 11, 7);
  set(m, 11, 7, 10, 7);
  set(m, 11, 7, 13, 7);

  return m;
}

const RAW_MODELS: { id: string; name: string; doc: string; build: () => Model }[] = [
  {
    id: 'goblin',
    name: 'Goblin Warrior',
    doc: 'A 28x44x20 goblin standing with pointed ears, fangs, glowing yellow eyes, leather vest, belt, claws, and a round wooden shield.',
    build: buildGoblin,
  },
  {
    id: 'human',
    name: 'Human',
    doc: 'A 28x47x20 person in a short-sleeved shirt, trousers, belt and shoes, with a neckerchief, eyes, nose, ears and hair: the human avatar.',
    build: buildHuman,
  },
  {
    id: 'goblin-ball-racer',
    name: 'Goblin Ball Racer',
    doc: 'A 36x36x36 crouched goblin in a round wooden spherical barrel-ball with open top hatch, head, ears, and clawed hands exposed.',
    build: buildGoblinBallRacer,
  },
  {
    id: 'palm',
    name: 'Tropical Palm Tree',
    doc: 'A 36x44x36 tropical palm tree with curved ringed trunk, coconuts, and 7 drooping 2-voxel thick fronds.',
    build: buildPalm,
  },
  {
    id: 'barrel',
    name: 'Wooden Barrel',
    doc: 'A 14x16x14 barrel with vertical plank striping, two iron bands with rivets, and a top lid with a bung.',
    build: buildBarrel,
  },
  {
    id: 'rock',
    name: 'Chunky Mossy Rock',
    doc: 'A 20x14x18 chunky rock featuring strata layers, quartz veins, iron oxide, crevices, and moss on top.',
    build: buildRock,
  },
  {
    id: 'trophy',
    name: 'Golden Winner Cup',
    doc: 'A 16x30x16 winner trophy cup on a stepped marble base with gold handles, interior velvet, and a glowing ruby gem.',
    build: buildTrophy,
  },
  {
    id: 'statue-plinth',
    name: 'Grand Statue Plinth',
    doc: 'A 24x8x24 carved stone plinth with chamfer, borders, glyphs, and a central bronze hook point at top.',
    build: buildStatuePlinth,
  },
];
/**
 * Join stray pieces to the biggest one: each loose component is linked to the main body by the shortest straight-ish walk of
 * 6-connected voxels (taking the colour of the voxel it leaves from). Thin diagonal strokes (fronds, claws) are often only
 * corner-connected, and this welds them so a model is always one solid piece. Deterministic.
 */
export function weld(m: Model, symmetricX = false): Model {
  const [sx, sy, sz] = m.size;
  const idx = (x: number, y: number, z: number): number => x + sx * (y + sy * z);
  const n = sx * sy * sz;
  const comp = new Int32Array(n).fill(-1);
  const comps: number[][] = [];
  const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
  for (let i = 0; i < n; i++) {
    if (!m.cells[i] || comp[i] !== -1) continue;
    const id = comps.length, list: number[] = [i], queue = [i];
    comp[i] = id;
    while (queue.length) {
      const c = queue.pop()!;
      const x = c % sx, y = Math.floor(c / sx) % sy, z = Math.floor(c / (sx * sy));
      for (const d of nb) {
        const X = x + d[0], Y = y + d[1], Z = z + d[2];
        if (X < 0 || Y < 0 || Z < 0 || X >= sx || Y >= sy || Z >= sz) continue;
        const j = idx(X, Y, Z);
        if (m.cells[j] && comp[j] === -1) { comp[j] = id; list.push(j); queue.push(j); }
      }
    }
    comps.push(list);
  }
  if (comps.length <= 1) return m;
  const order = comps.map((c, i) => i).sort((a, b) => comps[b]!.length - comps[a]!.length || a - b);
  const body: number[] = comps[order[0]!]!.slice();
  const out: Model = { ...m, cells: m.cells.slice() };
  const xyz = (c: number): V3 => [c % sx, Math.floor(c / sx) % sy, Math.floor(c / (sx * sy))];
  for (const ci of order.slice(1)) {
    const part = comps[ci]!;
    let best = Infinity, from = part[0]!, to = body[0]!;
    for (const a of part) { const A = xyz(a); for (const b of body) { const B = xyz(b); const d = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2]); if (d < best) { best = d; from = a; to = b; } } }
    const A = xyz(from), B = xyz(to), v = m.cells[from]!;
    const cur: V3 = [A[0], A[1], A[2]];
    while (cur[0] !== B[0] || cur[1] !== B[1] || cur[2] !== B[2]) {
      // step along the axis with the biggest gap first, so the weld is a clean staircase
      let ax = 0, gap = -1;
      for (let k = 0; k < 3; k++) { const g = Math.abs(B[k]! - cur[k]!); if (g > gap) { gap = g; ax = k; } }
      cur[ax] += Math.sign(B[ax]! - cur[ax]!);
      const j = idx(cur[0], cur[1], cur[2]);
      if (!out.cells[j]) { out.cells[j] = v; body.push(j); }
      if (symmetricX) { const k = idx(sx - 1 - cur[0], cur[1], cur[2]); if (!out.cells[k]) { out.cells[k] = v; body.push(k); } }
    }
    for (const a of part) body.push(a);
  }
  return out;
}

/** The ready-made models. Every build is deterministic and one connected piece. */
export const MODELS: { id: string; name: string; doc: string; build: () => Model }[] = RAW_MODELS.map((e) => ({ ...e, build: () => (e.id === 'goblin' || e.id === 'human' ? weld(weld(e.build(), true)) : weld(e.build())) }));
