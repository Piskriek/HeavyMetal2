import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  children: ReactNode;
  title: string;
  eyebrow: string;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}

export default function Modal({ children, title, eyebrow, onClose, wide = false, className = '' }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal ${wide ? 'modal-wide' : ''} ${className}`} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.22 }}>
        <div className="modal-heading"><div><span className="eyebrow orange-text">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={21} /></button></div>
        <div className="modal-content">{children}</div>
      </motion.div>
    </motion.div>,
    document.fullscreenElement || document.body,
  );
}