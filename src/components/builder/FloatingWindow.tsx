/**
 * A builder tool window that floats over the scene: drag it by its title bar, fold it to its title,
 * and it opens where it was last left (remembered on this device). Rendered on the page itself, so no
 * shelf or toolbar can clip it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';

interface FloatingWindowProps {
  title: string;
  /** Where its position is remembered (per viewer). */
  storageKey: string;
  /** Where it first opens (px from the top left of the window). */
  initial: { x: number; y: number };
  width?: number;
  children: ReactNode;
}

const clampTo = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export default function FloatingWindow({ title, storageKey, initial, width = 460, children }: FloatingWindowProps) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved as { x: number; y: number };
    } catch { /* first time */ }
    return initial;
  });
  const [folded, setFolded] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Keep it on screen when the window shrinks.
  useEffect(() => {
    const keep = () => setPos((p) => ({ x: clampTo(p.x, 0, window.innerWidth - 120), y: clampTo(p.y, 0, window.innerHeight - 40) }));
    keep();
    window.addEventListener('resize', keep);
    return () => window.removeEventListener('resize', keep);
  }, []);

  const remember = (p: { x: number; y: number }) => {
    try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch { /* storage unavailable */ }
  };

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      style={{ left: pos.x, top: pos.y, width }}
      className="fixed z-[60] pointer-events-auto max-w-[calc(100vw-1rem)] bg-zinc-950/95 border border-amber-500/60 rounded-lg shadow-2xl backdrop-blur-md text-amber-100 flex flex-col"
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 border-b border-zinc-800 cursor-move select-none touch-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos({
            x: clampTo(e.clientX - drag.current.dx, 0, window.innerWidth - 120),
            y: clampTo(e.clientY - drag.current.dy, 0, window.innerHeight - 40),
          });
        }}
        onPointerUp={() => { if (drag.current) { drag.current = null; remember(pos); } }}
      >
        <GripHorizontal size={14} className="text-zinc-500" />
        <span className="flex-1 text-xs font-bold text-amber-300">{title}</span>
        <button
          onClick={() => setFolded((f) => !f)}
          className="p-0.5 text-zinc-400 hover:text-amber-200 cursor-pointer"
          aria-label={folded ? `Open ${title}` : `Fold ${title}`}
          title={folded ? 'Open' : 'Fold'}
        >
          {folded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!folded && <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">{children}</div>}
    </div>,
    document.body,
  );
}
