// src/index.ts
export type Vec3 = [number, number, number];
export interface PaletteEntry { name: string; color: Vec3; roughness: number; metalness: number; emissive: number; alpha: number }
export interface VoxelModel { id: string; name: string; size: Vec3; pivot: Vec3; palette: PaletteEntry[]; cells: Uint8Array }
export interface VoxResult { models: VoxelModel[]; offsets: Vec3[]; errors: string[]; warnings: string[] }

class Reader {
  ptr = 0;
  view: DataView;
  decoder: TextDecoder;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.decoder = new TextDecoder();
  }

  readU8() {
    if (this.ptr >= this.view.byteLength) return undefined;
    return this.view.getUint8(this.ptr++);
  }

  readI32() {
    if (this.ptr + 4 > this.view.byteLength) return undefined;
    const v = this.view.getInt32(this.ptr, true);
    this.ptr += 4;
    return v;
  }

  readString() {
    const len = this.readI32();
    if (len === undefined || this.ptr + len > this.view.byteLength) return undefined;
    const slice = new Uint8Array(this.view.buffer, this.view.byteOffset + this.ptr, len);
    this.ptr += len;
    return this.decoder.decode(slice);
  }

  readDict() {
    const pairCount = this.readI32();
    if (pairCount === undefined) return undefined;
    const dict: Record<string, string> = {};
    for (let i = 0; i < pairCount; i++) {
      const k = this.readString();
      const v = this.readString();
      if (k === undefined || v === undefined) return undefined;
      dict[k] = v;
    }
    return dict;
  }
}

export function readVox(bytes: Uint8Array, name = 'vox'): VoxResult {
  const res: VoxResult = { models: [], offsets: [], errors: [], warnings: [] };
  if (bytes.length > 32 * 1024 * 1024) {
    res.errors.push('File too large');
    return res;
  }

  const r = new Reader(bytes);
  const magicStr = 'VOX ';
  for (let i = 0; i < 4; i++) {
    const b = r.readU8();
    if (b === undefined || b !== magicStr.charCodeAt(i)) {
      res.errors.push('Not a VOX file');
      return res;
    }
  }

  const version = r.readI32();
  if (version === undefined) {
    res.errors.push('Missing version');
    return res;
  }

  const sceneNodes: Record<number, { translation: Vec3; childId: number }> = {};
  const materials: Record<number, Record<string, string>> = {};
  const foundModels: { size: Vec3; cells: Uint8Array; rgba: number[] | null }[] = [];
  const foundRgbas: number[][] = [];

  const parseChunks = (contentSize: number, childrenSize: number): boolean => {
    const startPtr = r.ptr;
    while (r.ptr < startPtr + contentSize + childrenSize) {
      const idB = [];
      for (let i = 0; i < 4; i++) {
        const b = r.readU8();
        if (b === undefined) return false;
        idB.push(b);
      }
      const id = r.decoder.decode(new Uint8Array(idB));
      const n = r.readI32();
      const m = r.readI32();
      if (n === undefined || m === undefined || n < 0 || m < 0 || r.ptr + n + m > bytes.length) return false;

      const chunkStart = r.ptr;
      if (id === 'MAIN') {
        if (!parseChunks(n, m)) return false;
      } else if (id === 'SIZE') {
        const x = r.readI32();
        const y = r.readI32();
        const z = r.readI32();
        if (x === undefined || y === undefined || z === undefined) return false;
        foundModels.push({ size: [x, y, z], cells: new Uint8Array(0), rgba: null });
        r.ptr = chunkStart + n + m;
      } else if (id === 'XYZI') {
        const count = r.readI32();
        if (count === undefined || count < 0 || count > 16 * 1024 * 1024) return false;
        if (foundModels.length > 0) {
          const model = foundModels[foundModels.length - 1];
          const cells = new Uint8Array(model.size[0] * model.size[1] * model.size[2]);
          for (let i = 0; i < count; i++) {
            const vx = r.readI32();
            const vy = r.readI32();
            const vz = r.readI32();
            const col = r.readI32();
            if (vx === undefined || vy === undefined || vz === undefined || col === undefined) return false;
            if (vx >= 0 && vx < model.size[0] && vy >= 0 && vy < model.size[1] && vz >= 0 && vz < model.size[2]) {
              cells[vx + model.size[0] * (vy + model.size[1] * vz)] = col & 255;
            }
          }
          model.cells = cells;
        }
        r.ptr = chunkStart + n + m;
      } else if (id === 'RGBA') {
        const rgba = [];
        for (let i = 0; i < 256 * 4; i++) {
          const b = r.readU8();
          if (b === undefined) return false;
          rgba.push(b);
        }
        foundRgbas.push(rgba);
        r.ptr = chunkStart + n + m;
      } else if (id === 'MATL') {
        const mid = r.readI32();
        const dict = r.readDict();
        if (mid === undefined || dict === undefined) return false;
        materials[mid] = dict;
        r.ptr = chunkStart + n + m;
      } else if (id === 'nTRN') {
        const nodeId = r.readI32();
        const dict = r.readDict();
        const childId = r.readI32();
        const resvd = r.readI32();
        const layerId = r.readI32();
        const frameCount = r.readI32();
        if (nodeId === undefined || dict === undefined || childId === undefined || resvd === undefined || layerId === undefined || frameCount === undefined) return false;
        let translation: Vec3 = [0, 0, 0];
        const tStr = dict['_t'];
        if (tStr) {
          const parts = tStr.trim().split(/\s+/).map(Number);
          if (parts.length >= 3) translation = [parts[0], parts[1], parts[2]];
        }
        sceneNodes[nodeId] = { translation, childId };
        for (let i = 0; i < frameCount; i++) {
          if (r.readDict() === undefined) return false;
        }
        r.ptr = chunkStart + n + m;
      } else {
        r.ptr = chunkStart + n + m;
      }
    }
    return true;
  };

  const mainIdB = [];
  for (let i = 0; i < 4; i++) {
    const b = r.readU8();
    if (b === undefined) { res.errors.push('EOF'); return res; }
    mainIdB.push(b);
  }
  if (r.decoder.decode(new Uint8Array(mainIdB)) !== 'MAIN') {
    res.errors.push('No MAIN');
    return res;
  }
  const n = r.readI32();
  const m = r.readI32();
  if (n === undefined || m === undefined) {
    res.errors.push('Invalid MAIN');
    return res;
  }
  if (!parseChunks(n, m)) {
    res.errors.push('Chunk error');
    return res;
  }

  const nodeIds = Object.keys(sceneNodes).map(Number);
  for (let i = 0; i < foundModels.length; i++) {
    const nodeId = nodeIds[i];
    const node = nodeId !== undefined ? sceneNodes[nodeId] : undefined;
    res.offsets.push(node ? [node.translation[0], node.translation[2], node.translation[1]] : [0, 0, 0]);
  }

  for (let i = 0; i < foundModels.length; i++) {
    const m = foundModels[i];
    let rgba = foundRgbas[i] || foundRgbas[0] || [];
    if (rgba.length === 0) {
      res.warnings.push('default palette');
      rgba = [];
      for (let j = 0; j < 256; j++) {
        const grey = ((j % 16) / 15) * 255;
        rgba.push(grey, grey, grey, 255);
      }
    }

    const palette: PaletteEntry[] = [];
    const colorMap = new Map<number, number>();
    for (let j = 0; j < m.cells.length; j++) {
      const colIdx = m.cells[j];
      if (colIdx === 0) continue;
      if (!colorMap.has(colIdx)) {
        const newIdx = palette.length + 1;
        colorMap.set(colIdx, newIdx);
        const r_ = rgba[(colIdx - 1) * 4] / 255;
        const g_ = rgba[(colIdx - 1) * 4 + 1] / 255;
        const b_ = rgba[(colIdx - 1) * 4 + 2] / 255;
        const a_ = rgba[(colIdx - 1) * 4 + 3] / 255;
        let roughness = 0.8, metalness = 0, emissive = 0, alpha = a_;
        const mat = materials[colIdx];
        if (mat) {
          if (mat['_rough']) roughness = parseFloat(mat['_rough']);
          if (mat['_metal']) metalness = parseFloat(mat['_metal']);
          if (mat['_emit']) emissive = parseFloat(mat['_emit']);
          if (mat['_type'] === '_glass') alpha = mat['_trans'] ? parseFloat(mat['_trans']) : 0.5;
        }
        palette.push({ name: `Colour ${colIdx}`, color: [r_, g_, b_], roughness, metalness, emissive, alpha });
      }
    }

    const finalCells = new Uint8Array(m.cells.length);
    for (let j = 0; j < m.cells.length; j++) {
      const colIdx = m.cells[j];
      if (colIdx !== 0) {
        const mapped = colorMap.get(colIdx);
        if (mapped !== undefined) finalCells[j] = mapped;
      }
    }

    const gameSize: Vec3 = [m.size[0], m.size[2], m.size[1]];
    res.models.push({
      id: `${name}-${i}`,
      name: `${name}-${i}`,
      size: gameSize,
      pivot: [Math.floor(gameSize[0] / 2), 0, Math.floor(gameSize[2] / 2)],
      palette,
      cells: finalCells
    });
  }

  return res;
}

export function writeVox(model: VoxelModel): Uint8Array {
  const size = [model.size[0], model.size[2], model.size[1]];
  const rgba = new Uint8Array(1024);
  for (let i = 0; i < model.palette.length; i++) {
    const p = model.palette[i];
    rgba[i * 4] = Math.round(p.color[0] * 255);
    rgba[i * 4 + 1] = Math.round(p.color[1] * 255);
    rgba[i * 4 + 2] = Math.round(p.color[2] * 255);
    rgba[i * 4 + 3] = Math.round(p.alpha * 255);
  }

  const voxels = [];
  for (let z = 0; z < size[2]; z++) {
    for (let y = 0; y < size[1]; y++) {
      for (let x = 0; x < size[0]; x++) {
        const val = model.cells[x + size[0] * (y + size[1] * z)];
        if (val > 0) voxels.push(x, y, z, val);
      }
    }
  }

  const sizeChunk = new Uint8Array(12);
  const dv = new DataView(sizeChunk.buffer);
  dv.setInt32(0, size[0], true);
  dv.setInt32(4, size[1], true);
  dv.setInt32(8, size[2], true);

  const xyziData = new Uint8Array(4 + voxels.length * 4);
  const xyziDv = new DataView(xyziData.buffer);
  xyziDv.setInt32(0, voxels.length, true);
  for (let i = 0; i < voxels.length; i++) {
    xyziDv.setInt32(4 + i * 4, voxels[i], true);
  }

  const makeChunk = (id: string, content: Uint8Array, children: Uint8Array = new Uint8Array(0)) => {
    const res = new Uint8Array(12 + content.length + children.length);
    const resDv = new DataView(res.buffer);
    for (let i = 0; i < 4; i++) res[i] = id.charCodeAt(i);
    resDv.setInt32(4, content.length, true);
    resDv.setInt32(8, children.length, true);
    res.set(content, 12);
    res.set(children, 12 + content.length);
    return res;
  };

  const rgbaChunk = makeChunk('RGBA', rgba);
  const sizeChunkFull = makeChunk('SIZE', sizeChunk);
  const xyziChunk = makeChunk('XYZI', xyziData);
  const mainChildren = new Uint8Array(sizeChunkFull.length + xyziChunk.length + rgbaChunk.length);
  mainChildren.set(sizeChunkFull);
  mainChildren.set(xyziChunk, sizeChunkFull.length);
  mainChildren.set(rgbaChunk, sizeChunkFull.length + xyziChunk.length);
  const mainChunk = makeChunk('MAIN', new Uint8Array(0), mainChildren);

  const header = new Uint8Array(8);
  const headerDv = new DataView(header.buffer);
  for (let i = 0; i < 4; i++) header[i] = 'VOX '.charCodeAt(i);
  headerDv.setInt32(4, 150, true);

  const final = new Uint8Array(header.length + mainChunk.length);
  final.set(header);
  final.set(mainChunk, header.length);
  return final;
}

export function fitTo(model: VoxelModel, max: number): VoxelModel {
  let current = model;
  while (current.size[0] > max || current.size[1] > max || current.size[2] > max) {
    const nextSize: Vec3 = [Math.ceil(current.size[0] / 2), Math.ceil(current.size[1] / 2), Math.ceil(current.size[2] / 2)];
    const nextCells = new Uint8Array(nextSize[0] * nextSize[1] * nextSize[2]);
    for (let z = 0; z < nextSize[2]; z++) {
      for (let y = 0; y < nextSize[1]; y++) {
        for (let x = 0; x < nextSize[0]; x++) {
          const counts = new Map<number, number>();
          let totalNonEmpty = 0;
          for (let dz = 0; dz < 2; dz++) {
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const vx = x * 2 + dx;
                const vy = y * 2 + dy;
                const vz = z * 2 + dz;
                if (vx < current.size[0] && vy < current.size[1] && vz < current.size[2]) {
                  const val = current.cells[vx + current.size[0] * (vy + current.size[1] * vz)];
                  if (val > 0) {
                    counts.set(val, (counts.get(val) || 0) + 1);
                    totalNonEmpty++;
                  }
                }
              }
            }
          }
          if (totalNonEmpty > 0) {
            let bestVal = 0, maxCount = -1;
            for (const [val, count] of counts) {
              if (count > maxCount) { maxCount = count; bestVal = val; }
            }
            nextCells[x + nextSize[0] * (y + nextSize[1] * z)] = bestVal;
          }
        }
      }
    }
    current = { ...current, size: nextSize, cells: nextCells };
  }
  return current;
}