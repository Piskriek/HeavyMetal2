// ============================================================================
// File: apps/web/src/studio/flag-and-socket-schema.ts
// Pure schema validators for:
// 1. One-click fix flags on assets.json (fix: mirror-z, fix: plain-back, reach: 3, hold, lumOk)
// 2. Surface-luminance gate badge (low >= 0.18, low/high >= 0.85)
// 3. Raycast-snapped sockets in sockets.json (hopper, exhaust, cable, mount)
// ============================================================================

export const ALLOWED_FIX_KINDS = ['mirror-z', 'plain-back'] as const;
export type FixKind = (typeof ALLOWED_FIX_KINDS)[number];

export const ALLOWED_SOCKET_TYPES = ['hopper', 'exhaust', 'cable', 'mount'] as const;
export type SocketType = (typeof ALLOWED_SOCKET_TYPES)[number];

export const LUM_FLOOR = 0.18;
export const LUM_RATIO = 0.85;

export interface AssetFixPatch {
  readonly fix?: readonly FixKind[];
  readonly reach?: number;
  readonly hold?: boolean;
  readonly lumOk?: boolean;
}

export interface SnappedSocket {
  readonly id: string;
  readonly name: string;
  readonly type: SocketType;
  readonly kind?: SocketType;
  readonly at: readonly [number, number, number];
  readonly pos?: readonly [number, number, number];
  readonly normal?: readonly [number, number, number];
}

export type SnappedSocketsDoc = Readonly<Record<string, readonly SnappedSocket[]>>;

export interface LuminanceGateResult {
  readonly low: number;
  readonly high: number;
  readonly ratio: number;
  readonly ok: boolean;
  readonly badge: 'PASS' | 'FAIL';
  readonly why: string;
}

export type SchemaCheckResult<T> =
  | { readonly ok: true; readonly value: T; readonly why?: undefined }
  | { readonly ok: false; readonly value?: undefined; readonly why: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isVec3(v: unknown): v is readonly [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

/**
 * Validates a patch of asset fix flags intended for docs/runworld/assets.json.
 */
export function checkFixFlags(
  data: unknown,
  validAssetIds?: ReadonlySet<string>,
): SchemaCheckResult<Record<string, AssetFixPatch>> {
  if (!isObject(data)) return { ok: false, why: 'fix flags must be an object keyed by asset id' };

  const out: Record<string, AssetFixPatch> = {};
  for (const [id, patch] of Object.entries(data)) {
    if (!id.trim()) return { ok: false, why: 'asset id cannot be empty' };
    if (validAssetIds && !validAssetIds.has(id)) {
      return { ok: false, why: `unknown asset id "${id}"` };
    }
    if (!isObject(patch)) {
      return { ok: false, why: `patch for "${id}" must be an object` };
    }

    const item: Record<string, unknown> = {};

    if ('fix' in patch && patch.fix !== undefined) {
      if (!Array.isArray(patch.fix)) {
        return { ok: false, why: `fix for "${id}" must be an array of strings` };
      }
      const kinds: FixKind[] = [];
      for (const raw of patch.fix) {
        if (typeof raw !== 'string') {
          return { ok: false, why: `fix for "${id}" entries must be strings` };
        }
        let f = raw.trim();
        if (f.startsWith('fix:')) {
          f = f.slice(4).trim();
        }
        if (f.startsWith('reach:')) {
          const reachVal = parseInt(f.slice(6).trim(), 10);
          if (Number.isInteger(reachVal) && reachVal >= 1 && reachVal <= 20) {
            item.reach = reachVal;
            continue;
          }
        }
        if (!ALLOWED_FIX_KINDS.includes(f as FixKind)) {
          return { ok: false, why: `invalid fix kind "${raw}" for "${id}" (allowed: ${ALLOWED_FIX_KINDS.join(', ')})` };
        }
        kinds.push(f as FixKind);
      }
      item.fix = [...new Set(kinds)];
    }

    if ('reach' in patch && patch.reach !== undefined) {
      if (typeof patch.reach !== 'number' || !Number.isInteger(patch.reach) || patch.reach < 1 || patch.reach > 20) {
        return { ok: false, why: `reach for "${id}" must be an integer between 1 and 20` };
      }
      item.reach = patch.reach;
    }

    if ('hold' in patch && patch.hold !== undefined) {
      if (typeof patch.hold !== 'boolean') {
        return { ok: false, why: `hold for "${id}" must be a boolean` };
      }
      item.hold = patch.hold;
    }

    if ('lumOk' in patch && patch.lumOk !== undefined) {
      if (typeof patch.lumOk !== 'boolean') {
        return { ok: false, why: `lumOk for "${id}" must be a boolean` };
      }
      item.lumOk = patch.lumOk;
    }

    const keys = Object.keys(patch);
    const validKeys = new Set(['fix', 'reach', 'hold', 'lumOk']);
    for (const k of keys) {
      if (!validKeys.has(k)) {
        return { ok: false, why: `unknown flag property "${k}" on asset "${id}"` };
      }
    }

    out[id] = item as AssetFixPatch;
  }

  return { ok: true, value: out };
}

/**
 * Evaluates the surface-luminance gate according to Argo's fifth acceptance check:
 * low >= 0.18 floor and low/high >= 0.85 ratio.
 */
export function evaluateLuminanceGate(low: number, high: number): LuminanceGateResult {
  const safeLow = Number.isFinite(low) ? Math.max(0, low) : 0;
  const safeHigh = Number.isFinite(high) && high > 0 ? high : 1;
  const ratio = safeLow / safeHigh;

  const reasons: string[] = [];
  if (safeLow < LUM_FLOOR) {
    reasons.push(`low ${safeLow.toFixed(2)} under ${LUM_FLOOR} floor`);
  }
  if (ratio < LUM_RATIO) {
    reasons.push(`low is ${Math.round((1 - ratio) * 100)}% darker than high (ratio ${ratio.toFixed(2)} < ${LUM_RATIO})`);
  }

  const ok = reasons.length === 0;
  return {
    low: Number(safeLow.toFixed(3)),
    high: Number(safeHigh.toFixed(3)),
    ratio: Number(ratio.toFixed(3)),
    ok,
    badge: ok ? 'PASS' : 'FAIL',
    why: reasons.join('; '),
  };
}

/**
 * Validates authored sockets (snapped on a model's face) for sockets.json.
 */
export function checkSnappedSockets(
  data: unknown,
  validAssetIds?: ReadonlySet<string>,
): SchemaCheckResult<Record<string, SnappedSocket[]>> {
  if (!isObject(data)) return { ok: false, why: 'sockets document must be an object keyed by asset id' };

  const out: Record<string, SnappedSocket[]> = {};
  for (const [assetId, list] of Object.entries(data)) {
    if (!assetId.trim()) return { ok: false, why: 'asset id cannot be empty' };
    if (validAssetIds && !validAssetIds.has(assetId)) {
      return { ok: false, why: `unknown asset id "${assetId}"` };
    }
    if (!Array.isArray(list)) {
      return { ok: false, why: `sockets for "${assetId}" must be an array` };
    }

    const seenIds = new Set<string>();
    const sockets: SnappedSocket[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!isObject(item)) {
        return { ok: false, why: `socket #${i} on "${assetId}" must be an object` };
      }
      const sid = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `sock-${i + 1}`;
      if (seenIds.has(sid)) {
        return { ok: false, why: `duplicate socket id "${sid}" on asset "${assetId}"` };
      }
      seenIds.add(sid);

      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : sid;
      const rawType = typeof item.type === 'string' ? item.type : typeof (item as Record<string, unknown>).kind === 'string' ? (item as Record<string, unknown>).kind : '';
      const type = (typeof rawType === 'string' ? rawType : '').trim().toLowerCase();
      if (!ALLOWED_SOCKET_TYPES.includes(type as SocketType)) {
        return {
          ok: false,
          why: `socket "${sid}" on "${assetId}" has invalid type "${rawType}" (allowed: ${ALLOWED_SOCKET_TYPES.join(', ')})`,
        };
      }

      const rawCoord = 'at' in item ? item.at : 'pos' in item ? (item as Record<string, unknown>).pos : undefined;
      if (!isVec3(rawCoord)) {
        return { ok: false, why: `socket "${sid}" on "${assetId}" has invalid [x, y, z] coordinate` };
      }

      const normal = 'normal' in item && item.normal !== undefined
        ? isVec3(item.normal)
          ? item.normal
          : undefined
        : undefined;

      if ('normal' in item && item.normal !== undefined && !normal) {
        return { ok: false, why: `socket "${sid}" on "${assetId}" has invalid normal vector` };
      }

      const pt: readonly [number, number, number] = [rawCoord[0], rawCoord[1], rawCoord[2]];
      const normPt: readonly [number, number, number] | undefined = normal ? [normal[0], normal[1], normal[2]] : undefined;

      sockets.push({
        id: sid,
        name,
        type: type as SocketType,
        ...('kind' in item ? { kind: type as SocketType } : {}),
        at: pt,
        ...('pos' in item ? { pos: pt } : {}),
        ...(normPt ? { normal: normPt } : {}),
      });
    }

    out[assetId] = sockets;
  }

  return { ok: true, value: out };
}
