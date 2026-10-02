// Majority-rules evolution of a community-made game. Pure, deterministic, no dependencies.

export interface PresetRef {
  id: string;
  hash: string;
}

export interface PresetRecord {
  id: string;
  hash: string;
  kind: string;
  author: string;
  forkOf?: PresetRef;
  params: Record<string, string | number | boolean | null>;
}

export interface Canon {
  version: number;
  slots: Record<string, PresetRef>;
}

export interface UsageEvent {
  player: string;
  slot: string;
  preset: PresetRef;
  weight: number;
  at: number;
}

export interface EvolveRules {
  minPlayers: number;
  minShare: number;
  perPlayerCap: number;
  halfLifeDays: number;
  today: number;
  challengerMargin: number;
}

export const DEFAULT_RULES: Omit<EvolveRules, 'today'> = {
  minPlayers: 5,
  minShare: 0.4,
  perPlayerCap: 20,
  halfLifeDays: 14,
  challengerMargin: 1.15,
};

export interface TreeNode {
  id: string;
  hash: string;
  author: string;
  children: TreeNode[];
  depth: number;
}

export interface TallyEntry {
  preset: PresetRef;
  weight: number;
  players: number;
}

export interface EvolveChange {
  slot: string;
  /** null when the slot did not exist in the canon before (it was added). */
  from: PresetRef | null;
  to: PresetRef;
  share: number;
  players: number;
}

export interface EvolveResult {
  next: Canon;
  changes: EvolveChange[];
  kept: string[];
  notes: string[];
}

// ---------------------------------------------------------------- helpers

const EPS = 1e-9;

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function refKey(r: PresetRef): string {
  return JSON.stringify([r.id, r.hash]);
}

function sameRef(a: PresetRef, b: PresetRef): boolean {
  return a.id === b.id && a.hash === b.hash;
}

function cmpRecord(a: PresetRecord, b: PresetRecord): number {
  return cmp(a.id, b.id) || cmp(a.hash, b.hash);
}

function hasOwn(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function setKey<T>(o: Record<string, T>, k: string, v: T): void {
  Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function pct(share: number): number {
  return Math.round(share * 100);
}

// ---------------------------------------------------------------- 1. forest

export function buildForest(records: readonly PresetRecord[]): { roots: TreeNode[]; orphans: string[] } {
  const sorted = [...records].sort(cmpRecord);
  const byKey = new Map<string, PresetRecord>();
  for (const r of sorted) {
    const k = refKey(r);
    if (!byKey.has(k)) byKey.set(k, r);
  }
  const unique = [...byKey.values()]; // insertion order == sorted order
  const order = new Map<string, number>();
  unique.forEach((r, i) => order.set(refKey(r), i));

  const parent = new Map<string, string | undefined>();
  const orphans: string[] = [];
  for (const r of unique) {
    const k = refKey(r);
    if (!r.forkOf) {
      parent.set(k, undefined);
      continue;
    }
    const pk = refKey(r.forkOf);
    if (byKey.has(pk)) {
      parent.set(k, pk);
    } else {
      parent.set(k, undefined);
      if (orphans[orphans.length - 1] !== r.id) orphans.push(r.id);
    }
  }

  // Break cycles: the smallest member (by id, hash) becomes a root, its back edge is ignored.
  const state = new Map<string, number>(); // 1 = on current path, 2 = done
  for (const r of unique) {
    const start = refKey(r);
    if (state.has(start)) continue;
    const path: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && !state.has(cur)) {
      state.set(cur, 1);
      path.push(cur);
      cur = parent.get(cur);
    }
    if (cur !== undefined && state.get(cur) === 1) {
      const members = path.slice(path.indexOf(cur));
      let best = members[0] as string;
      for (const m of members) {
        if ((order.get(m) as number) < (order.get(best) as number)) best = m;
      }
      parent.set(best, undefined);
    }
    for (const p of path) state.set(p, 2);
  }

  const nodes = new Map<string, TreeNode>();
  for (const r of unique) {
    nodes.set(refKey(r), { id: r.id, hash: r.hash, author: r.author, children: [], depth: 0 });
  }
  const roots: TreeNode[] = [];
  for (const r of unique) {
    const k = refKey(r);
    const node = nodes.get(k) as TreeNode;
    const pk = parent.get(k);
    if (pk !== undefined) (nodes.get(pk) as TreeNode).children.push(node);
    else roots.push(node);
  }
  const stack: TreeNode[] = [...roots];
  while (stack.length) {
    const n = stack.pop() as TreeNode;
    for (const c of n.children) {
      c.depth = n.depth + 1;
      stack.push(c);
    }
  }
  return { roots, orphans };
}

// ---------------------------------------------------------------- 2. lineage

export function lineage(records: readonly PresetRecord[], id: string): PresetRecord[] {
  const sorted = [...records].sort(cmpRecord);
  const start = sorted.find((r) => r.id === id);
  if (!start) return [];
  const byKey = new Map<string, PresetRecord>();
  for (const r of sorted) {
    const k = refKey(r);
    if (!byKey.has(k)) byKey.set(k, r);
  }
  const chain: PresetRecord[] = [];
  const seen = new Set<string>();
  let cur: PresetRecord | undefined = start;
  while (cur && !seen.has(refKey(cur))) {
    seen.add(refKey(cur));
    chain.push(cur);
    cur = cur.forkOf ? byKey.get(refKey(cur.forkOf)) : undefined;
  }
  return chain.reverse();
}

// ---------------------------------------------------------------- 3. diff

export function diffPresets(
  a: PresetRecord,
  b: PresetRecord,
): { key: string; from: unknown; to: unknown }[] {
  const keys = [...new Set([...Object.keys(a.params), ...Object.keys(b.params)])].sort(cmp);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    const inA = hasOwn(a.params, key);
    const inB = hasOwn(b.params, key);
    const from: unknown = inA ? a.params[key] : undefined;
    const to: unknown = inB ? b.params[key] : undefined;
    const equal = inA && inB && (from === to || (from !== from && to !== to));
    if (!equal) out.push({ key, from, to });
  }
  return out;
}

// ---------------------------------------------------------------- 4. classify

export function classifyChange(
  diff: readonly { key: string }[],
  gameplayKeys: ReadonlySet<string>,
): 'gameplay' | 'cosmetic' | 'none' {
  if (diff.length === 0) return 'none';
  return diff.some((d) => gameplayKeys.has(d.key)) ? 'gameplay' : 'cosmetic';
}

// ---------------------------------------------------------------- 5. tally

export function tally(events: readonly UsageEvent[], rules: EvolveRules): Record<string, TallyEntry[]> {
  const valid = events.filter(
    (e) =>
      Number.isFinite(e.weight) && e.weight > 0 && Number.isFinite(e.at) && e.at <= rules.today,
  );
  // Canonical order so floating point sums do not depend on input order.
  valid.sort(
    (x, y) =>
      cmp(x.slot, y.slot) ||
      cmp(x.player, y.player) ||
      cmp(x.preset.id, y.preset.id) ||
      cmp(x.preset.hash, y.preset.hash) ||
      x.at - y.at ||
      x.weight - y.weight,
  );

  const bySlot = new Map<string, Map<string, UsageEvent[]>>();
  for (const e of valid) {
    let players = bySlot.get(e.slot);
    if (!players) bySlot.set(e.slot, (players = new Map()));
    let list = players.get(e.player);
    if (!list) players.set(e.player, (list = []));
    list.push(e);
  }

  const decay = (at: number): number => {
    const age = rules.today - at;
    if (!(rules.halfLifeDays > 0)) return age === 0 ? 1 : 0;
    return Math.pow(0.5, age / rules.halfLifeDays);
  };

  const result: Record<string, TallyEntry[]> = {};
  const slotNames = [...bySlot.keys()].sort(cmp);
  for (const slot of slotNames) {
    const acc = new Map<string, { preset: PresetRef; weight: number; players: Set<string> }>();
    for (const [player, list] of bySlot.get(slot) as Map<string, UsageEvent[]>) {
      let total = 0;
      for (const e of list) total += e.weight;
      const cap = rules.perPlayerCap;
      for (const e of list) {
        const capped = total > cap ? (cap > 0 ? (e.weight * cap) / total : 0) : e.weight;
        const w = capped * decay(e.at);
        if (!(w > 0)) continue;
        const k = refKey(e.preset);
        let entry = acc.get(k);
        if (!entry) {
          entry = { preset: { id: e.preset.id, hash: e.preset.hash }, weight: 0, players: new Set() };
          acc.set(k, entry);
        }
        entry.weight += w;
        entry.players.add(player);
      }
    }
    const entries: TallyEntry[] = [...acc.values()].map((v) => ({
      preset: v.preset,
      weight: v.weight,
      players: v.players.size,
    }));
    entries.sort(
      (x, y) =>
        y.weight - x.weight || cmp(x.preset.hash, y.preset.hash) || cmp(x.preset.id, y.preset.id),
    );
    if (entries.length) setKey(result, slot, entries);
  }
  return result;
}

// ---------------------------------------------------------------- 6. evolve

export function evolve(canon: Canon, events: readonly UsageEvent[], rules: EvolveRules): EvolveResult {
  const t = tally(events, rules);
  const slots = [...new Set([...Object.keys(canon.slots), ...Object.keys(t)])].sort(cmp);

  const nextSlots: Record<string, PresetRef> = {};
  const changes: EvolveChange[] = [];
  const kept: string[] = [];
  const notes: string[] = [];

  for (const slot of slots) {
    const current: PresetRef | undefined = hasOwn(canon.slots, slot) ? canon.slots[slot] : undefined;
    const entries: TallyEntry[] = hasOwn(t, slot) ? (t[slot] ?? []) : [];
    if (current) setKey(nextSlots, slot, { id: current.id, hash: current.hash });

    if (entries.length === 0) {
      if (current) kept.push(slot);
      continue;
    }
    const top = entries[0]!;
    if (current && sameRef(top.preset, current)) {
      kept.push(slot);
      continue;
    }

    let total = 0;
    for (const e of entries) total += e.weight;
    const share = total > 0 ? top.weight / total : 0;
    const currentWeight = current
      ? (entries.find((e) => sameRef(e.preset, current))?.weight ?? 0)
      : 0;

    let blocked: string | null = null;
    if (top.players < rules.minPlayers) {
      blocked = `needs at least ${plural(rules.minPlayers, 'player')}`;
    } else if (share + EPS < rules.minShare) {
      blocked = `needs at least ${pct(rules.minShare)}% of play`;
    } else if (
      current &&
      currentWeight > 0 &&
      top.weight + EPS < rules.challengerMargin * currentWeight
    ) {
      blocked = `has not beaten '${current.id}' by the required ${Math.round(
        (rules.challengerMargin - 1) * 100,
      )}%`;
    }

    if (blocked) {
      if (current) kept.push(slot);
      notes.push(
        `Slot '${slot}': '${top.preset.id}' leads with ${pct(share)}% of play from ${plural(
          top.players,
          'player',
        )} but ${blocked}.`,
      );
      continue;
    }

    const to = { id: top.preset.id, hash: top.preset.hash };
    setKey(nextSlots, slot, to);
    changes.push({
      slot,
      from: current ? { id: current.id, hash: current.hash } : null,
      to: { id: to.id, hash: to.hash },
      share,
      players: top.players,
    });
    const tail = `with ${pct(share)}% of play from ${plural(top.players, 'player')}.`;
    notes.push(
      current
        ? `Slot '${slot}': '${to.id}' overtook '${current.id}' ${tail}`
        : `Slot '${slot}': '${to.id}' was added ${tail}`,
    );
  }

  if (changes.length === 0) {
    return { next: canon, changes, kept, notes };
  }
  return { next: { version: canon.version + 1, slots: nextSlots }, changes, kept, notes };
}

// ---------------------------------------------------------------- 7. changelog

export function changelog(result: { changes: readonly EvolveChange[] }): string[] {
  return result.changes.map(
    (c) =>
      `${c.slot}: ${c.from ? c.from.id : '(new)'} -> ${c.to.id} (${pct(c.share)}% of play, ${plural(
        c.players,
        'player',
      )})`,
  );
}