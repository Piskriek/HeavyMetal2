import type { ReactElement } from 'react';

/** A goblin head in a few shapes: pointy ears, big eyes, a wide grin and a headband in the accent colour. Pure SVG, scales to any size. */
export function GoblinFace({ color, accent, size = 64, label }: { readonly color: string; readonly accent: string; readonly size?: number; readonly label?: string }): ReactElement {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-goblin="face" style={{ display: 'block', flex: '0 0 auto' }}>
      <ellipse cx="50" cy="56" rx="30" ry="29" fill={color} />
      <path d="M22 44 L2 26 L26 30 Z" fill={color} /><path d="M78 44 L98 26 L74 30 Z" fill={color} />
      <path d="M21 42 L9 31 L24 34 Z" fill="#000" opacity="0.18" /><path d="M79 42 L91 31 L76 34 Z" fill="#000" opacity="0.18" />
      <path d="M22 38 Q50 22 78 38 L77 46 Q50 34 23 46 Z" fill={accent} />
      <ellipse cx="38" cy="54" rx="8" ry="9" fill="#fff" /><ellipse cx="62" cy="54" rx="8" ry="9" fill="#fff" />
      <circle cx="40" cy="55" r="4.4" fill="#10151a" /><circle cx="60" cy="55" r="4.4" fill="#10151a" />
      <circle cx="41.6" cy="53" r="1.4" fill="#fff" /><circle cx="61.6" cy="53" r="1.4" fill="#fff" />
      <path d="M33 70 Q50 84 67 70 Q50 76 33 70 Z" fill="#10151a" />
      <path d="M38 71 L41 75 L44 72 Z M56 72 L59 75 L62 71 Z" fill="#fff" />
      <ellipse cx="50" cy="63" rx="3" ry="2" fill="#000" opacity="0.2" />
    </svg>
  );
}
