/**
 * 30-day season economy simulator (Deliverable 4 — equilibrium proof harness).
 * Target in game repo: `scripts/sim/economy-season.ts` (run in `scripts/check.mjs` with fixed seed).
 * Deterministic: same seed → byte-identical report. No Date, no Math.random.
 */
import { calculateResurrectionCost, seasonalNetWorth } from './shaman';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ECONOMY = {
  startingGold: 500,
  sheepFee: 25,
  sheepPayout: [50, 100] as const,
  sheepDailyFullRate: 12,
  sheepDailyHalfRate: 24,
  aiPilotShare: 0.5,
  rankedEntry: (elo: number) => (elo >= 1800 ? 250 : elo >= 1400 ? 150 : 100),
  rankedRake: 0.12,
  rankedPaidFraction: 0.1,
  rankedDeathChance: 0.035,
  bookieTakeout: 0.08,
  slotPrice: [0, 2500, 6000, 12000, 25000] as const,
  seasonDays: 30,
} as const;

export type Archetype = 'unranked-grinder' | 'ranked-regular' | 'whale' | 'reckless';

interface SimPlayer {
  archetype: Archetype;
  skill: number;          // latent, ~N(0,1)
  wallet: number;
  inventory: number;      // resale value (cosmetics resell at 40 %)
  gross: number;
  elo: number;
  deathsThisSeason: number;
  racerAlive: boolean;
  lockoutRacesLeft: number;
  everBroke: boolean;
  recovered: boolean;
  retired: number;
  resurrections: number;
  slots: number;
}

const MIX: readonly { archetype: Archetype; share: number; unranked: number; ranked: number; betShare: number; cosmeticAppetite: number }[] = [
  { archetype: 'unranked-grinder', share: 0.45, unranked: 10, ranked: 0, betShare: 0.0, cosmeticAppetite: 0.55 },
  { archetype: 'ranked-regular', share: 0.35, unranked: 4, ranked: 6, betShare: 0.03, cosmeticAppetite: 0.35 },
  { archetype: 'whale', share: 0.05, unranked: 2, ranked: 14, betShare: 0.06, cosmeticAppetite: 0.5 },
  { archetype: 'reckless', share: 0.15, unranked: 2, ranked: 8, betShare: 0.1, cosmeticAppetite: 0.15 },
];

export type FlowKey =
  | 'sheepPayout' | 'aiPilot' | 'seasonReward'
  | 'sheepFee' | 'rankedRake' | 'resurrection' | 'cosmetics' | 'slots' | 'bookieVig';

export interface SeasonReport {
  seed: number;
  players: number;
  days: { day: number; faucet: number; sink: number; moneySupply: number; perCapita: number }[];
  flows: Record<FlowKey, number>;
  startSupply: number;
  endSupply: number;
  netInflationPct: number;
  faucetSinkRatio: number;
  everBrokePct: number;
  recoveredPct: number;
  resurrections: number;
  retirements: number;
  avgDeathsAtRetirement: number;
  byArchetype: Record<Archetype, { players: number; avgWallet: number; avgElo: number }>;
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export function simulateSeason(seed = 1337, playerCount = 2000): SeasonReport {
  const rand = mulberry32(seed);
  const players: SimPlayer[] = [];
  const mixFor = new Map<Archetype, (typeof MIX)[number]>(MIX.map((m) => [m.archetype, m]));
  for (const m of MIX) {
    const count = Math.round(m.share * playerCount);
    for (let i = 0; i < count; i++) {
      players.push({
        archetype: m.archetype, skill: gaussian(rand) + (m.archetype === 'whale' ? 0.6 : 0),
        wallet: ECONOMY.startingGold + (m.archetype === 'whale' ? 1500 : 0), inventory: 0, gross: 0,
        elo: 1000, deathsThisSeason: 0, racerAlive: true, lockoutRacesLeft: 0,
        everBroke: false, recovered: false, retired: 0, resurrections: 0, slots: 1,
      });
    }
  }
  const flows: Record<FlowKey, number> = { sheepPayout: 0, aiPilot: 0, seasonReward: 0, sheepFee: 0, rankedRake: 0, resurrection: 0, cosmetics: 0, slots: 0, bookieVig: 0 };
  const supply = () => players.reduce((s, p) => s + p.wallet, 0);
  const startSupply = supply();
  const days: SeasonReport['days'] = [];
  let retireDeathsSum = 0;

  const credit = (p: SimPlayer, amt: number, key: FlowKey) => { p.wallet += amt; p.gross += amt; flows[key] += amt; };
  const debit = (p: SimPlayer, amt: number, key: FlowKey) => { p.wallet -= amt; flows[key] += amt; };

  for (let day = 1; day <= ECONOMY.seasonDays; day++) {
    const before = { ...flows };
    // Ranked heats are strictly zero-sum minus rake: entries pool per day, paid to top finishers at day end.
    let rankedPool = 0;
    const rankedWinners: { p: SimPlayer; weight: number }[] = [];
    for (const p of players) {
      const mix = mixFor.get(p.archetype)!;
      // ── Unranked with sheep hire, or AI pilot contract when broke ──
      let sheepToday = 0;
      const unrankedRaces = mix.unranked + (p.racerAlive ? 0 : 6) + (p.wallet < ECONOMY.rankedEntry(p.elo) ? 6 : 0);
      for (let r = 0; r < unrankedRaces; r++) {
        const scrap = ECONOMY.sheepPayout[0] + rand() * (ECONOMY.sheepPayout[1] - ECONOMY.sheepPayout[0]);
        const dim = sheepToday < ECONOMY.sheepDailyFullRate ? 1 : sheepToday < ECONOMY.sheepDailyHalfRate ? 0.5 : 0.1;
        if (p.wallet >= ECONOMY.sheepFee) {
          debit(p, ECONOMY.sheepFee, 'sheepFee');
          credit(p, Math.round(scrap * dim), 'sheepPayout');
          sheepToday++;
        } else {
          if (!p.everBroke) p.everBroke = true;
          credit(p, Math.round(scrap * ECONOMY.aiPilotShare), 'aiPilot');
        }
      }
      if (p.everBroke && p.wallet >= 1000) p.recovered = true;

      // ── Ranked heats (100 racers; modelled as expected-value draws) ──
      for (let r = 0; r < mix.ranked; r++) {
        if (!p.racerAlive) break;
        if (p.lockoutRacesLeft > 0) { p.lockoutRacesLeft--; continue; }
        const entry = ECONOMY.rankedEntry(p.elo);
        if (p.wallet < entry) break;
        p.wallet -= entry;
        rankedPool += entry * (1 - ECONOMY.rankedRake);
        flows.rankedRake += entry * ECONOMY.rankedRake;
        const pTop = 1 / (1 + Math.exp(-(p.skill * 1.1 - 2.2)));       // ≈ 0.1 at skill 0
        const top = rand() < pTop;
        const deathChance = ECONOMY.rankedDeathChance * (p.archetype === 'reckless' ? 1.8 : 1);
        if (rand() < deathChance) {
          p.deathsThisSeason++;
          const snw = seasonalNetWorth({ liquidWallet: p.wallet, inventoryValue: p.inventory, betEscrow: 0, grossSeasonalInflow: p.gross }).snw;
          const quote = calculateResurrectionCost(p.deathsThisSeason, p.elo, snw, p.wallet);
          const willing = quote.affordable && (quote.recommendation !== 'retire' || p.archetype === 'reckless') && quote.fee <= p.wallet * 0.7;
          if (willing) {
            debit(p, quote.fee, 'resurrection');
            p.resurrections++;
            p.lockoutRacesLeft = Math.round(quote.soulSicknessHours * 2); // 2 ranked slots per hour
          } else {
            p.retired++;
            retireDeathsSum += p.deathsThisSeason;
            p.deathsThisSeason = 0;
            p.elo = 1000;
            p.racerAlive = true; // fresh racer in the freed slot
            p.lockoutRacesLeft = 0;
          }
          break;
        }
        if (top) {
          rankedWinners.push({ p, weight: entry * (0.5 + rand()) }); // place spread across the paid top 10 %
          p.elo += 22;
        } else {
          p.elo = Math.max(100, p.elo - 2.4);
        }
      }

      // ── Bookie (pari-mutuel: EV = −takeout) ──
      if (mix.betShare > 0 && p.wallet > 300) {
        const stake = Math.round(p.wallet * mix.betShare);
        const winP = 0.25;
        p.wallet -= stake;
        flows.bookieVig += stake * ECONOMY.bookieTakeout;
        if (rand() < winP) { const pay = Math.round((stake * (1 - ECONOMY.bookieTakeout)) / winP); p.wallet += pay; p.gross += pay; }
      }

      // ── Cosmetics & slots (demand scales with wallet: richer goblins browse the shop more) ──
      if (p.wallet > 800 && rand() < mix.cosmeticAppetite) {
        const price = Math.round(Math.min(p.wallet * 0.35, 400 + rand() * 2600));
        debit(p, price, 'cosmetics');
        p.inventory += Math.round(price * 0.4);
      }
      const nextSlot = ECONOMY.slotPrice[p.slots];
      if (nextSlot !== undefined && nextSlot <= p.wallet * 0.5 && rand() < 0.08) { debit(p, nextSlot, 'slots'); p.slots++; }
    }
    const totalWeight = rankedWinners.reduce((sum, w) => sum + w.weight, 0);
    for (const w of rankedWinners) { const pay = (rankedPool * w.weight) / totalWeight; w.p.wallet += pay; w.p.gross += pay; }
    // Season-end rewards: top 1 % by Elo get 3,000; top 10 % get 600.
    if (day === ECONOMY.seasonDays) {
      const sorted = [...players].sort((a, b) => b.elo - a.elo);
      sorted.forEach((p, i) => {
        if (i < players.length * 0.01) credit(p, 3000, 'seasonReward');
        else if (i < players.length * 0.1) credit(p, 600, 'seasonReward');
      });
    }
    const faucetKeys: FlowKey[] = ['sheepPayout', 'aiPilot', 'seasonReward'];
    const sinkKeys: FlowKey[] = ['sheepFee', 'rankedRake', 'resurrection', 'cosmetics', 'slots', 'bookieVig'];
    const faucet = faucetKeys.reduce((s, k) => s + flows[k] - before[k], 0);
    const sink = sinkKeys.reduce((s, k) => s + flows[k] - before[k], 0);
    const m = supply();
    days.push({ day, faucet: Math.round(faucet), sink: Math.round(sink), moneySupply: Math.round(m), perCapita: Math.round(m / players.length) });
  }

  const endSupply = supply();
  const totalFaucet = flows.sheepPayout + flows.aiPilot + flows.seasonReward;
  const totalSink = flows.sheepFee + flows.rankedRake + flows.resurrection + flows.cosmetics + flows.slots + flows.bookieVig;
  const byArchetype = {} as SeasonReport['byArchetype'];
  for (const m of MIX) {
    const group = players.filter((p) => p.archetype === m.archetype);
    byArchetype[m.archetype] = {
      players: group.length,
      avgWallet: Math.round(group.reduce((s, p) => s + p.wallet, 0) / Math.max(1, group.length)),
      avgElo: Math.round(group.reduce((s, p) => s + p.elo, 0) / Math.max(1, group.length)),
    };
  }
  const retirements = players.reduce((s, p) => s + p.retired, 0);
  const broke = players.filter((p) => p.everBroke);
  const round = (x: number) => Math.round(x);
  return {
    seed, players: players.length, days,
    flows: Object.fromEntries(Object.entries(flows).map(([k, v]) => [k, round(v)])) as Record<FlowKey, number>,
    startSupply: round(startSupply), endSupply: round(endSupply),
    netInflationPct: Math.round(((endSupply - startSupply) / startSupply) * 1000) / 10,
    faucetSinkRatio: Math.round((totalFaucet / Math.max(1, totalSink)) * 100) / 100,
    everBrokePct: Math.round((broke.length / players.length) * 1000) / 10,
    recoveredPct: broke.length ? Math.round((broke.filter((p) => p.recovered).length / broke.length) * 1000) / 10 : 100,
    resurrections: players.reduce((s, p) => s + p.resurrections, 0),
    retirements,
    avgDeathsAtRetirement: retirements ? Math.round((retireDeathsSum / retirements) * 10) / 10 : 0,
    byArchetype,
  };
}
