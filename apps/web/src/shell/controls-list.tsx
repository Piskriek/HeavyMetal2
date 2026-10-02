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
  ['First person or over the shoulder', 'V, or the 1st and 3rd buttons top right'],
  ['Tabs: Select, Paint, Sculpt, Animate, Sound, Lights, Activities, Avatar, Things, Camera', 'F1 to F10 (Avatar also on P)'],
  ['Pick a slot', '1 to 9, or the mouse wheel'],
  ['Use what you hold', 'Left mouse button'],
  ['The opposite (lower, take away, smaller)', 'Right mouse button'],
  ['Your presets: fill the slots, change any preset', 'E (the mouse is free while it is open)'],
  ['Quick wheel of the open tab', 'Hold Tab, turn the wheel, let go (or click one when the mouse is free)'],
  ['Studio: fly without your goblin', 'B, or the Studio button; fly with W A S D, Space up, C down, hold the right button to look'],
  ['Focus on a thing, hide the others', 'F and H (or the Focus and Hide others tools)'],
  ['Flat or PBR ground', 'The Flat and PBR buttons top right'],
  ['Undo, redo', 'Ctrl+Z, Ctrl+Y'],
  ['Close one thing, then the menu', 'Esc'],
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
