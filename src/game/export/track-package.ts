/**
 * IF-EXPORT: Portable .hmt track package format carrying track layout and assets.
 */

import type { TrackDocV2 } from '../track-storage-migrate';
import type { AssetRecord } from '../assets/model-import';

export interface HmtPackage {
  format: 'hmt';
  version: 2;
  createdAt: string;
  track: TrackDocV2;
  assets: {
    record: AssetRecord;
    blobBase64?: string;
  }[];
}

export function createHmtPackage(
  track: TrackDocV2,
  assets: { record: AssetRecord; blobBase64?: string }[] = [],
): HmtPackage {
  return {
    format: 'hmt',
    version: 2,
    createdAt: new Date().toISOString(),
    track,
    assets,
  };
}

export function parseHmtPackage(jsonStr: string): { ok: true; pkg: HmtPackage } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || parsed.format !== 'hmt' || parsed.version !== 2 || !parsed.track) {
      return { ok: false, error: 'Invalid .hmt package format' };
    }
    return { ok: true, pkg: parsed };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Corrupt JSON' };
  }
}
