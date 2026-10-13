/**
 * The Studio's document, as data. One scenedoc node per asset placed in the scene; the node's props are that asset's
 * tweak values. The saved baseline is the asset-tweaks file. A pending change is a prop that differs from the baseline,
 * and accepting one writes it into the baseline. Pure: no DOM, no three.js, no I/O.
 */
import { createHistory, createRegistry, emptyDoc, run, type Doc, type History, type Op, type PropType, type Registry } from '@hm/scenedoc';
import { FIELDS, sameValue, type AssetTweak, type FieldDef, type TweakKey, type Vec3 } from '../../studio-server/tweak-schema';

export const ASSET = 'asset';
export type Props = Record<string, unknown>;
export type Saved = Record<string, AssetTweak>;

/** A pending change: one prop of one placed asset that differs from the saved file. */
export interface Change {
  readonly id: string;
  readonly key: TweakKey;
  readonly from: unknown;
  readonly to: unknown;
}

function propFor(f: FieldDef): PropType {
  if (f.kind === 'color') return { kind: 'string', maxLength: 7, default: '' };
  if (f.kind === 'vec3') return { kind: 'vec3', default: f.neutral as Vec3 };
  return { kind: 'number', default: f.neutral as number };
}

/** The scenedoc registry: one type, an asset, with one prop per tweak field. */
export const REGISTRY: Registry = createRegistry([
  { type: ASSET, version: 1, props: Object.fromEntries(FIELDS.map((f): [string, PropType] => [f.key, propFor(f)])) },
]);

export const EMPTY_HISTORY: History = createHistory(emptyDoc());

export const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The props of an asset from its saved tweak: every field, the neutral value where the file has none. */
export function propsOf(t: AssetTweak | undefined): Props {
  const out: Props = {};
  for (const f of FIELDS) {
    const v: unknown = t ? (t as Record<string, unknown>)[f.key] : undefined;
    out[f.key] = v === undefined ? f.neutral : f.key === 'scale' && typeof v === 'number' ? [v, v, v] : v;
  }
  return out;
}

/** How one value is written in the file: a uniform scale is a number; a neutral value is left out. */
function fileValue(f: FieldDef, v: unknown): unknown {
  if (f.key === 'scale' && Array.isArray(v) && v[0] === v[1] && v[1] === v[2]) return v[0];
  return v;
}

/** The file form of a set of props: only the fields that are not neutral. */
export function tweakOf(props: Props): AssetTweak {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) {
    const v = props[f.key];
    if (!sameValue(v, f.neutral)) out[f.key] = fileValue(f, v);
  }
  return out as AssetTweak;
}

/** Keeps a value inside the field's range (a neutral value is always kept, e.g. Metal -1 "model"). */
export function clampField(f: FieldDef, v: unknown): unknown {
  const c = (n: number): number => (sameValue(n, f.neutral) ? n : Math.min(f.max, Math.max(f.min, round3(n))));
  if (f.kind === 'color') return typeof v === 'string' ? v : f.neutral;
  if (f.kind === 'number') return typeof v === 'number' && Number.isFinite(v) ? c(v) : f.neutral;
  if (typeof v === 'number') return [c(v), c(v), c(v)];
  if (Array.isArray(v) && v.length === 3) return (v as number[]).map((x) => c(Number(x))) as Vec3;
  return f.neutral;
}

/** The pending changes of the scene against the saved file, in scene order and field order. */
export function pendingChanges(doc: Doc, saved: Saved): Change[] {
  const out: Change[] = [];
  for (const id of doc.roots) {
    const node = doc.nodes[id];
    if (!node) continue;
    const base = propsOf(saved[id]);
    for (const f of FIELDS) {
      const to = node.props[f.key];
      if (!sameValue(to, base[f.key])) out.push({ id, key: f.key, from: base[f.key], to });
    }
  }
  return out;
}

/** The saved file after accepting some changes: each accepted prop is written, the rest stay as they were. */
export function acceptInto(saved: Saved, doc: Doc, rows: readonly Change[]): Saved {
  const next: Record<string, Record<string, unknown>> = {};
  for (const id of Object.keys(saved)) next[id] = { ...(saved[id] as Record<string, unknown>) };
  for (const r of rows) {
    const node = doc.nodes[r.id];
    const f = FIELDS.find((x) => x.key === r.key);
    if (!node || !f) continue;
    const entry = { ...(next[r.id] ?? {}) };
    const v = node.props[r.key];
    if (sameValue(v, f.neutral)) delete entry[r.key];
    else entry[r.key] = fileValue(f, v);
    next[r.id] = entry;
  }
  const out: Saved = {};
  for (const id of Object.keys(next).sort()) {
    const entry = next[id] ?? {};
    if (Object.keys(entry).length > 0) out[id] = entry as AssetTweak;
  }
  return out;
}

/** The operations that put the given changes back to the saved values (Discard). */
export function discardOps(saved: Saved, rows: readonly Change[]): Op[] {
  return rows.map((r): Op => ({ op: 'set', id: r.id, props: { [r.key]: propsOf(saved[r.id])[r.key] } }));
}

export const placeOp = (id: string, saved: Saved): Op => ({ op: 'create', type: ASSET, id, name: id, parent: null, props: propsOf(saved[id]) });

/** The file text for a saved object: sorted, two-space indent, one trailing newline (the same form the server writes). */
export function fileText(saved: Saved): string {
  return `${JSON.stringify(saved, null, 2)}\n`;
}

/** Runs ops as one labelled step. Returns the history unchanged when the ops are refused. */
export function step(h: History, label: string, ops: readonly Op[], merge?: { readonly key: string; readonly at: number }): History {
  try {
    const mergeKey = merge?.key;
    return run(REGISTRY, h, label, ops, merge && mergeKey ? { mergeKey, at: merge.at } : undefined).history;
  } catch {
    return h;
  }
}

