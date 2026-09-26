import { useEffect, useState } from 'react';
import { AVATAR_CATALOG } from '../../game/meta/goblin-dna';
import type { AvatarLayerId } from '../../game/meta/interfaces';
import { KEYED_PARTS, PAINTED_PARTS } from '../../game/meta/painted-parts';

/**
 * Which painted parts have no PNG on the server yet. The catalog lists painted items ahead of their
 * art (the ART-B1/B2 batches add the files), and a missing file draws as an empty hole, so the
 * creator shows those tiles as "art coming" and randomize skips them.
 */
const probes = new Map<string, Promise<boolean>>();
function probe(url: string): Promise<boolean> {
  let p = probes.get(url);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    probes.set(url, p);
  }
  return p;
}

/** Catalog item names (`painted:<id>`) whose art is missing; empty until the checks finish. */
export function useMissingPaintedArt(): ReadonlySet<string> {
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let live = true;
    void Promise.all(PAINTED_PARTS.map(async (p) => {
      const file = p.fixedFile ?? KEYED_PARTS[p.id];
      return file && (await probe(file.file)) ? null : `painted:${p.id}`;
    })).then((names) => {
      if (live) setMissing(new Set(names.filter((n): n is string => !!n)));
    });
    return () => { live = false; };
  }, []);
  return missing;
}

/** Moves any layer that landed on a missing painted item onto an available item of the same layer. */
export function avoidMissing(layers: Readonly<Record<AvatarLayerId, number>>, missing: ReadonlySet<string>): Record<AvatarLayerId, number> {
  if (!missing.size) return layers;
  const out = { ...layers };
  for (const l of Object.keys(out) as AvatarLayerId[]) {
    const items = AVATAR_CATALOG[l];
    if (!missing.has(items[out[l]])) continue;
    const ok = items.map((_, i) => i).filter((i) => !missing.has(items[i]));
    if (ok.length) out[l] = ok[out[l] % ok.length];
  }
  return out;
}
