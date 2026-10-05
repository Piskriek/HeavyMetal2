import type { PresetBundle } from '@hm/contracts';
import { decodeIslandFile, encodeIslandFile, islandFileName } from './island-file';
import { createIslandWithMap, islands, readBundle } from './island-store';
import { bigStore } from '../storage/big-store';

/** Save an island to a `.setmix` file (the browser's download). Resolves to the sentence to show. */
export async function exportIsland(id: string): Promise<string> {
  const meta = islands().get(id);
  if (!meta) return 'That island is gone.';
  try {
    await bigStore().flush();
    const json = readBundle(id);
    const bytes = await encodeIslandFile(meta.name, meta.template ?? 'blank-island', json ? (JSON.parse(json) as PresetBundle) : null);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = islandFileName(meta.name);
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    return `Exported ${meta.name} to ${a.download}`;
  } catch {
    return `${meta.name} could not be exported. Try again.`;
  }
}

/** Make a new island from a `.setmix` file. Resolves to the sentence to show. */
export async function importIsland(file: File): Promise<string> {
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { return 'That file could not be read.'; }
  const { file: island, error } = await decodeIslandFile(bytes);
  if (!island) return error ?? 'That file could not be read.';
  const made = createIslandWithMap(island.name, island.template, island.bundle ? JSON.stringify(island.bundle) : null);
  if (made.error) return made.error;
  return `Imported ${(made.id ? islands().get(made.id)?.name : null) ?? island.name}. It is in Your islands.`;
}
