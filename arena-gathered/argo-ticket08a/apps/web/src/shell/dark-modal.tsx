// ============================================================================
// File: apps/web/src/shell/dark-modal.tsx
// TICKET-08a (OPUS_NOTE_13 Item B — MENU-02 & MENU-03):
// Shared DarkModal in the HUD telemetry vocabulary for Settings and Community,
// with Esc to close (hint shown), focus trap, and dark-forms.css auto-imported.
// ============================================================================

import React, { useEffect, useRef, type ReactNode } from 'react';

const STYLE_ID = "hm-dark-modal-styles";
const STYLE_CSS = "/* ============================================================================\n * File: apps/web/src/shell/dark-modal.css\n * TICKET-08a (OPUS_NOTE_13 Item B):\n * Dark-glass modal shell in the HUD vocabulary (Oxanium headers, Inter body,\n * cyan/amber telemetry accents).\n * ============================================================================ */\n\n.dm-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 100;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 20px;\n  background: rgba(4, 8, 15, 0.76);\n  backdrop-filter: blur(12px) saturate(140%);\n  -webkit-backdrop-filter: blur(12px) saturate(140%);\n}\n\n.dm-panel {\n  width: 100%;\n  max-height: min(86vh, 840px);\n  display: flex;\n  flex-direction: column;\n  background: rgba(10, 15, 24, 0.92);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  border-radius: 10px;\n  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65), 0 0 20px rgba(61, 200, 255, 0.08);\n  color: #f4f8ff;\n  font-family: 'Inter', system-ui, sans-serif;\n  overflow: hidden;\n  outline: none;\n}\n\n.dm-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 20px;\n  background: linear-gradient(180deg, rgba(18, 26, 38, 0.96), rgba(10, 15, 24, 0.96));\n  border-bottom: 1px solid rgba(255, 255, 255, 0.12);\n  flex-shrink: 0;\n}\n\n.dm-title-group {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.dm-indicator {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: #3dc8ff;\n  box-shadow: 0 0 8px #3dc8ff;\n}\n\n.dm-title {\n  margin: 0;\n  font-family: 'Oxanium', monospace, sans-serif;\n  font-size: 15px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: #f4f8ff;\n}\n\n.dm-subtitle {\n  margin: 2px 0 0;\n  font-size: 11px;\n  color: #94a3b8;\n}\n\n.dm-header-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.dm-close-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 5px 11px;\n  background: rgba(255, 255, 255, 0.06);\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  border-radius: 6px;\n  color: #f4f8ff;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.04em;\n  cursor: pointer;\n}\n\n.dm-close-btn:hover {\n  background: rgba(61, 200, 255, 0.16);\n  border-color: #3dc8ff;\n}\n\n.dm-close-btn kbd {\n  padding: 1px 5px;\n  font-family: 'Oxanium', monospace;\n  font-size: 10px;\n  color: #3dc8ff;\n  background: rgba(0, 0, 0, 0.45);\n  border: 1px solid rgba(61, 200, 255, 0.35);\n  border-radius: 4px;\n}\n\n.dm-body {\n  padding: 18px 22px 24px;\n  overflow-y: auto;\n  flex: 1;\n}\n\n/* ============================================================================\n * File: apps/web/src/shell/dark-forms.css\n * TICKET-08a (OPUS_NOTE_13 Item B — MENU-02 & MENU-03):\n * Scoped dark-glass form & card styles for Settings (settings-body.tsx) and\n * Community (community.tsx) inside a DarkModal or .dark-forms wrapper.\n * Replaces legacy #f1f0ea light surfaces and white inputs with HUD telemetry glass.\n * ============================================================================ */\n\n.dark-forms,\n.dark-modal {\n  color: #f4f8ff;\n  font-family: 'Inter', system-ui, sans-serif;\n}\n\n/* Sections & Headings */\n.dark-forms section,\n.dark-modal .settings-body > section,\n.dark-modal .your-shares {\n  margin: 0 0 18px;\n  padding: 14px 16px;\n  background: rgba(16, 23, 36, 0.72);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 8px;\n}\n\n.dark-forms h3,\n.dark-forms h4,\n.dark-modal h3,\n.dark-modal h4 {\n  margin: 0 0 10px;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: #3dc8ff;\n}\n\n/* Rows & Labels */\n.dark-forms .row,\n.dark-modal .row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 6px 0;\n  font-size: 13px;\n  color: #e2e8f0;\n}\n\n.dark-forms .row.slider,\n.dark-modal .row.slider {\n  display: grid;\n  grid-template-columns: 140px 1fr 56px;\n  align-items: center;\n  gap: 12px;\n}\n\n.dark-forms .row.slider output,\n.dark-modal .row.slider output {\n  font-family: 'Oxanium', monospace;\n  font-size: 12px;\n  font-weight: 700;\n  text-align: right;\n  color: #3dc8ff;\n  font-variant-numeric: tabular-nums;\n}\n\n/* Text, Number, Search Inputs & Selects */\n.dark-forms input[type='text'],\n.dark-forms input[type='number'],\n.dark-forms input[type='search'],\n.dark-forms input:not([type]),\n.dark-forms select,\n.dark-forms textarea,\n.dark-modal input[type='text'],\n.dark-modal input[type='number'],\n.dark-modal input[type='search'],\n.dark-modal input:not([type]),\n.dark-modal select,\n.dark-modal textarea {\n  padding: 7px 10px;\n  background: rgba(5, 9, 16, 0.9);\n  border: 1px solid rgba(255, 255, 255, 0.2);\n  border-radius: 6px;\n  color: #f4f8ff;\n  font-family: 'Inter', system-ui, sans-serif;\n  font-size: 13px;\n}\n\n.dark-forms input:focus,\n.dark-forms select:focus,\n.dark-forms textarea:focus,\n.dark-modal input:focus,\n.dark-modal select:focus,\n.dark-modal textarea:focus {\n  outline: none;\n  border-color: #3dc8ff;\n  box-shadow: 0 0 0 2px rgba(61, 200, 255, 0.2);\n}\n\n/* Range Sliders */\n.dark-forms input[type='range'],\n.dark-modal input[type='range'] {\n  width: 100%;\n  accent-color: #3dc8ff;\n  cursor: pointer;\n}\n\n/* Checkboxes */\n.dark-forms input[type='checkbox'],\n.dark-modal input[type='checkbox'] {\n  width: 16px;\n  height: 16px;\n  accent-color: #3dc8ff;\n  cursor: pointer;\n}\n\n/* Buttons & Segmented Controls */\n.dark-forms button,\n.dark-modal button {\n  padding: 6px 12px;\n  background: rgba(20, 29, 43, 0.9);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  border-radius: 6px;\n  color: #e2e8f0;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.03em;\n  cursor: pointer;\n  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;\n}\n\n.dark-forms button:hover:not(:disabled),\n.dark-modal button:hover:not(:disabled) {\n  background: rgba(34, 49, 71, 0.95);\n  border-color: rgba(61, 200, 255, 0.45);\n  color: #ffffff;\n}\n\n.dark-forms button.on,\n.dark-forms button[aria-pressed='true'],\n.dark-modal button.on,\n.dark-modal button[aria-pressed='true'] {\n  background: rgba(61, 200, 255, 0.2);\n  border-color: #3dc8ff;\n  color: #3dc8ff;\n  box-shadow: 0 0 12px rgba(61, 200, 255, 0.18);\n}\n\n.dark-forms button.go,\n.dark-modal button.go {\n  background: linear-gradient(180deg, #3dc8ff, #0284c7);\n  border-color: #38bdf8;\n  color: #040810;\n  font-weight: 700;\n}\n\n.dark-forms button.danger,\n.dark-modal button.danger {\n  background: rgba(255, 61, 138, 0.16);\n  border-color: rgba(255, 61, 138, 0.45);\n  color: #fda4af;\n}\n\n.dark-forms .seg,\n.dark-modal .seg,\n.dark-forms .tabs,\n.dark-modal .tabs {\n  display: inline-flex;\n  flex-wrap: wrap;\n  gap: 4px;\n  padding: 3px;\n  background: rgba(5, 9, 16, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 7px;\n}\n\n.dark-forms .seg button,\n.dark-modal .seg button,\n.dark-forms .tabs button,\n.dark-modal .tabs button {\n  border-radius: 5px;\n  border-color: transparent;\n  background: transparent;\n}\n\n.dark-forms .seg button.on,\n.dark-modal .seg button.on,\n.dark-forms .tabs button.on,\n.dark-modal .tabs button.on {\n  background: rgba(61, 200, 255, 0.2);\n  border-color: rgba(61, 200, 255, 0.55);\n  color: #3dc8ff;\n}\n\n/* Hints & Links */\n.dark-forms .hint,\n.dark-modal .hint {\n  margin: 4px 0 8px;\n  font-size: 12px;\n  line-height: 1.45;\n  color: #94a3b8;\n}\n\n.dark-forms a,\n.dark-modal a {\n  color: #3dc8ff;\n  text-decoration: none;\n}\n\n.dark-forms a:hover,\n.dark-modal a:hover {\n  text-decoration: underline;\n}\n\n/* Community Cards & Window Reset inside DarkModal */\n.dark-modal .shell-window,\n.dark-forms .shell-window {\n  background: transparent;\n  border: none;\n  box-shadow: none;\n  padding: 0;\n  color: #f4f8ff;\n}\n\n.dark-modal .shell-window > header,\n.dark-forms .shell-window > header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-wrap: wrap;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n.dark-modal .shell-cards,\n.dark-forms .shell-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));\n  gap: 14px;\n  margin: 12px 0;\n}\n\n.dark-modal .shell-activity,\n.dark-forms .shell-activity {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 14px;\n  background: rgba(16, 23, 36, 0.82);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 8px;\n  color: #f4f8ff;\n}\n\n.dark-modal .shell-activity .thumb,\n.dark-forms .shell-activity .thumb {\n  height: 96px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(5, 9, 16, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 6px;\n  overflow: hidden;\n}\n";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  document.head.appendChild(el);
}

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
