/**
 * @hm/gamebridge (Plan 51 Wave 2): bridging ANY game the player names, by permission.
 *
 * The drone in play is asked to "bridge this game". The AI on the bridge checks that game's terms live and answers with a
 * permission profile (docs/GAME_BRIDGE_PERMISSIONS_RESEARCH.md):
 *  - copyright protects expression (art, audio, models, text), so the `assets` class NEVER crosses, whatever a profile says;
 *  - mechanics (the numbers of rules and feel: gravity, jump and dash curves, fire rates, trigger -> action rules) are
 *    ideas and systems, which copyright does not protect, so mechanics ALWAYS cross. No verdict blocks them: an unchecked
 *    or refused game still bridges its mechanics out of the box through the floor rungs (below);
 *  - the floor rungs read only what the game itself sends out (its official telemetry) or shows the player (the screen,
 *    the last resort). The deeper rungs (mod SDK, loader, the game's files) touch the game's code or data, where terms and
 *    anti-cheat do bind, so they need a checked profile that allows them;
 *  - samples (a trajectory, shot times, an event log) are consumed to measure the mechanics and never kept; keeping or
 *    sharing raw session samples is the `telemetry` class, and the game's own names for things (event values) are the
 *    `entity-kinds` class: without it they cross as anonymous labels, so a rule's shape survives and its words do not.
 *
 * Nothing here knows any particular game: a game is a profile (who checked what, where) and, when it publishes telemetry,
 * a mapping preset (dotted paths from its payload to the observation's numbers). Pure: no DOM, no clock, no randomness.
 */
import { OBSERVER_LADDER, type MechanicObservation, type ObserverChannel } from '@hm/harness';

/** What may cross. `assets` exists only so a profile can be checked for it and refused. */
export type StreamClass = 'mechanics' | 'telemetry' | 'entity-kinds' | 'assets';
export const SAFE_STREAM_CLASSES: readonly StreamClass[] = ['mechanics', 'telemetry', 'entity-kinds'];

/**
 * The rungs every game allows, checked or not: its own official telemetry (the game sends it out to be read), the screen
 * (what the player sees) and input-audio (the game's own audio session and the player's own fire, jump and dash keys, read
 * only while the game's window is in front). None of them touches the game's code, memory or files. Mechanics read
 * through them cross whatever a profile says.
 */
export const FLOOR_CHANNELS: readonly ObserverChannel[] = ['telemetry', 'screen', 'input-audio'];

/** The rungs a profile allows: the floor, plus the deeper rungs a checked profile names (best first). */
export function allowedChannels(profile: BridgePermissionProfile): readonly ObserverChannel[] {
  return OBSERVER_LADDER.filter((rung) => FLOOR_CHANNELS.includes(rung) || profile.channels.includes(rung));
}

export type BridgeVerdict = 'permitted' | 'limited' | 'refused' | 'unchecked';

/**
 * A path into a telemetry payload: dotted fields ("player.position"), indices ("allplayers[0]") and selectors
 * ("player.weapons[state=active].ammo_clip": the first child whose field has that value), with an optional split of a
 * "x, y, z" string and a scale.
 */
export interface TelemetryPath {
  readonly path: string;
  /** Split the string at this separator and take `index` (a GSI-style "x, y, z" position). */
  readonly split?: string;
  readonly index?: number;
  /** Multiplies the value into metres or seconds (a game's units to FIDELITY's). */
  readonly scale?: number;
}

/** A counter whose steps are shots: rounds fired rising, or an ammo clip falling. */
export interface ShotCounterPath extends TelemetryPath {
  /** 'up' (default): each rise is a shot. 'down': each fall is a shot, and a rise (a reload) is not. */
  readonly counts?: 'up' | 'down';
  /** A path whose change re-bases the counter instead of counting (the active weapon's name: a switch is not a shot). */
  readonly scope?: string;
}

/** What an event means for play, whatever the game calls it (plan 51 wave 3: the reflex slot binds classes, not names). */
export type EventClass = 'threat' | 'mobility' | 'outcome' | 'objective' | 'harm';
export const EVENT_CLASSES: readonly EventClass[] = ['threat', 'mobility', 'outcome', 'objective', 'harm'];

/** How one game's official telemetry payload becomes observation samples: data, not code (a new game is a new preset). */
export interface TelemetryMapping {
  /** The sample's time in seconds; absent: the time the bridge received it. */
  readonly t?: TelemetryPath;
  readonly x?: TelemetryPath;
  readonly y?: TelemetryPath;
  readonly z?: TelemetryPath;
  readonly shotCounter?: ShotCounterPath;
  /** Fields whose change is an event, named by the field ("round.phase" changing to "over" is "round.phase:over"). */
  readonly events?: readonly string[];
  /** The class of an event field, where the keyword classifier would guess wrong. */
  readonly eventClasses?: Readonly<Record<string, EventClass>>;
  /** Plan 53: the held weapon's class ("Rifle", "Pistol"...), which picks the FIDELITY weapon that stands in for it. */
  readonly weaponClass?: string;
  /** Plan 53: the live state shown on FIDELITY's HUD, label to path ("health": "player.state.health"). */
  readonly hud?: Readonly<Record<string, string>>;
}

/**
 * Plan 53: mechanics a game publishes as constants (facts, with their sources), in FIDELITY's units. A documented value
 * is used where no rung measured one; a measured one always wins.
 */
export interface DocumentedMechanics {
  readonly gravityMps2?: number;
  readonly jumpImpulseMps?: number;
  readonly walkSpeedMps?: number;
  readonly runSpeedMps?: number;
  readonly sources: readonly { readonly url: string; readonly quote: string }[];
}

/** Keywords in an event's field path, per class: the default classification (a mapping can override it). */
const CLASS_WORDS: readonly (readonly [RegExp, EventClass])[] = [
  [/boss|wave|spawn|horde|alarm|alert|enemy|enemies|leak|surge|siege|invasion/, 'threat'],
  [/dash|jump|sprint|slide|movement|airborne|grounded|crouch|mantle|vault|roll/, 'mobility'],
  [/bomb|flag|objective|capture|checkpoint|lap|goal|point|zone/, 'objective'],
  [/health|damage|hurt|armor|armour|flashed|burning|bleed|stun|shield/, 'harm'],
  [/round|kill|score|death|frag|match|win|streak|mvp|assist/, 'outcome'],
];

/** The field part of an event name ("round.phase:#2" -> "round.phase"). */
export const eventField = (name: string): string => { const cut = name.indexOf(':'); return cut < 0 ? name : name.slice(0, cut); };

/** The class of an event by its field path (the overrides first), or null when no keyword says. */
export function classifyEventField(name: string, overrides?: Readonly<Record<string, EventClass>>): EventClass | null {
  const field = eventField(name);
  const set = overrides?.[field];
  if (set) return set;
  const low = field.toLowerCase();
  return CLASS_WORDS.find(([re]) => re.test(low))?.[1] ?? null;
}

export interface BridgePermissionProfile {
  readonly schema: 'hm2:bridge-profile:v1';
  /** A stable id (lowercase, from the title or the process). */
  readonly gameId: string;
  readonly title: string;
  readonly engine?: string;
  readonly verdict: BridgeVerdict;
  /** Allowed observer rungs beyond the floor (the floor, FLOOR_CHANNELS, is always allowed), best first. */
  readonly channels: readonly ObserverChannel[];
  /** Allowed stream classes (always `mechanics`, never `assets`). */
  readonly streams: readonly StreamClass[];
  /** Only while the player is alone in the game (no online session data crosses). */
  readonly soloOnly: boolean;
  /** The terms read for the verdict, with the lines that decided it. */
  readonly sources: readonly { readonly url: string; readonly quote: string }[];
  /** Who checked ("claude-opus via the bridge", "scripted agent: not checked"). */
  readonly checkedBy: string;
  /** When, as the checker gave it (an ISO date string; data, not this module's clock). */
  readonly checkedOn?: string;
  /** Steps for the player (where to point the game's telemetry, which option to turn on). */
  readonly setup: readonly string[];
  /** The game's official telemetry mapping, when it has one. */
  readonly telemetry?: TelemetryMapping;
  /** Plan 53: the mechanics the game publishes as constants. */
  readonly documented?: DocumentedMechanics;
  /** Plan 53: the anti-cheat that guards it, and the modes where bridging deeper carries no ban risk. */
  readonly antiCheat?: AntiCheatInfo;
  /** Plan 53: how the game takes the player's own relayed presses, when they choose to turn the relay on. */
  readonly inputRelay?: InputRelaySpec;
  readonly notes: readonly string[];
}

/** An anti-cheat a game runs (VAC, Easy Anti-Cheat, BattlEye, Vanguard...): when it watches and where it does not. */
export interface AntiCheatInfo {
  readonly system: string;
  /** 'online': secured servers and matchmaking; 'always': whenever the game runs (kernel drivers loaded at boot). */
  readonly scope: 'online' | 'always';
  /** Modes where it does not watch or the server allows it (offline bots, a server you host, cheats switched on). */
  readonly safeModes: readonly string[];
  readonly sources: readonly { readonly url: string; readonly quote: string }[];
}

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,47}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** A game id from a title or a process name: "Counter-Strike 2" -> "counter-strike-2", "cs2.exe" -> "cs2". */
export function gameIdOf(name: string): string {
  const id = name.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return id || 'game';
}

/**
 * The profile a game gets when no one has checked its terms: mechanics through the floor rungs (its own telemetry, the
 * screen), solo. It bridges out of the box; a checked profile can add the deeper rungs, raw samples and names.
 */
export function uncheckedProfile(title: string, gameId = gameIdOf(title)): BridgePermissionProfile {
  return {
    schema: 'hm2:bridge-profile:v1', gameId, title, verdict: 'unchecked',
    channels: [...FLOOR_CHANNELS], streams: ['mechanics'], soloOnly: true, sources: [], checkedBy: 'nobody (no AI checked the terms)',
    setup: ['Turn on the game\'s own telemetry if it has one, or link the game window from the comms panel so I can read the screen.'],
    notes: ['No one has checked this game\'s terms: its mechanics cross through its own telemetry or the screen, never its assets, and its names cross as anonymous labels.'],
  };
}

type PathToken = { readonly field: string } | { readonly index: number } | { readonly key: string; readonly value: string };
const TOKEN_RE = /\.?([A-Za-z0-9_-]+)|\[(\d+)\]|\[([A-Za-z0-9_]+)=([A-Za-z0-9_ .-]*)\]/y;

/** A path's tokens, or null when any character of it is not a field, an index or a selector. */
export function pathTokens(path: string): PathToken[] | null {
  if (path.length === 0 || path.length > 128) return null;
  const out: PathToken[] = [];
  TOKEN_RE.lastIndex = 0;
  while (TOKEN_RE.lastIndex < path.length) {
    const at = TOKEN_RE.lastIndex;
    const m = TOKEN_RE.exec(path);
    if (!m || m.index !== at) return null;
    if (m[1] !== undefined) out.push({ field: m[1] });
    else if (m[2] !== undefined) out.push({ index: Number(m[2]) });
    else out.push({ key: m[3]!, value: m[4] ?? '' });
  }
  return out;
}

// ------------------------------------------------------------------ shipped presets (checked profiles that need no AI)

/**
 * FIDELITY's own telemetry payload (any FIDELITY tab with `?telemetry-out`): seconds on the tab's clock, the player in
 * metres (y up), the weapon in hand and its ammo, and the world's waves, open leaks and kills. Our own game: everything
 * may cross, names included.
 */
export const FIDELITY_TELEMETRY_MAPPING: TelemetryMapping = {
  t: { path: 't' },
  x: { path: 'player.x' }, y: { path: 'player.y' }, z: { path: 'player.z' },
  shotCounter: { path: 'weapon.ammo', counts: 'down', scope: 'weapon.name' },
  weaponClass: 'weapon.name',
  hud: { ammo: 'weapon.ammo', wave: 'world.wave', kills: 'world.kills' },
  events: ['player.airborne', 'world.wave', 'world.leaksOpen', 'world.kills'],
  eventClasses: { 'player.airborne': 'mobility', 'world.wave': 'threat', 'world.leaksOpen': 'threat', 'world.kills': 'outcome' },
};

/**
 * Counter-Strike 2 through Valve's Game State Integration (research 28 Oct, docs/GAME_BRIDGE_PERMISSIONS_RESEARCH.md):
 * the game POSTs JSON to a local URI named in a cfg file in its own cfg folder. While playing it sends only the local
 * player's data. Shots are the active weapon's clip falling (a reload or a switch is not a shot); the time is when the
 * bridge received the post (GSI's own timestamp is whole seconds). Position is Source units (an inch), z up; it may be
 * sent only while spectating, so gravity is "if present" and fire and round, bomb and kill rules are the sure part.
 */
export const CS2_TELEMETRY_MAPPING: TelemetryMapping = {
  x: { path: 'player.position', split: ',', index: 0, scale: 0.0254 },
  y: { path: 'player.position', split: ',', index: 2, scale: 0.0254 },
  z: { path: 'player.position', split: ',', index: 1, scale: 0.0254 },
  shotCounter: { path: 'player.weapons[state=active].ammo_clip', counts: 'down', scope: 'player.weapons[state=active].name' },
  weaponClass: 'player.weapons[state=active].type',
  hud: { health: 'player.state.health', ammo: 'player.weapons[state=active].ammo_clip', round: 'round.phase', kills: 'player.match_stats.kills' },
  events: ['round.phase', 'round.bomb', 'map.phase', 'player.state.round_kills', 'player.match_stats.kills', 'player.state.health', 'player.state.flashed'],
  eventClasses: {
    'round.phase': 'outcome', 'map.phase': 'outcome', 'round.bomb': 'objective',
    'player.state.round_kills': 'outcome', 'player.match_stats.kills': 'outcome', 'player.state.health': 'harm', 'player.state.flashed': 'harm',
  },
};

const CS2_PROFILE: BridgePermissionProfile = {
  schema: 'hm2:bridge-profile:v1', gameId: 'cs2', title: 'Counter-Strike 2', engine: 'Source 2', verdict: 'limited',
  channels: ['telemetry', 'screen', 'input-audio'], streams: ['mechanics', 'telemetry', 'entity-kinds'], soloOnly: false,
  sources: [
    { url: 'https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration', quote: '' },
    { url: 'https://github.com/antonpup/CounterStrike2GSI', quote: 'will only expose local player\'s information when playing a game' },
  ],
  checkedBy: 'claude-opus (research)', checkedOn: '2026-10-28',
  setup: ['Run "node scripts/bridge-setup.mjs cs2" once (it writes Valve\'s gamestate_integration_fidelity.cfg into the game\'s cfg folder), then restart CS2.'],
  telemetry: CS2_TELEMETRY_MAPPING,
  inputRelay: {
    transport: 'synthetic-keys',
    bindings: { fire: 'mouse1', use: 'e', jump: 'space', reload: 'r' },
    notes: [
      'CS2 has no remote console any more (-netconport was CS:GO\'s), so only keys, and only while CS2\'s window is in front: on one PC that is never while you play FIDELITY.',
      'View angles are not relayed: setang is cheat-protected and needs a console.',
    ],
  },
  antiCheat: {
    system: 'VAC (Valve Anti-Cheat)',
    scope: 'online',
    safeModes: [
      'offline practice against bots',
      'a private or LAN server you host yourself, with sv_cheats 1 where you need it',
      'the game started with -insecure, which keeps you off VAC servers (a community report; Valve does not document whether it removes ban risk)',
    ],
    sources: [
      { url: 'https://steamcommunity.com/app/730/discussions/0/6352962692739126906', quote: 'it disables VAC modules, so you can only play on non-secured servers' },
    ],
  },
  // sv_gravity's default, 800 units/s², at the engine's inch scale; GSI sends no position while playing, so this is the
  // only gravity there is. The jump impulse found no source that confirms it, so it is not here (plan 53 §1)
  documented: {
    gravityMps2: 20.32,
    sources: [
      { url: 'https://csdb.gg/commands/sv_gravity', quote: 'sv_gravity default 800' },
      { url: 'https://totalcsgo.com/commands/svgravity', quote: 'CS2 and CS:GO sv_gravity, default 800' },
    ],
  },
  notes: [
    'Game State Integration is Valve\'s own feature for overlays and tools: the official telemetry rung, online included.',
    'No mods, loaders or memory reads: VAC guards the game, so the deeper rungs stay closed.',
  ],
};

/** The FIDELITY profile for one of its games ("fidelity-arena-survivor"): permitted, everything but assets, names included. */
export function fidelityProfile(gameId: string): BridgePermissionProfile {
  const rest = gameId.replace(/^fidelity-?/, '').replace(/-/g, ' ');
  return {
    schema: 'hm2:bridge-profile:v1', gameId, title: `FIDELITY${rest ? ` ${rest}` : ''}`, engine: 'FIDELITY', verdict: 'permitted',
    channels: [...OBSERVER_LADDER], streams: ['mechanics', 'telemetry', 'entity-kinds'], soloOnly: false, sources: [],
    checkedBy: 'FIDELITY (our own game)', setup: ['Open the other FIDELITY tab with ?telemetry-out added to its address.'],
    telemetry: FIDELITY_TELEMETRY_MAPPING,
    notes: ['A FIDELITY instance bridged into another: the whole pipe, with no install.'],
  };
}

/** Process signatures of the games with a shipped profile, for the running-game ranker ("bridge counter strike" -> cs2.exe). */
export const PRESET_SIGNATURES: readonly { readonly tokens: readonly string[]; readonly title: string }[] = [
  { tokens: ['cs2'], title: 'Counter-Strike 2' },
];

/** The shipped profile for a game, when there is one (CS2, any FIDELITY game); null sends the game to the unchecked one. */
export function bridgePresetFor(gameId: string): BridgePermissionProfile | null {
  if (gameId === 'cs2' || gameId === 'counter-strike-2' || gameId === 'counter-strike') return CS2_PROFILE;
  if (/^fidelity(-[a-z0-9-]+)?$/.test(gameId)) return fidelityProfile(gameId);
  return null;
}

function checkPath(v: unknown): (TelemetryPath & { counts?: 'up' | 'down'; scope?: string }) | null {
  if (!isRecord(v)) return null;
  const path = str(v.path, 128);
  if (!path || !pathTokens(path)) return null;
  const out: { path: string; split?: string; index?: number; scale?: number; counts?: 'up' | 'down'; scope?: string } = { path };
  if (v.split !== undefined) { const s = str(v.split, 4); if (!s) return null; out.split = s; }
  if (v.index !== undefined) { if (!Number.isInteger(v.index) || (v.index as number) < 0 || (v.index as number) > 16) return null; out.index = v.index as number; }
  if (v.scale !== undefined) { if (typeof v.scale !== 'number' || !Number.isFinite(v.scale) || v.scale === 0) return null; out.scale = v.scale; }
  if (v.counts !== undefined) { if (v.counts !== 'up' && v.counts !== 'down') return null; out.counts = v.counts; }
  if (v.scope !== undefined) { const s = str(v.scope, 128); if (!s || !pathTokens(s)) return null; out.scope = s; }
  return out;
}

/**
 * A profile from an AI (or a file), checked strictly: a malformed one is refused. `assets` is stripped from the streams
 * whatever was sent, `mechanics` is always in them, and a `refused` verdict keeps no deeper rungs and no class beyond
 * mechanics (the floor stays: mechanics are no one's to refuse).
 */
export function checkBridgeProfile(v: unknown): BridgePermissionProfile | null {
  if (!isRecord(v) || v.schema !== 'hm2:bridge-profile:v1') return null;
  const gameId = str(v.gameId, 48);
  const title = str(v.title, 96);
  const verdict = v.verdict;
  if (!gameId || !ID_RE.test(gameId) || !title || !['permitted', 'limited', 'refused', 'unchecked'].includes(verdict as string)) return null;
  const channels = Array.isArray(v.channels) ? v.channels.filter((c): c is ObserverChannel => (OBSERVER_LADDER as readonly string[]).includes(c as string)) : [];
  const streams = Array.isArray(v.streams) ? v.streams.filter((s): s is StreamClass => (SAFE_STREAM_CLASSES as readonly string[]).includes(s as string)) : [];
  const sources = Array.isArray(v.sources)
    ? v.sources.slice(0, 12).flatMap((s) => (isRecord(s) && str(s.url, 512) && /^https?:\/\//.test(s.url as string) ? [{ url: s.url as string, quote: typeof s.quote === 'string' ? s.quote.slice(0, 400) : '' }] : []))
    : [];
  const lines = (a: unknown, max: number): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string').slice(0, max).map((x) => x.slice(0, 300)) : []);
  let telemetry: TelemetryMapping | undefined;
  if (isRecord(v.telemetry)) {
    const t = v.telemetry;
    const m: { t?: TelemetryPath; x?: TelemetryPath; y?: TelemetryPath; z?: TelemetryPath; shotCounter?: ShotCounterPath; events?: string[]; eventClasses?: Record<string, EventClass>; weaponClass?: string; hud?: Record<string, string> } = {};
    for (const k of ['t', 'x', 'y', 'z', 'shotCounter'] as const) {
      if (t[k] !== undefined) { const p = checkPath(t[k]); if (!p) return null; m[k] = p; }
    }
    if (t.weaponClass !== undefined) { const p = str(t.weaponClass, 128); if (!p || !pathTokens(p)) return null; m.weaponClass = p; }
    if (isRecord(t.hud)) {
      const hud: Record<string, string> = {};
      for (const [label, path] of Object.entries(t.hud).slice(0, 8)) {
        if (/^[a-z][a-z0-9 -]{0,23}$/.test(label) && typeof path === 'string' && pathTokens(path)) hud[label] = path;
      }
      m.hud = hud;
    }
    if (t.events !== undefined) m.events = lines(t.events, 16).filter((e) => pathTokens(e) !== null);
    if (isRecord(t.eventClasses)) {
      const classes: Record<string, EventClass> = {};
      for (const [field, cls] of Object.entries(t.eventClasses).slice(0, 32)) {
        if (pathTokens(field) && (EVENT_CLASSES as readonly string[]).includes(cls as string)) classes[field] = cls as EventClass;
      }
      m.eventClasses = classes;
    }
    telemetry = m;
  }
  // documented mechanics: finite numbers in plausible ranges, each claim with an http(s) source
  let documented: DocumentedMechanics | undefined;
  if (isRecord(v.documented)) {
    const d = v.documented;
    const num = (x: unknown, lo: number, hi: number): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined);
    const dsrc = Array.isArray(d.sources)
      ? d.sources.slice(0, 8).flatMap((s) => (isRecord(s) && str(s.url, 512) && /^https?:\/\//.test(s.url as string) ? [{ url: s.url as string, quote: typeof s.quote === 'string' ? s.quote.slice(0, 200) : '' }] : []))
      : [];
    const g = num(d.gravityMps2, 0.1, 60), j = num(d.jumpImpulseMps, 0.1, 40), w = num(d.walkSpeedMps, 0.1, 40), r = num(d.runSpeedMps, 0.1, 60);
    if (dsrc.length && (g ?? j ?? w ?? r) !== undefined) {
      documented = { ...(g !== undefined ? { gravityMps2: g } : {}), ...(j !== undefined ? { jumpImpulseMps: j } : {}), ...(w !== undefined ? { walkSpeedMps: w } : {}), ...(r !== undefined ? { runSpeedMps: r } : {}), sources: dsrc };
    }
  }
  let antiCheat: AntiCheatInfo | undefined;
  if (isRecord(v.antiCheat) && str(v.antiCheat.system, 64)) {
    const a = v.antiCheat;
    const asrc = Array.isArray(a.sources)
      ? a.sources.slice(0, 6).flatMap((s) => (isRecord(s) && str(s.url, 512) && /^https?:\/\//.test(s.url as string) ? [{ url: s.url as string, quote: typeof s.quote === 'string' ? s.quote.slice(0, 200) : '' }] : []))
      : [];
    antiCheat = { system: a.system as string, scope: a.scope === 'always' ? 'always' : 'online', safeModes: lines(a.safeModes, 6), sources: asrc };
  }
  const refused = verdict === 'refused';
  return {
    schema: 'hm2:bridge-profile:v1', gameId, title, verdict: verdict as BridgeVerdict,
    ...(str(v.engine, 48) ? { engine: v.engine as string } : {}),
    channels: refused ? [...FLOOR_CHANNELS] : [...new Set(channels)],
    streams: refused ? ['mechanics'] : [...new Set<StreamClass>(['mechanics', ...streams])],
    soloOnly: refused || v.soloOnly !== false,
    sources,
    checkedBy: str(v.checkedBy, 96) ?? 'unknown',
    ...(str(v.checkedOn, 32) ? { checkedOn: v.checkedOn as string } : {}),
    setup: lines(v.setup, 8),
    ...(telemetry ? { telemetry } : {}),
    ...(documented ? { documented } : {}),
    ...(antiCheat ? { antiCheat } : {}),
    ...(checkInputRelay(v.inputRelay) ? { inputRelay: checkInputRelay(v.inputRelay)! } : {}),
    notes: lines(v.notes, 8),
  };
}

/** The best rung the profile allows that the observer can actually use now (best first), or null. */
export function bestChannel(profile: BridgePermissionProfile, available: readonly ObserverChannel[]): ObserverChannel | null {
  for (const rung of allowedChannels(profile)) if (available.includes(rung)) return rung;
  return null;
}

/**
 * An event log with the game's own words taken out: "boss.state:Enraged" becomes "boss.state:#2" (the second value that field
 * took). The field path stays (it is the telemetry API's structure, written by the mapping), so the trigger -> action rule the
 * harness reads keeps its shape and timing and loses only the game's names. Deterministic: labels number in order of arrival.
 */
export function anonymizeEvents(events: readonly { readonly t: number; readonly name: string }[], anonymize: (name: string) => string = createEventAnonymizer()): { t: number; name: string }[] {
  return events.map((e) => ({ t: e.t, name: anonymize(e.name) }));
}

/**
 * One session's anonymizer: the same value always gets the same label, across batches and live events, so a bridged rule
 * learnt from one batch still matches the events that arrive after it. A name already a label ("field:#3") passes as it is.
 */
export function createEventAnonymizer(): (name: string) => string {
  const labels = new Map<string, Map<string, number>>();
  return (name) => {
    const cut = name.indexOf(':');
    const field = cut < 0 ? 'event' : name.slice(0, cut);
    const value = cut < 0 ? name : name.slice(cut + 1);
    if (/^#\d+$/.test(value)) return name;
    const seen = labels.get(field) ?? new Map<string, number>();
    labels.set(field, seen);
    if (!seen.has(value)) seen.set(value, seen.size + 1);
    return `${field}:#${seen.get(value)}`;
  };
}

/**
 * Cuts an observation down to what the profile allows. Mechanics always cross, so nothing is refused for its verdict:
 *  - synthetic data (a test, a demo) passes untouched;
 *  - a rung outside the floor that the profile does not allow refuses the observation (read it through the floor instead);
 *  - trajectory, shot times and the event log pass: the harness consumes them to measure the mechanics and keeps none;
 *  - event names pass as anonymous labels unless the profile allows `entity-kinds`.
 */
export function gateObservation(profile: BridgePermissionProfile | null, obs: MechanicObservation): { readonly observation: MechanicObservation | null; readonly dropped: readonly string[] } {
  if (obs.channel === 'synthetic') return { observation: obs, dropped: [] };
  const p = profile ?? uncheckedProfile(obs.game);
  if (!allowedChannels(p).includes(obs.channel)) {
    return { observation: null, dropped: [`the ${obs.channel} rung needs a checked profile for ${p.title} (its own telemetry or the screen work without one)`] };
  }
  const dropped: string[] = [];
  let events = obs.events;
  if (events && !p.streams.includes('entity-kinds')) {
    events = anonymizeEvents(events);
    dropped.push('the game\'s names for its events (they cross as anonymous labels)');
  }
  if (!obs.trajectory && !obs.shots && !events) return { observation: null, dropped };
  return {
    observation: { game: obs.game, channel: obs.channel, ...(obs.trajectory ? { trajectory: obs.trajectory } : {}), ...(obs.shots ? { shots: obs.shots } : {}), ...(events ? { events } : {}) },
    dropped,
  };
}

// ------------------------------------------------------------------ telemetry mapping (an official payload -> samples)

/** The value at a path: fields, indices, and selectors that pick the first child whose field has the value. */
export function readRaw(payload: unknown, path: string): unknown {
  const tokens = pathTokens(path);
  if (!tokens) return undefined;
  let cur: unknown = payload;
  for (const tok of tokens) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if ('field' in tok) cur = (cur as Record<string, unknown>)[tok.field];
    else if ('index' in tok) cur = (cur as Record<string, unknown>)[String(tok.index)];
    else cur = Object.values(cur as Record<string, unknown>).find((c) => isRecord(c) && String(c[tok.key]) === tok.value);
  }
  return cur;
}

/** Reads a path ("player.state.health", "allplayers[0].position", "player.weapons[state=active].ammo_clip") as a number. */
export function readPath(payload: unknown, p: TelemetryPath): number | null {
  let cur = readRaw(payload, p.path);
  if (typeof cur === 'string' && p.split !== undefined) cur = cur.split(p.split)[p.index ?? 0]?.trim();
  const n = typeof cur === 'number' ? cur : typeof cur === 'string' && cur.trim() !== '' ? Number(cur) : NaN;
  return Number.isFinite(n) ? n * (p.scale ?? 1) : null;
}

export interface TelemetryAccumulator {
  /**
   * Takes one payload, received at `receivedAt` seconds (used when the mapping has no time path). Returns the events this
   * payload made (already renamed), so a live consumer (the reflex slot) reacts as they happen, not a batch later.
   */
  push(payload: unknown, receivedAt: number): readonly { readonly t: number; readonly name: string }[];
  /** Samples held. */
  size(): number;
  /** Seconds of game time the held samples span (a sparse feed, like a game that posts only on change, fills by time). */
  span(): number;
  /** The held samples by kind (a trajectory wants a full batch; shots and events alone can close by time). */
  counts(): { readonly trajectory: number; readonly shots: number; readonly events: number };
  /** The observation the held samples make (and clears them), or null when there is too little. */
  take(game: string, channel: ObserverChannel): MechanicObservation | null;
}

/**
 * Turns a stream of official telemetry payloads into observation samples through a mapping preset. `rename` is applied to
 * every event name as it is made (a session's anonymizer when the game's names may not cross).
 */
export function createTelemetryAccumulator(mapping: TelemetryMapping, opts: { readonly cap?: number; readonly rename?: (name: string) => string; readonly overlapS?: number } = {}): TelemetryAccumulator {
  const cap = opts.cap ?? 20000;
  const overlapS = opts.overlapS ?? 8;
  const rename = opts.rename ?? ((n: string) => n);
  let t: number[] = [], x: number[] = [], y: number[] = [], z: number[] = [];
  let shots: number[] = [];
  let events: { t: number; name: string }[] = [];
  let lastCounter: number | null = null;
  let lastScope: string | null = null;
  let first: number | null = null, last: number | null = null;
  const lastEventValue = new Map<string, string>();
  return {
    push(payload, receivedAt) {
      const time = mapping.t ? readPath(payload, mapping.t) ?? receivedAt : receivedAt;
      first ??= time;
      last = time;
      if (mapping.x && mapping.y && mapping.z) {
        const px = readPath(payload, mapping.x), py = readPath(payload, mapping.y), pz = readPath(payload, mapping.z);
        if (px !== null && py !== null && pz !== null && (t.length === 0 || time > t[t.length - 1]!)) {
          t.push(time); x.push(px); y.push(py); z.push(pz);
        }
      }
      const sc = mapping.shotCounter;
      if (sc) {
        // a change of scope (another weapon in hand) re-bases the counter: its new value is a start, not shots
        const scope = sc.scope !== undefined ? String(readRaw(payload, sc.scope) ?? '') : '';
        if (scope !== lastScope) { lastScope = scope; lastCounter = null; }
        const c = readPath(payload, sc);
        if (c !== null) {
          const step = lastCounter === null ? 0 : sc.counts === 'down' ? lastCounter - c : c - lastCounter;
          for (let k = 0; k < Math.min(20, step); k++) shots.push(time);
          lastCounter = c;
        }
      }
      const made: { t: number; name: string }[] = [];
      for (const path of mapping.events ?? []) {
        const v = readRaw(payload, path);
        if (v === undefined || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) continue;
        const s = String(v);
        if (lastEventValue.has(path) && lastEventValue.get(path) !== s) made.push({ t: time, name: rename(`${path}:${s}`.slice(0, 64)) });
        lastEventValue.set(path, s);
      }
      events.push(...made);
      if (t.length > cap) { t = t.slice(-cap); x = x.slice(-cap); y = y.slice(-cap); z = z.slice(-cap); }
      if (shots.length > cap) shots = shots.slice(-cap);
      if (events.length > cap) events = events.slice(-cap);
      return made;
    },
    size: () => t.length + shots.length + events.length,
    span: () => (first === null || last === null ? 0 : last - first),
    counts: () => ({ trajectory: t.length, shots: shots.length, events: events.length }),
    take(game, channel) {
      const hasTrajectory = t.length >= 8, hasShots = shots.length >= 3, hasEvents = events.length >= 1;
      if (!hasTrajectory && !hasShots && !hasEvents) return null;
      const obs: MechanicObservation = {
        game, channel,
        ...(hasTrajectory ? { trajectory: { t, x, y, z } } : {}),
        ...(hasShots ? { shots: { t: shots } } : {}),
        ...(hasEvents ? { events } : {}),
      };
      // the trajectory's last `overlapS` seconds start the next batch: a jump cut by the boundary is whole in the next one
      // (low gravity arcs last seconds: the Moon's is 6.4 s for a 5 m/s jump, longer than half a batch)
      const keepFrom = t.length ? t[t.length - 1]! - overlapS : Infinity;
      const k0 = t.findIndex((v) => v >= keepFrom);
      if (k0 > 0) { t = t.slice(k0); x = x.slice(k0); y = y.slice(k0); z = z.slice(k0); first = t[0]!; }
      else { t = []; x = []; y = []; z = []; first = null; last = null; }
      shots = []; events = [];
      return obs;
    },
  };
}

// ------------------------------------------------------------------ plan 53: anti-cheat risk, said before anything crosses

/**
 * Anti-cheat systems that run a process of their own, by its name (research 28 Oct: Wikipedia on Easy Anti-Cheat; file.net
 * on BEService.exe and vgc.exe; freefixer on PnkBstrA.exe; FACEIT's own support pages). VAC has no process of its own, so it
 * comes from the game's profile.
 */
const ANTI_CHEAT_PROCESSES: readonly (readonly [RegExp, string, AntiCheatInfo['scope']])[] = [
  [/easyanticheat/i, 'Easy Anti-Cheat', 'always'],
  [/^beservice(_x64)?(\.exe)?$/i, 'BattlEye', 'always'],
  [/^(vgc|vgtray)(\.exe)?$/i, 'Riot Vanguard', 'always'],
  [/faceit/i, 'FACEIT Anti-Cheat', 'always'],
  [/^pnkbstr[ab](\.exe)?$/i, 'PunkBuster', 'online'],
];

/** The anti-cheat systems whose processes are running on this PC. */
export function detectAntiCheat(processes: readonly string[]): { readonly system: string; readonly scope: AntiCheatInfo['scope']; readonly process: string }[] {
  const out: { system: string; scope: AntiCheatInfo['scope']; process: string }[] = [];
  for (const p of processes) {
    const hit = ANTI_CHEAT_PROCESSES.find(([re]) => re.test(p.trim()));
    if (hit && !out.some((o) => o.system === hit[1])) out.push({ system: hit[1], scope: hit[2], process: p.trim() });
  }
  return out;
}

export type BanRisk = 'none known' | 'low' | 'high';
/** What a bridge may do, rung by rung, plus the one thing it never does unasked: send input back into the game. */
export type BridgeAction = ObserverChannel | 'input-out';

/**
 * How much ban risk each way of bridging carries under an anti-cheat. Reading what the game itself sends out (its official
 * telemetry) or what the player sees and hears touches nothing of the game; reading three keys from Windows is not a hook
 * into the game, but anti-cheats do look at input tools, so it is low rather than none; loaders, the game's files and
 * sending input into it are what anti-cheats exist to catch.
 */
export function banRisk(action: BridgeAction, antiCheat: boolean): BanRisk {
  if (!antiCheat || action === 'synthetic') return 'none known';
  if (action === 'telemetry' || action === 'screen') return 'none known';
  if (action === 'input-audio' || action === 'mod-sdk') return 'low';
  return 'high';
}

/**
 * Plan 53: what the drone says about anti-cheat when it bridges a game: the systems guarding it (from its profile, or
 * running on this PC), the risk of what this bridge uses, and the modes where going deeper is safe. Null when none is known.
 */
export function antiCheatAdvice(profile: BridgePermissionProfile, processes: readonly string[]): { readonly systems: readonly string[]; readonly line: string; readonly risks: Readonly<Record<BridgeAction, BanRisk>> } | null {
  const detected = detectAntiCheat(processes);
  const systems = [...new Set([...(profile.antiCheat ? [profile.antiCheat.system] : []), ...detected.map((d) => d.system)])];
  if (systems.length === 0) return null;
  const actions: BridgeAction[] = [...OBSERVER_LADDER, 'input-out'];
  const risks = Object.fromEntries(actions.map((a) => [a, banRisk(a, true)])) as Record<BridgeAction, BanRisk>;
  const safe = profile.antiCheat?.safeModes ?? ['offline or single-player modes', 'a private or LAN server you host yourself', 'any mode the game runs with its anti-cheat off'];
  const always = profile.antiCheat?.scope === 'always' || detected.some((d) => d.scope === 'always');
  const line = `${profile.title} runs ${systems.join(' and ')}${always ? ', which watches whenever the game runs' : ''}. What I use here never touches the game: its own telemetry, your screen, its audio level and your fire, jump and dash keys (those last carry a low risk). Anything deeper, mods, memory, the game's files or sending input into it, risks a ban: only in ${safe.join('; ')}.`;
  return { systems, line, risks };
}

// ------------------------------------------------------------------ plan 53: the input relay, the player's own choice

/** What a player's own press in FIDELITY can be relayed as. */
export type RelayAction = 'fire' | 'use' | 'jump' | 'reload';
export const RELAY_ACTIONS: readonly RelayAction[] = ['fire', 'use', 'jump', 'reload'];

/**
 * How a game takes relayed input (owner, 28 Oct: "build it so the user can choose... have them click a box and write a word
 * to confirm"): a console over TCP (Source 1 games with -netconport), or Windows keys delivered only while the game's own
 * window is in front. Bindings are console commands ("+attack") or key names from RELAY_KEYS.
 */
export interface InputRelaySpec {
  readonly transport: 'console-tcp' | 'synthetic-keys';
  /** console-tcp: the port the game listens on (127.0.0.1). */
  readonly port?: number;
  /** What the player adds to the game's launch options for this transport. */
  readonly launchOption?: string;
  readonly bindings: Readonly<Partial<Record<RelayAction, string>>>;
  readonly notes: readonly string[];
}

/** The word the player types to turn the relay on, after ticking the box. */
export const RELAY_CONFIRM_WORD = 'RELAY';
/** The only keys and buttons the synthetic-keys transport may press. */
export const RELAY_KEYS: readonly string[] = ['mouse1', 'mouse2', 'space', 'e', 'f', 'q', 'r', 'shift', 'ctrl'];
/** The only console commands the console transport may send: a +name (its -name releases it). No binds, no quit, no cvars. */
const RELAY_CONSOLE_COMMAND = /^\+[a-z][a-z0-9_]{1,23}$/;

/** The relay a game gets when nobody declared one: the common keys. */
export const DEFAULT_INPUT_RELAY: InputRelaySpec = {
  transport: 'synthetic-keys',
  bindings: { fire: 'mouse1', use: 'e', jump: 'space', reload: 'r' },
  notes: ['Keys reach the game only while its own window is in front.'],
};

/** Both parts of the consent: the box ticked and the word typed. */
export function relayConsentOk(consent: { readonly ticked: boolean; readonly typed: string }): boolean {
  return consent.ticked && consent.typed.trim().toUpperCase() === RELAY_CONFIRM_WORD;
}

/** The one line a press becomes on the wire, whitelisted: a console command or "down <key>" / "up <key>"; null for anything else. */
export function relayCommand(spec: InputRelaySpec, action: RelayAction, phase: 'down' | 'up'): string | null {
  const b = spec.bindings[action];
  if (!b) return null;
  if (spec.transport === 'console-tcp') {
    if (!RELAY_CONSOLE_COMMAND.test(b)) return null;
    return phase === 'down' ? b : `-${b.slice(1)}`;
  }
  return RELAY_KEYS.includes(b) ? `${phase} ${b}` : null;
}

/** An input relay spec from an AI's profile, checked: a known transport, a sane port, whitelisted bindings only. */
export function checkInputRelay(v: unknown): InputRelaySpec | null {
  if (!isRecord(v) || (v.transport !== 'console-tcp' && v.transport !== 'synthetic-keys')) return null;
  const transport = v.transport;
  const port = Number.isInteger(v.port) && (v.port as number) >= 1024 && (v.port as number) <= 65535 ? (v.port as number) : undefined;
  if (transport === 'console-tcp' && port === undefined) return null;
  const bindings: Partial<Record<RelayAction, string>> = {};
  if (isRecord(v.bindings)) {
    for (const a of RELAY_ACTIONS) {
      const b = v.bindings[a];
      if (typeof b !== 'string') continue;
      if (transport === 'console-tcp' ? RELAY_CONSOLE_COMMAND.test(b) : RELAY_KEYS.includes(b)) bindings[a] = b;
    }
  }
  if (Object.keys(bindings).length === 0) return null;
  const launch = str(v.launchOption, 64);
  return {
    transport, ...(port !== undefined ? { port } : {}), ...(launch && /^-[a-z_]+( [0-9]{2,5})?$/.test(launch) ? { launchOption: launch } : {}),
    bindings, notes: Array.isArray(v.notes) ? v.notes.filter((x): x is string => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 200)) : [],
  };
}

// ------------------------------------------------------------------ plan 53: the bridge stage's stand-ins and manifest

/** Weapon Bench parts (FIDELITY's own weapon presets) standing in for a game's weapon. */
export interface WeaponStandIn {
  readonly core: string;
  readonly barrel: string;
  readonly sight: string;
  readonly cell: string;
  /** How the drone names it. */
  readonly label: string;
}

const NO_GUN = /knife|melee|fist|grenade|flash|smoke|molotov|incendiary|decoy|c4|bomb|taser|zeus|tool|kit|shield/;
const WEAPON_CLASS_STAND_INS: readonly (readonly [RegExp, WeaponStandIn])[] = [
  [/sniper|marksman|dmr|rail/, { core: 'core-semi', barrel: 'barrel-long', sight: 'sight-scope', cell: 'cell-compact', label: 'the scoped long rifle' }],
  [/shotgun|scatter/, { core: 'core-semi', barrel: 'barrel-scatter', sight: 'sight-iron', cell: 'cell-compact', label: 'the scatter gun' }],
  [/rifle|smg|submachine|machine|lmg|assault|auto|burst/, { core: 'core-burst', barrel: 'barrel-short', sight: 'sight-holo', cell: 'cell-extended', label: 'the burst rifle' }],
  [/beam|laser|plasma|energy/, { core: 'core-beam', barrel: 'barrel-short', sight: 'sight-iron', cell: 'cell-extended', label: 'the beam' }],
  [/pistol|revolver|handgun|semi|sidearm/, { core: 'core-semi', barrel: 'barrel-short', sight: 'sight-iron', cell: 'cell-compact', label: 'the sidearm' }],
];
const SIDEARM = WEAPON_CLASS_STAND_INS[4]![1];

/** The FIDELITY weapon for a game's weapon class ("Rifle", "SubMachine Gun"); null for a class that is no gun (a knife, a grenade). */
export function weaponStandIn(weaponClass: string | null): WeaponStandIn | null {
  if (weaponClass === null) return SIDEARM;
  const c = weaponClass.toLowerCase();
  if (NO_GUN.test(c)) return null;
  return WEAPON_CLASS_STAND_INS.find(([re]) => re.test(c))?.[1] ?? SIDEARM;
}

export type AspectId = 'movement' | 'fire' | 'rules' | 'state' | 'picture' | 'sound' | 'weapon' | 'characters' | 'world' | 'names';
/** live: measured or streamed now; documented: a published constant; stand-in: a FIDELITY preset; waiting: bridgeable, nothing in yet. */
export type AspectStatus = 'live' | 'documented' | 'stand-in' | 'waiting';
export interface BridgeAspect {
  readonly id: AspectId;
  readonly status: AspectStatus;
  /** How: the rung, the constant or the preset, in the drone's words. */
  readonly via: string;
}

export interface BridgeManifestInput {
  readonly profile: BridgePermissionProfile;
  /** What the harness has measured live this session. */
  readonly measured: { readonly movement: boolean; readonly fire: boolean; readonly rules: number };
  /** The live HUD values seen so far (label to value). */
  readonly state: Readonly<Record<string, string | number>>;
  readonly weaponClass: string | null;
  readonly pictureLinked: boolean;
  /** What FIDELITY put in place: the movement preset, the enemies, the world. */
  readonly standIns: { readonly movement: string; readonly enemies: string; readonly world: string };
}

/**
 * Plan 53: for each aspect of the bridged game, how it is served in the stage. Bridged where any rung or a documented
 * constant can carry it; a FIDELITY preset where it cannot (its assets) or where nothing has measured it yet.
 */
export function bridgeManifest(i: BridgeManifestInput): BridgeAspect[] {
  const p = i.profile;
  const d = p.documented;
  const docMoves = d ? [d.gravityMps2 !== undefined ? `gravity ${d.gravityMps2} m/s²` : null, d.jumpImpulseMps !== undefined ? `jump ${d.jumpImpulseMps} m/s` : null, d.runSpeedMps !== undefined ? `run ${d.runSpeedMps} m/s` : null].filter((x): x is string => x !== null) : [];
  const weapon = weaponStandIn(i.weaponClass);
  const hudLabels = Object.keys(p.telemetry?.hud ?? {});
  const stateSeen = Object.keys(i.state).length > 0;
  const rung = bestChannel(p, ['telemetry']) ?? 'input-audio';
  return [
    i.measured.movement ? { id: 'movement', status: 'live', via: `measured by ${rung}` }
      : docMoves.length ? { id: 'movement', status: 'documented', via: `${docMoves.join(', ')}, with ${i.standIns.movement} for the rest` }
      : { id: 'movement', status: 'stand-in', via: i.standIns.movement },
    i.measured.fire ? { id: 'fire', status: 'live', via: 'its own rounds, measured' }
      : { id: 'fire', status: 'waiting', via: `${weapon?.label ?? 'no gun'}'s own pattern until a few rounds are fired` },
    { id: 'rules', status: 'live', via: `its events, by class, in the reflex slot${i.measured.rules ? ` (+${i.measured.rules} of its own rules)` : ''}` },
    hudLabels.length ? { id: 'state', status: stateSeen ? 'live' : 'waiting', via: `its ${hudLabels.join(', ')} on FIDELITY's HUD` } : { id: 'state', status: 'stand-in', via: 'FIDELITY\'s own HUD' },
    i.pictureLinked ? { id: 'picture', status: 'live', via: 'its window, streamed onto the pad\'s screen (local, never saved)' }
      : { id: 'picture', status: 'waiting', via: 'link its window from the comms panel to stream it onto the pad' },
    { id: 'sound', status: 'stand-in', via: 'FIDELITY\'s own weapon sounds; the game\'s audio keeps playing on the PC, never copied' },
    { id: 'weapon', status: 'stand-in', via: weapon ? `${weapon.label} (FIDELITY's Weapon Bench)` : 'none: it holds no gun' },
    { id: 'characters', status: 'stand-in', via: i.standIns.enemies },
    { id: 'world', status: 'stand-in', via: i.standIns.world },
    p.streams.includes('entity-kinds') ? { id: 'names', status: 'live', via: 'its own labels for things' } : { id: 'names', status: 'stand-in', via: 'anonymous labels' },
  ];
}

/** The drone's one-line read of a manifest, grouped by status. */
export function manifestLine(aspects: readonly BridgeAspect[]): string {
  const group = (s: AspectStatus): string => aspects.filter((a) => a.status === s).map((a) => `${a.id} (${a.via})`).join('; ');
  const parts: string[] = [];
  for (const [s, label] of [['live', 'Bridged live'], ['documented', 'Documented'], ['stand-in', 'FIDELITY stands in'], ['waiting', 'Waiting']] as const) {
    const g = group(s);
    if (g) parts.push(`${label}: ${g}.`);
  }
  return parts.join(' ');
}

// ------------------------------------------------------------------ the input-audio rung (the cadence sampler's stream)

/** One sample of scripts/cadence-sampler.ps1: focus, three input keys (read only while the game has focus), its audio peak. */
export interface CadenceSample {
  readonly t: number;
  readonly fg: boolean;
  readonly fire: boolean;
  readonly jump: boolean;
  readonly dash: boolean;
  readonly peak: number;
}

/** A sampler line ("t fg fire jump dash peak") as a sample, or null for anything else. */
export function parseCadenceLine(line: string): CadenceSample | null {
  const f = line.trim().split(/\s+/);
  if (f.length !== 6) return null;
  const [t, fg, fire, jump, dash, peak] = f.map(Number) as [number, number, number, number, number, number];
  if (![t, fg, fire, jump, dash, peak].every(Number.isFinite) || peak < 0 || peak > 1) return null;
  // the keys only count while the game has focus (the sampler already zeroes them; this holds even for a hand-made stream)
  return { t, fg: fg === 1, fire: fg === 1 && fire === 1, jump: fg === 1 && jump === 1, dash: fg === 1 && dash === 1, peak };
}

export interface CadenceAnalyzer {
  /** Takes one sample; returns the live edges it made ("input.jump:down"), for the reflex slot. */
  push(s: CadenceSample): readonly string[];
  /** Samples held since the last take. */
  size(): number;
  /** The observation the held samples make (fire cadence, input edges), and clears them; null when there is too little. */
  take(game: string): MechanicObservation | null;
}

/**
 * The input-audio rung: shots are the game's own audio onsets (a rise through an adaptive threshold, 40 ms apart at least)
 * while fire is held or just pressed; a game whose shots make no sound in its session falls back to the fire presses.
 * Jump, dash and fire presses are events. Gravity is not here: it needs positions (telemetry or the screen).
 */
export function createCadenceAnalyzer(): CadenceAnalyzer {
  let shots: number[] = [], presses: number[] = [], events: { t: number; name: string }[] = [];
  let n = 0, recentMax = 0, prevPeak = 0, lastOnset = -Infinity, lastFireDown = -Infinity;
  let prev: CadenceSample | null = null;
  return {
    push(s) {
      n += 1;
      const made: string[] = [];
      for (const key of ['fire', 'jump', 'dash'] as const) {
        if (s[key] && !(prev?.[key] ?? false)) {
          const name = `input.${key}:down`;
          made.push(name);
          events.push({ t: s.t, name });
          if (key === 'fire') { lastFireDown = s.t; presses.push(s.t); }
        }
      }
      // onsets: the peak rises through a threshold that follows the session's own loudness (decays over about a second)
      recentMax = Math.max(s.peak, recentMax * 0.995);
      const thr = Math.max(0.02, recentMax * 0.35);
      if (s.peak >= thr && prevPeak < thr && s.t - lastOnset >= 0.04) {
        lastOnset = s.t;
        if (s.fire || s.t - lastFireDown <= 0.2) shots.push(s.t);
      }
      prevPeak = s.peak;
      prev = s;
      if (shots.length > 4000) shots = shots.slice(-4000);
      if (presses.length > 4000) presses = presses.slice(-4000);
      if (events.length > 4000) events = events.slice(-4000);
      return made;
    },
    size: () => n,
    take(game) {
      const fire = shots.length >= 3 ? shots : presses.length >= 3 ? presses : [];
      const obs: MechanicObservation | null = fire.length >= 3 || events.length >= 1
        ? { game, channel: 'input-audio', ...(fire.length >= 3 ? { shots: { t: [...fire] } } : {}), ...(events.length ? { events: [...events] } : {}) }
        : null;
      shots = []; presses = []; events = []; n = 0;
      return obs;
    },
  };
}

// ------------------------------------------------------------------ finding the game the player means

/** Process names that are never the game (the OS, browsers, launchers, this toolchain). */
const NOT_GAMES = /^(system|idle|svchost|explorer|dwm|csrss|winlogon|services|lsass|smss|wininit|fontdrvhost|sihost|ctfmon|conhost|cmd|powershell|pwsh|bash|node|code|chrome|msedge|firefox|claude|steam|steamwebhelper|epicgameslauncher|discord|searchhost|runtimebroker|taskhostw|textinputhost|startmenuexperiencehost|shellexperiencehost|audiodg|nvcontainer|nvdisplay\.container|rtkaudservice|securityhealthservice|msmpeng|spoolsv|wmiprvse|dllhost|applicationframehost|backgroundtaskhost|smartscreen|git|ssh|tasklist|registry|memory compression|secure system)(\.exe)?$/i;

export interface RunningGameCandidate {
  readonly process: string;
  readonly gameId: string;
  readonly title: string;
  /** Higher is likelier the game the player means. */
  readonly score: number;
}

/**
 * Ranks running processes as the game the player means: a name the player said wins, then a known engine signature, then
 * anything that is not the OS, a browser, a launcher or this toolchain. `known` maps process tokens to a display title
 * (bridgekit's signatures, passed in so this module stays independent).
 */
export function rankRunningGames(processes: readonly string[], hint: string | null, known: readonly { readonly tokens: readonly string[]; readonly title: string }[] = []): RunningGameCandidate[] {
  // compared without separators: "some indie" said aloud is the process "SomeIndie.exe"
  const flat = (s: string): string => s.replace(/-/g, '');
  const said = hint ? flat(gameIdOf(hint)) : null;
  const seen = new Set<string>();
  const out: RunningGameCandidate[] = [];
  for (const raw of processes) {
    const proc = raw.trim();
    const key = proc.toLowerCase();
    if (!proc || seen.has(key) || NOT_GAMES.test(proc)) continue;
    seen.add(key);
    const id = gameIdOf(proc);
    const sig = known.find((k) => k.tokens.some((tok) => key.includes(tok)));
    let score = 1;
    if (sig) score += 5;
    if (said && (flat(id).includes(said) || said.includes(flat(id)) || (sig && flat(gameIdOf(sig.title)).includes(said)))) score += 20;
    out.push({ process: proc, gameId: sig ? gameIdOf(sig.title) : id, title: sig?.title ?? proc.replace(/\.exe$/i, ''), score });
  }
  return out.sort((a, b) => b.score - a.score || a.process.localeCompare(b.process));
}

// ------------------------------------------------------------------ share code and the radio line

export const encodeBridgeProfileCode = (p: BridgePermissionProfile): string => `bridgec:${encodeURIComponent(JSON.stringify(p))}`;
export function decodeBridgeProfileCode(code: string): BridgePermissionProfile | null {
  if (!code.startsWith('bridgec:') || code.length > 32768) return null;
  try { return checkBridgeProfile(JSON.parse(decodeURIComponent(code.slice('bridgec:'.length)))); } catch { return null; }
}

/** What the drone says about a profile: the verdict, what may cross, by which rung, and the first setup step. */
export function profileLine(p: BridgePermissionProfile): string {
  const rungs = allowedChannels(p).join(' > ');
  const step = p.setup[0] ? ` First: ${p.setup[0]}` : '';
  if (p.verdict === 'refused') {
    return `${p.title}: its terms refuse anything deeper${p.sources[0] ? ` (${p.sources[0].url})` : ''}, so no mods, loaders or file reads. Its mechanics still cross by ${rungs}, solo: they are no one's to refuse. Never its art, audio, models or text.${step}`;
  }
  const extra = p.streams.filter((s) => s !== 'mechanics');
  const who = p.verdict === 'unchecked' ? 'Nobody checked its terms yet' : `${p.checkedBy} checked its terms (${p.sources.length} source${p.sources.length === 1 ? '' : 's'})`;
  return `${p.title}: ${p.verdict}. ${who}. Mechanics cross by ${rungs}${extra.length ? `, with ${extra.join(' and ')}` : ''}${p.soloOnly ? ', solo only' : ''}. Never its art, audio, models or text.${step}`;
}
