/**
// ============================================================================
// File: apps/web/studio-server/scene-layout-schema.ts
// Schema validation for Scene layouts write-back (POL-88).
// Checks:
// - Object of layouts or array of layouts.
// - Layout name must be a non-empty string.
// - Items must be an array of valid SceneItems.
// - Each item id must be unique within the layout.
// - Each item assetId must exist in the knownIds set (from registry.json).
// - Each transform t must have valid offset [x, y, z], yaw, and positive scale.
// ============================================================================
 */

export interface SceneTransform {
  readonly offset: [number, number, number];
  readonly yaw: number;
  readonly scale: number;
}

export interface SceneItemData {
  readonly id: string;
  readonly assetId: string;
  readonly t: SceneTransform;
}

export interface SceneLayoutDoc {
  readonly name: string;
  readonly items: readonly SceneItemData[];
}

export type SceneLayoutCheck =
  | { readonly ok: true; readonly value: Record<string, SceneLayoutDoc> }
  | { readonly ok: false; readonly why: string };

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const isPlain = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function checkTransform(raw: unknown, label: string): { ok: true; value: SceneTransform } | { ok: false; why: string } {
  if (!isPlain(raw)) return { ok: false, why: `${label}: transform "t" must be an object` };
  const off = raw.offset;
  if (!Array.isArray(off) || off.length !== 3 || !finite(off[0]) || !finite(off[1]) || !finite(off[2])) {
    return { ok: false, why: `${label}: transform offset must be a 3-number tuple [x, y, z]` };
  }
  const yaw = raw.yaw;
  if (!finite(yaw)) {
    return { ok: false, why: `${label}: transform yaw must be a finite number` };
  }
  const scale = raw.scale;
  if (!finite(scale) || scale <= 0) {
    return { ok: false, why: `${label}: transform scale must be a positive finite number` };
  }
  return {
    ok: true,
    value: {
      offset: [round3(off[0]), round3(off[1]), round3(off[2])],
      yaw: round3(yaw),
      scale: round3(scale),
    },
  };
}

export function checkSceneLayouts(data: unknown, knownIds: ReadonlySet<string>): SceneLayoutCheck {
  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (isPlain(data)) {
    list = Object.values(data);
  } else {
    return { ok: false, why: 'the file must be a JSON object or array of scene layouts' };
  }

  const out: Record<string, SceneLayoutDoc> = {};

  for (let idx = 0; idx < list.length; idx++) {
    const raw = list[idx];
    if (!isPlain(raw)) {
      return { ok: false, why: `layouts[${idx}]: expected a layout object` };
    }
    const name = raw.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { ok: false, why: `layouts[${idx}]: name must be a non-empty string` };
    }
    const layoutName = name.trim();
    if (out[layoutName]) {
      return { ok: false, why: `duplicate layout name "${layoutName}"` };
    }

    const rawItems = raw.items;
    if (!Array.isArray(rawItems)) {
      return { ok: false, why: `layout "${layoutName}": items must be an array` };
    }

    const seenIds = new Set<string>();
    const items: SceneItemData[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const it = rawItems[i];
      if (!isPlain(it)) {
        return { ok: false, why: `layout "${layoutName}" items[${i}]: expected an object` };
      }
      const id = it.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
        return { ok: false, why: `layout "${layoutName}" items[${i}]: id must be a non-empty string` };
      }
      const itemId = id.trim();
      if (seenIds.has(itemId)) {
        return { ok: false, why: `layout "${layoutName}": duplicate item id "${itemId}"` };
      }
      seenIds.add(itemId);

      const assetId = it.assetId;
      if (typeof assetId !== 'string' || assetId.trim().length === 0) {
        return { ok: false, why: `layout "${layoutName}" items[${i}]: assetId must be a non-empty string` };
      }
      const itemAssetId = assetId.trim();
      if (!knownIds.has(itemAssetId)) {
        return { ok: false, why: `layout "${layoutName}" items[${i}]: unknown asset "${itemAssetId}"` };
      }

      const tCheck = checkTransform(it.t, `layout "${layoutName}" items[${i}]`);
      if (!tCheck.ok) {
        return tCheck;
      }

      items.push({
        id: itemId,
        assetId: itemAssetId,
        t: tCheck.value,
      });
    }

    out[layoutName] = {
      name: layoutName,
      items,
    };
  }

  // Canonical: sorted layout names
  const canonical: Record<string, SceneLayoutDoc> = {};
  for (const k of Object.keys(out).sort()) {
    canonical[k] = out[k]!;
  }

  return { ok: true, value: canonical };
}
