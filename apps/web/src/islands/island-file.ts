import type { PresetBundle } from '@hm/contracts';

/**
 * An island as a file (RELEASE_PLAN Milestone 0.5, critique Q7 and Q12): `<name>.setmix`, so a player can keep a copy outside the
 * browser, move an island to another device, or send it to a friend.
 *
 * The file is gzipped JSON: { format: 'setmix-island', version, name, template, bundle }. `bundle` is the island's map (a preset
 * bundle, migrated by the kernel on load like any save), or null for a template island that was never edited (it is rebuilt from
 * its template). Reading never throws: anything wrong comes back as a plain sentence (the fuzzing rule: truncated, huge and
 * garbage files are expected).
 */

export const ISLAND_FILE_FORMAT = 'setmix-island';
export const ISLAND_FILE_VERSION = 1;
/** Bigger than any island we make; a file over this is refused before it is unpacked. */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_NAME = 60;

export interface IslandFile {
  readonly format: typeof ISLAND_FILE_FORMAT;
  readonly version: number;
  readonly name: string;
  readonly template: string;
  readonly bundle: PresetBundle | null;
}

/** A file name from an island name: letters, digits, spaces and dashes, never empty. */
export const islandFileName = (name: string): string => `${name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, MAX_NAME) || 'island'}.setmix`;

/** Check the bundle part: a root that is a scene, and presets that are objects with an id and a kind. */
function bundleProblem(b: unknown): string | null {
  if (b === null) return null;
  if (!b || typeof b !== 'object') return 'its map is missing';
  const x = b as Partial<PresetBundle>;
  if (x.format !== 'hm-bundle' || typeof x.root !== 'string' || !Array.isArray(x.presets) || typeof x.schemaVersions !== 'object' || x.schemaVersions === null) return 'its map is not a SetMix map';
  for (const p of x.presets) if (!p || typeof p !== 'object' || typeof (p as { id?: unknown }).id !== 'string' || typeof (p as { kind?: unknown }).kind !== 'string') return 'its map is damaged';
  if (!x.presets.some((p) => p.id === x.root && p.kind === 'scene')) return 'its map has no island in it';
  return null;
}

/** Check parsed JSON. Returns the file or a plain sentence saying what is wrong. */
export function checkIslandFile(data: unknown): { file: IslandFile | null; error: string | null } {
  const bad = (why: string) => ({ file: null, error: `That is not a SetMix island file: ${why}.` });
  if (!data || typeof data !== 'object') return bad('it holds no island');
  const d = data as Record<string, unknown>;
  if (d['format'] !== ISLAND_FILE_FORMAT) return bad('it is some other kind of file');
  const version = d['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return bad('its version is unreadable');
  if (version > ISLAND_FILE_VERSION) return { file: null, error: 'This island was saved by a newer SetMix. Update the game, then import it again.' };
  const name = typeof d['name'] === 'string' ? d['name'].trim().slice(0, MAX_NAME) : '';
  const template = typeof d['template'] === 'string' ? d['template'] : '';
  if (!template) return bad('it does not say what kind of island it is');
  const problem = bundleProblem(d['bundle'] ?? null);
  if (problem) return bad(problem);
  return { file: { format: ISLAND_FILE_FORMAT, version, name: name || 'Imported island', template, bundle: (d['bundle'] ?? null) as PresetBundle | null }, error: null };
}

/** The file's JSON text (before gzip). */
export const islandFileText = (name: string, template: string, bundle: PresetBundle | null): string =>
  JSON.stringify({ format: ISLAND_FILE_FORMAT, version: ISLAND_FILE_VERSION, name, template, bundle } satisfies IslandFile);

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}

/** The bytes of a `.setmix` file. */
export async function encodeIslandFile(name: string, template: string, bundle: PresetBundle | null): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(islandFileText(name, template, bundle)), new CompressionStream('gzip'));
}

/** Read a `.setmix` file (gzipped, or plain JSON for hand-made ones). Never throws. */
export async function decodeIslandFile(bytes: Uint8Array): Promise<{ file: IslandFile | null; error: string | null }> {
  if (bytes.length === 0) return { file: null, error: 'That file is empty.' };
  if (bytes.length > MAX_FILE_BYTES) return { file: null, error: 'That file is too big to be an island.' };
  let text: string;
  try {
    const gz = bytes[0] === 0x1f && bytes[1] === 0x8b;
    const raw = gz ? await pipe(bytes, new DecompressionStream('gzip')) : bytes;
    if (raw.length > MAX_FILE_BYTES * 4) return { file: null, error: 'That file is too big to be an island.' };
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    return { file: null, error: 'That file is damaged or cut short. Export the island again and use the new file.' };
  }
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { file: null, error: 'That file is damaged or cut short. Export the island again and use the new file.' }; }
  return checkIslandFile(data);
}
