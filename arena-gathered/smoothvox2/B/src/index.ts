export type Vec3 = [number, number, number];

export interface VMaterial {
  color: Vec3;
  alpha: number;
  roughness: number;
  metalness: number;
  emissive: number;
}

export interface SmoothMesh {
  positions: Float32Array;
  normals: Float32Array;
  paletteIndex: Uint8Array;
  indices: Uint32Array;
}

export interface Surface {
  id: number;
  name: string;
  color: Vec3;
}

export function surfaceOf(
  palette: readonly VMaterial[],
  surfaces: readonly Surface[],
  explicit?: Readonly<Record<number, number>>,
): number[] {
  const mapped: number[] = [];
  const metal = surfaces.find((surface) => surface.name === 'metal')?.id;
  const glow = surfaces.find((surface) => surface.name === 'glow')?.id;

  for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
    const material = palette[paletteIndex];
    if (material === undefined) {
      mapped.push(-1);
      continue;
    }

    const hasExplicitSurface = explicit !== undefined && Object.prototype.hasOwnProperty.call(explicit, paletteIndex);
    if (hasExplicitSurface) {
      mapped.push(explicit?.[paletteIndex] ?? -1);
      continue;
    }

    if (material.metalness > 0.5 && metal !== undefined) {
      mapped.push(metal);
      continue;
    }

    if (material.emissive > 0.5 && glow !== undefined) {
      mapped.push(glow);
      continue;
    }

    let nearest = -1;
    let nearestDistance = Infinity;
    for (const surface of surfaces) {
      const red = material.color[0] - surface.color[0];
      const green = material.color[1] - surface.color[1];
      const blue = material.color[2] - surface.color[2];
      const distance = 0.3 * red * red + 0.59 * green * green + 0.11 * blue * blue;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = surface.id;
      }
    }
    mapped.push(nearest);
  }

  return mapped;
}

export function triplanarWeights(m: SmoothMesh, sharpness: number): Float32Array {
  const vertexCount = Math.floor(m.positions.length / 3);
  const weights = new Float32Array(vertexCount * 3);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const nx = m.normals[offset] ?? 0;
    const ny = m.normals[offset + 1] ?? 0;
    const nz = m.normals[offset + 2] ?? 0;
    const x = Math.pow(Math.abs(nx), sharpness);
    const y = Math.pow(Math.abs(ny), sharpness);
    const z = Math.pow(Math.abs(nz), sharpness);
    const sum = x + y + z;

    if (sum > 0 && Number.isFinite(sum)) {
      weights[offset] = x / sum;
      weights[offset + 1] = y / sum;
      weights[offset + 2] = z / sum;
    } else {
      weights[offset] = 1 / 3;
      weights[offset + 1] = 1 / 3;
      weights[offset + 2] = 1 / 3;
    }
  }

  return weights;
}

export function tangents(m: SmoothMesh): Float32Array {
  const vertexCount = Math.floor(m.positions.length / 3);
  const result = new Float32Array(vertexCount * 4);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const normalOffset = vertex * 3;
    const outputOffset = vertex * 4;
    const nx = m.normals[normalOffset] ?? 0;
    const ny = m.normals[normalOffset + 1] ?? 0;
    const nz = m.normals[normalOffset + 2] ?? 0;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    let ux = 0;
    let uy = 0;
    let uz = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;

    if (ax >= ay && ax >= az) {
      uz = 1;
      vy = 1;
    } else if (ay >= az) {
      ux = 1;
      vz = 1;
    } else {
      ux = 1;
      vy = 1;
    }

    const normalLengthSquared = nx * nx + ny * ny + nz * nz;
    const normalDotU = nx * ux + ny * uy + nz * uz;
    const projection = normalLengthSquared > 0 ? normalDotU / normalLengthSquared : 0;
    let tx = ux - nx * projection;
    let ty = uy - ny * projection;
    let tz = uz - nz * projection;
    const tangentLength = Math.hypot(tx, ty, tz);

    if (tangentLength > 0 && Number.isFinite(tangentLength)) {
      tx /= tangentLength;
      ty /= tangentLength;
      tz /= tangentLength;
    } else {
      tx = ux;
      ty = uy;
      tz = uz;
    }

    const crossX = ny * tz - nz * ty;
    const crossY = nz * tx - nx * tz;
    const crossZ = nx * ty - ny * tx;
    const handedness = crossX * vx + crossY * vy + crossZ * vz >= 0 ? 1 : -1;

    result[outputOffset] = tx;
    result[outputOffset + 1] = ty;
    result[outputOffset + 2] = tz;
    result[outputOffset + 3] = handedness;
  }

  return result;
}

type Triangle = [number, number, number];

function vertexSurface(
  mesh: SmoothMesh,
  vertex: number,
  surfaceByPalette: readonly number[],
): number {
  const paletteIndex = mesh.paletteIndex[vertex];
  return paletteIndex === undefined ? -1 : (surfaceByPalette[paletteIndex] ?? -1);
}

function triangleSurface(
  mesh: SmoothMesh,
  triangle: Triangle,
  surfaceByPalette: readonly number[],
): number {
  const first = vertexSurface(mesh, triangle[0], surfaceByPalette);
  const second = vertexSurface(mesh, triangle[1], surfaceByPalette);
  const third = vertexSurface(mesh, triangle[2], surfaceByPalette);

  if (first === second || first === third) {
    return first;
  }
  if (second === third) {
    return second;
  }
  return first;
}

export function groups(
  m: SmoothMesh,
  surfaceByPalette: readonly number[],
): { indices: Uint32Array; groups: { surface: number; start: number; count: number }[] } {
  const bySurface = new Map<number, Triangle[]>();

  for (let index = 0; index + 2 < m.indices.length; index += 3) {
    const triangle: Triangle = [m.indices[index] ?? 0, m.indices[index + 1] ?? 0, m.indices[index + 2] ?? 0];
    const surface = triangleSurface(m, triangle, surfaceByPalette);
    const triangles = bySurface.get(surface);
    if (triangles === undefined) {
      bySurface.set(surface, [triangle]);
    } else {
      triangles.push(triangle);
    }
  }

  const surfaces = [...bySurface.keys()].sort((a, b) => a - b);
  const reordered = new Uint32Array(m.indices.length);
  const resultGroups: { surface: number; start: number; count: number }[] = [];
  let cursor = 0;

  for (const surface of surfaces) {
    const triangles = bySurface.get(surface) ?? [];
    const start = cursor;
    for (const triangle of triangles) {
      reordered[cursor] = triangle[0];
      reordered[cursor + 1] = triangle[1];
      reordered[cursor + 2] = triangle[2];
      cursor += 3;
    }
    resultGroups.push({ surface, start, count: cursor - start });
  }

  return { indices: reordered, groups: resultGroups };
}

export function surfaceBlend(
  m: SmoothMesh,
  surfaceByPalette: readonly number[],
): { ids: Uint8Array; weights: Float32Array } {
  const vertexCount = Math.floor(m.positions.length / 3);
  const adjacency: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>());

  const connect = (first: number, second: number): void => {
    if (first < vertexCount && second < vertexCount) {
      adjacency[first]?.add(second);
      adjacency[second]?.add(first);
    }
  };

  for (let index = 0; index + 2 < m.indices.length; index += 3) {
    const first = m.indices[index] ?? 0;
    const second = m.indices[index + 1] ?? 0;
    const third = m.indices[index + 2] ?? 0;
    connect(first, second);
    connect(first, third);
    connect(second, third);
  }

  const ids = new Uint8Array(vertexCount * 4);
  ids.fill(255);
  const weights = new Float32Array(vertexCount * 4);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const counts = new Map<number, number>();
    const addSurface = (surface: number): void => {
      counts.set(surface, (counts.get(surface) ?? 0) + 1);
    };

    addSurface(vertexSurface(m, vertex, surfaceByPalette));
    const neighbors = adjacency[vertex];
    if (neighbors !== undefined) {
      for (const neighbor of neighbors) {
        addSurface(vertexSurface(m, neighbor, surfaceByPalette));
      }
    }

    const candidates: { id: number; count: number; order: number }[] = [];
    let order = 0;
    for (const [id, count] of counts) {
      candidates.push({ id, count, order });
      order += 1;
    }
    candidates.sort((a, b) => b.count - a.count || a.order - b.order);

    const keptCount = candidates.slice(0, 4).reduce((sum, candidate) => sum + candidate.count, 0);
    const outputOffset = vertex * 4;
    if (keptCount > 0) {
      for (let slot = 0; slot < 4 && slot < candidates.length; slot += 1) {
        const candidate = candidates[slot];
        if (candidate === undefined) {
          continue;
        }
        ids[outputOffset + slot] = candidate.id;
        weights[outputOffset + slot] = candidate.count / keptCount;
      }
    }
  }

  return { ids, weights };
}