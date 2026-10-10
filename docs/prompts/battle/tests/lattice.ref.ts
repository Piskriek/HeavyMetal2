export interface ItemDef { readonly stack: number; readonly kg: number }
export type Defs = Readonly<Record<string, ItemDef>>;
export interface Stack { readonly item: string; readonly n: number }
export interface Box { readonly id: number; readonly x: number; readonly z: number; readonly slots: readonly (Stack | null)[]; readonly maxKg: number }
export interface Relay { readonly id: number; readonly x: number; readonly z: number; readonly range: number }
export type Taken = { box: number; item: string; n: number };
const cnt = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
export const box = (id: number, x: number, z: number, slotCount: number, maxKg: number): Box => ({ id, x, z, slots: Array.from({ length: cnt(slotCount) }, () => null), maxKg });
export const kg = (b: Box, defs: Defs) => b.slots.reduce((s, q) => s + (q ? q.n * (defs[q.item]?.kg ?? 0) : 0), 0);
export const count = (b: Box, item: string) => b.slots.reduce((s, q) => s + (q && q.item === item ? q.n : 0), 0);
export function deposit(b: Box, defs: Defs, item: string, n: number): { box: Box; left: number } {
  let left = cnt(n); const d = defs[item]; if (!d || left === 0) return { box: b, left };
  const room = d.kg > 0 ? Math.floor((b.maxKg - kg(b, defs)) / d.kg + 1e-9) : Infinity;
  let fit = Math.max(0, Math.min(left, room)); const slots = b.slots.slice(); const start = fit;
  for (let i = 0; i < slots.length && fit > 0; i++) { const q = slots[i]; if (q && q.item === item && q.n < d.stack) { const a = Math.min(fit, d.stack - q.n); slots[i] = { item, n: q.n + a }; fit -= a; } }
  for (let i = 0; i < slots.length && fit > 0; i++) if (!slots[i]) { const a = Math.min(fit, d.stack); slots[i] = { item, n: a }; fit -= a; }
  const placed = start - fit; left -= placed;
  return { box: placed ? { ...b, slots } : b, left };
}
export function withdraw(b: Box, item: string, n: number): { box: Box; got: number } {
  let want = cnt(n); const slots = b.slots.slice(); let got = 0;
  while (want > 0) {
    let best = -1; for (let i = 0; i < slots.length; i++) { const q = slots[i]; if (q && q.item === item && (best < 0 || q.n < slots[best]!.n)) best = i; }
    if (best < 0) break; const q = slots[best]!; const a = Math.min(want, q.n);
    slots[best] = q.n - a > 0 ? { item, n: q.n - a } : null; want -= a; got += a;
  }
  return { box: got ? { ...b, slots } : b, got };
}
export function links(boxes: readonly Box[], relays: readonly Relay[]): number[][] {
  const N = boxes.length, par = Array.from({ length: N + relays.length }, (_, i) => i);
  const find = (i: number): number => { while (par[i] !== i) { par[i] = par[par[i]!]!; i = par[i]!; } return i; };
  const join = (a: number, b: number) => { par[find(a)] = find(b); };
  relays.forEach((r, ri) => { boxes.forEach((b, bi) => { if (Math.hypot(b.x - r.x, b.z - r.z) <= r.range) join(bi, N + ri); }); relays.forEach((q, qi) => { if (qi > ri && Math.hypot(q.x - r.x, q.z - r.z) <= Math.max(q.range, r.range)) join(N + ri, N + qi); }); });
  const groups = new Map<number, number[]>(); boxes.forEach((b, bi) => { const k = find(bi); groups.set(k, [...(groups.get(k) ?? []), b.id]); });
  return [...groups.values()].map((g) => g.sort((a, b) => a - b)).sort((a, b) => a[0]! - b[0]!);
}
export function totals(boxes: readonly Box[], ids: readonly number[]): Record<string, number> {
  const out: Record<string, number> = {}; for (const b of boxes) if (ids.includes(b.id)) for (const q of b.slots) if (q) out[q.item] = (out[q.item] ?? 0) + q.n; return out;
}
const order = (boxes: readonly Box[], ids: readonly number[], at: { x: number; z: number }) => { const set = new Set(ids); return boxes.map((b, i) => ({ b, i, d: Math.hypot(b.x - at.x, b.z - at.z) })).filter((e) => set.has(e.b.id)).sort((p, q) => p.d - q.d || p.b.id - q.b.id); };
const merge = (need: readonly Stack[]) => { const m = new Map<string, number>(); for (const s of need) m.set(s.item, (m.get(s.item) ?? 0) + cnt(s.n)); return [...m].map(([item, n]) => ({ item, n })); };
export function pull(boxes: readonly Box[], ids: readonly number[], at: { x: number; z: number }, need: readonly Stack[]): { ok: true; boxes: Box[]; taken: Taken[] } | { ok: false; short: Stack[] } {
  const needs = merge(need), ord = order(boxes, ids, at), short: Stack[] = [];
  for (const s of needs) { const have = ord.reduce((t, e) => t + count(e.b, s.item), 0); if (have < s.n) short.push({ item: s.item, n: s.n - have }); }
  if (short.length) return { ok: false, short };
  const out = boxes.slice(), taken: Taken[] = [];
  for (const s of needs) { let want = s.n; for (const e of ord) { if (want <= 0) break; const w = withdraw(out[e.i]!, s.item, want); if (w.got) { out[e.i] = w.box; want -= w.got; taken.push({ box: e.b.id, item: s.item, n: w.got }); } } }
  return { ok: true, boxes: out, taken };
}
export function store(boxes: readonly Box[], ids: readonly number[], at: { x: number; z: number }, defs: Defs, items: readonly Stack[]): { boxes: Box[]; left: Stack[] } {
  const out = boxes.slice(), left: Stack[] = [];
  for (const s of items) {
    let n = cnt(s.n); const ord = order(out, ids, at); const first = [...ord.filter((e) => count(e.b, s.item) > 0), ...ord.filter((e) => count(e.b, s.item) === 0)];
    for (const e of first) { if (n <= 0) break; const r = deposit(out[e.i]!, defs, s.item, n); out[e.i] = r.box; n = r.left; }
    if (n > 0) left.push({ item: s.item, n });
  }
  return { boxes: out, left };
}
