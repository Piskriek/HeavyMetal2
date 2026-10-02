export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

export function updateRatings(
  players: readonly { id: string; rating: number }[],
  k = 24,
): Record<string, number> {
  const count = players.length;
  if (count === 0) return {};
  if (count === 1) return { [players[0]!.id]: players[0]!.rating };

  const changes = players.map(() => 0);
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const winner = players[i]!;
      const loser = players[j]!;
      const gain = k * (1 - expectedScore(winner.rating, loser.rating));
      changes[i] = changes[i]! + gain;
      changes[j] = changes[j]! - gain;
    }
  }

  return Object.fromEntries(players.map((player, index) => {
    const change = changes[index]! / (count - 1);
    return [player.id, Math.round((player.rating + change) * 100) / 100];
  }));
}