// The preset bench's Lights page (plan 39 section 6, Lx): named lights first, then the light tuned: a colour temperature
// on a warm-to-cool track, or a signal colour as a separate mode (never both at once), an intensity and a pattern. The
// cartridge goes in the beam rifle; Apply sets the lamp it is fired at (a hold, every lamp on the machine). Same
// vocabulary as the Parts and Species pages, and the same previews rule: a live lamp lighting a floor, the presets as
// glowing balls, and hover to try any choice on.
import React, { useMemo, useState } from 'react';
import type { LightPattern, LightSpec } from '@hm/cartlab';
import { LIGHT_PATTERNS } from '@hm/cartlab';
import { KELVIN_MAX, KELVIN_MIN, kelvinHex, LIGHT_PRESETS, lightHex, lightSpecName, PATTERN_LABEL } from './light-presets';
import { LightPreview } from './light-preview';
import type { MyPreset } from './my-presets';
import './bench-parts.css';

export interface BenchLightsProps {
  /** Whether printing this light can start now, and why not (the bench, the blank, the power). */
  readonly check: (spec: LightSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: LightSpec) => void;
  readonly printLabel?: string;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
  /** The player's saved lights ("Yours", plan 39 section 7), offered after the named lights. */
  readonly mine?: readonly MyPreset[];
  /** Keeps the current light in the player's presets. */
  readonly onSave?: (spec: LightSpec) => void;
}

/** Signal colours for the second mode: the game's own plume and status colours. */
const SIGNALS: readonly { readonly hex: string; readonly name: string }[] = [
  { hex: '#ff3b3b', name: 'Alarm red' }, { hex: '#ffb02a', name: 'Amber' }, { hex: '#ffe14d', name: 'Yellow' },
  { hex: '#3eff8b', name: 'Status green' }, { hex: '#2ad1ff', name: 'Cyan' }, { hex: '#3b6bff', name: 'Blue' },
  { hex: '#b46bff', name: 'Violet' }, { hex: '#ff4fd8', name: 'Pink' },
];

/** A light drawn as a small glowing ball: its colour bright at the centre, falling off, with a halo. */
const glowBall = (hex: string): React.CSSProperties => ({
  background: `radial-gradient(circle at 50% 45%, #ffffff 0%, ${hex} 38%, rgba(0, 0, 0, 0.55) 100%)`,
  boxShadow: `0 0 10px ${hex}`,
});

/** The Kelvin slider's track: the black-body colours from warm to cool. */
const KELVIN_TRACK = `linear-gradient(90deg, ${[1500, 2500, 3500, 4500, 5500, 6500, 7500, 9000].map((k) => kelvinHex(k)).join(', ')})`;

/** What the player is trying on: another named light, another pattern, or another signal colour. */
type Trial = { readonly label: string; readonly preset?: string; readonly pattern?: LightPattern; readonly colour?: string; readonly spec?: LightSpec };

const withName = (l: Omit<LightSpec, 'name'>): LightSpec => ({ ...l, name: lightSpecName(l) });

export const BenchLights: React.FC<BenchLightsProps> = ({ check, onPrint, printLabel = 'Start printing', firstStep = 2, mine = [], onSave }) => {
  const [presetId, setPresetId] = useState('sodium-amber');
  const [light, setLight] = useState<Omit<LightSpec, 'name'>>(() => {
    const p = LIGHT_PRESETS[0]!;
    return { kelvin: p.kelvin, colour: p.colour, intensity: p.intensity, pattern: p.pattern };
  });
  const [trial, setTrial] = useState<Trial | null>(null);
  const spec = useMemo(() => withName(light), [light]);
  const shown = useMemo(() => {
    if (!trial) return spec;
    if (trial.spec) return trial.spec;
    const p = trial.preset ? LIGHT_PRESETS.find((x) => x.id === trial.preset) : undefined;
    if (p) return p;
    return withName({ ...light, ...(trial.pattern ? { pattern: trial.pattern } : {}), ...(trial.colour ? { colour: trial.colour } : {}) });
  }, [trial, spec, light]);
  const can = check(spec);
  const signal = light.colour !== null;
  const mineSpecs = mine.flatMap((p) => ('light' in p.print ? [{ id: p.id, spec: p.print.light }] : []));
  const tryOn = (t: Trial) => ({
    onMouseEnter: () => setTrial(t),
    onMouseLeave: () => setTrial(null),
    onFocus: () => setTrial(t),
    onBlur: () => setTrial(null),
  });
  const set = (patch: Partial<Omit<LightSpec, 'name'>>): void => { setTrial(null); setLight((l) => ({ ...l, ...patch })); };

  return (
    <div className="bench-parts bench-lights" data-testid="bench-lights">
      <div className="play-carts">
        <h4>{firstStep}. Pick a light</h4>
        <div className="bench-parts-gens">
          {LIGHT_PRESETS.map((p) => (
            <button key={p.id} className={presetId === p.id ? 'on' : ''} data-testid={`bench-light-${p.id}`}
              onClick={() => { setTrial(null); setPresetId(p.id); setLight({ kelvin: p.kelvin, colour: p.colour, intensity: p.intensity, pattern: p.pattern }); }}
              {...(presetId === p.id ? {} : tryOn({ label: p.name.toLowerCase(), preset: p.id }))}>
              <i aria-hidden="true" className="bench-light-ball" style={glowBall(lightHex(p))} />
              <b>{p.name}</b>
            </button>
          ))}
        </div>
        {mineSpecs.length > 0 ? (
          <>
            <p className="bench-parts-yours">Yours</p>
            <div className="bench-parts-gens">
              {mineSpecs.map((m) => (
                <button key={m.id} data-testid={`bench-mine-${m.id}`} {...tryOn({ label: m.spec.name.toLowerCase(), spec: m.spec })}
                  onClick={() => { setTrial(null); setPresetId(m.id); setLight({ kelvin: m.spec.kelvin, colour: m.spec.colour, intensity: m.spec.intensity, pattern: m.spec.pattern }); }}>
                  <i aria-hidden="true" className="bench-light-ball" style={glowBall(lightHex(m.spec))} />
                  <b>{m.spec.name}</b>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="play-carts">
        <h4>{firstStep + 1}. Tune it</h4>
        <LightPreview spec={shown} trying={trial?.label ?? null} />
        <div className="bench-parts-choices bench-light-mode" role="group" aria-label="Colour by">
          <button className={!signal ? 'on' : ''} aria-pressed={!signal} data-testid="bench-light-mode-kelvin"
            onClick={() => set({ colour: null })}>Temperature</button>
          <button className={signal ? 'on' : ''} aria-pressed={signal} data-testid="bench-light-mode-signal"
            onClick={() => set({ colour: light.colour ?? SIGNALS[1]!.hex })}>Signal colour</button>
        </div>
        {!signal ? (
          <label className="bench-parts-row">
            <span>Temperature</span>
            <output>{Math.round(light.kelvin)} K</output>
            <input type="range" className="bench-kelvin" min={KELVIN_MIN} max={KELVIN_MAX} step={100} value={light.kelvin}
              style={{ background: KELVIN_TRACK }} data-testid="bench-light-kelvin"
              onChange={(e) => set({ kelvin: Number(e.currentTarget.value) })} />
          </label>
        ) : (
          <div className="bench-parts-row">
            <span>Signal</span>
            <span className="bench-parts-swatches" role="radiogroup" aria-label="Signal colour">
              {SIGNALS.map((c) => (
                <button key={c.hex} role="radio" aria-checked={light.colour === c.hex} title={c.name} aria-label={c.name}
                  style={glowBall(c.hex)} data-testid={`bench-light-signal-${c.hex.slice(1)}`}
                  {...(light.colour === c.hex ? {} : tryOn({ label: c.name.toLowerCase(), colour: c.hex }))}
                  onClick={() => set({ colour: c.hex })} />
              ))}
            </span>
          </div>
        )}
        <label className="bench-parts-row">
          <span>Intensity</span>
          <output>{light.intensity.toFixed(1)}x</output>
          <input type="range" min={0.2} max={3} step={0.1} value={light.intensity} data-testid="bench-light-intensity"
            onChange={(e) => set({ intensity: Number(e.currentTarget.value) })} />
        </label>
        <div className="bench-parts-ops" role="radiogroup" aria-label="Pattern">
          {LIGHT_PATTERNS.map((pt) => (
            <button key={pt} role="radio" aria-checked={light.pattern === pt} className={light.pattern === pt ? 'on' : ''}
              data-testid={`bench-light-pattern-${pt}`}
              {...(light.pattern === pt ? {} : tryOn({ label: PATTERN_LABEL[pt].toLowerCase(), pattern: pt }))}
              onClick={() => set({ pattern: pt })}>
              {PATTERN_LABEL[pt]}
            </button>
          ))}
        </div>
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>A light takes a blank and the bench's time, like a written material.
      </p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(spec)} data-testid="bench-print-light">{printLabel}</button>
        {onSave ? <button onClick={() => onSave(spec)} data-testid="bench-save-light">Save as preset</button> : null}
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
