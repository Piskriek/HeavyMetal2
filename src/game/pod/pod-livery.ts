/**
 * Hoop-Pod liveries (docs/HOOP_POD.md).
 *
 * Pure module: no DOM, no three.js, no React. It turns the roster's existing identity
 * (loadout + team colour) into the 22 floats the instanced pod shader reads, so a 100-racer
 * field costs one material and zero per-racer textures.
 *
 * Rules this file follows (docs/CONTRACTS.md):
 *  - identity is the racer ID, never array order;
 *  - refusals are typed (`E_POD_LIVERY`), never a silent repair;
 *  - storage is optional — a denied or full store is reported, and the game runs either way.
 */
import { CAPSULES, RIDERS, capsuleById, riderById, type CapsuleId, type Loadout, type RiderId } from '../loadouts';
import { PLAYER_ID, rosterColor } from '../roster';

export const POD_LIVERY_VERSION = 1;
export const POD_LIVERY_STORAGE_KEY = 'hm2-pod-livery-v1';
/** Fired on `window` after the paint shop saves, so a running renderer can repaint the player. */
export const POD_LIVERY_EVENT = 'hm2:pod-livery';

/** Hub emblem names. Index 0 = none; index n = decal atlas cell n − 1 (4×4 grid). */
export const POD_EMBLEMS = [
  'None', 'Skull', 'Gear', 'Bolt', 'Flame', 'Crown', 'Coin', 'Star', 'Seven',
  'Jaws', 'Bomb', 'Wrench', 'Gem', 'Eye', 'Anchor', 'Crossbones', 'Clover',
] as const;
/** Procedural band patterns computed in the shader (no texture memory). */
export const POD_PATTERNS = ['None', 'Checker', 'Centre stripe', 'Flames', 'Chevrons', 'Dots', 'Glow runes'] as const;

export interface PodLivery {
  /** Hoops 1, 3, 4, 6 and the hubcap field. */
  readonly primary: string;
  /** Accent hoops 2 and 5 plus the inner ball — the team colour by default. */
  readonly secondary: string;
  /** Rivets, rims and rails. */
  readonly trim: string;
  /** Porthole glass tint (emissive). */
  readonly glass: string;
  /** Emblem and band-pattern colour. */
  readonly decalColor: string;
  /** 0…16, see POD_EMBLEMS. */
  readonly hubDecal: number;
  /** 0…6, see POD_PATTERNS. */
  readonly bandPattern: number;
  /** 0 pristine … 1 scrapyard. */
  readonly wear: number;
}

/** Capsule → base finish. Silhouette never changes (fixed 452 px hull rule in ART_PIPELINE). */
export const CAPSULE_FINISH: Readonly<Record<CapsuleId, Pick<PodLivery, 'primary' | 'trim' | 'glass' | 'bandPattern' | 'wear'>>> = {
  // Rustbucket — riveted iron: rust blooms, raw iron rivets, amber lantern glass.
  iron: { primary: '#7a6f66', trim: '#8f8a84', glass: '#ffb238', bandPattern: 0, wear: 0.75 },
  // Springsteel — lightweight alloy: teal enamel, brass trim, a racing centre stripe.
  springsteel: { primary: '#4f9f97', trim: '#e0aa48', glass: '#ffc34d', bandPattern: 2, wear: 0.25 },
  // Siegebreaker — armoured steel: dark plate, bright steel rims, chevrons, hot glass.
  siege: { primary: '#4b4f5c', trim: '#d8dde2', glass: '#ff9a3a', bandPattern: 4, wear: 0.45 },
};

/** Rider → hub emblem. The emblem colour is the rider's own colour from loadouts.ts. */
export const RIDER_EMBLEM: Readonly<Record<RiderId, number>> = { rivet: 11, nix: 3, grub: 1, sprocket: 4 };

export function liveryForLoadout(loadout: Loadout, teamColor: string): PodLivery {
  const capsule = capsuleById(loadout.capsule);
  const rider = riderById(loadout.rider);
  const finish = CAPSULE_FINISH[capsule.id];
  return {
    ...finish,
    secondary: isHex(teamColor) ? teamColor : rosterColor(0),
    decalColor: rider.color,
    hubDecal: RIDER_EMBLEM[rider.id],
  };
}

/** What the renderer can read from a racer frame. Every field is optional on purpose. */
export interface PodRacerIdentity {
  readonly id?: number;
  readonly loadout?: Loadout;
  readonly color?: string;
}

const FALLBACK_LOADOUT: Loadout = { rider: 'rivet', capsule: 'iron' };

/**
 * Livery for one racer. The player's saved livery (if any) replaces the loadout look for
 * `PLAYER_ID` only — CPU racers always read as their loadout so the field stays legible.
 */
export function liveryForRacer(racer: PodRacerIdentity, slot: number, playerLivery: PodLivery | null): PodLivery {
  const id = Number.isInteger(racer.id) ? (racer.id as number) : slot;
  if (id === PLAYER_ID && playerLivery) return playerLivery;
  const loadout = racer.loadout && isLoadout(racer.loadout) ? racer.loadout : fallbackLoadout(id);
  return liveryForLoadout(loadout, racer.color && isHex(racer.color) ? racer.color : rosterColor(id));
}

/** Same deterministic cycle as roster.buildRosterLoadouts, used only if a frame lacks a loadout. */
function fallbackLoadout(id: number): Loadout {
  if (id <= 0) return FALLBACK_LOADOUT;
  return { rider: RIDERS[id % RIDERS.length].id, capsule: CAPSULES[Math.floor(id / RIDERS.length) % CAPSULES.length].id };
}

/* -------------------------------------------------------------------------- */
/* Presets shown in the paint shop                                             */
/* -------------------------------------------------------------------------- */

export interface PodPreset {
  readonly id: 'stock' | 'upgraded' | 'custom';
  readonly name: string;
  readonly rarity: 'Common' | 'Rare' | 'Epic';
  readonly livery: PodLivery;
}

export const POD_PRESETS: readonly PodPreset[] = [
  { id: 'stock', name: 'Scrapsphere', rarity: 'Common', livery: { primary: '#7a7480', secondary: '#a8602e', trim: '#8f8a84', glass: '#ffb238', decalColor: '#efe3c4', hubDecal: 0, bandPattern: 0, wear: 0.85 } },
  { id: 'upgraded', name: 'Gearbolt', rarity: 'Rare', livery: { primary: '#4a9a32', secondary: '#3c3844', trim: '#e0aa48', glass: '#ffc34d', decalColor: '#f6e6a8', hubDecal: 2, bandPattern: 2, wear: 0.35 } },
  { id: 'custom', name: 'Golden Grease Baron', rarity: 'Epic', livery: { primary: '#e8b53a', secondary: '#6a32a0', trim: '#fff0b0', glass: '#35f0d0', decalColor: '#35f0d0', hubDecal: 1, bandPattern: 6, wear: 0 } },
];

/* -------------------------------------------------------------------------- */
/* Validation (typed refusals)                                                 */
/* -------------------------------------------------------------------------- */

export type LiveryResult =
  | { readonly ok: true; readonly livery: PodLivery }
  | { readonly ok: false; readonly code: 'E_POD_LIVERY'; readonly reason: string };

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);
const isLoadout = (value: Loadout) =>
  RIDERS.some((r) => r.id === value.rider) && CAPSULES.some((c) => c.id === value.capsule);

export function validateLivery(value: unknown): LiveryResult {
  if (!value || typeof value !== 'object') return refuse('not an object');
  const v = value as Record<string, unknown>;
  for (const key of ['primary', 'secondary', 'trim', 'glass', 'decalColor'] as const) {
    if (!isHex(v[key])) return refuse(`${key} must be a #rrggbb colour`);
  }
  if (!Number.isInteger(v.hubDecal) || (v.hubDecal as number) < 0 || (v.hubDecal as number) >= POD_EMBLEMS.length) return refuse('hubDecal out of range');
  if (!Number.isInteger(v.bandPattern) || (v.bandPattern as number) < 0 || (v.bandPattern as number) >= POD_PATTERNS.length) return refuse('bandPattern out of range');
  if (typeof v.wear !== 'number' || !Number.isFinite(v.wear) || v.wear < 0 || v.wear > 1) return refuse('wear must be 0…1');
  return {
    ok: true,
    livery: Object.freeze({
      primary: (v.primary as string).toLowerCase(), secondary: (v.secondary as string).toLowerCase(),
      trim: (v.trim as string).toLowerCase(), glass: (v.glass as string).toLowerCase(),
      decalColor: (v.decalColor as string).toLowerCase(),
      hubDecal: v.hubDecal as number, bandPattern: v.bandPattern as number, wear: v.wear,
    }),
  };
}
const refuse = (reason: string): LiveryResult => ({ ok: false, code: 'E_POD_LIVERY', reason });

export function sameLivery(a: PodLivery | null, b: PodLivery | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.primary === b.primary && a.secondary === b.secondary && a.trim === b.trim && a.glass === b.glass
    && a.decalColor === b.decalColor && a.hubDecal === b.hubDecal && a.bandPattern === b.bandPattern && a.wear === b.wear;
}

/* -------------------------------------------------------------------------- */
/* Optional persistence (versioned, validated)                                 */
/* -------------------------------------------------------------------------- */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const defaultStorage = (): StorageLike | null => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

export function loadPlayerLivery(storage: StorageLike | null = defaultStorage()): PodLivery | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(POD_LIVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; livery?: unknown };
    if (parsed.version !== POD_LIVERY_VERSION) return null;
    const result = validateLivery(parsed.livery);
    return result.ok ? result.livery : null;
  } catch {
    return null;
  }
}

export type SaveResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'unavailable' | 'invalid' | 'denied' };

export function savePlayerLivery(livery: PodLivery | null, storage: StorageLike | null = defaultStorage()): SaveResult {
  if (!storage) return { ok: false, reason: 'unavailable' };
  try {
    if (livery === null) {
      storage.removeItem(POD_LIVERY_STORAGE_KEY);
    } else {
      const result = validateLivery(livery);
      if (!result.ok) return { ok: false, reason: 'invalid' };
      storage.setItem(POD_LIVERY_STORAGE_KEY, JSON.stringify({ version: POD_LIVERY_VERSION, livery: result.livery }));
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'denied' };
  }
}

/** Plain-language description for the HUD / screen readers — never colour alone. */
export function describeLivery(l: PodLivery): string {
  const emblem = POD_EMBLEMS[l.hubDecal] ?? 'None';
  const pattern = POD_PATTERNS[l.bandPattern] ?? 'None';
  const wear = l.wear < 0.15 ? 'showroom' : l.wear < 0.5 ? 'race-worn' : l.wear < 0.8 ? 'battle-scarred' : 'scrapyard';
  return `${emblem === 'None' ? 'Plain' : emblem} hubcaps, ${pattern.toLowerCase()} bands, ${wear} finish`;
}
