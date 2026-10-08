import { useSyncExternalStore } from 'react';
import { BLOCKED_WORDS } from '@hm/avatarlook';
import { checkBundleLimit, licenseOf, validatePublish, type License, type PublishRequest, type Visibility } from '@hm/plugs';

/**
 * Your shares: presets you saved with a choice of who gets them (keep private, up for sale, share freely, share with friends). Until the
 * platform backend exists they live on this device and show in the Community tab under "Your shares"; the request, the checks and the licence
 * are the real ones (`@hm/plugs`), so connecting RUN later only changes where `publish` sends them. Credits only, never real money.
 */
export type ShareKind = 'tool' | 'sprite' | 'animation' | 'look' | 'island';
export interface Share {
  readonly id: string;
  readonly kind: ShareKind;
  /** The preset id it was made from. */
  readonly ref: string;
  readonly name: string;
  readonly description: string;
  readonly visibility: Visibility;
  readonly priceCredits?: number;
  readonly tags: readonly string[];
  readonly license: License;
  readonly bytes: number;
  readonly at: number;
  /** The preset itself, as it was when shared. */
  readonly data: unknown;
}

export const VISIBILITY: readonly { readonly id: Visibility; readonly label: string; readonly doc: string }[] = [
  { id: 'private', label: 'Keep private', doc: 'Only you. It stays in your presets.' },
  { id: 'sale', label: 'Up for sale', doc: 'Others buy it with credits. They can use it, not change or resell it.' },
  { id: 'free', label: 'Share freely', doc: 'Anyone can use it and change it; your name stays on it.' },
  { id: 'friends', label: 'Share with friends', doc: 'Only your friends see it. They can use it and change it.' },
];

/** RUN's limit for one piece of player content. Bigger things need splitting before they can be shared. */
export const SHARE_LIMIT = 100_000;

const MESSAGES: Readonly<Record<string, string>> = {
  'invalid visibility': 'Choose who gets it.',
  'name must be 3..40 characters': 'The name needs 3 to 40 letters.',
  'description must be 0..400 characters': 'Keep the description under 400 letters.',
  'price required for sale': 'Set a price in credits.',
  'price must be an integer 1..100000': 'The price is a whole number of credits, 1 to 100000.',
  'price only allowed for sale': 'Only things up for sale have a price.',
  'max 6 tags': 'Use at most 6 tags.',
  'url not allowed': 'Links are not allowed.',
};

/** Everything wrong with a share request, in plain words (empty when it can go). */
export function shareProblems(req: PublishRequest, bytes: number): string[] {
  const v = validatePublish(req, { blocked: [...BLOCKED_WORDS] });
  const out = v.errors.map((e) => (e.startsWith('blocked word') ? 'Pick different words.' : e.startsWith('invalid tag') ? 'Tags are 2 to 20 small letters, numbers or dashes.' : MESSAGES[e] ?? e));
  const flat = `${req.name} ${req.description} ${(req.tags ?? []).join(' ')}`.toLowerCase().replace(/[^a-z]/g, '');
  if (!out.includes('Pick different words.') && BLOCKED_WORDS.some((w) => flat.includes(w))) out.push('Pick different words.');
  const limit = checkBundleLimit(bytes, SHARE_LIMIT);
  if (!limit.ok) out.push(`It is too big to share yet: ${Math.ceil(bytes / 1000)} KB of ${SHARE_LIMIT / 1000} KB.`);
  return [...new Set(out)];
}

export const parseTags = (s: string): string[] => s.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);

import { kv } from '../storage/profile-storage';

const KEY = 'hm.shares.v1';
const listeners = new Set<() => void>();
let cache: readonly Share[] | null = null;
function load(): readonly Share[] {
  try {
    const raw = JSON.parse(kv.get(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw.filter((s) => s && typeof s === 'object' && typeof (s as Share).id === 'string') as Share[]) : [];
  } catch { return []; }
}
const get = (): readonly Share[] => (cache ??= load());
function set(next: readonly Share[]): void {
  cache = next;
  try { kv.set(KEY, JSON.stringify(next)); } catch { /* storage full or blocked: kept for this visit */ }
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useShares = (): readonly Share[] => useSyncExternalStore(subscribe, get, get);

/** Share it (replaces your earlier share of the same preset). Returns the problems instead when it cannot go. */
export function publish(kind: ShareKind, ref: string, req: Omit<PublishRequest, 'presetId'>, data: unknown): { share?: Share; problems: string[] } {
  const bytes = JSON.stringify(data ?? null).length;
  const full: PublishRequest = { ...req, presetId: ref };
  const problems = shareProblems(full, bytes);
  if (problems.length) return { problems };
  const clean = validatePublish(full).clean;
  const share: Share = {
    id: `share-${Date.now().toString(36)}`, kind, ref, name: clean.name, description: clean.description, visibility: clean.visibility,
    ...(clean.priceCredits !== undefined ? { priceCredits: clean.priceCredits } : {}), tags: clean.tags ?? [], license: licenseOf(clean.visibility), bytes, at: Date.now(), data,
  };
  set([share, ...get().filter((s) => !(s.kind === kind && s.ref === ref))]);
  return { share, problems: [] };
}
export const unshare = (id: string): void => set(get().filter((s) => s.id !== id));
export const shareOf = (kind: ShareKind, ref: string): Share | undefined => get().find((s) => s.kind === kind && s.ref === ref);
