# 1 · Data Models & TypeScript Interfaces

Full source: **`src/hmgp2/interfaces.ts`** (target: `src/game/meta/interfaces.ts`). This section explains the *shape decisions*; the file is the contract.

## 1.1 Conventions

- **Brands** (`Gold`, `RacerId`, `EpochMs`, …) prevent passing an Elo where gold is expected. `gold(n)` rounds + clamps ≥ 0; `goldDelta(n)` rounds signed.
- **Versioned records**: `version: 1` literals on every persisted/networked shape. Migrations are `migrateX(v0) → v1` pure functions with tests.
- **Physics vs. cosmetics split**: `LoadoutPreset = { capsule: CapsuleId /* physics */, ball: CustomBallConfig /* looks */ }`. `loadoutStats()` in `loadouts.ts` is untouched.

## 1.2 Interface map

| Group | Interfaces | Notes |
|---|---|---|
| Ball | `CustomBallConfig`, `DecalStamp`, `DecalDef`, `BaseMaterialDef`, `LoadoutPreset` | `bakeKey` = FNV-1a of canonical JSON; doubles as cache key & array-texture layer key. Max 12 decals. |
| Avatar | `GoblinAvatarConfig`, `GoblinDna`, `AvatarLayerItem`, `AvatarLayerId`, `SkinToneId` | DNA is the only thing networked (18 bytes as text). |
| Profile | `RacerProfile`, `CareerStats`, `EloState`, `RankTier`, `BadgeId`, `RANK_TIER_THRESHOLDS` | One account → up to 5 racer slots. Podium % derived, never stored. |
| Death | `DeathRecord`, `SoulSicknessState`, `ResurrectionCalculation`, `SeasonalNetWorthBreakdown` | `DeathRecord.simTick` lets the tombstone "Watch final moments" seek the replay. |
| Economy | `EconomyLedger`, `TransactionRecord`, `TransactionKind`, `SheepHireContract`, `AiPilotContract` | AI contract stores an **eligibility snapshot** proving bankruptcy at queue time. |
| Lobby | `LobbyMatchmaking`, `QueueKind` | `seedCommit` = sha256(seed) published at betting open; seed revealed at start (provably fair). |
| Bookie | `BookieBet`, `BetMarket`, `BetMarketKind`, `BetSelection` | `selfBet` flag is computed server-side, never trusted from the client. |
| Integrity | `SuspicionAudit`, `SuspicionSignal` | Stores per-signal z and contribution for explainable decisions + replay tick ranges. |

## 1.3 Critical excerpts

```ts
export interface DecalStamp {
  readonly uid: string;
  readonly textureId: DecalTextureId;
  readonly u: UnitU;        // 0..1 around the ROLLING circumference (wraps)
  readonly v: UnitV;        // 0 = −X axle pole, 0.5 = equator, 1 = +X axle pole
  readonly scale: number;   // angular half-width as fraction of 90° (0.02..0.6)
  readonly rotation: number;// radians about the surface normal
  readonly opacity: number;
  readonly tintColor: HexColor | null;
  readonly blendMode: 'normal' | 'multiply' | 'overlay';
  readonly mirrorU?: boolean;
  readonly number?: number; // roundels 0..99
}

export interface ResurrectionCalculation {
  readonly inputs: { deaths: number; elo: number; snw: Gold };
  readonly eloFloorBase: number;    // B(E)
  readonly deathMultiplier: number; // k^(n−1)
  readonly eloFloor: Gold;
  readonly wealthTaxRate: number;   // P(n)
  readonly wealthTax: Gold;
  readonly fee: Gold;               // max(eloFloor, wealthTax)
  readonly dominantTerm: 'elo-floor' | 'wealth-tax';
  readonly soulSicknessHours: 0 | 2 | 6 | 12 | 24;
  readonly affordable: boolean;
  readonly liquidShortfall: Gold;
  readonly recommendation: 'resurrect' | 'consider-retiring' | 'retire';
}

export interface AiPilotContract {
  readonly kind: 'ai-pilot';
  readonly eligibility: {
    walletBelowSheepFee: boolean;
    noLivingRacerAffordable: boolean;
    noSellableInventory: boolean;
  };
  readonly payoutRange: readonly [Gold, Gold]; // exactly 50 % of sheep payout: 25..50
  readonly minimumInputRatio: number;          // ≥ 0.6 of ticks with human input (anti-AFK)
  readonly state: 'queued' | 'piloting' | 'settled' | 'voided';
}
```

## 1.4 Persistence schema (server)

Reference implementation: **`src/db/schema.ts`** (Drizzle / Postgres). Tables:

| Table | Key columns | Invariants |
|---|---|---|
| `accounts` | id, display_name, slots_owned (1..5), bookie_cooldown_until | slots_owned only increases via `slot-purchase` tx |
| `racers` | id, account_id, slot, status, elo, season_deaths, dna, ball_config (jsonb), soul_sickness_until | unique (account_id, slot) where status ≠ 'retired' |
| `death_records` | racer_id, heat_id, cause, sim_tick, impact_speed, season_death_index | append-only |
| `ledger_tx` | account_id, kind, delta, balance_after, idempotency_key **unique** | append-only; wallet = last balance_after |
| `lobbies` | kind, cadence, starts_at, betting_locks_at, seed_commit, seed, state | seed NULL until `racing` |
| `bets` | account_id, lobby_id, market, selection_key, stake, locked_odds, state, self_bet | CHECK stake > 0; placed_at < betting_locks_at |
| `suspicion_audits` | subject, lobby_id, score, signals (jsonb), action, resolution | score ∈ [0,100] |
| `hall_of_fame` | racer snapshot, season, peak_elo, cause_of_retirement | written at retirement / season close |

**Ledger write path** (single SQL transaction, `SERIALIZABLE`):
`SELECT balance … FOR UPDATE → validate → INSERT ledger_tx (ON CONFLICT idempotency_key DO NOTHING) → UPDATE accounts.wallet_cache`. A replayed request becomes a no-op, so a double-clicked "Pay Shaman" can never charge twice.
