# MP-T01: Meta Contracts, Branded Types & Pure Math Core

- **ID**: `MP-T01`
- **Priority**: Critical (Phase A Foundation)
- **Track**: Core Math & Contracts
- **Estimate**: 3 days
- **Dependencies**: None
- **Target Files**: `src/game/meta/interfaces.ts`, `src/game/meta/shaman.ts`, `src/game/meta/prng.ts`, `tests/meta-contracts.test.ts`, `scripts/check.mjs`

---

## Goal
Implement the central, zero-dependency TypeScript contracts, branded types, and pure mathematical calculation engines for Heavy Metal GP 2's meta-game. Establish the **Hybrid High-Water Mark** Shaman resurrection formula, the Seasonal Net Worth (SNW) gross-inflow guard, and deterministic PRNG generators without any Three.js or DOM dependencies.

---

## Evidence & Architectural Decisions
- **ADR-05 & §1.1**: Types must use nominal branding (`Gold`, `RacerId`, `EpochMs`, `UnitU`, `UnitV`) so quantities like Elo ratings and Gold currencies cannot be accidentally swapped.
- **ADR-08**: Calculations must be deterministic, pure functions operating on integer pennies/gold.
- Naive percentage resurrection formulas suffer from the **Offshore Mule**, **Pauper God-Racer**, and **Anti-Grind** exploits. The hybrid formula resolves these by enforcing `max(B(E) * k^(n-1), P(n) * SNW)`.

---

## Technical Specification

### 1. Branded Types & Validation Helpers
```ts
export type Gold = number & { readonly __brand: unique symbol };
export const gold = (n: number): Gold => Math.max(0, Math.round(Number.isFinite(n) ? n : 0)) as Gold;
export const goldDelta = (n: number): number => Math.round(Number.isFinite(n) ? n : 0);
```

### 2. The Hybrid High-Water Mark Formula
```ts
export function calculateResurrectionCost(
  deaths: number,
  elo: number,
  snw: number,
  liquidWallet?: number
): ResurrectionCalculation {
  const n = Math.max(1, Math.min(10_000, Math.floor(deaths)));
  const safeElo = Math.max(100, Math.min(3500, elo));
  const base = 250 * Math.pow(safeElo / 1000, 2);
  const eloFloor = gold(Math.min(Number.MAX_SAFE_INTEGER, base * Math.pow(1.75, n - 1)));
  const rates = [0.15, 0.25, 0.40, 0.60, 0.85];
  const rate = rates[Math.min(n, 5) - 1];
  const wealthTax = gold(rate * Math.max(0, snw));
  const fee = gold(Math.max(eloFloor, wealthTax));
  const soulSicknessHours = ([0, 2, 6, 12, 24] as const)[Math.min(n, 5) - 1];

  return {
    inputs: { deaths: n, elo: safeElo, snw: gold(snw) },
    eloFloorBase: base,
    deathMultiplier: Math.pow(1.75, n - 1),
    eloFloor,
    wealthTaxRate: rate,
    wealthTax,
    fee,
    dominantTerm: eloFloor >= wealthTax ? 'elo-floor' : 'wealth-tax',
    soulSicknessHours,
    affordable: liquidWallet !== undefined ? fee <= liquidWallet : true,
    liquidShortfall: liquidWallet !== undefined ? gold(Math.max(0, fee - liquidWallet)) : gold(0),
    recommendation: n >= 4 ? 'retire' : n === 3 || (liquidWallet !== undefined && fee > liquidWallet) ? 'consider-retiring' : 'resurrect',
  };
}
```

### 3. Seasonal Net Worth (SNW) Gross-Inflow Guard
```ts
export function calculateSeasonalNetWorth(holdings: number, grossSeasonalInflow: number, lambda = 0.6): Gold {
  const safeHoldings = Math.max(0, holdings);
  const safeInflow = Math.max(0, grossSeasonalInflow);
  return gold(Math.max(safeHoldings, lambda * safeInflow));
}
```

---

## Acceptance Criteria
- [ ] All interfaces in `src/game/meta/interfaces.ts` compile under strict TypeScript with 0 `any` types.
- [ ] `costTable()` matches the §6.3 reference table cell-by-cell across all 15 permutations (1,000 / 1,800 / 2,400 Elo across Deaths 1–5).
- [ ] `calculateResurrectionCost` handles NaN, Infinity, and negative values gracefully without throwing.
- [ ] `calculateSeasonalNetWorth` enforces `0.6 * grossSeasonalInflow` floor when holdings are dumped.
- [ ] Strict lint check: zero imports of `three` or `react` inside `src/game/meta/**`.
- [ ] Registered in `scripts/check.mjs` with 100% test pass rate.

---

## Tests to Run
`node --import tsx --test tests/meta-contracts.test.ts`
