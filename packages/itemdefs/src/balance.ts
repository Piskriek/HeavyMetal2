import type { BalanceReport, ItemDef } from './types';
import { rollTable } from './roll';

export function balanceReport(items: readonly ItemDef[]): BalanceReport {
  const safeItems: readonly ItemDef[] = Array.isArray(items) ? items : [];
  const warnings: string[] = [];

  const frontTable = rollTable(safeItems, 0);
  const middleTable = rollTable(safeItems, 1);
  const backTable = rollTable(safeItems, 2);

  const bucketDefinitions: { name: 'front' | 'middle' | 'back'; table: typeof frontTable }[] = [
    { name: 'front', table: frontTable },
    { name: 'middle', table: middleTable },
    { name: 'back', table: backTable }
  ];

  // 1. Check if an item can never be rolled in any bucket
  for (const item of safeItems) {
    if (!item || typeof item !== 'object') continue;
    const w0 = item.weights?.[0] ?? 0;
    const w1 = item.weights?.[1] ?? 0;
    const w2 = item.weights?.[2] ?? 0;
    const isCallable = item.enabled && (w0 > 0 || w1 > 0 || w2 > 0);
    if (!isCallable) {
      warnings.push(`'${item.id}' can never be rolled.`);
    }
  }

  // 2. Check if one item is more than 45% in any bucket
  for (const b of bucketDefinitions) {
    for (const entry of b.table) {
      if (entry.chance > 0.45) {
        const pct = (entry.chance * 100).toFixed(1);
        warnings.push(
          `'${entry.id}' has more than 45% roll chance (${pct}%) in ${b.name} bucket.`
        );
      }
    }
  }

  // 3. Power comparison between front-runner and back-of-field
  const itemMap = new Map<string, ItemDef>();
  for (const item of safeItems) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      itemMap.set(item.id, item);
    }
  }

  let frontPower = 0;
  for (const entry of frontTable) {
    const item = itemMap.get(entry.id);
    if (item) {
      const dur = typeof item.durationMs === 'number' ? item.durationMs : 0;
      const rad = typeof item.radius === 'number' ? item.radius : 0;
      const pwr = typeof item.power === 'number' ? item.power : 1;
      frontPower += entry.chance * pwr * (dur + rad * 100 + 500);
    }
  }

  let backPower = 0;
  for (const entry of backTable) {
    const item = itemMap.get(entry.id);
    if (item) {
      const dur = typeof item.durationMs === 'number' ? item.durationMs : 0;
      const rad = typeof item.radius === 'number' ? item.radius : 0;
      const pwr = typeof item.power === 'number' ? item.power : 1;
      backPower += entry.chance * pwr * (dur + rad * 100 + 500);
    }
  }

  if (frontPower > backPower) {
    warnings.push(
      `Front-runner items are more powerful than back-of-field items (front score: ${frontPower.toFixed(1)}, back score: ${backPower.toFixed(1)}).`
    );
  }

  // 4. Check presence of area and self items
  const hasArea = safeItems.some(
    i => i && typeof i === 'object' && i.enabled && i.kind === 'area'
  );
  const hasSelf = safeItems.some(
    i => i && typeof i === 'object' && i.enabled && i.kind === 'self'
  );

  if (!hasArea) {
    warnings.push('There are no enabled area items in the item set.');
  }
  if (!hasSelf) {
    warnings.push('There are no enabled self items in the item set.');
  }

  return {
    buckets: [
      { bucket: 'front', table: frontTable },
      { bucket: 'middle', table: middleTable },
      { bucket: 'back', table: backTable }
    ],
    warnings
  };
}
