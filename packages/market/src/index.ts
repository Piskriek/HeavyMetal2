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

// Mulberry32 gives each crowd a repeatable sequence without global random state.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic crowd with tastes, budgets, and patience in the specified ranges. */
export function makeBuyers(seed: number, n: number): Buyer[] {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const random = mulberry32(seed);
  const buyers: Buyer[] = [];

  for (let i = 0; i < count; i += 1) {
    buyers.push({
      id: `buyer-${i + 1}`,
      taste: random(),
      budget: 5 + Math.floor(random() * 196),
      patience: Math.floor(random() * 4),
    });
  }

  return buyers;
}

export function sellable(l: Listing): boolean {
  return l.license !== 'only-me' && l.license !== 'share-alike';
}

export function appeal(b: Buyer, l: Listing): number {
  const lightness = 1 / (1 + l.bytes / 65536);
  const pricePenalty = Math.min(1, l.price / Math.max(1, b.budget));
  const value = b.taste * l.looks + (1 - b.taste) * lightness - pricePenalty;
  return Math.max(0, Math.min(1, value));
}

export function simulateDay(
  day: number,
  buyers: readonly Buyer[],
  listings: readonly Listing[],
): Sale[] {
  const sales: Sale[] = [];

  for (const buyer of buyers) {
    let bestListing: Listing | undefined;
    let bestAppeal = Number.NEGATIVE_INFINITY;

    for (const listing of listings) {
      if (!sellable(listing)) continue;
      if (day - listing.listedDay < buyer.patience) continue;
      if (listing.price > buyer.budget) continue;

      const listingAppeal = appeal(buyer, listing);
      if (listingAppeal < 0.5) continue;

      const breaksTie =
        bestListing !== undefined &&
        listingAppeal === bestAppeal &&
        (listing.price < bestListing.price ||
          (listing.price === bestListing.price && listing.id < bestListing.id));

      if (bestListing === undefined || listingAppeal > bestAppeal || breaksTie) {
        bestListing = listing;
        bestAppeal = listingAppeal;
      }
    }

    if (bestListing !== undefined) {
      sales.push({
        day,
        listing: bestListing.id,
        buyer: buyer.id,
        price: bestListing.price,
      });
    }
  }

  return sales;
}

function highestAppealingPrice(buyer: Buyer, listing: Listing): number {
  const effectiveBudget = Math.max(1, buyer.budget);
  const highLimit = Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(effectiveBudget) - 1);

  if (!(highLimit >= 1)) return 0;

  let low = 1;
  let high = highLimit;

  if (appeal(buyer, { ...listing, price: low }) < 0.5) return 0;

  while (low < high) {
    const middle = low + Math.floor((high - low + 1) / 2);

    if (appeal(buyer, { ...listing, price: middle }) >= 0.5) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

export function suggestPrice(
  buyers: readonly Buyer[],
  l: Listing,
  share: number,
): number {
  if (buyers.length === 0 || !Number.isFinite(share) || share <= 0) return 1;

  const targetCount = Math.ceil(Math.min(1, share) * buyers.length);
  if (targetCount === 0) return 1;

  const prices: number[] = [];
  for (const buyer of buyers) {
    const price = highestAppealingPrice(buyer, l);
    if (price >= 1) prices.push(price);
  }

  if (prices.length < targetCount) return 1;

  prices.sort((a, b) => b - a);
  return prices[targetCount - 1] ?? 1;
}

export function earnings(
  sales: readonly Sale[],
  listings: readonly Listing[],
): Record<string, number> {
  const sellerByListing = new Map<string, string>();

  for (const listing of listings) {
    if (!sellerByListing.has(listing.id)) {
      sellerByListing.set(listing.id, listing.seller);
    }
  }

  const totals: Record<string, number> = {};

  for (const sale of sales) {
    const seller = sellerByListing.get(sale.listing);
    if (seller === undefined) continue;

    const marketCut = Math.floor(sale.price / 10);
    const net = sale.price - marketCut;

    if (Object.prototype.hasOwnProperty.call(totals, seller)) {
      totals[seller] = (totals[seller] ?? 0) + net;
    } else {
      Object.defineProperty(totals, seller, {
        value: net,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  return totals;
}