/**
 * The editor's key sheet (? or F1): every action with its keys, straight from the bindings, and a
 * Change button on each to set your own key. Taking a key another action uses moves it (that action
 * loses it) and the sheet says which. Mouse controls are listed at the end; they are fixed.
 */
import { useEffect, useState } from 'react';
import { Keyboard, RotateCcw, X } from 'lucide-react';
import {
  BUILDER_ACTIONS, BUILDER_KEY_GROUPS, chordOf, prettyChord, reservedChord,
  type BuilderKeys, type EditorMode, type KeyOverrides,
} from '../../game/builder/builder-keys';

interface CheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bindings: BuilderKeys;
  mode: EditorMode;
  onChange: (overrides: KeyOverrides) => void;
}

const MOUSE: [string, string][] = [
  ['Right-drag', 'Look around'],
  ['Wheel', 'Zoom in / out'],
  ['Click', 'Pick a piece (Shift adds more)'],
  ['Drag a handle', 'Move / rotate / scale the picked piece'],
  ['Arrows', 'Nudge the picked piece (Shift: bigger steps)'],
];

const MODIFIERS = new Set(['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight']);

export default function CheatSheet({ isOpen, onClose, bindings, mode, onChange }: CheatSheetProps) {
  const [capturing, setCapturing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const action = BUILDER_ACTIONS.find((a) => a.id === capturing);
      if (!action) { setCapturing(null); return; }
      // Held (fly) keys take a bare key; a lone modifier only binds to them.
      if (MODIFIERS.has(e.code) && !action.held) return;
      if (e.code === 'Escape' && capturing !== 'edit.cancel') { setCapturing(null); setNote(null); return; }
      const chord = action.held ? e.code : chordOf(e);
      const refused = reservedChord(chord);
      if (refused) { setNote(`${prettyChord(chord)}: ${refused} Pick another key.`); return; }
      const { overrides, moved } = bindings.rebind(action.id, chord);
      onChange(overrides);
      setNote(moved.length
        ? `${action.label} is now ${prettyChord(chord)}. Taken from: ${moved.join(', ')} (set it a new key if you still want one).`
        : `${action.label} is now ${prettyChord(chord)}.`);
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, bindings, onChange]);

  if (!isOpen) return null;
  const changed = Object.keys(bindings.overrides).length;

  return (
    <div
      className="forge-theme fixed inset-0 z-[85] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none pointer-events-auto"
      onClick={() => { if (!capturing) onClose(); }}
    >
      <div
        className="builder-forged-panel w-full max-w-3xl max-h-[86vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keys"
      >
        <div className="builder-forged-header flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Keyboard size={17} className="text-amber-400" />
            <span className="builder-forged-title">Keys</span>
            <span className="text-[11px] text-zinc-400">{mode === 'easy' ? 'Easy Build' : 'Pro'} mode · click Change to set your own key</span>
          </div>
          <div className="flex items-center gap-1.5">
            {changed > 0 && (
              <button className="forge-tool" onClick={() => { onChange({}); setNote('All keys are back to the defaults.'); }} title="Put every key back to its default">
                <RotateCcw size={13} /> Defaults
              </button>
            )}
            <button onClick={onClose} className="forge-tool" aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        {note && <div role="status" className="px-4 py-2 text-[12px] text-amber-200 bg-amber-950/40 border-b border-amber-900/50">{note}</div>}

        <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 builder-scroll">
          {BUILDER_KEY_GROUPS.map((group) => {
            const actions = BUILDER_ACTIONS.filter((a) => a.group === group.id && (!a.mode || a.mode === mode));
            if (!actions.length) return null;
            return (
              <section key={group.id} className="bg-black/30 border border-zinc-800 rounded-lg p-3">
                <h3 className="forge-title text-[11px] font-bold uppercase text-amber-300 pb-1.5 mb-1.5 border-b border-zinc-800">{group.label}</h3>
                <ul className="flex flex-col gap-0.5">
                  {actions.map((action) => {
                    const keys = bindings.keysOf(action.id);
                    const custom = Boolean(bindings.overrides[action.id]);
                    const listening = capturing === action.id;
                    return (
                      <li key={action.id} className="flex items-center gap-2 text-[12px] py-0.5">
                        <span className={`flex-1 min-w-0 truncate ${custom ? 'text-amber-200' : 'text-zinc-300'}`}>{action.label}</span>
                        {listening
                          ? <kbd className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono text-[11px] font-bold animate-pulse">press a key…</kbd>
                          : keys.length
                            ? keys.slice(0, 2).map((k) => <kbd key={k} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-amber-700/40 font-mono text-[11px] font-bold text-amber-200 whitespace-nowrap">{prettyChord(k)}</kbd>)
                            : <span className="text-[11px] text-zinc-500 italic">no key</span>}
                        <button
                          className="text-[11px] text-zinc-400 hover:text-amber-200 underline-offset-2 hover:underline"
                          onClick={() => { setNote(listening ? null : `Press the new key for “${action.label}” (Esc to cancel).`); setCapturing(listening ? null : action.id); }}
                        >
                          {listening ? 'Cancel' : 'Change'}
                        </button>
                        {custom && !listening && (
                          <button className="text-zinc-500 hover:text-amber-200" title="Back to the default" aria-label={`Reset ${action.label}`} onClick={() => onChange(bindings.reset(action.id))}>
                            <RotateCcw size={11} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <section className="bg-black/30 border border-zinc-800 rounded-lg p-3">
            <h3 className="forge-title text-[11px] font-bold uppercase text-amber-300 pb-1.5 mb-1.5 border-b border-zinc-800">Mouse</h3>
            <ul className="flex flex-col gap-0.5">
              {MOUSE.map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-2 text-[12px] py-0.5">
                  <span className="text-zinc-300">{d}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 font-mono text-[11px] text-zinc-300">{k}</kbd>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
