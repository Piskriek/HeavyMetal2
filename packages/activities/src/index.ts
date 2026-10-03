// activities.ts  (exported from src/index.ts)

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface MenuEntry {
  id: string;
  label: string;
  icon: string; // exact lucide-react PascalCase name
  kind: 'screen' | 'action';
  target: string;
}

export interface Activity {
  id: string;
  name: string;
  doc: string;
  builtin: boolean;
  hidden: boolean;
  planet: { hue: number; size: number; ring: boolean };
  menu: MenuEntry[];
  hosting: { tournament: boolean; players: number; nextEventAt: number | null };
  owner: string;
  forkOf: string | null;
  rules: Record<string, number | string | boolean>;
}

export interface ActivityError {
  readonly kind: 'ActivityError';
  readonly code:
    | 'not-found'
    | 'builtin-protected'
    | 'duplicate-first'
    | 'bad-name'
    | 'duplicate-id';
  readonly message: string;
}

export const err = (code: ActivityError['code'], message: string): ActivityError => ({
  kind: 'ActivityError',
  code,
  message,
});

export function isActivityError(v: unknown): v is ActivityError {
  return typeof v === 'object' && v !== null && (v as { kind?: unknown }).kind === 'ActivityError';
}

const at = <T>(a: readonly T[], i: number): T | undefined => a[i];

/* ------------------------------------------------------------------ *
 * Deterministic helpers
 * ------------------------------------------------------------------ */

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'activity';
}

export function planetFor(name: string): Activity['planet'] {
  const h = hashString(name);
  return {
    hue: h % 360,
    size: 1 + ((h >>> 9) % 5),
    ring: ((h >>> 17) & 1) === 0,
  };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ------------------------------------------------------------------ *
 * 1. ActivityRegistry
 * ------------------------------------------------------------------ */

const GOBLIN_MENU: MenuEntry[] = [
  { id: 'quick-race', label: 'Quick Race', icon: 'Flag', kind: 'action', target: 'race/quick' },
  { id: 'tournaments', label: 'Tournaments', icon: 'Trophy', kind: 'screen', target: 'tournaments' },
  { id: 'spectate', label: 'Spectate', icon: 'Eye', kind: 'screen', target: 'spectate' },
  { id: 'rankings', label: 'Rankings', icon: 'ListOrdered', kind: 'screen', target: 'rankings' },
  { id: 'settings', label: 'Settings', icon: 'Settings', kind: 'screen', target: 'settings' },
  { id: 'my-goblin', label: 'My Goblin', icon: 'Ghost', kind: 'screen', target: 'goblin' },
  { id: 'the-bookie', label: 'The Bookie', icon: 'Coins', kind: 'screen', target: 'bookie' },
];

export const DEFAULT_MENU: MenuEntry[] = [
  { id: 'quick-play', label: 'Quick Play', icon: 'Play', kind: 'action', target: 'play/quick' },
  { id: 'settings', label: 'Settings', icon: 'Settings', kind: 'screen', target: 'settings' },
];

export function goblinRacing(): Activity {
  return {
    id: 'goblin-racing',
    name: 'Goblin Racing',
    doc: 'Race goblins in glass balls round an island, with items, heats and a weekly cup.',
    builtin: true,
    hidden: false,
    planet: { hue: 96, size: 4, ring: true },
    menu: clone(GOBLIN_MENU),
    hosting: { tournament: false, players: 0, nextEventAt: null },
    owner: 'studio',
    forkOf: null,
    rules: { laps: 3, field: 8, aiSkill: 1 },
  };
}

export class ActivityRegistry {
  private readonly items: readonly Activity[];

  constructor(list: Activity[] = []) {
    this.items = clone(list);
  }

  static withDefaults(): ActivityRegistry {
    return new ActivityRegistry([goblinRacing()]);
  }

  all(): Activity[] {
    return clone(this.items as Activity[]);
  }

  list(opts: { includeHidden?: boolean } = {}): Activity[] {
    const include = opts.includeHidden === true;
    return clone(this.items.filter((a) => include || !a.hidden));
  }

  get(id: string): Activity | undefined {
    const f = this.items.find((a) => a.id === id);
    return f === undefined ? undefined : clone(f);
  }

  private require(id: string): Activity {
    const f = this.items.find((a) => a.id === id);
    if (f === undefined) throw err('not-found', `no activity '${id}'`);
    return f;
  }

  private uniqueId(base: string): string {
    let id = base;
    let n = 2;
    while (this.items.some((a) => a.id === id)) {
      id = `${base}-${n}`;
      n++;
    }
    return id;
  }

  private replace(next: Activity[]): ActivityRegistry {
    return new ActivityRegistry(next);
  }

  create(name: string, doc: string, owner: string, now: number): ActivityRegistry {
    if (name.trim().length === 0) throw err('bad-name', 'name must not be empty');
    void now;
    const a: Activity = {
      id: this.uniqueId(slugify(name)),
      name: name.trim(),
      doc,
      builtin: false,
      hidden: false,
      planet: planetFor(name.trim()),
      menu: clone(DEFAULT_MENU),
      hosting: { tournament: false, players: 0, nextEventAt: null },
      owner,
      forkOf: null,
      rules: {},
    };
    return this.replace([...this.all(), a]);
  }

  duplicate(id: string, owner: string): ActivityRegistry {
    const src = this.require(id);
    const name = `Copy of ${src.name}`;
    const copy: Activity = {
      ...clone(src),
      id: this.uniqueId(slugify(name)),
      name,
      builtin: false,
      hidden: false,
      owner,
      forkOf: src.id,
      hosting: { tournament: false, players: 0, nextEventAt: null },
    };
    return this.replace([...this.all(), copy]);
  }

  remove(id: string): ActivityRegistry {
    const a = this.require(id);
    if (a.builtin) throw err('builtin-protected', `'${id}' is built-in: hide it instead`);
    return this.replace(this.all().filter((x) => x.id !== id));
  }

  hide(id: string): ActivityRegistry {
    this.require(id);
    return this.replace(this.all().map((x) => (x.id === id ? { ...x, hidden: true } : x)));
  }

  unhide(id: string): ActivityRegistry {
    this.require(id);
    return this.replace(this.all().map((x) => (x.id === id ? { ...x, hidden: false } : x)));
  }

  rename(id: string, name: string): ActivityRegistry {
    this.require(id);
    if (name.trim().length === 0) throw err('bad-name', 'name must not be empty');
    return this.replace(this.all().map((x) => (x.id === id ? { ...x, name: name.trim() } : x)));
  }

  setRule(id: string, key: string, value: number | string | boolean): ActivityRegistry {
    const a = this.require(id);
    if (a.builtin) {
      throw err('duplicate-first', `'${id}' is built-in: duplicate it before editing rules`);
    }
    return this.replace(
      this.all().map((x) => (x.id === id ? { ...x, rules: { ...x.rules, [key]: value } } : x)),
    );
  }

  validate(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const a of this.items) {
      if (seen.has(a.id)) errors.push(`duplicate id '${a.id}'`);
      seen.add(a.id);
      if (a.name.trim().length === 0) errors.push(`empty name on '${a.id}'`);
      if (a.planet.hue < 0 || a.planet.hue > 359) errors.push(`bad hue on '${a.id}'`);
      if (a.planet.size <= 0) errors.push(`bad size on '${a.id}'`);
      const mids = new Set<string>();
      for (const m of a.menu) {
        if (mids.has(m.id)) errors.push(`duplicate menu entry '${m.id}' on '${a.id}'`);
        mids.add(m.id);
        if (!/^[A-Z][A-Za-z0-9]*$/.test(m.icon)) errors.push(`bad icon '${m.icon}' on '${a.id}'`);
      }
    }
    return { ok: errors.length === 0, errors };
  }
}

/* ------------------------------------------------------------------ *
 * 2. Galaxy layout
 * ------------------------------------------------------------------ */

export interface PlanetPos {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  orbit: number;
}

const MARGIN = 2;
const ARMS = 3;

export function galaxyLayout(
  activities: Activity[],
  seed: number,
  highlightId: string | null = null,
): PlanetPos[] {
  const sorted = [...activities].sort((a, b) => {
    const ha = a.hosting.players > 0 || a.hosting.tournament ? 0 : 1;
    const hb = b.hosting.players > 0 || b.hosting.tournament ? 0 : 1;
    if (ha !== hb) return ha - hb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const seedAngle = ((seed % 360) + 360) % 360 * (Math.PI / 180);
  const placed: PlanetPos[] = [];

  for (let k = 0; k < sorted.length; k++) {
    const a = at(sorted, k);
    if (a === undefined) continue;
    const radius = Math.max(0.5, a.planet.size);
    const arm = k % ARMS;
    const turn = Math.floor(k / ARMS);
    const angle = seedAngle + (arm * 2 * Math.PI) / ARMS + turn * 0.5;
    const h = hashString(a.id);
    const z = (((h % 200) - 100) / 100) * 2;
    let orbit = 8 + 14 * k;
    let pos: PlanetPos = {
      id: a.id,
      x: Math.cos(angle) * orbit,
      y: Math.sin(angle) * orbit,
      z,
      radius,
      orbit,
    };
    for (let guard = 0; guard < 500; guard++) {
      const clash = placed.some((p) => dist(p, pos) < p.radius + pos.radius + MARGIN);
      if (!clash) break;
      orbit += 4;
      pos = { id: a.id, x: Math.cos(angle) * orbit, y: Math.sin(angle) * orbit, z, radius, orbit };
    }
    placed.push(pos);
  }

  if (highlightId !== null) {
    const c = placed.find((p) => p.id === highlightId);
    if (c !== undefined) {
      const { x, y, z } = c;
      return placed.map((p) => ({ ...p, x: p.x - x, y: p.y - y, z: p.z - z }));
    }
  }
  return placed;
}

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function pickPlanet(
  layout: PlanetPos[],
  ray: { origin: [number, number, number]; dir: [number, number, number] },
): string | null {
  const [ox, oy, oz] = ray.origin;
  const [dx0, dy0, dz0] = ray.dir;
  const len = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0);
  if (len === 0) return null;
  const dx = dx0 / len;
  const dy = dy0 / len;
  const dz = dz0 / len;
  let bestId: string | null = null;
  let bestT = Infinity;
  for (const p of layout) {
    const mx = ox - p.x;
    const my = oy - p.y;
    const mz = oz - p.z;
    const b = mx * dx + my * dy + mz * dz;
    const c = mx * mx + my * my + mz * mz - p.radius * p.radius;
    const disc = b * b - c;
    if (disc < 0) continue;
    const s = Math.sqrt(disc);
    const t0 = -b - s;
    const t1 = -b + s;
    const t = t0 >= 0 ? t0 : t1;
    if (t < 0) continue;
    if (t < bestT || (t === bestT && bestId !== null && p.id < bestId)) {
      bestT = t;
      bestId = p.id;
    }
  }
  return bestId;
}

/* ------------------------------------------------------------------ *
 * 3. Tournaments
 * ------------------------------------------------------------------ */

export type TournamentStatus = 'signup' | 'locked' | 'running' | 'done';

export interface HeatResult {
  playerId: string;
  position: number;
  dnf?: boolean;
  time?: number;
}

export interface Heat {
  id: string;
  round: number;
  playerIds: string[];
  deadline: number;
  results: HeatResult[] | null;
  noShowApplied: boolean;
}

export interface Entrant {
  playerId: string;
  rating: number;
  signedUpAt: number;
}

export interface TournamentState {
  id: string;
  capacity: number;
  heatSize: number;
  advanceCount: number;
  closesAt: number;
  heatDurationMs: number;
  status: TournamentStatus;
  round: number;
  entrants: Entrant[];
  strikes: Record<string, number>;
  lockedOut: string[];
  heats: Heat[];
}

export interface TournamentError {
  readonly kind: 'TournamentError';
  readonly code:
    | 'not-open'
    | 'closed'
    | 'full'
    | 'already-signed-up'
    | 'locked-out'
    | 'not-signed-up'
    | 'not-enough-players'
    | 'not-running'
    | 'no-such-heat'
    | 'heat-done'
    | 'bad-results';
  readonly message: string;
}

const terr = (code: TournamentError['code'], message: string): TournamentError => ({
  kind: 'TournamentError',
  code,
  message,
});

export function isTournamentError(v: unknown): v is TournamentError {
  return typeof v === 'object' && v !== null && (v as { kind?: unknown }).kind === 'TournamentError';
}

export const POINTS: readonly number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const pointsFor = (position: number): number => at(POINTS, position - 1) ?? 0;

export interface Standing {
  playerId: string;
  points: number;
  wins: number;
  bestTime: number | null;
}

export class Tournament {
  readonly state: TournamentState;

  constructor(state: TournamentState) {
    this.state = clone(state);
  }

  static create(opts: {
    id: string;
    capacity: number;
    heatSize: number;
    closesAt: number;
    advanceCount?: number;
    heatDurationMs?: number;
    strikes?: Record<string, number>;
    lockedOut?: string[];
  }): Tournament {
    return new Tournament({
      id: opts.id,
      capacity: opts.capacity,
      heatSize: opts.heatSize,
      advanceCount: opts.advanceCount ?? 2,
      closesAt: opts.closesAt,
      heatDurationMs: opts.heatDurationMs ?? 3600_000,
      status: 'signup',
      round: 0,
      entrants: [],
      strikes: { ...(opts.strikes ?? {}) },
      lockedOut: [...(opts.lockedOut ?? [])],
      heats: [],
    });
  }

  get status(): TournamentStatus {
    return this.state.status;
  }

  private next(patch: Partial<TournamentState>): Tournament {
    return new Tournament({ ...clone(this.state), ...clone(patch) });
  }

  signUp(playerId: string, now: number, rating = 1000): Tournament {
    const s = this.state;
    if (s.status !== 'signup') throw terr('not-open', 'sign-up is not open');
    if (now >= s.closesAt) throw terr('closed', 'sign-up has closed');
    if (s.lockedOut.includes(playerId)) throw terr('locked-out', `${playerId} is locked out`);
    if (s.entrants.some((e) => e.playerId === playerId)) {
      throw terr('already-signed-up', `${playerId} already signed up`);
    }
    if (s.entrants.length >= s.capacity) throw terr('full', 'tournament is full');
    return this.next({ entrants: [...s.entrants, { playerId, rating, signedUpAt: now }] });
  }

  withdraw(playerId: string): Tournament {
    const s = this.state;
    if (s.status !== 'signup') throw terr('not-open', 'sign-up is not open');
    if (!s.entrants.some((e) => e.playerId === playerId)) {
      throw terr('not-signed-up', `${playerId} is not signed up`);
    }
    return this.next({ entrants: s.entrants.filter((e) => e.playerId !== playerId) });
  }

  lock(now: number): Tournament {
    const s = this.state;
    if (s.status !== 'signup') throw terr('not-open', 'already locked');
    if (s.entrants.length < 2) throw terr('not-enough-players', 'need at least 2 players');
    const seeded = [...s.entrants].sort((a, b) =>
      b.rating !== a.rating ? b.rating - a.rating : a.playerId < b.playerId ? -1 : 1,
    );
    const heats = makeHeats(seeded.map((e) => e.playerId), s.heatSize, 1, now + s.heatDurationMs);
    return this.next({ status: 'locked', round: 1, heats });
  }

  currentHeats(): Heat[] {
    return clone(this.state.heats.filter((h) => h.round === this.state.round));
  }

  reportHeat(heatId: string, results: HeatResult[]): Tournament {
    const s = this.state;
    if (s.status !== 'locked' && s.status !== 'running') throw terr('not-running', 'not running');
    const heat = s.heats.find((h) => h.id === heatId && h.round === s.round);
    if (heat === undefined) throw terr('no-such-heat', `no heat '${heatId}' in current round`);
    if (heat.results !== null) throw terr('heat-done', `heat '${heatId}' already reported`);
    const seenP = new Set<string>();
    const seenPos = new Set<number>();
    for (const r of results) {
      if (!heat.playerIds.includes(r.playerId)) {
        throw terr('bad-results', `${r.playerId} is not in heat '${heatId}'`);
      }
      if (seenP.has(r.playerId)) throw terr('bad-results', `duplicate entry for ${r.playerId}`);
      seenP.add(r.playerId);
      if (!Number.isInteger(r.position) || r.position < 1) {
        throw terr('bad-results', 'positions must be positive integers');
      }
      if (seenPos.has(r.position)) throw terr('bad-results', `duplicate position ${r.position}`);
      seenPos.add(r.position);
    }
    const heats = s.heats.map((h) => (h.id === heatId ? { ...h, results: clone(results) } : h));
    let out = this.next({ heats, status: 'running' });
    const cur = heats.filter((h) => h.round === s.round);
    if (cur.every((h) => h.results !== null)) out = out.closeRound(cur);
    return out;
  }

  private closeRound(cur: Heat[]): Tournament {
    const s = this.state;
    if (cur.length <= 1) return this.next({ status: 'done' });
    const advancing: string[] = [];
    for (const h of cur) {
      const res = (h.results ?? [])
        .filter((r) => r.dnf !== true)
        .sort((a, b) => a.position - b.position);
      for (let i = 0; i < Math.min(s.advanceCount, res.length); i++) {
        const r = at(res, i);
        if (r !== undefined) advancing.push(r.playerId);
      }
    }
    if (advancing.length < 2) return this.next({ status: 'done' });
    const rating = (p: string): number =>
      this.state.entrants.find((e) => e.playerId === p)?.rating ?? 1000;
    const seeded = [...advancing].sort((a, b) =>
      rating(b) !== rating(a) ? rating(b) - rating(a) : a < b ? -1 : 1,
    );
    const lastDeadline = cur.reduce((m, h) => Math.max(m, h.deadline), 0);
    const round = s.round + 1;
    const heats = makeHeats(seeded, s.heatSize, round, lastDeadline + s.heatDurationMs);
    return this.next({ round, heats: [...this.state.heats, ...heats], status: 'running' });
  }

  noShows(now: number): Tournament {
    const s = this.state;
    if (s.status !== 'locked' && s.status !== 'running') return this;
    const strikes = { ...s.strikes };
    const lockedOut = new Set(s.lockedOut);
    const entrants = s.entrants.map((e) => ({ ...e }));
    const heats = s.heats.map((h) => {
      if (h.noShowApplied || h.deadline > now) return { ...h };
      const played = new Set((h.results ?? []).map((r) => r.playerId));
      for (const p of h.playerIds) {
        if (played.has(p)) continue;
        const e = entrants.find((x) => x.playerId === p);
        if (e !== undefined) e.rating = Math.max(0, e.rating - 50);
        const n = (strikes[p] ?? 0) + 1;
        strikes[p] = n;
        if (n >= 3) lockedOut.add(p);
      }
      return { ...h, noShowApplied: true };
    });
    return this.next({ heats, strikes, lockedOut: [...lockedOut].sort(), entrants });
  }

  strikesFor(playerId: string): number {
    return this.state.strikes[playerId] ?? 0;
  }

  isLockedOut(playerId: string): boolean {
    return this.state.lockedOut.includes(playerId);
  }

  standings(): Standing[] {
    const map = new Map<string, Standing>();
    const ensure = (p: string): Standing => {
      const cur = map.get(p);
      if (cur !== undefined) return cur;
      const fresh: Standing = { playerId: p, points: 0, wins: 0, bestTime: null };
      map.set(p, fresh);
      return fresh;
    };
    for (const e of this.state.entrants) ensure(e.playerId);
    for (const h of this.state.heats) {
      for (const r of h.results ?? []) {
        const st = ensure(r.playerId);
        if (r.dnf === true) continue;
        st.points += pointsFor(r.position);
        if (r.position === 1) st.wins += 1;
        if (r.time !== undefined && (st.bestTime === null || r.time < st.bestTime)) {
          st.bestTime = r.time;
        }
      }
    }
    return [...map.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      const ta = a.bestTime ?? Infinity;
      const tb = b.bestTime ?? Infinity;
      if (ta !== tb) return ta - tb;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    });
  }

  toJSON(): TournamentState {
    return clone(this.state);
  }

  static fromJSON(raw: unknown): Tournament | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const o = raw as Record<string, unknown>;
    const num = (k: string): number | null => (typeof o[k] === 'number' && Number.isFinite(o[k] as number) ? (o[k] as number) : null);
    const id = typeof o['id'] === 'string' ? (o['id'] as string) : null;
    const capacity = num('capacity');
    const heatSize = num('heatSize');
    const advanceCount = num('advanceCount');
    const closesAt = num('closesAt');
    const heatDurationMs = num('heatDurationMs');
    const round = num('round');
    const status = o['status'];
    const okStatus =
      status === 'signup' || status === 'locked' || status === 'running' || status === 'done';
    if (
      id === null || capacity === null || heatSize === null || advanceCount === null ||
      closesAt === null || heatDurationMs === null || round === null || !okStatus
    ) {
      return null;
    }
    if (!Array.isArray(o['entrants']) || !Array.isArray(o['heats']) || !Array.isArray(o['lockedOut'])) {
      return null;
    }
    const entrants: Entrant[] = [];
    for (const e of o['entrants'] as unknown[]) {
      if (typeof e !== 'object' || e === null) return null;
      const r = e as Record<string, unknown>;
      if (typeof r['playerId'] !== 'string' || typeof r['rating'] !== 'number' || typeof r['signedUpAt'] !== 'number') {
        return null;
      }
      entrants.push({ playerId: r['playerId'], rating: r['rating'], signedUpAt: r['signedUpAt'] });
    }
    const heats: Heat[] = [];
    for (const h of o['heats'] as unknown[]) {
      if (typeof h !== 'object' || h === null) return null;
      const r = h as Record<string, unknown>;
      if (typeof r['id'] !== 'string' || typeof r['round'] !== 'number' || typeof r['deadline'] !== 'number') return null;
      if (!Array.isArray(r['playerIds']) || !(r['playerIds'] as unknown[]).every((p) => typeof p === 'string')) return null;
      let results: HeatResult[] | null = null;
      if (Array.isArray(r['results'])) {
        results = [];
        for (const x of r['results'] as unknown[]) {
          if (typeof x !== 'object' || x === null) return null;
          const q = x as Record<string, unknown>;
          if (typeof q['playerId'] !== 'string' || typeof q['position'] !== 'number') return null;
          const entry: HeatResult = { playerId: q['playerId'], position: q['position'] };
          if (typeof q['dnf'] === 'boolean') entry.dnf = q['dnf'];
          if (typeof q['time'] === 'number') entry.time = q['time'];
          results.push(entry);
        }
      } else if (r['results'] !== null && r['results'] !== undefined) {
        return null;
      }
      heats.push({
        id: r['id'],
        round: r['round'],
        playerIds: r['playerIds'] as string[],
        deadline: r['deadline'],
        results,
        noShowApplied: r['noShowApplied'] === true,
      });
    }
    const strikesRaw = o['strikes'];
    const strikes: Record<string, number> = {};
    if (typeof strikesRaw === 'object' && strikesRaw !== null) {
      for (const [k, v] of Object.entries(strikesRaw as Record<string, unknown>)) {
        if (typeof v === 'number') strikes[k] = v;
      }
    }
    const lockedOut = (o['lockedOut'] as unknown[]).filter((p): p is string => typeof p === 'string');
    return new Tournament({
      id, capacity, heatSize, advanceCount, closesAt, heatDurationMs,
      status, round, entrants, strikes, lockedOut, heats,
    });
  }
}

function makeHeats(seeded: string[], heatSize: number, round: number, deadline: number): Heat[] {
  const size = Math.max(1, heatSize);
  const count = Math.max(1, Math.ceil(seeded.length / size));
  const buckets: string[][] = [];
  for (let i = 0; i < count; i++) buckets.push([]);
  for (let i = 0; i < seeded.length; i++) {
    const p = at(seeded, i);
    if (p === undefined) continue;
    const row = Math.floor(i / count);
    const col = i % count;
    const idx = row % 2 === 0 ? col : count - 1 - col;
    at(buckets, idx)?.push(p);
  }
  return buckets.map((playerIds, i) => ({
    id: `r${round}h${i + 1}`,
    round,
    playerIds,
    deadline,
    results: null,
    noShowApplied: false,
  }));
}

export function updateRatings(
  ratings: Record<string, number>,
  order: string[],
  k = 24,
): Record<string, number> {
  const out: Record<string, number> = { ...ratings };
  const n = order.length;
  if (n < 2) return out;
  const deltas: Record<string, number> = {};
  for (const p of order) deltas[p] = 0;
  const scale = k / (n - 1);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = at(order, i);
      const b = at(order, j);
      if (a === undefined || b === undefined) continue;
      const ra = out[a] ?? 1000;
      const rb = out[b] ?? 1000;
      const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
      const d = scale * (1 - ea);
      deltas[a] = (deltas[a] ?? 0) + d;
      deltas[b] = (deltas[b] ?? 0) - d;
    }
  }
  for (const p of order) out[p] = (out[p] ?? 1000) + (deltas[p] ?? 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * 4. Description helpers
 * ------------------------------------------------------------------ */

export function humanizeDelta(ms: number): string {
  if (ms <= 0) return 'now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function describeActivity(a: Activity, now: number): string {
  const n = a.hosting.players;
  const who = `${n} player${n === 1 ? '' : 's'}`;
  let body: string;
  if (n === 0 && !a.hosting.tournament) body = 'quiet right now';
  else if (a.hosting.tournament) body = `${who} hosting a tournament`;
  else body = `${who} in play`;
  const tail =
    a.hosting.nextEventAt === null ? '' : `, next event in ${humanizeDelta(a.hosting.nextEventAt - now)}`;
  return `${a.name}: ${body}${tail}`;
}

export function activityCard(a: Activity): { title: string; subtitle: string; badge: string } {
  const subtitle = (a.doc.split('\n')[0] ?? '').trim();
  const badge = a.hidden ? 'Hidden' : a.builtin ? 'Built-in' : a.forkOf !== null ? 'Fork' : 'Custom';
  return { title: a.name, subtitle, badge };
}