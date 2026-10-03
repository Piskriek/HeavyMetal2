import { useCallback, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactElement, type ReactNode } from 'react';
import { WindowManager } from '@hm/uistack';
import { X } from 'lucide-react';

/**
 * Floating windows you can move (drag the title bar), bring to the front (click), and close (x, or Esc closes the front one). Positions and
 * stacking come from `@hm/uistack`'s WindowManager, which keeps every window inside the screen.
 */
export interface OpenWindow { readonly id: string; readonly title: string }

export interface Windows {
  readonly list: readonly OpenWindow[];
  open(id: string, title: string, rect: { x: number; y: number; w: number; h: number }): void;
  close(id: string): void;
  toggle(id: string, title: string, rect: { x: number; y: number; w: number; h: number }): void;
  isOpen(id: string): boolean;
  /** Close the front window. Returns false when none is open (so Esc can fall through to the menu). */
  closeTop(): boolean;
  readonly wm: WindowManager;
  bump(): void;
}

export function useWindows(): Windows {
  const wm = useRef(new WindowManager(typeof window === 'undefined' ? 1600 : window.innerWidth, typeof window === 'undefined' ? 900 : window.innerHeight)).current;
  const [list, setList] = useState<OpenWindow[]>([]);
  const [, setV] = useState(0);
  const bump = useCallback(() => setV((v) => v + 1), []);
  const open = useCallback((id: string, title: string, rect: { x: number; y: number; w: number; h: number }) => {
    wm.setViewport(window.innerWidth, window.innerHeight);
    wm.open(id, rect, { title, minW: 220, minH: 120 });
    setList((l) => (l.some((w) => w.id === id) ? l : [...l, { id, title }]));
    bump();
  }, [wm, bump]);
  const close = useCallback((id: string) => { wm.close(id); setList((l) => l.filter((w) => w.id !== id)); }, [wm]);
  const isOpen = useCallback((id: string) => wm.get(id) !== null, [wm]);
  const toggle = useCallback((id: string, title: string, rect: { x: number; y: number; w: number; h: number }) => { if (wm.get(id)) close(id); else open(id, title, rect); }, [wm, open, close]);
  const closeTop = useCallback(() => { const id = wm.focused(); if (!id) return false; close(id); return true; }, [wm, close]);
  return useMemo(() => ({ list, open, close, toggle, isOpen, closeTop, wm, bump }), [list, open, close, toggle, isOpen, closeTop, wm, bump]);
}

export function FloatingWindow(props: { readonly win: Windows; readonly id: string; readonly title: string; readonly children: ReactNode; readonly className?: string }): ReactElement | null {
  const { win, id } = props;
  const info = win.wm.get(id);
  const drag = useRef<{ x: number; y: number } | null>(null);
  if (!info) return null;
  const down = (e: RPointerEvent<HTMLElement>): void => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    win.wm.bringToFront(id); win.bump();
  };
  const move = (e: RPointerEvent<HTMLElement>): void => {
    if (!drag.current) return;
    win.wm.move(id, e.clientX - drag.current.x, e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
    win.bump();
  };
  const up = (e: RPointerEvent<HTMLElement>): void => { drag.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ } };
  return (
    <section className={`fwin ${props.className ?? ''}`} role="dialog" aria-label={props.title} style={{ left: info.rect.x, top: info.rect.y, width: info.rect.w, maxHeight: `max(160px, calc(100vh - ${info.rect.y}px - var(--win-bottom, 12px)))`, zIndex: 50 + info.z }}
      onPointerDown={() => { if (win.wm.focused() !== id) { win.wm.bringToFront(id); win.bump(); } }}>
      <header onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <h3>{props.title}</h3>
        <button className="fwin-x" aria-label={`Close ${props.title}`} title="Close (Esc)" onClick={() => win.close(id)}><X size={14} strokeWidth={1.6} /></button>
      </header>
      <div className="fwin-body">{props.children}</div>
    </section>
  );
}
