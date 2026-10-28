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
 * The rungs every game allows, checked or not: its own official telemetry (the game sends it out to be read) and the screen
 * (what the player sees). Mechanics read through them cross whatever a profile says.
 */
export const FLOOR_CHANNELS: readonly ObserverChannel[] = ['telemetry', 'screen'];

/** The rungs a profile allows: the floor, plus the deeper rungs a checked profile names (best first). */
export function allowedChannels(profile: BridgePermissionProfile): readonly ObserverChannel[] {
  return OBSERVER_LADDER.filter((rung) => FLOOR_CHANNELS.includes(rung) || profile.channels.includes(rung));
}

export type BridgeVerdict = 'permitted' | 'limited' | 'refused' | 'unchecked';

/** A dotted path into a telemetry payload ("player.position"), with an optional split of a "x, y, z" string and a scale. */
export interface TelemetryPath {
  readonly path: string;
  /** Split the string at this separator and take `index` (a GSI-style "x, y, z" position). */
  readonly split?: string;
  readonly index?: number;
  /** Multiplies the value into metres or seconds (a game's units to FIDELITY's). */
  readonly scale?: number;
}

/** How one game's official telemetry payload becomes observation samples: data, not code (a new game is a new preset). */
export interface TelemetryMapping {
  /** The sample's time in seconds; absent: the time the bridge received it. */
  readonly t?: TelemetryPath;
  readonly x?: TelemetryPath;
  readonly y?: TelemetryPath;
  readonly z?: TelemetryPath;
  /** A counter that rises by one per shot (ammo spent, rounds fired): each rise is a shot. */
  readonly shotCounter?: TelemetryPath;
  /** Fields whose change is an event, named by the field ("round.phase" changing to "over" is "round.phase:over"). */
  readonly events?: readonly string[];
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
  readonly notes: readonly string[];
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

function checkPath(v: unknown): TelemetryPath | null {
  if (!isRecord(v)) return null;
  const path = str(v.path, 128);
  if (!path || !/^[A-Za-z0-9_.[\]-]+$/.test(path)) return null;
  const out: { path: string; split?: string; index?: number; scale?: number } = { path };
  if (v.split !== undefined) { const s = str(v.split, 4); if (!s) return null; out.split = s; }
  if (v.index !== undefined) { if (!Number.isInteger(v.index) || (v.index as number) < 0 || (v.index as number) > 16) return null; out.index = v.index as number; }
  if (v.scale !== undefined) { if (typeof v.scale !== 'number' || !Number.isFinite(v.scale) || v.scale === 0) return null; out.scale = v.scale; }
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
    const m: { t?: TelemetryPath; x?: TelemetryPath; y?: TelemetryPath; z?: TelemetryPath; shotCounter?: TelemetryPath; events?: string[] } = {};
    for (const k of ['t', 'x', 'y', 'z', 'shotCounter'] as const) {
      if (t[k] !== undefined) { const p = checkPath(t[k]); if (!p) return null; m[k] = p; }
    }
    if (t.events !== undefined) m.events = lines(t.events, 16).filter((e) => /^[A-Za-z0-9_.[\]-]+$/.test(e));
    telemetry = m;
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
export function anonymizeEvents(events: readonly { readonly t: number; readonly name: string }[]): { t: number; name: string }[] {
  const labels = new Map<string, Map<string, number>>();
  return events.map((e) => {
    const cut = e.name.indexOf(':');
    const field = cut < 0 ? 'event' : e.name.slice(0, cut);
    const value = cut < 0 ? e.name : e.name.slice(cut + 1);
    const seen = labels.get(field) ?? new Map<string, number>();
    labels.set(field, seen);
    if (!seen.has(value)) seen.set(value, seen.size + 1);
    return { t: e.t, name: `${field}:#${seen.get(value)}` };
  });
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

/** Reads a dotted path ("player.state.health", "allplayers[0].position") from a payload, as a number. */
export function readPath(payload: unknown, p: TelemetryPath): number | null {
  let cur: unknown = payload;
  for (const seg of p.path.replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (seg === '') continue;
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  if (typeof cur === 'string' && p.split !== undefined) cur = cur.split(p.split)[p.index ?? 0]?.trim();
  const n = typeof cur === 'number' ? cur : typeof cur === 'string' && cur.trim() !== '' ? Number(cur) : NaN;
  return Number.isFinite(n) ? n * (p.scale ?? 1) : null;
}

const readRaw = (payload: unknown, path: string): unknown => {
  let cur: unknown = payload;
  for (const seg of path.replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (seg === '') continue;
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
};

export interface TelemetryAccumulator {
  /** Takes one payload, received at `receivedAt` seconds (used when the mapping has no time path). */
  push(payload: unknown, receivedAt: number): void;
  /** Samples held. */
  size(): number;
  /** The observation the held samples make (and clears them), or null when there is too little. */
  take(game: string, channel: ObserverChannel): MechanicObservation | null;
}

/** Turns a stream of official telemetry payloads into observation samples through a mapping preset. */
export function createTelemetryAccumulator(mapping: TelemetryMapping, cap = 20000): TelemetryAccumulator {
  let t: number[] = [], x: number[] = [], y: number[] = [], z: number[] = [];
  let shots: number[] = [];
  let events: { t: number; name: string }[] = [];
  let lastCounter: number | null = null;
  const lastEventValue = new Map<string, string>();
  return {
    push(payload, receivedAt) {
      const time = mapping.t ? readPath(payload, mapping.t) ?? receivedAt : receivedAt;
      if (mapping.x && mapping.y && mapping.z) {
        const px = readPath(payload, mapping.x), py = readPath(payload, mapping.y), pz = readPath(payload, mapping.z);
        if (px !== null && py !== null && pz !== null && (t.length === 0 || time > t[t.length - 1]!)) {
          t.push(time); x.push(px); y.push(py); z.push(pz);
        }
      }
      if (mapping.shotCounter) {
        const c = readPath(payload, mapping.shotCounter);
        if (c !== null) {
          if (lastCounter !== null && c > lastCounter) for (let k = 0; k < Math.min(20, c - lastCounter); k++) shots.push(time);
          lastCounter = c;
        }
      }
      for (const path of mapping.events ?? []) {
        const v = readRaw(payload, path);
        if (v === undefined || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) continue;
        const s = String(v);
        if (lastEventValue.has(path) && lastEventValue.get(path) !== s) events.push({ t: time, name: `${path}:${s}`.slice(0, 64) });
        lastEventValue.set(path, s);
      }
      if (t.length > cap) { t = t.slice(-cap); x = x.slice(-cap); y = y.slice(-cap); z = z.slice(-cap); }
      if (shots.length > cap) shots = shots.slice(-cap);
      if (events.length > cap) events = events.slice(-cap);
    },
    size: () => t.length + shots.length + events.length,
    take(game, channel) {
      const hasTrajectory = t.length >= 8, hasShots = shots.length >= 3, hasEvents = events.length >= 1;
      if (!hasTrajectory && !hasShots && !hasEvents) return null;
      const obs: MechanicObservation = {
        game, channel,
        ...(hasTrajectory ? { trajectory: { t, x, y, z } } : {}),
        ...(hasShots ? { shots: { t: shots } } : {}),
        ...(hasEvents ? { events } : {}),
      };
      t = []; x = []; y = []; z = []; shots = []; events = [];
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
