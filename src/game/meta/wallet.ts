/**
 * PROFILE: the player's gold, an integer ledger, and bets on their own races.
 *
 * Local-first (docs/RUN_LAUNCH_PLAN.md): the wallet lives in the player's saves (browser storage, or
 * RUN.world's cloud storage through the platform layer). The server-owned economy (RUN's Simulation
 * API) replaces it for online play (MP-R06); the shapes here follow the Season Zero ledger rules so that
 * move is a change of backend, not of meaning:
 *
 *  - **Integer gold.** Every change is a ledger entry with an **idempotency key** (`id`): posting the same
 *    key twice changes nothing, so a round replayed, a double click or a restored save can never pay twice.
 *  - **Balance = starting purse + every entry**, recomputed on read; the stored `gold` is a cache.
 *  - **Bets are on your own finish only**, fixed odds from the field and CPU challenge, one bet per
 *    market per round, placed before the round and settled from its committed result. Gold is a soft
 *    currency: nothing here can be bought with money or cashed out.
 *
 * Pure functions over a plain document plus a thin storage wrapper, so the tests drive it directly.
 */

export const WALLET_KEY = 'hm2-wallet-v1';
export const STARTING_GOLD = 500;
export const MIN_STAKE = 10;
export const MAX_STAKE = 1000;
const LEDGER_KEEP = 300;
const BETS_KEEP = 120;

export type LedgerReason = 'race-purse' | 'bet-stake' | 'bet-payout' | 'bet-refund' | 'shop';

export interface LedgerEntry {
  /** Idempotency key: one entry per key, ever. */
  id: string;
  at: number;
  /** Whole gold: + credit, − debit. */
  amount: number;
  reason: LedgerReason;
  note: string;
}

export type BetMarket = 'win' | 'podium' | 'finish';
export type BetStatus = 'open' | 'won' | 'lost' | 'void';

export interface Bet {
  id: string;
  at: number;
  sessionId: string;
  round: number;
  market: BetMarket;
  stake: number;
  /** Decimal odds (a winning stake returns stake × odds, rounded down). */
  odds: number;
  status: BetStatus;
  payout: number;
  /** What the bet was on, as the player reads it ("Serpentine Isle · round 1 of 3"). */
  label: string;
  fieldSize: number;
  /** The finishing place it was settled on (absent while open, or a DNF). */
  position?: number;
}

export interface WalletDoc {
  version: 1;
  ledger: LedgerEntry[];
  bets: Bet[];
}

export const BET_MARKETS: readonly { id: BetMarket; name: string; blurb: string }[] = Object.freeze([
  { id: 'win', name: 'Win it', blurb: 'You cross the line first.' },
  { id: 'podium', name: 'Podium', blurb: 'You finish in the top three.' },
  { id: 'finish', name: 'Just finish', blurb: 'You make it to the line at all.' },
]);

/** CPU challenge → how much harder a result is to get. */
const CHALLENGE: Record<string, number> = { rookie: 0.85, racer: 1, veteran: 1.2 };

/**
 * Fixed decimal odds for betting on yourself. Four racers on Racer: win 3.0, podium 1.5, finish 1.15.
 * Bigger fields and a harder CPU pay more; the house keeps a small edge for an average driver.
 */
export function betOdds(market: BetMarket, fieldSize: number, difficulty = 'racer'): number {
  const field = Math.max(2, Math.floor(fieldSize) || 4);
  const hard = CHALLENGE[difficulty] ?? 1;
  let odds: number;
  if (market === 'win') odds = 3 * Math.pow(field / 4, 0.62) * hard;
  else if (market === 'podium') odds = field <= 3 ? 1.05 : 1.5 * Math.pow(field / 4, 0.55) * Math.sqrt(hard);
  else odds = 1.15 * Math.pow(hard, 0.3);
  return Math.round(Math.max(1.02, odds) * 100) / 100;
}

export const emptyWallet = (): WalletDoc => ({ version: 1, ledger: [], bets: [] });

/** Anything (an old or hand-edited save) → a valid wallet. */
export function normalizeWallet(raw: unknown): WalletDoc {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<WalletDoc>;
  const ledger = Array.isArray(r.ledger) ? r.ledger.filter((e): e is LedgerEntry =>
    !!e && typeof e.id === 'string' && Number.isInteger(e.amount) && typeof e.reason === 'string') : [];
  const bets = Array.isArray(r.bets) ? r.bets.filter((b): b is Bet =>
    !!b && typeof b.id === 'string' && Number.isInteger(b.stake) && typeof b.odds === 'number' && typeof b.sessionId === 'string') : [];
  return { version: 1, ledger, bets };
}

/** Gold on hand: the starting purse (STARTING_GOLD) plus every ledger entry. */
export function balance(doc: WalletDoc): number {
  let gold = STARTING_GOLD;
  for (const e of doc.ledger) gold += e.amount;
  return gold;
}

/** Adds a ledger entry unless its key was posted before. Refuses to go below zero. */
export function post(doc: WalletDoc, entry: Omit<LedgerEntry, 'at'> & { at?: number }): { doc: WalletDoc; posted: boolean; error?: string } {
  if (!Number.isInteger(entry.amount)) return { doc, posted: false, error: 'Gold comes in whole pieces.' };
  if (doc.ledger.some((e) => e.id === entry.id)) return { doc, posted: false };
  if (entry.amount < 0 && balance(doc) + entry.amount < 0) return { doc, posted: false, error: 'Not enough gold.' };
  const full: LedgerEntry = { ...entry, at: entry.at ?? Date.now() };
  return { doc: { ...doc, ledger: [...doc.ledger, full].slice(-LEDGER_KEEP) }, posted: true };
}

export interface BetRequest { sessionId: string; round: number; market: BetMarket; stake: number; odds: number; label: string; fieldSize: number; at?: number }

/** A new bet: the stake leaves the wallet now. One bet per market per round. */
export function placeBet(doc: WalletDoc, req: BetRequest): { doc: WalletDoc; bet?: Bet; error?: string } {
  const stake = Math.floor(req.stake);
  if (!(stake >= MIN_STAKE)) return { doc, error: `The bookie takes at least ${MIN_STAKE} gold.` };
  if (stake > MAX_STAKE) return { doc, error: `The bookie takes at most ${MAX_STAKE} gold on one bet.` };
  const id = `bet:${req.sessionId}:${req.round}:${req.market}`;
  if (doc.bets.some((b) => b.id === id)) return { doc, error: 'You already have that bet on this round.' };
  if (stake > balance(doc)) return { doc, error: 'Not enough gold.' };
  const at = req.at ?? Date.now();
  const paid = post(doc, { id: `stake:${id}`, amount: -stake, reason: 'bet-stake', note: `${marketName(req.market)} · ${req.label}`, at });
  if (!paid.posted) return { doc, error: paid.error ?? 'That bet is already paid for.' };
  const bet: Bet = { id, at, sessionId: req.sessionId, round: req.round, market: req.market, stake, odds: req.odds, status: 'open', payout: 0, label: req.label, fieldSize: req.fieldSize };
  return { doc: { ...paid.doc, bets: [...paid.doc.bets, bet].slice(-BETS_KEEP) }, bet };
}

export const marketName = (m: BetMarket) => BET_MARKETS.find((x) => x.id === m)?.name ?? m;

const wins = (market: BetMarket, finished: boolean, position: number) =>
  finished && (market === 'finish' || (market === 'podium' && position <= 3) || (market === 'win' && position === 1));

/** Settles every open bet on this round from its result. Safe to call more than once. */
export function settleRound(doc: WalletDoc, sessionId: string, round: number, result: { finished: boolean; position?: number }, at = Date.now()): WalletDoc {
  let next = doc;
  for (const bet of doc.bets) {
    if (bet.sessionId !== sessionId || bet.round !== round || bet.status !== 'open') continue;
    const position = result.position ?? Number.POSITIVE_INFINITY;
    const won = wins(bet.market, result.finished, position);
    const payout = won ? Math.floor(bet.stake * bet.odds) : 0;
    if (won) next = post(next, { id: `payout:${bet.id}`, amount: payout, reason: 'bet-payout', note: `${marketName(bet.market)} · ${bet.label}`, at }).doc;
    const settled: Bet = { ...bet, status: won ? 'won' : 'lost', payout, ...(result.finished && result.position ? { position: result.position } : {}) };
    next = { ...next, bets: next.bets.map((b) => (b.id === bet.id ? settled : b)) };
  }
  return next;
}

/** Hands back the stakes of a round that will never be raced (the event was replaced). */
export function voidRound(doc: WalletDoc, sessionId: string, round: number, at = Date.now()): WalletDoc {
  let next = doc;
  for (const bet of doc.bets) {
    if (bet.sessionId !== sessionId || bet.round !== round || bet.status !== 'open') continue;
    next = post(next, { id: `refund:${bet.id}`, amount: bet.stake, reason: 'bet-refund', note: `Refund · ${bet.label}`, at }).doc;
    next = { ...next, bets: next.bets.map((b) => (b.id === bet.id ? { ...b, status: 'void' as const } : b)) };
  }
  return next;
}

/** Prize gold for a finished round (a small faucet, so there is always something to bet). */
export function racePurse(finished: boolean, position: number | undefined, fieldSize: number): number {
  if (!finished || !position) return 0;
  const table = fieldSize <= 4 ? [60, 35, 20, 10] : [80, 55, 40, 30, 25, 20, 15, 12, 10];
  return table[position - 1] ?? 5;
}

export function payRacePurse(doc: WalletDoc, sessionId: string, round: number, finished: boolean, position: number | undefined, fieldSize: number, label: string, at = Date.now()): WalletDoc {
  const gold = racePurse(finished, position, fieldSize);
  if (!gold) return doc;
  return post(doc, { id: `purse:${sessionId}:${round}`, amount: gold, reason: 'race-purse', note: `P${position} · ${label}`, at }).doc;
}

/** Buys a cosmetic (once: the key is the item). */
export function buyItem(doc: WalletDoc, itemId: string, price: number, name: string, at = Date.now()): { doc: WalletDoc; error?: string } {
  if (!Number.isInteger(price) || price < 0) return { doc, error: 'That item has no price.' };
  if (price === 0) return { doc };
  const r = post(doc, { id: `shop:${itemId}`, amount: -price, reason: 'shop', note: name, at });
  return r.error ? { doc, error: r.error } : { doc: r.doc };
}

/* ───────────── storage ───────────── */

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const storage = (): StorageLike | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function readWallet(store: StorageLike | null = storage()): WalletDoc {
  try { return normalizeWallet(JSON.parse(store?.getItem(WALLET_KEY) ?? 'null')); } catch { return emptyWallet(); }
}

export function writeWallet(doc: WalletDoc, store: StorageLike | null = storage()): boolean {
  try { store?.setItem(WALLET_KEY, JSON.stringify(doc)); return !!store; } catch { return false; }
}

/** Read, change, write: the one way the app updates the wallet. */
export function updateWallet(change: (doc: WalletDoc) => WalletDoc, store: StorageLike | null = storage()): WalletDoc {
  const next = change(readWallet(store));
  writeWallet(next, store);
  return next;
}
