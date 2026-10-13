/**
 * Pure TypeScript Quake PAK archive reader (id Tech 2 "PACK" files, the format
 * LibreQuake ships as id1/pak0.pak and pak1.pak). No I/O: the caller passes the bytes.
 *
 * Layout: 4-byte magic "PACK", int32 directory offset, int32 directory length.
 * The directory is a run of 64-byte entries: 56-byte NUL-padded name, int32 offset, int32 size.
 */

export interface PakEntry {
  /** The path as stored in the archive, e.g. "progs/dog.mdl". */
  readonly name: string;
  readonly offset: number;
  readonly size: number;
}

export interface PakArchive {
  readonly entries: readonly PakEntry[];
  /** Keyed by the lower-cased path, because Quake paths are case-insensitive. */
  readonly entryMap: ReadonlyMap<string, PakEntry>;
  readonly buffer: ArrayBuffer;
}

const PAK_MAGIC = 'PACK';
const PAK_ENTRY_BYTES = 64;
const PAK_NAME_BYTES = 56;

/** Parses a PAK archive. Throws on a bad magic, a truncated directory or an entry past the end of the file. */
export function parsePak(buffer: ArrayBuffer): PakArchive {
  const view = new DataView(buffer);
  if (view.byteLength < 12) {
    throw new Error('Buffer too small to be a Quake PAK archive');
  }
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (magic !== PAK_MAGIC) {
    throw new Error(`Invalid PAK magic header: ${magic}`);
  }

  const dirOffset = view.getInt32(4, true);
  const dirLength = view.getInt32(8, true);
  if (dirOffset < 0 || dirLength < 0 || dirLength % PAK_ENTRY_BYTES !== 0) {
    throw new Error('Malformed PAK directory location');
  }
  if (dirOffset + dirLength > view.byteLength) {
    throw new Error('PAK directory runs past the end of the file');
  }

  const count = dirLength / PAK_ENTRY_BYTES;
  const entries: PakEntry[] = [];
  const entryMap = new Map<string, PakEntry>();

  for (let i = 0; i < count; i++) {
    const pos = dirOffset + i * PAK_ENTRY_BYTES;
    let name = '';
    for (let c = 0; c < PAK_NAME_BYTES; c++) {
      const code = view.getUint8(pos + c);
      if (code === 0) break;
      name += String.fromCharCode(code);
    }
    const offset = view.getInt32(pos + PAK_NAME_BYTES, true);
    const size = view.getInt32(pos + PAK_NAME_BYTES + 4, true);
    if (offset < 0 || size < 0 || offset + size > view.byteLength) {
      throw new Error(`PAK entry "${name}" runs past the end of the file`);
    }
    const entry: PakEntry = { name, offset, size };
    entries.push(entry);
    const key = name.toLowerCase();
    if (!entryMap.has(key)) {
      entryMap.set(key, entry);
    }
  }

  return { entries: Object.freeze(entries), entryMap, buffer };
}

/** Lists the entry paths, optionally only those under a folder prefix such as "progs/". */
export function listPakFiles(pak: PakArchive, prefix = ''): string[] {
  const lower = prefix.toLowerCase();
  return pak.entries
    .filter((e) => e.name.toLowerCase().startsWith(lower))
    .map((e) => e.name);
}

/** Returns a view of an entry's bytes (no copy), or undefined when the archive has no such path. */
export function readPakEntry(pak: PakArchive, name: string): Uint8Array | undefined {
  const entry = pak.entryMap.get(name.toLowerCase());
  if (!entry) return undefined;
  return new Uint8Array(pak.buffer, entry.offset, entry.size);
}
