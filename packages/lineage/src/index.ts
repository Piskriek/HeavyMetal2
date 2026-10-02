import { classifyChange, diffPresets, type PresetRecord } from '@hm/evolve';

/**
 * Which settings change how a race PLAYS (as opposed to how it looks or sounds). The evolution asks about gameplay changes
 * ("suggest it for the next evolution, or keep it as your branch?") and lets cosmetic changes stay yours. '*' = every setting of the kind.
 * This table is data: a future evolution can change what counts as gameplay.
 */
export const GAMEPLAY: Readonly<Record<string, '*' | readonly string[]>> = {
  race: '*', track: '*', mechanic: '*', racer: '*', 'ai-driver': '*', rule: '*',
  item: ['effect', 'durationMs', 'power', 'radius', 'weightFront', 'weightMiddle', 'weightBack', 'enabled'],
  terrain: ['data', 'friction', 'restitution'],
  entity: ['shape', 'size', 'x', 'y', 'z', 'yaw', 'scaleX', 'scaleY', 'scaleZ', 'body', 'mass', 'friction', 'restitution'],
  scene: ['gravity', 'seed', 'track'],
};

/** The gameplay variable keys of a kind, given the keys its schema declares. */
export function gameplayKeys(kind: string, schemaKeys: readonly string[]): ReadonlySet<string> {
  const g = GAMEPLAY[kind];
  if (!g) return new Set();
  return new Set(g === '*' ? schemaKeys : g);
}

/** The bits of a preset the lineage compares. Structural, so any store's presets fit. */
export interface Snap { readonly id: string; readonly kind: string; readonly name: string; readonly hash: string; readonly author: string; readonly params: Readonly<Record<string, unknown>>; readonly children: Readonly<Record<string, readonly string[]>> }
export type Baseline = ReadonlyMap<string, Snap>;

export function baselineOf(presets: readonly Snap[]): Baseline {
  return new Map(presets.map((p) => [p.id, p]));
}

export type ChangeClass = 'gameplay' | 'cosmetic';
export interface PresetChange {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly status: 'added' | 'removed' | 'changed';
  readonly class: ChangeClass;
  readonly keys: readonly string[];
}

const asRecord = (s: Snap): PresetRecord => ({ id: s.id, hash: s.hash, kind: s.kind, author: s.author, params: s.params as PresetRecord['params'] });
const childKeys = (s: Snap): string[] => Object.entries(s.children).map(([k, v]) => `${k}:${v.join(',')}`);
const GAMEPLAY_SLOTS = ['entities', 'terrain', 'items', 'rules', 'mechanics'] as const;

/**
 * What changed between a baseline and now, each change tagged gameplay or cosmetic. `schemaKeys(kind)` lists the settings a kind declares.
 * Added and removed presets of a gameplay kind count as gameplay (a new item, a new rule set); anything else is cosmetic.
 * Adding or removing children of a scene (an item, a rule set, an object) counts as gameplay; sounds, drivers and interface do not.
 */
export function changesBetween(base: Baseline, now: readonly Snap[], schemaKeys: (kind: string) => readonly string[]): PresetChange[] {
  const out: PresetChange[] = [];
  const seen = new Set<string>();
  for (const cur of now) {
    seen.add(cur.id);
    const gp = gameplayKeys(cur.kind, schemaKeys(cur.kind));
    const was = base.get(cur.id);
    if (!was) { out.push({ id: cur.id, kind: cur.kind, name: cur.name, status: 'added', class: GAMEPLAY[cur.kind] ? 'gameplay' : 'cosmetic', keys: [] }); continue; }
    if (was.hash === cur.hash) continue;
    const diff = diffPresets(asRecord(was), asRecord(cur));
    const kids = JSON.stringify(childKeys(was)) !== JSON.stringify(childKeys(cur));
    if (diff.length === 0 && !kids) continue;
    const cls = classifyChange(diff, gp);
    const slotGameplay = kids && cur.kind === 'scene' && GAMEPLAY_SLOTS.some((s) => JSON.stringify(was.children[s] ?? []) !== JSON.stringify(cur.children[s] ?? []));
    out.push({ id: cur.id, kind: cur.kind, name: cur.name, status: 'changed', class: cls === 'gameplay' || slotGameplay ? 'gameplay' : 'cosmetic', keys: diff.map((d) => d.key) });
  }
  for (const [id, was] of base) if (!seen.has(id)) out.push({ id, kind: was.kind, name: was.name, status: 'removed', class: GAMEPLAY[was.kind] ? 'gameplay' : 'cosmetic', keys: [] });
  return out.sort((a, b) => (a.class === b.class ? a.name.localeCompare(b.name) : a.class === 'gameplay' ? -1 : 1));
}

/** One sentence for the banner ("3 changes affect how the race plays"). */
export function summarise(changes: readonly PresetChange[]): { gameplay: number; cosmetic: number; text: string } {
  const gameplay = changes.filter((c) => c.class === 'gameplay').length;
  const cosmetic = changes.length - gameplay;
  const head = gameplay === 0 ? 'Nothing you changed affects how the race plays' : `${gameplay} change${gameplay === 1 ? '' : 's'} affect${gameplay === 1 ? 's' : ''} how the race plays`;
  const tail = cosmetic ? `; ${cosmetic} ${cosmetic === 1 ? 'is' : 'are'} only looks and sounds` : '';
  return { gameplay, cosmetic, text: changes.length === 0 ? 'No changes yet.' : `${head}${tail}.` };
}

/** A local record of what the player decided to do with their gameplay changes. Shared and tallied once the platform has a backend. */
export interface Decision { readonly id: string; readonly kind: 'suggest' | 'branch'; readonly name: string; readonly at: number; readonly parent?: string; readonly changes: readonly { readonly id: string; readonly hash: string }[] }
