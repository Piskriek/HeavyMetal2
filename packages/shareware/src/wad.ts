/**
 * Pure TypeScript DOOM WAD lump and asset parser.
 * Supports IWAD & PWAD parsing, PLAYPAL palette extraction,
 * patch/sprite rasterization into RGBA buffers, and 8-bit PCM sound decoding.
 */

export interface LumpEntry {
  readonly name: string;
  readonly offset: number;
  readonly size: number;
}

export interface WadArchive {
  readonly type: 'IWAD' | 'PWAD';
  readonly numLumps: number;
  readonly lumps: readonly LumpEntry[];
  readonly lumpMap: ReadonlyMap<string, LumpEntry>;
  readonly buffer: ArrayBuffer;
}

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly leftOffset: number;
  readonly topOffset: number;
  readonly data: Uint8Array;
}

export interface PcmSound {
  readonly format: number;
  readonly sampleRate: number;
  readonly samples: number;
  readonly data: Uint8Array;
}

/**
 * Parses a binary WAD ArrayBuffer into a WadArchive structure.
 */
export function parseWad(buffer: ArrayBuffer): WadArchive {
  const view = new DataView(buffer);
  if (view.byteLength < 12) {
    throw new Error('Buffer too small to be a valid WAD archive');
  }

  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (magic !== 'IWAD' && magic !== 'PWAD') {
    throw new Error(`Invalid WAD magic header: ${magic}`);
  }

  const numLumps = view.getInt32(4, true);
  const infoTableOfs = view.getInt32(8, true);

  if (numLumps < 0 || infoTableOfs + numLumps * 16 > view.byteLength) {
    throw new Error('Malformed WAD directory table');
  }

  const lumps: LumpEntry[] = [];
  const lumpMap = new Map<string, LumpEntry>();

  for (let i = 0; i < numLumps; i++) {
    const pos = infoTableOfs + i * 16;
    const offset = view.getInt32(pos, true);
    const size = view.getInt32(pos + 4, true);

    let name = '';
    for (let c = 0; c < 8; c++) {
      const code = view.getUint8(pos + 8 + c);
      if (code === 0) break;
      name += String.fromCharCode(code);
    }
    name = name.toUpperCase().trim();

    const entry: LumpEntry = { name, offset, size };
    lumps.push(entry);
    if (!lumpMap.has(name)) {
      lumpMap.set(name, entry);
    }
  }

  return {
    type: magic,
    numLumps,
    lumps: Object.freeze(lumps),
    lumpMap,
    buffer,
  };
}

/**
 * Extracts a 256-color RGB palette from the PLAYPAL lump.
 * Palette 0 is the default game palette (768 bytes: R, G, B * 256).
 */
export function extractPlaypal(wad: WadArchive, paletteIndex = 0): Uint8Array {
  const lump = wad.lumpMap.get('PLAYPAL');
  if (!lump) {
    throw new Error('WAD does not contain a PLAYPAL lump');
  }

  const paletteOffset = lump.offset + paletteIndex * 768;
  if (paletteOffset + 768 > wad.buffer.byteLength) {
    throw new Error(`Palette index ${paletteIndex} is out of bounds in PLAYPAL`);
  }

  return new Uint8Array(wad.buffer, paletteOffset, 768);
}

/**
 * Default fallback VGA/DOOM palette if PLAYPAL is absent.
 */
export function createDefaultPalette(): Uint8Array {
  const pal = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    pal[i * 3] = i;
    pal[i * 3 + 1] = i;
    pal[i * 3 + 2] = i;
  }
  return pal;
}

/**
 * Decodes a picture patch/sprite lump into an RGBA pixel buffer.
 */
export function extractPatch(
  wad: WadArchive,
  lumpName: string,
  palette?: Uint8Array
): RgbaImage {
  const lump = wad.lumpMap.get(lumpName.toUpperCase());
  if (!lump) {
    throw new Error(`Lump not found in WAD: ${lumpName}`);
  }

  const pal = palette || extractPlaypal(wad, 0);
  const view = new DataView(wad.buffer, lump.offset, lump.size);

  if (view.byteLength < 8) {
    throw new Error(`Patch lump ${lumpName} too small for header`);
  }

  const width = view.getUint16(0, true);
  const height = view.getUint16(2, true);
  const leftOffset = view.getInt16(4, true);
  const topOffset = view.getInt16(6, true);

  const rgba = new Uint8Array(width * height * 4);

  for (let x = 0; x < width; x++) {
    const colOfs = view.getUint32(8 + x * 4, true);
    let p = colOfs;

    while (p < view.byteLength) {
      const topDelta = view.getUint8(p++);
      if (topDelta === 0xff) break;

      const len = view.getUint8(p++);
      p++; // padding byte

      for (let i = 0; i < len; i++) {
        if (p >= view.byteLength) break;
        const colorIdx = view.getUint8(p++);
        const y = topDelta + i;

        if (y < height) {
          const dest = (y * width + x) * 4;
          rgba[dest] = pal[colorIdx * 3] ?? 0;
          rgba[dest + 1] = pal[colorIdx * 3 + 1] ?? 0;
          rgba[dest + 2] = pal[colorIdx * 3 + 2] ?? 0;
          rgba[dest + 3] = 255;
        }
      }

      p++; // padding byte
    }
  }

  return {
    width,
    height,
    leftOffset,
    topOffset,
    data: rgba,
  };
}

/**
 * Extracts and decodes an 8-bit PCM sound lump (e.g. DSPISTOL, DSSHOTGN).
 */
export function extractSound(wad: WadArchive, lumpName: string): PcmSound {
  const lump = wad.lumpMap.get(lumpName.toUpperCase());
  if (!lump) {
    throw new Error(`Sound lump not found in WAD: ${lumpName}`);
  }

  const view = new DataView(wad.buffer, lump.offset, lump.size);
  if (view.byteLength < 8) {
    throw new Error(`Sound lump ${lumpName} too small for header`);
  }

  const format = view.getUint16(0, true);
  const sampleRate = view.getUint16(2, true);
  const samples = view.getUint32(4, true);

  const data = new Uint8Array(wad.buffer, lump.offset + 8 + 16, Math.max(0, samples - 32));

  return {
    format,
    sampleRate,
    samples: data.length,
    data,
  };
}

/**
 * Finds all sprite lumps matching standard DOOM monster or weapon prefixes.
 */
export function findSpriteLumps(wad: WadArchive, prefix: string): string[] {
  const upper = prefix.toUpperCase();
  return wad.lumps
    .filter((l) => l.name.startsWith(upper))
    .map((l) => l.name);
}

/**
 * One sprite lump name, split into its parts. Sprite names are BASE (4 chars), FRAME (1 letter), ROTATION (0 to 8),
 * then an optional second pair: `TROOA2A8` is frame A rotation 2, with rotation 8 drawn as its mirror image.
 * Rotation 0 means one view for every direction (`H0`).
 */
export interface SpriteLumpName {
  readonly base: string;
  readonly frame: string;
  readonly rotation: number;
  readonly frame2?: string;
  readonly rotation2?: number;
}

const SPRITE_NAME = /^([A-Z0-9_]{4})([A-Z[\\\]^_])([0-8])(?:([A-Z[\\\]^_])([0-8]))?$/;

/** Parses a sprite lump name such as `TROOA1` or `SKULA8A2`. Returns undefined for any other name. */
export function parseSpriteLumpName(name: string): SpriteLumpName | undefined {
  const m = SPRITE_NAME.exec(name.toUpperCase());
  if (!m) return undefined;
  const base = m[1]!;
  const frame = m[2]!;
  const rotation = Number(m[3]);
  if (m[4] === undefined) {
    return { base, frame, rotation };
  }
  return { base, frame, rotation, frame2: m[4], rotation2: Number(m[5]) };
}

/** One of the eight views of a frame. `mirrored` means the lump is drawn flipped left to right. */
export interface SpriteView {
  readonly lump: string;
  readonly mirrored: boolean;
}

/**
 * The eight views (rotations 1 to 8, index 0 to 7) of one frame letter of one sprite base.
 * A lump `A2A8` fills slot 2 normally and slot 8 mirrored, so the mirrored views are flagged instead of duplicated.
 * A rotation 0 lump fills every slot. A slot with no lump is undefined (a missing view).
 */
export function spriteViewsForFrame(
  wad: WadArchive,
  base: string,
  frame: string
): (SpriteView | undefined)[] {
  const slots: (SpriteView | undefined)[] = new Array(8).fill(undefined);
  const b = base.toUpperCase();
  const f = frame.toUpperCase();
  for (const lump of wad.lumps) {
    const parsed = parseSpriteLumpName(lump.name);
    if (!parsed || parsed.base !== b) continue;
    if (parsed.rotation === 0) {
      if (parsed.frame === f) {
        for (let i = 0; i < 8; i++) slots[i] ??= { lump: lump.name, mirrored: false };
      }
      continue;
    }
    if (parsed.frame === f) {
      slots[parsed.rotation - 1] ??= { lump: lump.name, mirrored: false };
    }
    if (parsed.frame2 === f && parsed.rotation2 !== undefined && parsed.rotation2 > 0) {
      // the second pair is a mirror of the first when it belongs to the same frame letter and rotation differs
      const mirror = parsed.frame === f && parsed.rotation2 !== parsed.rotation;
      slots[parsed.rotation2 - 1] ??= { lump: lump.name, mirrored: mirror };
    }
  }
  return slots;
}
