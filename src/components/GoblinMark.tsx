export default function GoblinMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? 'goblin-mark goblin-mark-small' : 'goblin-mark'} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <path d="M28 2 50 10 52 35 40 49 28 55 16 49 4 35 6 10Z" fill="currentColor" />
      <path d="m13 17 7 2 8-5 8 5 7-2-3 15-5 9-7 5-7-5-5-9Z" fill="#111710" />
      <path d="m15 23-9-5 5 13 8 3m22-11 9-5-5 13-8 3" fill="#111710" />
      <path d="m19 24 7 3-2 4-6-4m19-3-7 3 2 4 6-4" fill="currentColor" />
      <path d="m28 28-3 7h6l-3-7Z" fill="currentColor" />
      <path d="m21 35 4 4h6l4-4-2 7H23l-2-7Z" fill="currentColor" />
      <path d="m23 35 1 4 2-4m7 0-1 4-2-4" fill="#efe9d8" />
      <path d="m23 12 5-5 5 5-5-2-5 2Z" fill="#111710" />
    </svg>
  );
}