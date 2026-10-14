// The lore on the telemetry HUD (P0-LORE-01, TASK-23c): a hover card with a prop's two-sentence readout, and the Bridge Incident Log
// databank panel that a salvaged or read prop opens, with a short CRT data-chirp. The game's HUD vocabulary (monster-hud.css): a dark
// glass plate with a 2 px accent edge, Oxanium for the stamps and labels, Inter for the sentences. Sentence case, no ALL CAPS labels.
import { useEffect } from 'react';
import { loreFor, BRIDGE_LOGS } from './lore-logs';
import { clutterById } from './lab-clutter';
import './lore-ui.css';

/** The names the readouts go by: the transponders are named for what they are (Argo's readouts 5 to 8). */
const TRANSPONDER_LABELS: Readonly<Record<string, string>> = {
  'transponder-01': 'survey beacon',
  'transponder-02': 'telemetry box',
  'transponder-03': 'cargo skid power box',
  'transponder-04': 'optical transceiver',
};

/** The name of a prop the player can read or salvage. */
export function propLabel(id: string): string {
  return clutterById(id)?.label ?? TRANSPONDER_LABELS[id] ?? 'wreck';
}

/** Splits a log into its channel stamp ("BRIDGE TELEMETRY [T-00:04:12]") and its message, at the first colon after the stamp. */
export function splitLog(text: string): { readonly stamp: string; readonly message: string } {
  const at = text.indexOf(': ');
  return at > 0 ? { stamp: text.slice(0, at), message: text.slice(at + 2) } : { stamp: '', message: text };
}

let chirpContext: AudioContext | null = null;
/** The CRT data-chirp: a short falling sweep with a tick, synthesised (no sample). Silent where audio is unavailable. */
export function playDataChirp(): void {
  try {
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return;
    chirpContext ??= new Ctor();
    const ctx = chirpContext;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, t0);
    osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.16);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.21);
    const tick = ctx.createOscillator();
    const tg = ctx.createGain();
    tick.type = 'square';
    tick.frequency.setValueAtTime(3200, t0 + 0.2);
    tg.gain.setValueAtTime(0.02, t0 + 0.2);
    tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.23);
    tick.connect(tg).connect(ctx.destination);
    tick.start(t0 + 0.2);
    tick.stop(t0 + 0.24);
  } catch {
    // no audio: the panel still opens
  }
}

/** The hover card: the readout of the prop under the crosshair (pointer-free: it never takes a click). */
export function LoreHover({ prop }: { readonly prop: string }) {
  const entry = loreFor(prop);
  if (!entry) return null;
  return (
    <div className="lore-hover" role="status" aria-live="polite">
      <p className="lore-hover-name">{propLabel(prop)}</p>
      <p className="lore-hover-text">{entry.readout}</p>
    </div>
  );
}

/** The Bridge Incident Log databank: one entry, opened by a read or a salvage. Escape or Close dismisses it. */
export function DataBank({ log, onClose }: { readonly log: string; readonly onClose: () => void }) {
  // the chirp sounds once per entry opened (not on every render)
  useEffect(() => { playDataChirp(); }, [log]);
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const { stamp, message } = splitLog(BRIDGE_LOGS[log] ?? '');
  return (
    <section className="lore-bank" aria-label="Bridge Incident Log" data-testid="bridge-log">
      <header className="lore-bank-head">
        <span className="lore-bank-title">Bridge Incident Log</span>
        <span className="lore-bank-id">{log}</span>
      </header>
      <div className="lore-bank-scan" aria-hidden="true" />
      <p className="lore-bank-stamp">{stamp}</p>
      <p className="lore-bank-text">{message}</p>
      <footer className="lore-bank-foot">
        <button type="button" className="lore-bank-close" onClick={onClose}>Close</button>
      </footer>
    </section>
  );
}
