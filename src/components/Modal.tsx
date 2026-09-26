import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import Brand from './Brand';
import OrnateCorners from './OrnateCorners';
import AnimatedMenuBackground from './ui/AnimatedMenuBackground';
import type { MenuBackdropPreset } from './ui/ambient-motion';

interface ModalProps {
  children: ReactNode;
  title: string;
  eyebrow: string;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  /** TICKET-05: paint a dedicated fantasy backdrop behind the dialog panel. */
  backdrop?: MenuBackdropPreset | string;
}

export default function Modal({ children, title, eyebrow, onClose, wide = false, className = '', backdrop }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const scroll = useScrollCue(content, dialog);

  useEffect(() => {
    const dialogElement = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      if (dialogElement?.contains(document.activeElement) || document.activeElement === document.body) {
        previousFocus?.focus({ preventScroll: true });
      }
    };
  }, [onClose]);

  return createPortal(
    <motion.div className="modal-backdrop" data-painted-backdrop={backdrop ? 'true' : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {backdrop && <AnimatedMenuBackground preset={backdrop} className="modal-backdrop-painted" />}
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal ${wide ? 'modal-wide' : ''} ${className}`} data-scrolled={scroll.above ? 'true' : undefined} data-more-below={scroll.below ? 'true' : undefined} style={{ '--cue-bottom': `${scroll.cueBottom}px` } as CSSProperties} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.22 }}>
        <OrnateCorners /><div className="modal-heading"><Brand variant="emblem" decorative /><div className="modal-title"><span className="eyebrow orange-text">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={21} /></button></div>
        <div ref={content} className="modal-content">{children}</div>
        {scroll.below && <button type="button" className="modal-scroll-cue" tabIndex={-1} aria-hidden="true" onClick={scroll.pageDown}><ChevronDown size={14} />More below</button>}
      </motion.div>
    </motion.div>,
    document.fullscreenElement || document.body,
  );
}

/**
 * Whether the dialog's content scrolls, and which way: `below` shows the "More below" cue and
 * `above` shades the heading. The cue sits just above a pinned action bar when the content has one.
 */
function useScrollCue(content: RefObject<HTMLDivElement | null>, dialog: RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState({ above: false, below: false, cueBottom: 14 });
  const measure = useCallback(() => {
    const el = content.current, box = dialog.current;
    if (!el || !box) return;
    const above = el.scrollTop > 4;
    const below = el.scrollHeight - el.scrollTop - el.clientHeight > 8;
    const visibleBottom = el.getBoundingClientRect().bottom;
    const bar = el.querySelector<HTMLElement>(':scope > .fantasy-dialog-actions, :scope > * > .fantasy-dialog-actions, :scope > .modal-bottom');
    const barTop = bar ? Math.min(bar.getBoundingClientRect().top, visibleBottom) : visibleBottom;
    const cueBottom = Math.round(box.getBoundingClientRect().bottom - barTop + 10);
    setState((s) => (s.above === above && s.below === below && s.cueBottom === cueBottom ? s : { above, below, cueBottom }));
  }, [content, dialog]);
  useEffect(() => {
    const el = content.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const watchChildren = () => { for (const child of Array.from(el.children)) resize.observe(child); };
    watchChildren();
    const mutation = new MutationObserver(() => { watchChildren(); measure(); });
    mutation.observe(el, { childList: true, subtree: true });
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { resize.disconnect(); mutation.disconnect(); el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [measure]);
  const pageDown = useCallback(() => {
    const el = content.current;
    if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ top: el.clientHeight * 0.7, behavior: smooth ? 'smooth' : 'auto' });
  }, [content]);
  return { ...state, pageDown };
}
