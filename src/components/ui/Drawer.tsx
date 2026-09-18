import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  title: string;
  caption?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * TICKET-02 drill-down: a flyout drawer that overlays the enclosing modal
 * content. Keeps deep specs, lore, and formulas one click away so the default
 * view stays clean. Escape and scrim clicks close it without closing the modal.
 */
export default function Drawer({ open, title, caption, onClose, children }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // The drawer is anchored to the modal content box; keep it aligned by
    // resetting any scroll before it slides in.
    panel.current?.closest('.modal-content')?.scrollTo({ top: 0 });
    panel.current?.querySelector<HTMLElement>('.drawer-close')?.focus({ preventScroll: true });
    // Capture phase so the drawer swallows Escape before the modal's handler.
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      if (panel.current?.contains(document.activeElement)) previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="drawer-scrim" className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      )}
      {open && (
        <motion.div
          key="drawer-panel"
          ref={panel}
          role="dialog"
          aria-label={title}
          className="tuning-drawer"
          initial={{ x: 46, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 46, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="drawer-heading">
            <div className="drawer-titles">
              {caption && <span className="eyebrow orange-text">{caption}</span>}
              <h3>{title}</h3>
            </div>
            <button className="icon-button drawer-close" onClick={onClose} aria-label="Close details"><X size={18} /></button>
          </div>
          <div className="drawer-body">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
