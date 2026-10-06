/* ============================================================================
 *  packages/setmix-dialogue/src/GoblinTrader.ts
 *  ---------------------------------------------------------------------------
 *  THE CARTRIDGE BARTER ECONOMY.
 *
 *  The Lab can synthesise anything the player can REASON about. The trader
 *  sells the things they cannot: presets whose graphs contain nodes that do
 *  not exist in the Synthesizer yet, recovered from moons that finished.
 *
 *  THE DESIGN PROBLEM THIS SOLVES
 *  A crafting game with a shop usually kills its own crafting. Ours cannot,
 *  because traded cartridges are *inputs*, never outputs: every legendary is
 *  fusable, and the interesting play is fusing a bought exotic with something
 *  you made. You cannot buy a finished planet. You can buy a verb you did
 *  not know existed.
 *
 *  Pricing is deterministic from (item, stock, reputation, planet stage) —
 *  no RNG anywhere, so a price quoted over NetBus is a price both peers
 *  compute independently and therefore agree on without a transaction.
 *
 *  Pure. No clock, no RNG, no I/O.
 * ==========================================================================*/

import { contentHash } from "./fidelity";
import type { Stage } from "./contracts.setmix";

/* ─────────────────────────────────────────────────────────── currency ── */

export type Resource =
  | "TOPOLOGY_SHARD" | "PHOTON_SALT" | "ICE_CLATHRATE"
  | "CHROMATIC_CRYSTAL" | "LOGIC_SUBSTRATE" | "ENTROPY_SLAG" | "DEEP_CHROMA";

export interface ResourceSpec {
  key: Resource;
  label: string;
  colour: string;
  /** trader's internal valuation, in abstract credits */
  baseValue: number;
  note: string;
}

export const RESOURCES: Readonly<Record<Resource, ResourceSpec>> = Object.freeze({
  TOPOLOGY_SHARD:    { key: "TOPOLOGY_SHARD",    label: "Topology Shard",    colour: "#7cff4d", baseValue: 4,   note: "Latent vertex budget. The commonest currency on any moon with ridges." },
  PHOTON_SALT:       { key: "PHOTON_SALT",       label: "Photon Salt",       colour: "#ffc13d", baseValue: 6,   note: "Charges in daylight, discharges at night. Traders discount it at dusk." },
  ICE_CLATHRATE:     { key: "ICE_CLATHRATE",     label: "Ice Clathrate",     colour: "#3dc8ff", baseValue: 11,  note: "Polar only. Requires traversal gear, so its price encodes your logistics." },
  CHROMATIC_CRYSTAL: { key: "CHROMATIC_CRYSTAL", label: "Chromatic Crystal", colour: "#ff3d8a", baseValue: 8,   note: "Discrete colour quanta. On a four-colour moon, a fifth colour is wealth." },
  LOGIC_SUBSTRATE:   { key: "LOGIC_SUBSTRATE",   label: "Logic Substrate",   colour: "#b46bff", baseValue: 34,  note: "Non-renewable. Recovered from derelict render farms. The hard currency." },
  ENTROPY_SLAG:      { key: "ENTROPY_SLAG",      label: "Entropy Slag",      colour: "#6b7a90", baseValue: 1,   note: "Waste. Skree accepts it, grudgingly, because decay operators need it." },
  DEEP_CHROMA:       { key: "DEEP_CHROMA",       label: "Deep Chroma",       colour: "#ff6fb2", baseValue: 52,  note: "Underwater vents only. Proof you built an ocean and then dived into it." },
});

export type Bundle = Partial<Record<Resource, number>>;

export const bundleValue = (b: Bundle): number =>
  (Object.entries(b) as [Resource, number][])
    .reduce((a, [k, n]) => a + RESOURCES[k].baseValue * n, 0);

/* ───────────────────────────────────────────────────────── the stock ── */

export type Rarity = "UNCOMMON" | "RARE" | "EXOTIC" | "LEGENDARY";

export interface TradeGood {
  id: string;
  name: string;
  version: string;
  cls: "MATERIAL" | "OPERATOR" | "RULE" | "BIOME" | "MESH" | "RIG";
  rarity: Rarity;
  tint: string;
  /** cannot be crafted below this planetary stage, even if bought */
  minStage: Stage;
  /** how many Skree has this visit; stock drives price */
  stock: number;
  /** the node types the Lab cannot yet produce — WHY it is unbuyable-by-craft */
  exoticNodes: string[];
  ask: Bundle;
  blurb: string;
  /** what it unlocks mechanically, not just visually */
  unlocks: string;
}

const RARITY_MULT: Record<Rarity, number> = {
  UNCOMMON: 1, RARE: 2.4, EXOTIC: 5.5, LEGENDARY: 13,
};

export const STOCK: TradeGood[] = [
  {
    id: "liquid_neon_sea", name: "Liquid Neon Sea", version: "v1.2",
    cls: "BIOME", rarity: "LEGENDARY", tint: "#39f5c8", minStage: 4, stock: 1,
    exoticNodes: ["emissive_fluid", "ior_dispersion"],
    ask: { ICE_CLATHRATE: 42, DEEP_CHROMA: 6, LOGIC_SUBSTRATE: 3 },
    blurb: "An ocean that glows from beneath. The dispersion node splits its own caustics into a spectrum — nobody in the Lab has worked out how to build an index-of-refraction ramp yet.",
    unlocks: "Night-time Lx harvesting from your own sea. Aq and Lx stop competing for the first time.",
  },
  {
    id: "basalt_archway", name: "Basalt Archway", version: "v3.0",
    cls: "MESH", rarity: "EXOTIC", tint: "#7d7fa8", minStage: 3, stock: 2,
    exoticNodes: ["boolean_csg", "arch_solver"],
    ask: { TOPOLOGY_SHARD: 180, LOGIC_SUBSTRATE: 2 },
    blurb: "A self-supporting span that solves its own catenary against local gravity. Place two anchors; it computes the arch. At 1.62 m/s² the curves are absurd and perfectly stable.",
    unlocks: "Bridges across craters — which is to say, racing lines that did not previously exist.",
  },
  {
    id: "antigrav_ring", name: "Anti-Gravity Hover Ring", version: "v0.9b",
    cls: "RIG", rarity: "LEGENDARY", tint: "#ff6fb2", minStage: 4, stock: 1,
    exoticNodes: ["field_inverter", "kinematic_constraint"],
    ask: { LOGIC_SUBSTRATE: 14, PHOTON_SALT: 120, DEEP_CHROMA: 2 },
    blurb: "Still flagged beta by whoever made it. Inverts local gravity inside the torus. Skree will not say which moon it came from, and the certificate has one failing check.",
    unlocks: "Repulsor Sled chassis + vertical race gates. The first content that is genuinely 3D rather than terrain-bound.",
  },
  {
    id: "wind_prairie", name: "Living Wind Prairie", version: "v4.1",
    cls: "BIOME", rarity: "RARE", tint: "#86c954", minStage: 5, stock: 3,
    exoticNodes: ["curl_advect"],
    ask: { TOPOLOGY_SHARD: 90, CHROMATIC_CRYSTAL: 40 },
    blurb: "Four million blades sharing one divergence-free gust field. The Lab can author the grass; it cannot yet author the wind that all of it agrees on.",
    unlocks: "One vector field drives grass, windmills, seed dispersal and your cape simultaneously.",
  },
  {
    id: "organ_canyon", name: "Whistling Organ-Pipe Canyon", version: "v2.7",
    cls: "MESH", rarity: "EXOTIC", tint: "#9fd6ff", minStage: 3, stock: 1,
    exoticNodes: ["resonance_solver", "hardness_aniso"],
    ask: { TOPOLOGY_SHARD: 140, PHOTON_SALT: 60, ENTROPY_SLAG: 200 },
    blurb: "Columnar basalt hollowed by anisotropic erosion into tubes. Tube length feeds a resonator, so the terrain is literally the instrument. Sculpt the canyon, tune the chord.",
    unlocks: "Geometry-driven procedural audio. Players have tuned these to play melodies.",
  },
  {
    id: "patina_rule", name: "Patina Aging Rule", version: "v1.0",
    cls: "RULE", rarity: "UNCOMMON", tint: "#a35c35", minStage: 2, stock: 5,
    exoticNodes: ["curvature_accum"],
    ask: { ENTROPY_SLAG: 120, TOPOLOGY_SHARD: 30 },
    blurb: "Edge wear from mesh curvature, applied retroactively to everything you have ever built and everything you build later. Cheap, and it changes how the whole base reads.",
    unlocks: "Visual archaeology. Veteran bases start looking veteran.",
  },
  {
    id: "null_tide_ward", name: "Null-Tide Ward", version: "v1.1",
    cls: "RULE", rarity: "EXOTIC", tint: "#ff3d8a", minStage: 4, stock: 2,
    exoticNodes: ["coherence_clamp"],
    ask: { LOGIC_SUBSTRATE: 8, ICE_CLATHRATE: 60 },
    blurb: "Clamps the Aq/Pxd ratio inside its radius, which is the only known way to stop a Null Tide without draining the basin. Skree sells these to people who learned the hard way.",
    unlocks: "Safe aggressive hydrology. You can outrun Pxd for a while and survive it.",
  },
  {
    id: "strider_chassis", name: "Hexapod Strider Chassis", version: "v5.2",
    cls: "RIG", rarity: "RARE", tint: "#d8a24a", minStage: 3, stock: 2,
    exoticNodes: ["ik_retarget"],
    ask: { TOPOLOGY_SHARD: 110, LOGIC_SUBSTRATE: 1 },
    blurb: "Six sockets and a procedural gait solver that retargets to whatever silhouette you bolt on. Authoring a vehicle becomes authoring an outline.",
    unlocks: "Player-designed mounts with real stat consequences: leg length → step height → terrain access.",
  },
];

/* ═══════════════════════════════════════════ pricing (deterministic) ══ */

export interface TraderState {
  /** 0..1 — rises with completed trades, falls if you decline mid-haggle */
  reputation: number;
  /** goods already bought this visit shrink stock and raise prices */
  bought: Record<string, number>;
  /** the planet's stage gates what Skree will even show you */
  stage: Stage;
  visitSeed: number;
}

export function initialTrader(stage: Stage = 3, visitSeed = 1): TraderState {
  return { reputation: 0.2, bought: {}, stage, visitSeed };
}

/**
 *  price = ask · rarityMult · scarcity · reputationDiscount · stageTax
 *
 *  Scarcity is hyperbolic in remaining stock: the last unit of a legendary
 *  costs three times the first, which is what stops a rich player from
 *  buying the board and ending their own progression in one transaction.
 */
export function priceOf(good: TradeGood, st: TraderState): {
  bundle: Bundle; credits: number; scarcity: number; discount: number; available: boolean; reason: string;
} {
  const sold = st.bought[good.id] ?? 0;
  const left = Math.max(0, good.stock - sold);
  const scarcity = left <= 0 ? Infinity : 1 + (good.stock - left) * 0.9 + (1 / left - 1 / good.stock) * 1.6;
  const discount = 1 - st.reputation * 0.22;
  const stageTax = good.minStage > st.stage ? 2.2 : 1;

  const mult = RARITY_MULT[good.rarity] * scarcity * discount * stageTax;
  const bundle: Bundle = {};
  for (const [k, n] of Object.entries(good.ask) as [Resource, number][])
    bundle[k] = Math.max(1, Math.round(n * mult / RARITY_MULT[good.rarity]));

  return {
    bundle,
    credits: Math.round(bundleValue(bundle)),
    scarcity: isFinite(scarcity) ? scarcity : 0,
    discount,
    available: left > 0,
    reason: left <= 0 ? "sold out this visit"
      : good.minStage > st.stage ? `your planet is Stage ${st.stage}; this needs Stage ${good.minStage} — Skree will sell it anyway, at a markup`
      : "in stock",
  };
}

export function canAfford(inv: Bundle, price: Bundle): boolean {
  return (Object.entries(price) as [Resource, number][]).every(([k, n]) => (inv[k] ?? 0) >= n);
}

export interface TradeResult {
  ok: boolean;
  inventory: Bundle;
  trader: TraderState;
  /** the cartridge hash the player now owns — identical for every peer */
  acquiredHash: string | null;
  message: string;
}

/**
 *  Executing a trade is a pure state transition, and the resulting cartridge
 *  hash is derived from (good.id, version, visitSeed) — so two players who
 *  buy the same good from the same visit own the *same* cartridge, dedupe in
 *  the Galaxy, and can verify each other's ownership without a server.
 */
export function executeTrade(
  good: TradeGood, inv: Bundle, st: TraderState,
): TradeResult {
  const p = priceOf(good, st);
  if (!p.available)
    return { ok: false, inventory: inv, trader: st, acquiredHash: null, message: "Skree has none left this visit." };
  if (!canAfford(inv, p.bundle))
    return { ok: false, inventory: inv, trader: st, acquiredHash: null, message: "Not enough ore. Skree is sympathetic but firm." };

  const inventory: Bundle = { ...inv };
  for (const [k, n] of Object.entries(p.bundle) as [Resource, number][])
    inventory[k] = (inventory[k] ?? 0) - n;

  const trader: TraderState = {
    ...st,
    bought: { ...st.bought, [good.id]: (st.bought[good.id] ?? 0) + 1 },
    reputation: Math.min(1, st.reputation + 0.06 + RARITY_MULT[good.rarity] * 0.004),
  };

  return {
    ok: true, inventory, trader,
    acquiredHash: contentHash({ good: good.id, v: good.version, seed: st.visitSeed }),
    message: `Acquired ${good.name} ${good.version}. Skree's regard: ${(trader.reputation * 100) | 0}%.`,
  };
}

/** Sell-back exists but is punitive by design: the loop is "mine, craft,
 *  fuse", and a liquid two-way market would turn it into "farm, arbitrage". */
export function sellValue(good: TradeGood, st: TraderState): Bundle {
  const p = priceOf(good, st);
  const out: Bundle = {};
  for (const [k, n] of Object.entries(p.bundle) as [Resource, number][])
    out[k] = Math.max(1, Math.floor(n * 0.34));
  return out;
}

export const MARKET_RULES = [
  ["Traded cartridges are inputs, never outputs",
   "Every legendary is fusable. The interesting play is fusing a bought exotic with something you made — you cannot buy a finished planet, only a verb you did not know existed."],
  ["Exotics contain nodes the Synthesizer lacks",
   "Each good lists its exoticNodes. That is the honest reason it cannot be crafted: the Lab has not unlocked that node type yet. Buying one is a preview of a future tech tier."],
  ["Prices are deterministic, so they need no server",
   "price = f(good, stock, reputation, stage). Two peers compute the same number independently, which is how trading works over NetBus with zero authority."],
  ["Scarcity is hyperbolic in remaining stock",
   "The last unit of a legendary costs ~3× the first. A rich player cannot buy the board and end their own progression in one transaction."],
  ["Sell-back is punitive on purpose",
   "34% of ask. A liquid two-way market would convert 'mine, craft, fuse' into 'farm, arbitrage', which is a different and much worse game."],
] as const;
