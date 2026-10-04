import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { defineSchema, type Params } from '@hm/contracts';
import { Inspector } from '@hm/ui';
import { DEFAULT_CONTROLS, normalizeControls, type Controls } from './profile';

/** The mouse and view settings as a preset: the same sliders as everywhere (they grow when pushed, with a number box). */
const CONTROLS_SCHEMA = defineSchema({
  kind: 'controls', version: 1, label: 'Controls', doc: 'How the mouse and the view feel.', slots: [],
  variables: [
    { key: 'sensitivity', type: 'number', label: 'Mouse speed', doc: 'How fast the view turns with the mouse (1 = as made).', tier: 'play', default: 1, min: 0.25, max: 3, step: 0.05, hardMin: 0.05, hardMax: 20, group: 'Mouse' },
    { key: 'invertY', type: 'boolean', label: 'Invert up and down', doc: 'Mouse forward looks down, like a plane.', tier: 'play', default: false, group: 'Mouse' },
    { key: 'fov', type: 'number', label: 'Field of view', doc: 'How wide you see in first person (third person and studio are a little narrower).', tier: 'play', default: 75, min: 55, max: 100, step: 1, hardMin: 30, hardMax: 120, unit: '°', group: 'View' },
  ],
});

export function ControlsSettings(props: { readonly value: Controls; readonly onChange: (c: Controls) => void }): ReactElement {
  const own = useMemo(() => Object.fromEntries(Object.entries(props.value).filter(([k, v]) => v !== DEFAULT_CONTROLS[k as keyof Controls])) as Params, [props.value]);
  return (
    <section className="controls-settings" aria-label="Mouse and view">
      <h4>Mouse and view</h4>
      <Inspector schema={CONTROLS_SCHEMA} params={own} resolved={props.value as unknown as Params} tier="play" onChange={(k, v) => props.onChange(normalizeControls({ ...props.value, [k]: v }))} />
    </section>
  );
}

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
  ['The hotbar tabs', 'F1 to F12 (F11 and F12 also on Shift+F1 and Shift+F2: the browser keeps those keys)'],
  ['Game, Simplified or Advanced', 'The backtick key, or the switch at the end of the hotbar'],
  ['Pick a slot', '1 to 9, or the mouse wheel'],
  ['Use what you hold', 'Left mouse button'],
  ['The opposite (dig, wipe, take away)', 'Right mouse button'],
  ['Free the mouse for sliders and presets while you walk', 'Tab (Tab again, or a click in the world, takes it back)'],
  ['Find a tool', '/ (type a name, Enter takes you there)'],
  ['Make the tool in hand bigger or smaller', '[ and ]'],
  ['The gizmo (Simplified and Advanced)', '+ and - size it, Shift snaps moves, Ctrl snaps turns, Alt leaves a copy'],
  ['Your avatar', 'The My avatar button top right, or My avatar in the Esc menu'],
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
