import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, Keyboard } from 'lucide-react';
import {
  ACTIONS,
  GAMEPAD_LABELS,
  formatKey,
  getConflictCodes,
  getConflicts,
  getDefaultBindings,
  loadBindings,
  saveBindings,
  type ActionId,
  type KeyBindings,
} from '../game/controls';

interface ControlsSettingsProps {
  onBindingsChange?: (bindings: KeyBindings) => void;
}

export default function ControlsSettings({ onBindingsChange }: ControlsSettingsProps) {
  const [bindings, setBindings] = useState<KeyBindings>(() => loadBindings());
  const [capturing, setCapturing] = useState<{ action: ActionId; index: number } | null>(null);
  const [message, setMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh if another tab/window or component changes bindings
  useEffect(() => {
    const handler = () => setBindings(loadBindings());
    window.addEventListener('goblin-bindings-changed' as any, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('goblin-bindings-changed' as any, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const conflictCodes = useMemo(() => getConflictCodes(bindings), [bindings]);
  const conflicts = useMemo(() => getConflicts(bindings), [bindings]);
  const hasConflicts = conflictCodes.size > 0;

  const persist = useCallback(
    (next: KeyBindings) => {
      setBindings(next);
      saveBindings(next);
      onBindingsChange?.(next);
      setMessage('Controls saved');
    },
    [onBindingsChange],
  );

  const handleReset = useCallback(() => {
    const defaults = getDefaultBindings();
    persist(defaults);
    setMessage('Controls restored to defaults');
    setCapturing(null);
  }, [persist]);

  // Key capture effect
  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Prevent page scroll etc while capturing
      // Allow Escape to cancel capture without assigning
      if (event.code === 'Escape' && event.key === 'Escape') {
        // If user is rebinding Pause (which includes Escape), allow Escape to be assigned
        // only if the target is pause action. Otherwise cancel.
        if (capturing.action !== 'pause') {
          event.preventDefault();
          event.stopPropagation();
          setCapturing(null);
          setMessage('Rebind cancelled');
          return;
        }
        // For pause, treat Escape as valid rebinding key
      }
      // Ignore pure modifiers if they have no code? But event.code is always set for those.
      // We accept any code except we ignore if it's just 'Escape' for non-pause? Already handled.
      event.preventDefault();
      event.stopPropagation();

      const code = event.code;
      if (!code) return;

      // If code is Tab, ignore (would move focus)
      if (code === 'Tab') return;

      setBindings((prev) => {
        const next: KeyBindings = { ...prev };
        // Ensure array exists
        const current = [...(next[capturing.action] ?? [])];
        // Expand array if index beyond length
        while (current.length <= capturing.index) current.push('');
        current[capturing.index] = code;
        // Remove empty strings that may be placeholders and dedupe within same action if duplicate
        // Keep empty slots as they were, but allow duplicate codes across actions (flagged)
        next[capturing.action] = current.filter((c) => c !== '');
        // Ensure at least one binding remains
        if (next[capturing.action].length === 0) next[capturing.action] = [code];
        saveBindings(next);
        onBindingsChange?.(next);
        return next;
      });
      setCapturing(null);
      setMessage(`Bound to ${formatKey(code)}`);
    };

    const onMouseDown = (event: MouseEvent) => {
      // If user clicks outside while capturing, cancel? Keep capturing until key.
      // But if they click another pill, that pill's onClick will set new capturing; ignore.
      const target = event.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Click outside – cancel capture
        setCapturing(null);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [capturing, onBindingsChange]);

  // Accessibility: focus management for capturing pill
  useEffect(() => {
    if (capturing) {
      const el = containerRef.current?.querySelector<HTMLButtonElement>(`[data-action="${capturing.action}"][data-index="${capturing.index}"]`);
      el?.focus();
    }
  }, [capturing]);

  return (
    <div ref={containerRef} className="controls-settings" role="region" aria-label="Custom controls">
      <div className="controls-intro">
        <p className="fantasy-lead" style={{ marginBottom: 12 }}>
          Rebind every racing control to the keys that feel right for your hands — arrow keys, ESDF, or anything else.
          Click a key pill to capture a new binding. Conflicts are highlighted in crimson. Changes save automatically.
        </p>
      </div>

      {hasConflicts && (
        <div className="controls-conflict-banner" role="alert">
          <AlertTriangle size={16} />
          <span>
            {conflictCodes.size === 1
              ? `Duplicate key: ${formatKey([...conflictCodes][0])} is assigned to multiple actions.`
              : `Conflicting keys: ${[...conflictCodes].map(formatKey).join(', ')} assigned more than once.`}
          </span>
        </div>
      )}

      <div className="controls-table" role="table" aria-label="Key bindings">
        {/* Header row for screen readers */}
        <div className="controls-row controls-header" role="row">
          <span role="columnheader">Action</span>
          <span role="columnheader">Primary</span>
          <span role="columnheader">Alternate</span>
          {ACTIONS.some((a) => a.defaults.length > 2) && <span role="columnheader" className="tertiary-header">Extra</span>}
        </div>
        {ACTIONS.map((action) => {
          const codes = bindings[action.id] ?? [];
          // Ensure we display at least 2 slots; for hop with 3, show 3; for bounce with 1, show 2 with placeholder
          const slotCount = Math.max(2, codes.length);
          // But for hop default is 3, so slotCount becomes 3 if codes length 3
          const slots = Array.from({ length: slotCount }, (_, i) => codes[i] ?? '');
          // Determine if this row has conflict
          const rowHasConflict = codes.some((c) => conflictCodes.has(c));
          return (
            <div
              key={action.id}
              className={`controls-row forged-row ${rowHasConflict ? 'has-conflict' : ''}`}
              role="row"
              aria-label={`${action.label} bindings`}
            >
              <div className="controls-action" role="cell">
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </div>
              <div className="controls-pills" role="cell">
                {slots.map((code, idx) => {
                  const isCapturing = capturing?.action === action.id && capturing?.index === idx;
                  const isConflict = code ? conflictCodes.has(code) : false;
                  const display = code ? formatKey(code) : '—';
                  // For keyboard users, show which keys are bound
                  const conflictDetail = isConflict
                    ? ` Conflict: ${code} also used by ${conflicts
                        .get(code)
                        ?.filter((e) => !(e.action === action.id && e.index === idx))
                        .map((e) => ACTIONS.find((a) => a.id === e.action)?.label)
                        .join(', ')}`
                    : '';
                  return (
                    <button
                      key={`${action.id}-${idx}`}
                      data-action={action.id}
                      data-index={idx}
                      className={`key-pill ${isCapturing ? 'is-capturing' : ''} ${isConflict ? 'is-conflict' : ''} ${!code ? 'is-empty' : ''}`}
                      aria-label={
                        isCapturing
                          ? `Listening for new key for ${action.label} ${idx === 0 ? 'primary' : idx === 1 ? 'alternate' : 'extra'} binding. Press a key or Escape to cancel`
                          : `Rebind ${action.label} ${idx === 0 ? 'primary' : idx === 1 ? 'alternate' : 'extra'} key. Currently ${display}${conflictDetail}`
                      }
                      aria-pressed={isCapturing}
                      onClick={() => {
                        setMessage('');
                        setCapturing({ action: action.id, index: idx });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCapturing({ action: action.id, index: idx });
                        }
                      }}
                    >
                      <span className="key-pill-label">{isCapturing ? 'Press a key…' : display}</span>
                      <Keyboard size={14} className="key-pill-icon" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* H13: the keys that are not rebindable, so the whole keyboard is written down in one place. */}
      <div className="controls-fixed-keys" aria-label="Fixed keys">
        <strong>FIXED KEYS</strong>
        <span><kbd>Enter</kbd> Start / race again</span>
        <span><kbd>R</kbd> Restart</span>
        <span><kbd>M</kbd> Sound</span>
        <span><kbd>F</kbd> Fullscreen</span>
        <span><kbd>V</kbd> Camera: cockpit / chase</span>
        <span><kbd>[</kbd> <kbd>]</kbd> Slow motion down / up</span>
        <span className="controls-gamepad">Gamepad: {GAMEPAD_LABELS.steerLeft.split(' / ')[0]} or d-pad changes lanes · {GAMEPAD_LABELS.bounce} bounces · {GAMEPAD_LABELS.boost} boosts · {GAMEPAD_LABELS.pause} pauses</span>
      </div>

      <div className="fantasy-dialog-actions controls-actions">
        <button className="fantasy-link" onClick={handleReset} aria-label="Reset controls to factory defaults">
          <RotateCcw size={14} /> Reset to Defaults
        </button>
        <span className="save-status" role="status" aria-live="polite">
          {message || (hasConflicts ? 'Resolve crimson conflicts before racing' : 'Saved on this device')}
        </span>
        <span className="controls-hint" aria-hidden="true">
          <kbd>ESC</kbd> cancel capture
        </span>
      </div>

      <p className="settings-footnote">
        Bindings are stored in <code>goblin-rally-keybindings-v1</code>. If storage is blocked or corrupt, factory defaults are
        used. Every pill is keyboard focusable — Tab to a pill, press Enter to rebind, Escape to cancel.
      </p>

      <style>{`
        .controls-settings { display: flex; flex-direction: column; gap: 14px; }
        .controls-conflict-banner {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 13px;
          background: #2a0f14;
          border: 1px solid #a33a4a;
          border-left: 3px solid #e0525c;
          border-radius: 6px;
          color: #f7c9cf;
          font-size: 11px; line-height: 1.5;
        }
        .controls-conflict-banner svg { color: #e0525c; flex-shrink: 0; }
        .controls-table { display: flex; flex-direction: column; gap: 10px; }
        .controls-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          background: linear-gradient(180deg, #1a2420 0%, #121a17 100%);
          border: 1px solid #3b4a3a;
          border-radius: 8px;
          box-shadow: inset 0 1px 0 #ffffff0a, 0 2px 8px #0000003a;
          position: relative;
        }
        .controls-row.forged-row::before {
          content: ''; position: absolute; inset: -1px; border-radius: 8px;
          border: 1px solid #6b542610; pointer-events: none;
        }
        .controls-row.has-conflict { border-color: #8b2e3a; background: linear-gradient(180deg, #2a1719 0%, #1e1214 100%); }
        .controls-header {
          background: transparent; border: none; box-shadow: none; padding: 0 4px 2px;
          font: 6px var(--mono); letter-spacing: 1.1px; color: #8b9a7d; text-transform: uppercase;
        }
        .controls-header span:nth-child(2), .controls-header span:nth-child(3) { text-align: center; min-width: 92px; }
        .controls-action strong { display: block; font: 700 12px var(--display); letter-spacing: .4px; color: #ececdb; text-transform: uppercase; }
        .controls-action small { display: block; margin-top: 3px; font-size: 10px; line-height: 1.45; color: #9aa68d; }
        .controls-pills { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .key-pill {
          position: relative;
          display: inline-flex; align-items: center; gap: 7px;
          min-width: 92px; height: 36px; padding: 0 12px; justify-content: center;
          background: linear-gradient(180deg, #2b3530 0%, #1e2823 100%);
          border: 1px solid #4a5a48; border-radius: 9999px;
          font: 700 11px var(--mono); letter-spacing: .6px; color: #e8e8d8;
          box-shadow: inset 0 1px 0 #ffffff12, 0 2px 6px #0000003a;
          transition: all 160ms;
        }
        .key-pill:hover { border-color: #ffb86a; color: #fff; transform: translateY(-1px); }
        .key-pill:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .key-pill.is-capturing {
          background: #f0a15b; color: #1a1208; border-color: #ffcc8a;
          box-shadow: 0 0 0 3px #f0a15b36, 0 4px 10px #0000004a;
          animation: pulse-capture 1.1s ease-in-out infinite;
        }
        .key-pill.is-conflict {
          background: #3a1218; border-color: #d14a5a; color: #ffc9d0;
          box-shadow: inset 0 1px 0 #ffffff0f, 0 0 0 2px #d14a5a3a;
        }
        .key-pill.is-conflict.is-capturing { background: #8b1d2e; color: #fff; }
        .key-pill.is-empty { border-style: dashed; opacity: .85; }
        .key-pill-label { white-space: nowrap; }
        .controls-fixed-keys { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; padding: 10px 12px; border: 1px solid #2e3827; border-radius: 6px; background: #0f1814; font-size: 11px; color: #9aa68d; }
        .controls-fixed-keys .controls-gamepad { flex-basis: 100%; }
        .controls-fixed-keys strong { flex-basis: 100%; color: #f0a15b; font-size: 9px; letter-spacing: .6px; }
        .key-pill-icon { opacity: .55; }
        .key-pill.is-capturing .key-pill-icon { opacity: 1; }
        @keyframes pulse-capture { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        .controls-actions { margin-top: 4px; align-items: center; flex-wrap: wrap; gap: 10px; }
        .controls-hint { font: 6px var(--mono); letter-spacing: .8px; color: #8b9a7d; display: inline-flex; gap: 6px; align-items: center; }
        .controls-hint kbd { background: #1e2823; border: 1px solid #3a4a3a; border-bottom-width: 2px; border-radius: 4px; padding: 2px 5px; font: 600 7px var(--mono); }
        @media (max-width: 640px) {
          .controls-row { grid-template-columns: 1fr; gap: 10px; }
          .controls-pills { justify-content: flex-start; }
          .key-pill { min-width: 84px; height: 34px; font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
