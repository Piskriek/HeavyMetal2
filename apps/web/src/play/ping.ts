/**
 * The ping (plan 49, Mission 1): the player marks what the crosshair is on, the companion names it, and the event goes to
 * the Neural Bridge so an outside AI knows what Piskriek is pointing at.
 *
 * Pure and deterministic: the classification, the marker's pulse envelope, its distance sizing, the wire event and the
 * spoken label. The scene does the ray and draws the marker (play-scene.ts); the screen sends the event (play.tsx).
 */

/** What a ping hit, coarse. The owner named the first four; the last three keep a base piece or a Spore model from being called a wall. */
export type PingEntityType = 'machine' | 'rover' | 'wall' | 'terrain' | 'structure' | 'prop' | 'creation';

export interface PingVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One ray hit before classification: the scene fills what it knows. */
export interface PingHit {
  readonly point: PingVec3;
  /** The surface normal, world space, unit length (the scene normalises it). */
  readonly normal: PingVec3;
  readonly distance: number;
  /** The kind of thing the ray met. */
  readonly source: 'kit' | 'piece' | 'shell' | 'ground' | 'clutter';
  /** The kit the part belongs to ('gate', 'plot:<id>@<built>', 'vehicle-<kind>', 'stargate', ...). */
  readonly kitId?: string;
  /** The placed part's path in its kit (what an override is keyed by). */
  readonly partId?: string;
  /** The part definition id ('hazard-rim'). */
  readonly part?: string;
  /** The material the part wears now. */
  readonly material?: string;
  /** A base piece's id, or a lab prop's id. */
  readonly objectId?: string;
}

/** A classified ping, as the screen keeps it and the bridge receives it. */
export interface PingTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly normal: PingVec3;
  readonly entityType: PingEntityType;
  readonly entityId: string;
  readonly kitId?: string;
  readonly partId?: string;
  readonly part?: string;
  readonly material?: string;
  readonly distance: number;
}

/** How long a marker lives, seconds. */
export const PING_LIFE_S = 3.0;
/** The last part of its life the marker fades over, seconds. */
export const PING_FADE_S = 0.5;
/** The drop-in: the brackets close from PING_DROP_FROM times their size to their size in this long. */
export const PING_DROP_S = 0.18;
export const PING_DROP_FROM = 1.6;
/** The breathing rate and depth of the brackets once they have landed. */
export const PING_BREATH_HZ = 2.0;
export const PING_BREATH_DEPTH = 0.06;
/** A square ripple leaves the reticle this often, seconds, and grows to this many times the reticle. */
export const PING_RIPPLE_S = 0.75;
export const PING_RIPPLE_GROW = 2.2;
/** How far a ping reaches, metres. */
export const PING_REACH_M = 60;
/** Two pings closer together than this are one (a held key, a double click). */
export const PING_DEBOUNCE_S = 0.25;
/** Ray-7 violet, the companion's colour. */
export const PING_VIOLET = '#b84dff';

/** A wall is steeper than this (|normal.y| below it); a floor or ceiling is flatter. */
const WALL_NY = 0.6;

const isVehicleKit = (kit: string): boolean => kit.startsWith('vehicle-');
const isCreationKit = (kit: string): boolean => kit === 'player-rig' || kit.startsWith('spore:') || kit.startsWith('creation:');
const isPropKit = (kit: string): boolean => kit === 'astro-suit';

/** The coarse entity type of a hit. */
export function classifyPing(hit: PingHit): PingEntityType {
  switch (hit.source) {
    case 'kit': {
      const kit = hit.kitId ?? '';
      if (isVehicleKit(kit)) return 'rover';
      if (isCreationKit(kit)) return 'creation';
      if (isPropKit(kit)) return 'prop';
      return 'machine';
    }
    case 'piece':
      return 'structure';
    case 'clutter':
      return 'prop';
    case 'ground':
      return 'terrain';
    case 'shell':
      // the lab's floor (and a ceiling) is the ground of the room; its walls are walls
      return Math.abs(hit.normal.y) >= WALL_NY ? 'terrain' : 'wall';
  }
}

/** The id an AI refers to the hit by: the kit for a part, the piece or prop id, else the surface. */
function entityIdOf(hit: PingHit, type: PingEntityType, where: 'lab' | 'planet'): string {
  if (hit.kitId) return hit.kitId;
  if (hit.objectId) return hit.objectId;
  if (type === 'terrain') return where === 'lab' ? (hit.normal.y < 0 ? 'lab-ceiling' : 'lab-floor') : 'ground';
  if (type === 'wall') return `lab-wall-${wallSide(hit.normal)}`;
  return type;
}

/** Which way a lab wall faces, named by the side of the room it stands on (its normal points into the room). */
function wallSide(n: PingVec3): 'north' | 'south' | 'east' | 'west' {
  if (Math.abs(n.x) > Math.abs(n.z)) return n.x > 0 ? 'west' : 'east';
  return n.z > 0 ? 'north' : 'south';
}

/** Rounds for the wire: centimetres for positions and distance, three places for the normal. */
const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** A hit as the screen keeps it and the bridge receives it. */
export function pingTargetOf(hit: PingHit, where: 'lab' | 'planet'): PingTarget {
  const entityType = classifyPing(hit);
  const len = Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z) || 1;
  return {
    x: r2(hit.point.x),
    y: r2(hit.point.y),
    z: r2(hit.point.z),
    normal: { x: r3(hit.normal.x / len), y: r3(hit.normal.y / len), z: r3(hit.normal.z / len) },
    entityType,
    entityId: entityIdOf(hit, entityType, where),
    ...(hit.kitId !== undefined ? { kitId: hit.kitId } : {}),
    ...(hit.partId !== undefined ? { partId: hit.partId } : {}),
    ...(hit.part !== undefined ? { part: hit.part } : {}),
    ...(hit.material !== undefined ? { material: hit.material } : {}),
    distance: r2(hit.distance),
  };
}

/** The nearest of several hits (the scene casts against each kind of thing and keeps the closest). */
export function nearestPingHit(hits: readonly (PingHit | null)[]): PingHit | null {
  let best: PingHit | null = null;
  for (const h of hits) if (h && Number.isFinite(h.distance) && (!best || h.distance < best.distance)) best = h;
  return best;
}

/** Names the kits the game knows by sight; anything else is its id made readable. */
const KIT_NAMES: Readonly<Record<string, string>> = {
  gate: 'Quantum archway gate',
  'gate-dais': 'Gate dais',
  'capacitor-bank': 'Capacitor bank',
  stargate: 'Stargate',
  'astro-suit': 'Your suit',
  'player-rig': 'Your rig',
};

/** 'hazard-rim' -> 'hazard rim'; 'cells[1]/can' -> 'can'. */
export function readablePart(id: string): string {
  const leaf = id.split('/').pop() ?? id;
  return leaf.replace(/\[\d+\]|#\d+$/g, '').replace(/[-_]+/g, ' ').trim();
}

/** A kit id as a name: the known kits by name, a plot machine by its kind, a vehicle by its kind. */
export function kitName(kitId: string): string {
  const known = KIT_NAMES[kitId];
  if (known) return known;
  if (kitId.startsWith('vehicle-')) return `${capitalise(readablePart(kitId.slice('vehicle-'.length)))} rover`;
  if (kitId.startsWith('plot:')) {
    // plot:<id>@<built>: the machine's id names its kind first ('mill-3')
    const id = kitId.slice('plot:'.length).split('@')[0] ?? '';
    return capitalise(readablePart(id.replace(/\d+$/, '')).trim() || 'machine');
  }
  return capitalise(readablePart(kitId));
}

const capitalise = (s: string): string => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s);

const TYPE_NAMES: Readonly<Record<PingEntityType, string>> = {
  machine: 'machine',
  rover: 'rover',
  wall: 'wall',
  terrain: 'ground',
  structure: 'base piece',
  prop: 'prop',
  creation: 'creation',
};

/** The short name the HUD shows: 'Quantum archway gate · rim front', 'Lab wall, west side', 'Ground'. The placed part names which one. */
export function pingLabel(t: PingTarget): string {
  if (t.kitId) {
    const part = t.partId ? readablePart(t.partId) : t.part ? readablePart(t.part) : '';
    return part ? `${kitName(t.kitId)} · ${part}` : kitName(t.kitId);
  }
  if (t.entityType === 'terrain') return t.entityId === 'lab-floor' ? 'Lab floor' : t.entityId === 'lab-ceiling' ? 'Lab ceiling' : 'Ground';
  if (t.entityType === 'wall') return t.entityId.startsWith('lab-wall-') ? `Lab wall, ${t.entityId.slice('lab-wall-'.length)} side` : 'Wall';
  return capitalise(TYPE_NAMES[t.entityType]);
}

/** What the companion says on a ping: 'Target locked: Quantum archway gate, rim front, at (0.0, -6.4), 6.3 m.' */
export function pingCallout(t: PingTarget): string {
  const name = pingLabel(t).replace(' · ', ', ');
  return `Target locked: ${name}, at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}), ${t.distance.toFixed(1)} m.`;
}

/** The bridge event for a ping (POST /event). */
export function pingEvent(t: PingTarget, where: 'lab' | 'planet'): { readonly type: 'ping'; readonly where: 'lab' | 'planet'; readonly label: string; readonly target: PingTarget } {
  return { type: 'ping', where, label: pingLabel(t), target: t };
}

/** The marker's look at an age: whether it still shows, the bracket scale, the overall alpha and the ripple. */
export interface PingPulse {
  readonly alive: boolean;
  /** The brackets' size relative to the reticle (the drop-in, then the breathing). */
  readonly scale: number;
  /** 0 to 1: full until the fade, then down to 0 at the end of the life. */
  readonly alpha: number;
  /** The ripple's size relative to the reticle (1 to PING_RIPPLE_GROW) and its alpha. */
  readonly ripple: number;
  readonly rippleAlpha: number;
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** The marker's pulse at `age` seconds after the ping. */
export function pingPulse(age: number): PingPulse {
  if (!(age >= 0) || age >= PING_LIFE_S) return { alive: false, scale: 1, alpha: 0, ripple: 1, rippleAlpha: 0 };
  const drop = age < PING_DROP_S ? PING_DROP_FROM + (1 - PING_DROP_FROM) * easeOutCubic(age / PING_DROP_S) : 1;
  const breath = age < PING_DROP_S ? 0 : PING_BREATH_DEPTH * Math.sin(2 * Math.PI * PING_BREATH_HZ * (age - PING_DROP_S));
  const fadeFrom = PING_LIFE_S - PING_FADE_S;
  const alpha = age <= fadeFrom ? 1 : Math.max(0, (PING_LIFE_S - age) / PING_FADE_S);
  const phase = (age % PING_RIPPLE_S) / PING_RIPPLE_S;
  return {
    alive: true,
    scale: drop + breath,
    alpha,
    ripple: 1 + (PING_RIPPLE_GROW - 1) * easeOutCubic(phase),
    rippleAlpha: alpha * (1 - phase) * 0.8,
  };
}

/** The reticle's size in metres at a distance: big enough to read at 40 m, small enough not to cover a bolt at 2 m. */
export function pingSizeM(distance: number): number {
  return Math.min(2.4, Math.max(0.28, distance * 0.045));
}
