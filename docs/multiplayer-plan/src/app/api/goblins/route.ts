import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { savedGoblins } from '@/db/schema';
import { decodeGoblinDna, encodeGoblinDna, isNudged } from '@/hmgp2/goblin-dna';

export const dynamic = 'force-dynamic';

const NAME_RE = /^[A-Za-z0-9' -]{3,16}$/;
const TITLES = ['The Rookie', 'The Mechanic', 'The Daredevil', 'The Bruiser', 'The Rocket Jockey', 'The Unkillable', 'Scrap Baron', 'Soot Saint'];

export async function GET() {
  try {
    const rows = await db.select().from(savedGoblins).orderBy(desc(savedGoblins.at)).limit(24);
    return NextResponse.json({ goblins: rows });
  } catch {
    return NextResponse.json({ goblins: [] });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; title?: unknown; dna?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!NAME_RE.test(name)) return NextResponse.json({ error: 'Name must be 3–16 characters: letters, digits, space, hyphen or apostrophe.' }, { status: 400 });
  const title = typeof body.title === 'string' && TITLES.includes(body.title) ? body.title : 'The Rookie';
  let config;
  try { config = decodeGoblinDna(String(body.dna ?? '')); } catch (e) { return NextResponse.json({ error: `Invalid DNA: ${(e as Error).message}` }, { status: 400 }); }
  // Re-encode canonically so the stored DNA is always the shortest valid form.
  const dna = encodeGoblinDna(config);
  const [row] = await db.insert(savedGoblins).values({ name, title, dna, dnaVersion: dna[4] === '1' ? 1 : 2, nudged: isNudged(config.nudge) ? 1 : 0 }).returning();
  return NextResponse.json({ goblin: row }, { status: 201 });
}
