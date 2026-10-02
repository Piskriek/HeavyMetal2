import { useEffect, useState, type ReactElement } from 'react';

/**
 * Controls live here, in Settings, not on the screen: the screen only says what the tool in your hand does.
 * The mouse line is a live check of whether this browser lets the game capture the mouse (it never changes anything).
 */
const ROWS: readonly (readonly [string, string])[] = [
  ['Look around', 'Move the mouse (click the world first to capture it)'],
  ['Walk', 'W A S D or the arrow keys'],
  ['Run', 'Hold Shift'],
  ['Jump', 'Space'],
  ['First person or third person', 'V'],
  ['Use the tool in your hand', 'Left mouse button'],
  ['The opposite (lower, take away)', 'Right mouse button'],
  ['Pick a hotbar slot', '1 to 9'],
  ['Presets in your hand', 'Hold Tab, turn the wheel, Q and E change group, let go to keep'],
  ['Tools', 'T opens the rail and lets go of the mouse; click the world to capture it again'],
  ['Inventory', 'E'],
  ['Undo', 'Ctrl+Z'],
  ['Menu and back', 'Esc (closes the tool panel first)'],
];

type Capture = { readonly supported: boolean; readonly on: boolean };

function readCapture(): Capture {
  if (typeof document === 'undefined') return { supported: false, on: false };
  return { supported: 'pointerLockElement' in document && typeof document.body.requestPointerLock === 'function', on: !!document.pointerLockElement };
}

export function ControlsList(): ReactElement {
  const [cap, setCap] = useState<Capture>(readCapture);
  useEffect(() => {
    const on = (): void => setCap(readCapture());
    document.addEventListener('pointerlockchange', on);
    return () => document.removeEventListener('pointerlockchange', on);
  }, []);
  return (
    <section className="controls-list" aria-label="Controls">
      <h4>Controls</h4>
      <dl>
        {ROWS.map(([what, how]) => <div key={what}><dt>{what}</dt><dd>{how}</dd></div>)}
      </dl>
      <p className="hint" role="status">
        Mouse capture: {cap.supported ? (cap.on ? 'on, the mouse is captured right now' : 'available, click the world to capture it') : 'not available in this browser, so the game aims at the middle of the screen and you look with the right mouse button held'}.
      </p>
    </section>
  );
}
