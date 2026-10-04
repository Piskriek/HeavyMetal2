export interface Listing {
  id: string;
  seller: string;
  kind: 'texture' | 'model' | 'other';
  looks: number;
  bytes: number;
  price: number;
  listedDay: number;
  license: 'mine' | 'cc0' | 'cc-by' | 'share-alike' | 'only-me';
}

export interface Buyer {
  id: string;
  taste: number;
  budget: number;
  patience: number;
}

export interface Sale {
  day: number;
  listing: string;
  buyer: string;
  price: number;
}

function mulberry32(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic crowd of n buyers from a seed (taste spread over 0..1, budget 5..200, patience 0..3). */
export function makeBuyers(seed: number, n: number): Buyer[] {
  const rng = mulberry32(seed);
  const buyers: Buyer[] = [];
  for (let i = 0; i < n; i++) {
    const taste = Math.round(rng() * 100) / 100;
    const budget = Math.floor(rng() * (200 - 5 + 1)) + 5;
    const patience = Math.floor(rng() * 4);
    buyers.push({
      id: `b${i + 1}`,
      taste,
      budget,
      patience,
    });
  }
  return buyers;
}

/** Can it be sold at all? 'only-me' and 'share-alike' never (share-alike may only be given away); others yes. */
export function sellable(l: Listing): boolean {
  return l.license !== 'only-me' && l.license !== 'share-alike';
}

/** How much a buyer wants it, 0..1: taste * looks + (1 - taste) * lightness - price penalty, where lightness = 1 / (1 + bytes / 65536) and price penalty = min(1, price / max(1, budget)); clamped to 0..1. */
export function appeal(b: Buyer, l: Listing): number {
  const lightness = 1 / (1 + l.bytes / 65536);
  const budget = Math.max(1, b.budget);
  const pricePenalty = Math.min(1, l.price / budget);
  const raw = b.taste * l.looks + (1 - b.taste) * lightness - pricePenalty;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/** Simulate one day: each buyer (in order) buys at most one listing: the sellable listing they want most with appeal >= 0.5, listed at least `patience` days ago, priced within their remaining budget, ties broken by lower price then id. A listing can sell many times (presets are copies). Returns the sales. */
export function simulateDay(
  day: number,
  buyers: readonly Buyer[],
  listings: readonly Listing[],
): Sale[] {
  const sales: Sale[] = [];
  const EPSILON = 1e-9;

  for (const b of buyers) {
    let bestListing: Listing | null = null;
    let bestAppeal = -1;

    for (const l of listings) {
      if (!sellable(l)) continue;
      if (day - l.listedDay < b.patience) continue;
      if (l.price > b.budget) continue;

      const app = appeal(b, l);
      if (app < 0.5) continue;

      if (bestListing === null) {
        bestListing = l;
        bestAppeal = app;
      } else if (app > bestAppeal + EPSILON) {
        bestListing = l;
        bestAppeal = app;
      } else if (Math.abs(app - bestAppeal) <= EPSILON) {
        if (l.price < bestListing.price) {
          bestListing = l;
          bestAppeal = app;
        } else if (l.price === bestListing.price) {
          if (l.id < bestListing.id) {
            bestListing = l;
            bestAppeal = app;
          }
        }
      }
    }

    if (bestListing !== null) {
      sales.push({
        day,
        listing: bestListing.id,
        buyer: b.id,
        price: bestListing.price,
      });
    }
  }

  return sales;
}

/** A price that would sell to about the given share of the crowd (0..1): the highest whole price at which at least that share of buyers has appeal >= 0.5 (1 if none). */
export function suggestPrice(buyers: readonly Buyer[], l: Listing, share: number): number {
  if (buyers.length === 0) return 1;

  const target = Math.max(1, Math.ceil(share * buyers.length - 1e-9));

  function countAt(price: number): number {
    const listingAtP: Listing = { ...l, price };
    let count = 0;
    for (const b of buyers) {
      if (appeal(b, listingAtP) >= 0.5) {
        count++;
      }
    }
    return count;
  }

  if (countAt(1) < target) {
    return 1;
  }

  let maxBudget = 1;
  for (const b of buyers) {
    if (b.budget > maxBudget) {
      maxBudget = b.budget;
    }
  }

  let low = 1;
  let high = maxBudget;
  let best = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (countAt(mid) >= target) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

/** Earnings per seller over a list of sales (the market keeps 10%, rounded down per sale). */
export function earnings(sales: readonly Sale[], listings: readonly Listing[]): Record<string, number> {
  const sellerByListing = new Map<string, string>();
  for (const l of listings) {
    sellerByListing.set(l.id, l.seller);
  }

  const result: Record<string, number> = {};
  for (const s of sales) {
    const seller = sellerByListing.get(s.listing);
    if (seller === undefined) continue;
    const fee = Math.floor(s.price * 0.1);
    const sellerCut = s.price - fee;
    const current = result[seller];
    result[seller] = (current !== undefined ? current : 0) + sellerCut;
  }

  return result;
}