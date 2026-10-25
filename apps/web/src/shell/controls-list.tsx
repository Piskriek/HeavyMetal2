// ============================================================================
// File: apps/web/src/shell/controls-list.tsx
// UI-02 (DEC-10): Categorized multi-column visual keycap grid for Settings and Controls.
// ============================================================================

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { defineSchema, type Params } from '@hm/contracts';
import { Inspector } from '@hm/ui';
import { DEFAULT_CONTROLS, normalizeControls, type Controls } from './profile';

/** The mouse and view settings as a preset. */
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

interface KeycapControl {
  readonly action: string;
  readonly keys: readonly string[];
  readonly note?: string;
}

interface ControlGroup {
  readonly category: string;
  readonly items: readonly KeycapControl[];
}

const CATEGORIZED_CONTROLS: readonly ControlGroup[] = [
  {
    category: 'Locomotion & Vehicle',
    items: [
      { action: 'Move / Steer', keys: ['W', 'A', 'S', 'D'] },
      { action: 'Sprint / Boost', keys: ['Shift'] },
      { action: 'Jump / Mantle', keys: ['Space'] },
      { action: 'Camera 1P / 3P', keys: ['V'] },
      { action: 'Interact / Enter Rover', keys: ['E'] },
    ],
  },
  {
    category: 'Beam Rifle & Tools',
    items: [
      { action: 'Fire Beam / Harvest', keys: ['LMB'] },
      { action: 'Cycle Mode (Extract/Apply/Sculpt)', keys: ['Q'] },
      { action: 'Cycle Cartridge / Tool', keys: ['R'], note: 'or Alt + Wheel' },
      { action: 'Bandolier / Inventory', keys: ['Tab'] },
      { action: 'Holster Sidearm', keys: ['G'] },
    ],
  },
  {
    category: 'Base Construction',
    items: [
      { action: 'Open Build Menu', keys: ['B'] },
      { action: 'Radial Quick Picker', keys: ['X'] },
      { action: 'Rotate Placed Piece', keys: ['R'] },
      { action: 'Place Another Piece', keys: ['LMB'], note: 'Continuous build' },
      { action: 'Exit Build Mode', keys: ['Esc'], note: 'or RMB' },
    ],
  },
  {
    category: 'Hotbar & System',
    items: [
      { action: 'Hotbar Selection', keys: ['1', '…', '9'] },
      { action: 'Planetary Grid / Consensus', keys: ['P'], note: 'or HUD pill' },
      { action: 'Close Window / Cancel', keys: ['Esc'] },
      { action: 'Toggle HUD Telemetry', keys: ['F1'] },
      { action: 'Undo / Redo', keys: ['Ctrl', 'Z'] },
    ],
  },
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
    <section className="controls-list" aria-label="Controls Keymap">
      <h4>Categorized Keybindings</h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginTop: '10px',
        }}
      >
        {CATEGORIZED_CONTROLS.map((grp) => (
          <div
            key={grp.category}
            style={{
              background: 'rgba(8, 14, 24, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px 14px',
            }}
          >
            <h5
              style={{
                margin: '0 0 10px 0',
                font: '600 12px/1 Oxanium, monospace',
                color: '#3dc8ff',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {grp.category}
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {grp.items.map((it) => (
                <div
                  key={it.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                  }}
                >
                  <span>{it.action}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {it.keys.map((k) => (
                      <kbd
                        key={k}
                        style={{
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          font: '600 11px/1 Oxanium, monospace',
                          color: '#f8fafc',
                          boxShadow: '0 2px 0 rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                    {it.note ? (
                      <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '2px' }}>
                        {it.note}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="hint" role="status" style={{ marginTop: '12px' }}>
        Mouse capture:{' '}
        {cap.supported
          ? cap.on
            ? 'Active (click world to refocus).'
            : 'Available (click world to capture pointer).'
          : 'Not supported in this browser environment.'}
      </p>
    </section>
  );
}
