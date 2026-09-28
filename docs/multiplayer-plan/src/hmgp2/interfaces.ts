/**
 * Heavy Metal GP 2 — Meta-game data contracts (Deliverable 1).
 *
 * Target in game repo: `src/game/meta/interfaces.ts`.
 * Rules:
 *  - Every persisted/networked shape carries a `version` literal so migrations are explicit.
 *  - Gold is always an integer (`Gold` brand). Never store fractional gold; round at the boundary.
 *  - Timestamps are epoch milliseconds (`EpochMs`), produced by the server clock only.
 *  - Nothing in here imports Three.js or React — the contracts are consumed by the 120 Hz sim,
 *    the renderer, the UI and the server alike.
 */

/* ────────────────────────────── Brands & primitives ────────────────────────────── */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Gold = Brand<number, 'Gold'>;           // integer ≥ 0 unless in a signed delta
export type GoldDelta = Brand<number, 'GoldDelta'>; // signed integer
export type EpochMs = Brand<number, 'EpochMs'>;
export type AccountId = Brand<string, 'AccountId'>;
export type RacerId = Brand<string, 'RacerId'>;
export type LobbyId = Brand<string, 'LobbyId'>;
export type HeatId = Brand<string, 'HeatId'>;
export type SeasonId = Brand<string, 'SeasonId'>;   // e.g. "S2026-05"
export type BetId = Brand<string, 'BetId'>;
export type TxId = Brand<string, 'TxId'>;
export type HexColor = `#${string}`;

/** Longitude on the ball surface, 0..1 wraps around the ROLLING circumference (equator). */
export type UnitU = number;
/** Latitude on the ball surface, 0 = axle pole (−X cap), 1 = axle pole (+X cap), 0.5 = rolling equator. */
export type UnitV = number;

export const gold = (n: number): Gold => Math.max(0, Math.round(n)) as Gold;
export const goldDelta = (n: number): GoldDelta => Math.round(n) as GoldDelta;

/* ────────────────────────────── SYSTEM 1: Ball customization ────────────────────────────── */

export type BaseMaterialId = 'scrap-iron' | 'galvanized-brass' | 'damascus' | 'scorched-obsidian' | 'boiler-copper';

/** Procedural recipe for the base metal. Baked once into the equirect canvas; no runtime shading cost. */
export interface BaseMaterialDef {
  readonly id: BaseMaterialId;
  readonly name: string;
  readonly unlock: { readonly kind: 'default' } | { readonly kind: 'shop'; readonly price: Gold } | { readonly kind: 'season-reward'; readonly season: SeasonId };
  /** Albedo gradient stops sampled by the noise field (0..1). */
  readonly palette: readonly { readonly at: number; readonly color: HexColor }[];
  readonly noise: {
    readonly kind: 'pitted' | 'brushed' | 'folded-wave' | 'fissure' | 'patina';
    readonly frequency: number;   // cycles around the equator
    readonly octaves: 1 | 2 | 3 | 4;
    readonly contrast: number;    // 0..2
    /** Brushed grain runs along this axis in UV space. 'u' = along rolling direction. */
    readonly anisotropy?: 'u' | 'v';
  };
  /** Emissive micro-fissures (obsidian) — packed into the same map, driven by emissiveMap. */
  readonly emissive?: { readonly color: HexColor; readonly threshold: number; readonly intensity: number };
  /** Fake lighting baked into albedo so the Lambert shadow side never reads as pure black. */
  readonly bakedAmbient: number; // 0..0.4, added as flat lift
  /** Racer stat offsets are NOT allowed here: cosmetics are stat-neutral. Physics stays in `CapsuleId`. */
}

export type DecalCategory = 'emblem' | 'pattern' | 'tech' | 'roundel';

export type DecalTextureId =
  | 'emblem.crossed-wrenches' | 'emblem.flaming-skull' | 'emblem.clockwork-gear' | 'emblem.goblin-fist' | 'emblem.trefoil'
  | 'pattern.dual-stripes' | 'pattern.hazard-chevrons' | 'pattern.checker-band' | 'pattern.boiler-rivets'
  | 'tech.patch-plate' | 'tech.pressure-gauge' | 'tech.exhaust-louver'
  | 'roundel.number';

export type DecalBlendMode = 'normal' | 'multiply' | 'overlay';

/**
 * How the decal is projected. `gnomonic` = tangent-plane stamp (emblems, plates; exact, no polar stretch).
 * `band` = wraps a full ring at constant latitude (stripes, checker bands; seam-free by construction).
 */
export type DecalProjection = 'gnomonic' | 'band';

export interface DecalDef {
  readonly id: DecalTextureId;
  readonly category: DecalCategory;
  readonly name: string;
  readonly projection: DecalProjection;
  /** Source art: alpha PNG (square for gnomonic, 1-px-tall repeatable strip for band). */
  readonly image: string;
  readonly defaultScale: number;
  readonly tintable: boolean;
  readonly price: Gold;
}

export interface DecalStamp {
  readonly uid: string;                 // stable per stamp for undo/redo & React keys
  readonly textureId: DecalTextureId;
  readonly u: UnitU;                    // centre longitude, 0..1 (wraps)
  readonly v: UnitV;                    // centre latitude, 0..1
  /** Angular size: the stamp's half-width as a fraction of a great circle's quarter (0.02..0.6). */
  readonly scale: number;
  readonly rotation: number;            // radians, around the surface normal, 0 = "up" toward +X pole
  readonly opacity: number;             // 0..1
  readonly tintColor: HexColor | null;
  readonly blendMode: DecalBlendMode;
  readonly mirrorU?: boolean;
  /** Roundel only: 0..99. */
  readonly number?: number;
}

export const MAX_DECALS_PER_BALL = 12;

export interface CustomBallConfig {
  readonly version: 1;
  readonly base: BaseMaterialId;
  /** Team rim / accent: replaces the old 2D `RIM_COLORS` stroke with a baked equatorial pin-line. */
  readonly accentColor: HexColor;
  readonly capFinish: 'brass' | 'gunmetal' | 'copper' | 'chrome';
  /** Ordered back → front, max `MAX_DECALS_PER_BALL`. */
  readonly decals: readonly DecalStamp[];
  /** Deterministic hash of everything above; also the texture cache key and array-texture layer key. */
  readonly bakeKey: string;
}

export interface LoadoutPreset {
  readonly slot: 0 | 1 | 2 | 3 | 4;
  readonly name: string;
  readonly capsule: 'iron' | 'springsteel' | 'siege'; // physics (unchanged, from loadouts.ts)
  readonly ball: CustomBallConfig;                      // cosmetics
}

/* ────────────────────────────── SYSTEM 2: Goblin avatar ────────────────────────────── */

export type AvatarLayerId =
  | 'background' | 'ears' | 'head' | 'mouth' | 'nose' | 'eyes' | 'eyewear'
  | 'hair' | 'headgear' | 'neck' | 'warpaint';

/** Z-order is the array order. Skin tone is a parameter of `head`/`ears`, not its own layer. */
export const AVATAR_LAYER_ORDER: readonly AvatarLayerId[] = [
  'background', 'ears', 'head', 'warpaint', 'mouth', 'nose', 'eyes', 'eyewear', 'hair', 'headgear', 'neck',
] as const;

export type SkinToneId = 'toxic-green' | 'sallow-ochre' | 'ash-grey' | 'mottled-olive';

export interface AvatarLayerItem {
  readonly layer: AvatarLayerId;
  readonly id: string;                    // e.g. 'ears.torn-brass-ring'
  readonly name: string;
  /** Index inside its layer's catalog — this is what the DNA encodes. 0 is always "none" for optional layers. */
  readonly index: number;
  readonly optional: boolean;
  /** Which color channels the draw routine consumes. */
  readonly uses: readonly ('skin' | 'accent' | 'leather' | 'metal')[];
  /** Items that must be hidden when this one is worn (e.g. headgear hides mohawk → hair falls back to 'tufts-short'). */
  readonly occludes?: readonly { readonly layer: AvatarLayerId; readonly fallbackIndex: number }[];
  readonly unlock: { readonly kind: 'default' } | { readonly kind: 'shop'; readonly price: Gold } | { readonly kind: 'badge'; readonly badge: BadgeId };
  readonly weight: number; // rarity weight for generateRandomGoblin
}

/** Layers the player may nudge. Background, head and neck are structural and stay fixed. */
export type NudgeLayerId = 'ears' | 'eyes' | 'eyewear' | 'nose' | 'mouth' | 'hair' | 'headgear' | 'warpaint';
/** Paired features that can also be spread apart / pulled together symmetrically. */
export type SpreadLayerId = 'ears' | 'eyes';

/** Integer steps in [-3, +3]. Pixel size of a step is per layer (NUDGE_STEP_PX). */
export interface NudgeState {
  readonly offset: Readonly<Partial<Record<NudgeLayerId, { readonly x: number; readonly y: number }>>>;
  readonly spread: Readonly<Partial<Record<SpreadLayerId, number>>>;
}

export interface GoblinAvatarConfig {
  readonly version: 1;
  readonly layers: Readonly<Record<AvatarLayerId, number>>; // catalog index per layer
  readonly skin: SkinToneId;
  readonly accent: number;   // 0..7 index into ACCENT_PALETTE
  readonly leather: number;  // 0..3 index into LEATHER_PALETTE
  readonly metal: number;    // 0..3 index into METAL_PALETTE
  /** Optional player nudges (DNA v2 suffix). Absent ≡ all zero ≡ v1-compatible. */
  readonly nudge?: NudgeState;
}

/**
 * v1 `GOB-XXXX-XXXX-XXXX` — 48 bits: 4 version | 36 payload (mixed-radix) | 8 checksum.
 * v2 `GOB-XXXX-XXXX-XXXX[-NNNN-NNNN-NNNN]` — version nibble 2 (extended catalog radix) + optional
 * base-36 nudge block: 18 radix-7 digits (≈ 50.5 bits) + 2-char checksum bound to the head.
 */
export type GoblinDna = Brand<`GOB-${string}-${string}-${string}`, 'GoblinDna'>;

/* ────────────────────────────── SYSTEM 3: Profile ────────────────────────────── */

export type RankTier = 'rookie' | 'grease-monkey' | 'gearhead' | 'pit-boss' | 'grand-champion';

export const RANK_TIER_THRESHOLDS: Readonly<Record<RankTier, number>> = {
  'rookie': 0, 'grease-monkey': 1100, 'gearhead': 1400, 'pit-boss': 1800, 'grand-champion': 2200,
};

export type BadgeId =
  | 'first-blood-survivor'   // survived a ranked heat where ≥1 racer died in the first 30 s
  | 'centurion-racer'        // 100 completed ranked heats (account-wide)
  | 'bookies-nightmare'      // won a bet at ≥ 25.0 decimal odds with S < 20
  | 'iron-will'              // finished a season with this racer at 0 deaths
  | 'lazarus'                // resurrected 3 times in one season
  | 'hall-of-famer'          // retired a racer with ≥ 1800 peak Elo
  | 'shepherd'               // 200 sheep-hire races
  | 'contract-pilot';        // completed 10 AI pilot contracts and then got back to solvency

export type RacerStatus = 'alive' | 'dead' | 'retired';

export interface CareerStats {
  readonly races: number;
  readonly rankedRaces: number;
  readonly wins: number;
  readonly podiums: number;
  readonly dnfs: number;
  readonly deaths: number;             // lifetime, all seasons
  readonly bestFinish: number | null;
  readonly fastestLapMs: Readonly<Record<string, number>>; // courseId → ms
  /** Derived, never stored: podiums / races. */
}

export interface EloState {
  readonly rating: number;
  readonly seasonPeak: number;
  readonly lifetimePeak: number;
  readonly provisionalRacesLeft: number; // first 10 ranked heats use K=48
}

export interface RacerProfile {
  readonly version: 1;
  readonly id: RacerId;
  readonly account: AccountId;
  readonly slot: 0 | 1 | 2 | 3 | 4;
  readonly name: string;
  readonly title: string;              // earned or chosen, e.g. "The Unkillable"
  readonly avatar: GoblinDna;
  readonly ballPresetSlot: 0 | 1 | 2 | 3 | 4;
  readonly status: RacerStatus;
  readonly elo: EloState;
  readonly tier: RankTier;
  readonly career: CareerStats;
  readonly season: {
    readonly id: SeasonId;
    readonly deaths: number;            // n in the Shaman formula
    readonly races: number;
    readonly earnings: Gold;            // gross seasonal inflow attributed to this racer
  };
  readonly badges: readonly BadgeId[];
  readonly lastDeath: DeathRecord | null;
  readonly soulSickness: SoulSicknessState;
  readonly createdAt: EpochMs;
  readonly retiredAt: EpochMs | null;
}

/* ────────────────────────────── SYSTEM 5/6: Death & resurrection ────────────────────────────── */

export type DeathCause = 'lava-lake' | 'tnt-chain' | 'terminal-fall' | 'wall-smash' | 'crushed' | 'drowned-in-oil';

export interface DeathRecord {
  readonly racer: RacerId;
  readonly season: SeasonId;
  readonly heat: HeatId;
  readonly course: string;
  readonly cause: DeathCause;
  readonly simTick: number;           // 120 Hz tick → deterministic replay seek
  readonly impactSpeed: number | null; // units/s, for wall-smash (threshold 1400)
  readonly finishingPlace: null;      // dead racers don't place; kept for schema clarity
  readonly killedBy: RacerId | null;  // last collider within 0.75 s, for First Blood market
  readonly at: EpochMs;
  readonly seasonDeathIndex: number;  // n after this death
}

export interface SoulSicknessState {
  readonly active: boolean;
  readonly lockoutUntil: EpochMs | null; // ranked queue only; unranked and betting unaffected
  readonly hours: 0 | 2 | 6 | 12 | 24;
}

export interface ResurrectionCalculation {
  readonly version: 1;
  readonly inputs: { readonly deaths: number; readonly elo: number; readonly snw: Gold };
  readonly eloFloorBase: number;        // B(E) = 250·(E/1000)²
  readonly deathMultiplier: number;     // k^(n−1)
  readonly eloFloor: Gold;              // B(E)·k^(n−1)
  readonly wealthTaxRate: number;       // P(n)
  readonly wealthTax: Gold;             // P(n)·SNW
  readonly fee: Gold;                   // max(eloFloor, wealthTax)
  readonly dominantTerm: 'elo-floor' | 'wealth-tax';
  readonly soulSicknessHours: SoulSicknessState['hours'];
  readonly affordable: boolean;         // fee ≤ liquid wallet
  readonly liquidShortfall: Gold;       // how much more liquid gold is needed
  /** UX advice: 'retire' once n ≥ 4; 'consider-retiring' at n = 3 or when the fee exceeds liquid gold. */
  readonly recommendation: 'resurrect' | 'consider-retiring' | 'retire';
}

export interface SeasonalNetWorthBreakdown {
  readonly liquidWallet: Gold;
  readonly inventoryValue: Gold;        // resale value of tradeable items only
  readonly betEscrow: Gold;             // stakes currently locked in open slips
  readonly holdings: Gold;              // sum of the three above
  readonly grossSeasonalInflow: Gold;   // every credit this season, never decreases
  /** SNW = max(holdings, λ·grossSeasonalInflow) — mule transfers cannot shrink the tax base. */
  readonly snw: Gold;
  readonly lambda: number;
}

/* ────────────────────────────── SYSTEM 5: Economy ────────────────────────────── */

export type TransactionKind =
  | 'ranked-purse' | 'ranked-entry' | 'ranked-rake'
  | 'sheep-hire-fee' | 'sheep-hire-payout' | 'ai-pilot-payout'
  | 'resurrection' | 'slot-purchase' | 'cosmetic-purchase'
  | 'bet-stake' | 'bet-payout' | 'bet-refund' | 'bookie-vig'
  | 'season-reward' | 'escrow-hold' | 'escrow-release' | 'confiscation' | 'lobby-host-fee';

export interface TransactionRecord {
  readonly id: TxId;
  readonly account: AccountId;
  readonly racer: RacerId | null;
  readonly kind: TransactionKind;
  readonly delta: GoldDelta;            // signed
  readonly balanceAfter: Gold;
  readonly ref: { readonly heat?: HeatId; readonly bet?: BetId; readonly lobby?: LobbyId } | null;
  readonly idempotencyKey: string;      // `${kind}:${ref}:${account}` — double-credit impossible
  readonly at: EpochMs;
}

export interface EconomyLedger {
  readonly version: 1;
  readonly account: AccountId;
  readonly season: SeasonId;
  readonly wallet: Gold;
  readonly escrow: Gold;                // held by Bookie / audits, not spendable
  readonly grossSeasonalInflow: Gold;
  readonly grossSeasonalOutflow: Gold;
  readonly faucetCounters: {
    readonly sheepRacesToday: number;   // diminishing returns after SHEEP_DAILY_FULL_RATE
    readonly aiContractsToday: number;
  };
  readonly slotsOwned: 1 | 2 | 3 | 4 | 5;
  readonly recent: readonly TransactionRecord[]; // last 50, full history server-side
}

export interface SheepHireContract {
  readonly kind: 'sheep-hire';
  readonly lobby: LobbyId;
  readonly racer: RacerId;
  readonly fee: Gold;                   // 20, paid on queue
  readonly sheepBreed: 'scrap-merino' | 'boiler-ram' | 'lava-lamb';
  /** Payout = base[50..100] by scrap collected, × diminishing factor. Settled at race end. */
  readonly payoutRange: readonly [Gold, Gold];
  readonly diminishingFactor: number;   // 1.0 for first 24/day, 0.5 up to 48/day, 0.1 after
  readonly state: 'queued' | 'racing' | 'settled' | 'refunded';
  readonly payout: Gold | null;
}

export interface AiPilotContract {
  readonly kind: 'ai-pilot';
  readonly account: AccountId;
  readonly lobby: LobbyId;
  /** Eligibility snapshot, proven at queue time. All must be true. */
  readonly eligibility: {
    readonly walletBelowSheepFee: boolean;
    readonly noLivingRacerAffordable: boolean; // every alive racer can't afford entry, or all dead
    readonly noSellableInventory: boolean;
  };
  /** Exactly 50 % of the sheep payout the same finish would have produced: 25..50. */
  readonly payoutRange: readonly [Gold, Gold];
  readonly minimumInputRatio: number;   // ≥ 0.6 of ticks must carry human input — anti-AFK
  readonly state: 'queued' | 'piloting' | 'settled' | 'voided';
  readonly payout: Gold | null;
}

/* ────────────────────────────── SYSTEM 4: Lobbies ────────────────────────────── */

export type QueueKind = 'custom' | 'unranked' | 'ranked';

export interface LobbyMatchmaking {
  readonly version: 1;
  readonly id: LobbyId;
  readonly kind: QueueKind;
  readonly season: SeasonId;
  readonly course: string;
  readonly fieldSize: 4 | 20 | 50 | 100 | number; // custom may be 4..100
  readonly collisionMode: 'full' | 'ghost-start' | 'ghost';
  readonly entryFee: Gold;              // 0..5000 custom; tiered ranked; 0 unranked
  readonly permadeath: boolean;         // true only for 'ranked'
  readonly bettingEnabled: boolean;
  readonly cadenceMinutes: 10 | 30 | null; // unranked 10, ranked 30, custom null
  readonly schedule: {
    readonly bettingOpensAt: EpochMs;   // start − 25 min (ranked)
    readonly bettingLocksAt: EpochMs;   // start − 5 min, hard lock
    readonly queueLocksAt: EpochMs;     // start − 2 min
    readonly startsAt: EpochMs;
  };
  readonly eloBracket: { readonly min: number; readonly max: number } | null;
  readonly entrants: readonly { readonly racer: RacerId; readonly elo: number; readonly isAiPilot: boolean; readonly sheep: boolean }[];
  readonly seed: number;                // deterministic sim seed, revealed at start (commit-reveal hash shown early)
  readonly seedCommit: string;          // sha256(seed) published when betting opens
  readonly state: 'scheduled' | 'betting' | 'locked' | 'racing' | 'settling' | 'settled' | 'void';
}

/* ────────────────────────────── SYSTEM 7: Bookie ────────────────────────────── */

export type BetMarketKind = 'outright' | 'podium' | 'head-to-head' | 'casualties-over-under' | 'first-blood';

export interface BetSelection {
  readonly racer?: RacerId;
  readonly opponent?: RacerId;          // head-to-head
  readonly line?: number;               // over/under, e.g. 6.5
  readonly side?: 'over' | 'under';
}

export interface BetMarket {
  readonly id: string;
  readonly heat: HeatId;
  readonly kind: BetMarketKind;
  readonly pricing: 'pari-mutuel' | 'fixed-odds';
  readonly takeoutRate: number;         // pari-mutuel vig, e.g. 0.08 — a gold sink
  readonly pool: Gold;
  readonly selections: readonly {
    readonly key: string;
    readonly selection: BetSelection;
    readonly staked: Gold;
    readonly decimalOdds: number;       // live indicative (pari-mutuel) or locked (fixed)
    readonly impliedProbability: number;
  }[];
  readonly state: 'open' | 'locked' | 'settled' | 'void';
}

export interface BookieBet {
  readonly version: 1;
  readonly id: BetId;
  readonly account: AccountId;
  readonly market: string;
  readonly selectionKey: string;
  readonly stake: Gold;
  readonly lockedOdds: number | null;   // fixed-odds only
  readonly placedAt: EpochMs;
  readonly selfBet: boolean;            // bettor owns a racer in this heat
  readonly state: 'open' | 'won' | 'lost' | 'void' | 'escrowed' | 'confiscated';
  readonly payout: Gold | null;
  readonly auditId: string | null;
}

export type SuspicionSignal =
  | 'underdog-stake-spike' | 'linked-account-cluster' | 'late-money-flow'
  | 'throttle-anomaly' | 'brake-check' | 'route-abandonment' | 'suicide-collision'
  | 'payout-deviation';

export interface SuspicionAudit {
  readonly version: 1;
  readonly id: string;
  readonly heat: HeatId;
  readonly subject: AccountId;
  readonly score: number;               // S ∈ [0, 100]
  readonly signals: readonly { readonly signal: SuspicionSignal; readonly z: number; readonly contribution: number; readonly evidence: string }[];
  readonly action: 'none' | 'escrow-1h' | 'bookie-cooldown-24h' | 'confiscate-and-penalize';
  readonly replayTicks: readonly [number, number][]; // tick ranges for human review
  readonly createdAt: EpochMs;
  readonly resolvedAt: EpochMs | null;
  readonly resolution: 'auto-cleared' | 'upheld' | 'overturned' | null;
}
