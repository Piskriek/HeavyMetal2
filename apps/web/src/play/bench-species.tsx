// The preset bench's Species page (plan 39 section 6, Aq): pick a named tree, shape it with the treegen sliders, choose
// its canopy, and print it onto a blank. The cartridge goes in the beam rifle; Apply regrows the tree it is fired at (a
// hold, every tree of that kind nearby). Same vocabulary as the Parts page, and the same previews rule: a live tree, the
// presets as thumbnails, the canopy palette as coloured balls, and hover to try any of them on.
import React, { useMemo, useState } from 'react';
import type { SpeciesSpec } from '@hm/cartlab';
import { TREE_PARAM_SPECS, type Species } from '@hm/treegen';
import { CANOPY_TINTS } from './plot-biome-view';
import { CANOPY_NAMES, formatTreeValue, SPECIES_PRESETS, speciesSpec } from './species-presets';
import { SpeciesPreview, useSpeciesThumbs } from './species-preview';
import { materialBall } from './part-swatches';
import './bench-parts.css';

export interface BenchSpeciesProps {
  /** Whether printing this species can start now, and why not (the bench, the blank, the power). */
  readonly check: (spec: SpeciesSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: SpeciesSpec) => void;
  readonly printLabel?: string;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
}

/** What the player is trying on: another named tree, or another canopy. */
type Trial = { readonly label: string; readonly preset?: string; readonly tint?: number };

const SLIDERS = TREE_PARAM_SPECS.filter((s) => s.unit !== 'choice');
const TINT = TREE_PARAM_SPECS.find((s) => s.key === 'tint');
const canopyBall = (i: number): string => {
  const c = CANOPY_TINTS[i] ?? [0.25, 0.52, 0.2];
  const hex = `#${c.map((x) => Math.round(Math.min(1, x * 1.2) * 255).toString(16).padStart(2, '0')).join('')}`;
  return materialBall({ color: hex, metal: 0, rough: 0.8 });
};

export const BenchSpecies: React.FC<BenchSpeciesProps> = ({ check, onPrint, printLabel = 'Start printing', firstStep = 2 }) => {
  const [presetId, setPresetId] = useState('broadleaf-oak');
  const [species, setSpecies] = useState<Species>('oak');
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...SPECIES_PRESETS[1]!.params }));
  const [trial, setTrial] = useState<Trial | null>(null);
  const thumbs = useSpeciesThumbs();

  const spec = useMemo(() => speciesSpec(species, values), [species, values]);
  const shown = useMemo(() => {
    if (!trial) return spec;
    const p = trial.preset ? SPECIES_PRESETS.find((x) => x.id === trial.preset) : undefined;
    if (p) return speciesSpec(p.species, p.params);
    return speciesSpec(species, { ...values, ...(trial.tint !== undefined ? { tint: trial.tint } : {}) });
  }, [trial, spec, species, values]);
  const can = check(spec);
  const tryOn = (t: Trial) => ({
    onMouseEnter: () => setTrial(t),
    onMouseLeave: () => setTrial(null),
    onFocus: () => setTrial(t),
    onBlur: () => setTrial(null),
  });
  const pick = (id: string): void => {
    const p = SPECIES_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setTrial(null);
    setPresetId(id);
    setSpecies(p.species);
    setValues({ ...p.params });
  };

  return (
    <div className="bench-parts bench-species" data-testid="bench-species">
      <div className="play-carts">
        <h4>{firstStep}. Pick a tree</h4>
        <div className="bench-parts-gens">
          {SPECIES_PRESETS.map((p) => (
            <button key={p.id} className={presetId === p.id ? 'on' : ''} onClick={() => pick(p.id)} data-testid={`bench-species-${p.id}`}
              {...(presetId === p.id ? {} : tryOn({ label: p.name.toLowerCase(), preset: p.id }))}>
              {thumbs.get(p.id) ? <img src={thumbs.get(p.id)} alt="" width={40} height={40} /> : <i aria-hidden="true" />}
              <b>{p.name}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="play-carts">
        <h4>{firstStep + 1}. Shape it</h4>
        <SpeciesPreview spec={shown} trying={trial?.label ?? null} />
        <div className="bench-parts-sliders">
          {SLIDERS.map((p) => {
            const v = spec.params[p.key] ?? p.default;
            return (
              <label key={p.key} className="bench-parts-row">
                <span>{p.label}</span>
                <output>{formatTreeValue(p, v)}</output>
                <input type="range" min={p.min} max={p.max} step={p.step} value={v} data-testid={`bench-tree-${p.key}`}
                  onChange={(e) => {
                    const n = Number(e.currentTarget.value);
                    setValues((all) => ({ ...all, [p.key]: n }));
                  }} />
              </label>
            );
          })}
        </div>
      </div>

      <div className="play-carts">
        <h4>{firstStep + 2}. Give it a canopy</h4>
        <div className="bench-parts-row">
          <span>Canopy</span>
          <span className="bench-parts-swatches" role="radiogroup" aria-label="Canopy palette">
            {CANOPY_NAMES.map((name, i) => {
              const t = (TINT?.min ?? 0) + i;
              const on = Math.round(spec.params.tint ?? 0) === t;
              const label = name.replace(/-/g, ' ');
              return (
                <button key={name} role="radio" aria-checked={on} title={label} aria-label={label}
                  style={{ background: canopyBall(i) }} data-testid={`bench-canopy-${name}`}
                  {...(on ? {} : tryOn({ label: `${label} leaves`, tint: t }))}
                  onClick={() => { setTrial(null); setValues((all) => ({ ...all, tint: t })); }} />
              );
            })}
          </span>
        </div>
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>A species takes a blank and the bench's time, like a written material.
      </p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(spec)} data-testid="bench-print-species">{printLabel}</button>
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
