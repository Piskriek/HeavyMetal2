import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { shamanQuotes } from '@/db/schema';
import { calculateResurrectionCost, seasonalNetWorth } from '@/hmgp2/shaman';

export const dynamic = 'force-dynamic';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Server-authoritative quote (the client mirror is only for instant UI feedback). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const snwBreakdown = seasonalNetWorth({
    liquidWallet: num(body.wallet, 0),
    inventoryValue: num(body.inventory, 0),
    betEscrow: num(body.escrow, 0),
    grossSeasonalInflow: num(body.grossInflow, 0),
  });
  const quote = calculateResurrectionCost(num(body.deaths, 1), num(body.elo, 1000), snwBreakdown.snw, snwBreakdown.liquidWallet);
  try {
    await db.insert(shamanQuotes).values({ deaths: quote.inputs.deaths, elo: quote.inputs.elo, snw: quote.inputs.snw, fee: quote.fee, dominant: quote.dominantTerm });
  } catch {
    // Persistence is best-effort for the plan viewer; the quote itself is pure.
  }
  return NextResponse.json({ quote, snw: snwBreakdown });
}

export async function GET() {
  try {
    const rows = await db.select().from(shamanQuotes).orderBy(desc(shamanQuotes.at)).limit(8);
    return NextResponse.json({ quotes: rows });
  } catch {
    return NextResponse.json({ quotes: [] });
  }
}
