/** The Goblin Engineering Co. crest: a hand-painted gold-and-iron shield, cut from a
 *  magenta-keyed source painting by `scripts/cut-ui-art.mjs` (see docs/ART_PIPELINE.md).
 *  Rendered as an image so the painted texture survives at every size; `currentColor`
 *  tinting is gone by design — the art carries its own gold. */
export default function GoblinMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? 'goblin-mark goblin-mark-small' : 'goblin-mark'}
      src="/art/goblin-emblem.png"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
