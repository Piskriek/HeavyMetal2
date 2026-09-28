/**
 * A menu card's painted illustration, when its file exists (docs/tickets/art/ART-MENU-CARDS.md);
 * the given fallback (an icon) until then, or if the file fails to load. Drop-in art, no code change.
 */
import { useState, type ReactNode } from 'react';

export default function CardArt({ src, fallback, className = 'card-art' }: { src: string; fallback: ReactNode; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img className={className} src={src} alt="" aria-hidden="true" draggable={false} onError={() => setFailed(true)} />;
}
