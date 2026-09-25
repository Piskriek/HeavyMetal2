/**
 * Heavy Metal GP 2 — Meta Server reference schema (Plan §1.4).
 * Append-only ledger + idempotency keys; balances are derived (wallet_cache is a projection).
 */
import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, jsonb, pgTable, real, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  slotsOwned: smallint('slots_owned').notNull().default(1),
  walletCache: bigint('wallet_cache', { mode: 'number' }).notNull().default(500),
  escrowCache: bigint('escrow_cache', { mode: 'number' }).notNull().default(0),
  grossSeasonalInflow: bigint('gross_seasonal_inflow', { mode: 'number' }).notNull().default(0),
  bookieCooldownUntil: timestamp('bookie_cooldown_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check('slots_range', sql`${t.slotsOwned} between 1 and 5`), check('wallet_nonneg', sql`${t.walletCache} >= 0`)]);

export const racers = pgTable('racers', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  slot: smallint('slot').notNull(),
  name: text('name').notNull(),
  title: text('title').notNull().default('The Rookie'),
  archetype: text('archetype').notNull().default('rivet'),
  dna: text('dna').notNull(),
  ballConfig: jsonb('ball_config').notNull(),
  status: text('status', { enum: ['alive', 'dead', 'retired'] }).notNull().default('alive'),
  elo: real('elo').notNull().default(1000),
  seasonPeakElo: real('season_peak_elo').notNull().default(1000),
  seasonId: text('season_id').notNull(),
  seasonDeaths: integer('season_deaths').notNull().default(0),
  career: jsonb('career').notNull().default(sql`'{}'::jsonb`),
  badges: text('badges').array().notNull().default(sql`'{}'::text[]`),
  soulSicknessUntil: timestamp('soul_sickness_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('racers_active_slot').on(t.accountId, t.slot).where(sql`${t.status} <> 'retired'`),
  check('racer_slot_range', sql`${t.slot} between 0 and 4`),
]);

export const deathRecords = pgTable('death_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  racerId: uuid('racer_id').notNull().references(() => racers.id),
  seasonId: text('season_id').notNull(),
  lobbyId: uuid('lobby_id').notNull(),
  course: text('course').notNull(),
  cause: text('cause', { enum: ['lava-lake', 'tnt-chain', 'terminal-fall', 'wall-smash', 'crushed', 'drowned-in-oil'] }).notNull(),
  simTick: integer('sim_tick').notNull(),
  impactSpeed: real('impact_speed'),
  killedBy: uuid('killed_by'),
  seasonDeathIndex: integer('season_death_index').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('death_racer_idx').on(t.racerId, t.seasonId)]);

export const ledgerTx = pgTable('ledger_tx', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  racerId: uuid('racer_id'),
  kind: text('kind').notNull(),
  delta: bigint('delta', { mode: 'number' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  ref: jsonb('ref'),
  idempotencyKey: text('idempotency_key').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('ledger_idem').on(t.idempotencyKey), index('ledger_account_idx').on(t.accountId, t.at), check('ledger_balance_nonneg', sql`${t.balanceAfter} >= 0`)]);

export const lobbies = pgTable('lobbies', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['custom', 'unranked', 'ranked'] }).notNull(),
  seasonId: text('season_id').notNull(),
  course: text('course').notNull(),
  fieldSize: smallint('field_size').notNull(),
  collisionMode: text('collision_mode').notNull().default('full'),
  entryFee: integer('entry_fee').notNull().default(0),
  permadeath: integer('permadeath').notNull().default(0),
  bettingEnabled: integer('betting_enabled').notNull().default(0),
  eloMin: real('elo_min'),
  eloMax: real('elo_max'),
  bettingOpensAt: timestamp('betting_opens_at', { withTimezone: true }),
  bettingLocksAt: timestamp('betting_locks_at', { withTimezone: true }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  seedCommit: text('seed_commit').notNull(),
  seed: bigint('seed', { mode: 'number' }),
  state: text('state').notNull().default('scheduled'),
}, (t) => [index('lobby_start_idx').on(t.kind, t.startsAt), check('fee_range', sql`${t.entryFee} between 0 and 5000`), check('field_range', sql`${t.fieldSize} between 4 and 100`)]);

export const bets = pgTable('bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  lobbyId: uuid('lobby_id').notNull().references(() => lobbies.id),
  market: text('market', { enum: ['outright', 'podium', 'head-to-head', 'casualties-over-under', 'first-blood'] }).notNull(),
  selectionKey: text('selection_key').notNull(),
  stake: integer('stake').notNull(),
  lockedOdds: real('locked_odds'),
  selfBet: integer('self_bet').notNull().default(0),
  state: text('state').notNull().default('open'),
  payout: integer('payout'),
  auditId: uuid('audit_id'),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('bets_lobby_idx').on(t.lobbyId, t.market), check('stake_pos', sql`${t.stake} > 0`)]);

export const suspicionAudits = pgTable('suspicion_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  lobbyId: uuid('lobby_id').notNull(),
  subject: uuid('subject').notNull(),
  score: real('score').notNull(),
  signals: jsonb('signals').notNull(),
  action: text('action').notNull(),
  replayTicks: jsonb('replay_ticks').notNull().default(sql`'[]'::jsonb`),
  resolution: text('resolution'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [check('score_range', sql`${t.score} between 0 and 100`)]);

export const hallOfFame = pgTable('hall_of_fame', {
  id: uuid('id').primaryKey().defaultRandom(),
  racerId: uuid('racer_id').notNull(),
  accountId: uuid('account_id').notNull(),
  seasonId: text('season_id').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  peakElo: real('peak_elo').notNull(),
  reason: text('reason', { enum: ['retired-by-player', 'season-close-dead'] }).notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Stored Shaman quotes from the calculator API — lets the plan page show recent server-side quotes. */
export const shamanQuotes = pgTable('shaman_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  deaths: integer('deaths').notNull(),
  elo: real('elo').notNull(),
  snw: bigint('snw', { mode: 'number' }).notNull(),
  fee: bigint('fee', { mode: 'number' }).notNull(),
  dominant: text('dominant').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Goblins saved from the Character Creator showcase (DNA is validated server-side before insert). */
export const savedGoblins = pgTable('saved_goblins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  title: text('title').notNull().default('The Rookie'),
  dna: text('dna').notNull(),
  dnaVersion: smallint('dna_version').notNull(),
  nudged: integer('nudged').notNull().default(0),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('saved_goblins_at_idx').on(t.at)]);
