export function rankRacers(
  states: readonly { id: string; progress: number }[],
): { id: string; position: number }[] {
  const progressById = new Map<string, number>();
  for (const state of states) {
    const previous = progressById.get(state.id);
    if (previous === undefined || state.progress > previous) progressById.set(state.id, state.progress);
  }

  const ranked = [...progressById.entries()].sort(([idA, progressA], [idB, progressB]) => {
    if (progressA > progressB) return -1;
    if (progressA < progressB) return 1;
    if (idA < idB) return -1;
    if (idA > idB) return 1;
    return 0;
  });

  return ranked.map(([id], index) => ({ id, position: index + 1 }));
}