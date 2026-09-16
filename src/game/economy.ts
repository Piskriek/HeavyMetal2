import { emptyInventory, ITEM_INFO, MAX_ITEM_STACK, normalizeInventory } from './types';
import type { HeatResult, Inventory, ItemType } from './types';

export const ACCOUNT_KEY = 'mrr-account-v1';
export const STARTER_CREDITS = 400;
export const RACE_PRIZES = [500, 350, 275, 220, 180, 150, 120, 100, 80, 60] as const;
export const PEG_CREDITS = 5;

export interface RacerAccount {
  version: 1;
  credits: number;
  inventory: Inventory;
  paidRaces: string[];
  totalWinnings: number;
  finishes: number;
}

export interface RacePayout {
  raceId: string;
  placement: number;
  pegBonus: number;
  total: number;
  balance: number;
  alreadyPaid: boolean;
}

export function createAccount(): RacerAccount {
  return { version: 1, credits: STARTER_CREDITS, inventory: emptyInventory(), paidRaces: [], totalWinnings: 0, finishes: 0 };
}

export function purchaseItem(account: RacerAccount, item: ItemType): { account: RacerAccount; error?: string } {
  const info = ITEM_INFO[item];
  if (!info) return { account, error: 'Unknown item.' };
  if (account.inventory[item] >= MAX_ITEM_STACK) return { account, error: `You already own ${MAX_ITEM_STACK} ${info.name.toLowerCase()} charges.` };
  if (account.credits < info.price) return { account, error: `You need ${info.price - account.credits} more credits.` };
  return { account: { ...account, credits: account.credits - info.price, inventory: { ...account.inventory, [item]: account.inventory[item] + 1 } } };
}

export function prizeFor(result: HeatResult): { placement: number; pegBonus: number } {
  if (result.time === null || !Number.isFinite(result.time) || result.time < 0 || !Number.isInteger(result.rank) || result.rank < 1 || result.rank > 10) {
    return { placement: 0, pegBonus: 0 };
  }
  const pegCount = Number.isFinite(result.pegs) ? Math.max(0, Math.min(5000, Math.floor(result.pegs))) : 0;
  return { placement: RACE_PRIZES[result.rank - 1], pegBonus: pegCount * PEG_CREDITS };
}

export function settleRace(account: RacerAccount, raceId: string, result: HeatResult): { account: RacerAccount; payout: RacePayout } {
  const alreadyPaid = account.paidRaces.includes(raceId);
  const prize = prizeFor(result);
  const total = prize.placement + prize.pegBonus;
  if (alreadyPaid) return { account, payout: { raceId, ...prize, total, balance: account.credits, alreadyPaid: true } };
  const next = {
    ...account, credits: account.credits + total, totalWinnings: account.totalWinnings + total,
    finishes: account.finishes + (prize.placement > 0 ? 1 : 0), paidRaces: [...account.paidRaces, raceId],
  };
  return { account: next, payout: { raceId, ...prize, total, balance: next.credits, alreadyPaid: false } };
}

export function parseAccount(raw: string | null): RacerAccount {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return createAccount();
    const account = value as Partial<RacerAccount>;
    if (account.version !== 1 || typeof account.credits !== 'number' || !Number.isFinite(account.credits) || account.credits < 0) return createAccount();
    const safeNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1e9, Math.floor(n))) : 0;
    return {
      version: 1, credits: safeNumber(account.credits), inventory: normalizeInventory(account.inventory),
      paidRaces: Array.isArray(account.paidRaces) ? [...new Set(account.paidRaces.filter((id) => typeof id === 'string' && id.length < 180))] : [],
      totalWinnings: safeNumber(account.totalWinnings), finishes: safeNumber(account.finishes),
    };
  } catch { return createAccount(); }
}

export function loadAccount(): RacerAccount {
  try { return parseAccount(localStorage.getItem(ACCOUNT_KEY)); } catch { return createAccount(); }
}

export function saveAccount(account: RacerAccount) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); } catch { /* Play remains available when storage is blocked. */ }
}