import type { ReactElement } from 'react';

const ROWS: readonly (readonly [string, string])[] = [
  ['V', 'Select and move props'], ['B', 'Brush: paint surfaces, raise, lower, smooth, flatten'], ['S', 'Shape: ramps, hills, craters, plateaus, ridges, volcanoes, dunes'],
  ['T', 'Track: click to draw a loop, drag points, Delete removes one'], ['D', 'Dress: scatter palms, bushes and rocks'], ['P', 'Place props (cones, barrels, flags ...)'], ['X', 'Delete props'],
  ['[  ]', 'Smaller / bigger brush'], ['1 – 9', 'Pick a surface and start painting'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo, every edit is one step'], ['?', 'This help'],
];

/** The first-run welcome and the shortcut sheet. Esc or a click anywhere closes it. */
export function HelpOverlay({ onClose, firstRun }: { readonly onClose: () => void; readonly firstRun: boolean }): ReactElement {
  return (
    <div className="help" role="dialog" aria-modal="true" aria-label="Map Maker help" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h2>{firstRun ? 'Welcome to the Map Maker' : 'Shortcuts'}</h2>
        {firstRun ? <p className="hint">Build a track, dress the island, then press <b>Test drive</b> to race it. Everything is a preset: every setting can be edited, driven by a wobble or a timeline, and it all saves itself.</p> : null}
        <table><tbody>{ROWS.map(([k, v]) => <tr key={k}><th><kbd>{k}</kbd></th><td>{v}</td></tr>)}</tbody></table>
        <p className="hint">Mouse: left button uses the tool · right or middle drag orbits · wheel zooms.</p>
        <p className="hint">Select a prop, then <b>Drive a setting…</b> to make it move; <b>▶ Preview</b> runs the scene; <b>🎚 Sounds</b> changes every sound.</p>
        <button className="go" autoFocus onClick={onClose}>{firstRun ? 'Let’s build' : 'Close'}</button>
      </div>
    </div>
  );
}

const SEEN = 'hm.maker.seenHelp';
export const helpSeen = (): boolean => { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } };
export const markHelpSeen = (): void => { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } };
