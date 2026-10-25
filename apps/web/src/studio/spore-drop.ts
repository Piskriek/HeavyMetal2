import { decodeSporeCardPng, type SporeCard } from '@hm/cartlab';

/** All parsing/auditing completes before onCard can touch the world or Studio undo history. Returns listener cleanup. */
export function bindSporeCardDrop(canvas: HTMLElement, handlers: {
  readonly onCard: (card: SporeCard, isCurrent: () => boolean) => void | Promise<void>;
  readonly onRefusal: (refusal: { readonly title: string; readonly detail: string }) => void;
}): () => void {
  let generation = 0, alive = true;
  const over = (e: DragEvent): void => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  };
  const drop = (e: DragEvent): void => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    const token = ++generation;
    if (!files || files.length !== 1 || !files[0]) { handlers.onRefusal({ title: 'Spore Card refused', detail: 'Drop one PNG card at a time.' }); return; }
    // PNG magic, not a browser-provided MIME or extension, is the authority.
    void decodeSporeCardPng(files[0]).then(async (card) => { if (alive && token === generation) await handlers.onCard(card, () => alive && token === generation); }).catch((e: unknown) => {
      if (alive && token === generation) handlers.onRefusal({ title: 'Spore Card refused', detail: e instanceof Error ? e.message : 'Invalid Spore Card' });
    });
  };
  canvas.addEventListener('dragover', over); canvas.addEventListener('drop', drop);
  return () => { alive = false; generation++; canvas.removeEventListener('dragover', over); canvas.removeEventListener('drop', drop); };
}
