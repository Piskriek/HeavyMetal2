import { useState, type ReactElement } from 'react';
import type { Runtime } from '@hm/engine';
import type { PresetId } from '@hm/contracts';
import { mapToCode, useMapCode } from './storage';

/** Share a map as a line of text, or load one someone sent. Works anywhere text can be pasted (chat, notes). */
export function ShareDialog({ rt, sceneId, onClose, onDone }: { readonly rt: Runtime; readonly sceneId: PresetId; readonly onClose: () => void; readonly onDone: (text: string) => void }): ReactElement {
  const [code, setCode] = useState('');
  const [incoming, setIncoming] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      const c = await mapToCode(rt, sceneId);
      setCode(c);
      let copied = false;
      try { await navigator.clipboard.writeText(c); copied = true; } catch { /* the box below still has it */ }
      onDone(copied ? `Map code copied (${Math.round(c.length / 1024)} KB)` : 'Map code ready: copy it from the box');
    } catch { setError('Could not make a code in this browser.'); }
    setBusy(false);
  };
  const load = async (): Promise<void> => {
    setBusy(true);
    const problem = await useMapCode(incoming, rt);
    setBusy(false);
    if (problem) { setError(problem); return; }
    location.reload();
  };

  return (
    <div className="help" role="dialog" aria-modal="true" aria-label="Share a map" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h2>Share a map</h2>
        <p className="hint">A map code is one line of text with your whole map inside: track, ground, foliage, props, sounds and drivers.</p>
        <div className="btns"><button className="go" disabled={busy} onClick={() => void make()}>Copy my map code</button></div>
        {code ? <textarea className="code" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} /> : null}
        <h3 className="sub">Load a map code</h3>
        <textarea className="code" placeholder="Paste a code that starts with HM1." value={incoming} rows={3} onChange={(e) => { setIncoming(e.target.value); setError(null); }} />
        {error ? <p className="bad" role="alert">{error}</p> : null}
        <div className="btns">
          <button disabled={busy || incoming.trim() === ''} onClick={() => void load()}>Load it (replaces this map)</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
