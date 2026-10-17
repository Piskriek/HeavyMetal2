// ============================================================================
// File: apps/web/src/shell/dark-modal.tsx
// TICKET-08a (OPUS_NOTE_13 Item B — MENU-02 & MENU-03):
// Shared DarkModal in the HUD telemetry vocabulary for Settings and Community,
// with Esc to close (hint shown), focus trap, and dark-forms.css auto-imported.
// ============================================================================

import React, { useEffect, useRef, type ReactNode } from 'react';
import './dark-modal.css';
import './dark-forms.css';

export interface DarkModalProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly width?: number;
  readonly subtitle?: string;
  readonly headerRight?: ReactNode;
  readonly children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const DarkModal: React.FC<DarkModalProps> = ({
  title,
  onClose,
  width = 860,
  subtitle,
  headerRight,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const firstEl = nodes[0]!;
        const lastEl = nodes[nodes.length - 1]!;
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === firstEl || !panelRef.current.contains(active)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (!active || active === lastEl || !panelRef.current.contains(active)) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (prevActive && typeof prevActive.focus === 'function') {
        prevActive.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="dm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="dark-modal"
    >
      <div
        ref={panelRef}
        className="dm-panel dark-modal dark-forms"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <header className="dm-header">
          <div className="dm-title-group">
            <span className="dm-indicator" aria-hidden="true" />
            <div>
              <h2 className="dm-title">{title}</h2>
              {subtitle ? <p className="dm-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <div className="dm-header-actions">
            {headerRight}
            <button
              type="button"
              className="dm-close-btn"
              onClick={onClose}
              aria-label="Close modal (Escape)"
              data-testid="dark-modal-close"
            >
              <kbd>Esc</kbd>
              <span>Close</span>
            </button>
          </div>
        </header>
        <div className="dm-body">{children}</div>
      </div>
    </div>
  );
};

export default DarkModal;
