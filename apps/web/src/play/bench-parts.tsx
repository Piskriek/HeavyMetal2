// The preset bench's Parts page (TICKET-32; ARGO_NOTE_34 section 3): pick a Shape Press part, move its sliders, give
// each slot a material, toggle up to six one-click operators, and print it onto a blank. The printed cartridge goes in
// the beam rifle; Apply then puts the part onto whatever part it is fired at. The Studio's Parts workspace is the deep
// version of this page.
// Previews drive play (the owner, 2026-10-20): the live view shows the part as set, and hovering or focusing a part, an
// operator or a material tries it on there at once; leaving puts it back, a click keeps it. The part chips carry
// thumbnails and the materials are drawn as lit balls, so every choice shows what it would do before it is made.
import React, { useMemo, useState } from 'react';
import type { PartSpec } from '@hm/cartlab';
import { GENERATORS, resolveParams } from '@hm/partgen';
import { BENCH_OPERATORS, PART_COSTS, partName } from './part-cartridge';
import { DEFAULT_SLOT_MATERIAL, formatValue, materialBall, PART_SWATCHES, swatchName } from './part-swatches';
import { PartPreview, usePartThumbs } from './part-preview';
import './bench-parts.css';

export interface BenchPartsProps {
  /** Whether printing this part can start now, and why not (the bench, the blank, the power, the cost). */
  readonly check: (spec: PartSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: PartSpec) => void;
  /** The print button's words: the lab bench starts a timed print, the planet's Drafting Table prints at once. */
  readonly printLabel?: string;
  /** A side column's foot (where the blank comes from): the preview, the part's name, its cost and Print go above it. */
  readonly side?: React.ReactNode;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
}

/** What the player is trying on: another part, an operator toggled, or a material in one slot. */
type Trial = { readonly label: string; readonly gen?: string; readonly op?: string; readonly slot?: string; readonly mat?: string };

export const BenchParts: React.FC<BenchPartsProps> = ({ check, onPrint, printLabel = 'Start printing', side, firstStep = 2 }) => {
  const [gen, setGen] = useState('bolt');
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [slots, setSlots] = useState<Record<string, Record<string, string>>>({});
  const [ops, setOps] = useState<readonly string[]>([]);
  const [trial, setTrial] = useState<Trial | null>(null);
  const thumbs = usePartThumbs();

  /** The cartridge for a generator with its own sliders and materials, the given operators and one slot's material swapped. */
  const specOf = (id: string, opList: readonly string[], swap?: { readonly slot: string; readonly mat: string }): PartSpec => {
    const gg = GENERATORS[id] ?? GENERATORS.bolt!;
    const params = resolveParams(gg.params, values[id] ?? {});
    const set = slots[id] ?? Object.fromEntries(gg.slots.map((s) => [s, DEFAULT_SLOT_MATERIAL[s] ?? 'paint']));
    const slotMaterials = swap ? { ...set, [swap.slot]: swap.mat } : set;
    const base = { gen: gg.id, params, slotMaterials, ops: opList.map((op) => ({ op, params: {} })) };
    return { ...base, name: partName(base, swatchName) };
  };
  const g = GENERATORS[gen] ?? GENERATORS.bolt!;
  const spec = useMemo(() => specOf(gen, ops), [gen, ops, values, slots]);
  const params = spec.params;
  const slotMaterials = spec.slotMaterials;
  const shown = useMemo(() => {
    if (!trial) return spec;
    const opList = trial.op ? (ops.includes(trial.op) ? ops.filter((x) => x !== trial.op) : [...ops, trial.op]) : ops;
    return specOf(trial.gen ?? gen, opList, trial.slot && trial.mat ? { slot: trial.slot, mat: trial.mat } : undefined);
  }, [trial, spec, ops, gen, values, slots]);
  const can = check(spec);
  const cost = PART_COSTS[gen] ?? { vtx: 20, pxd: 15 };
  const preview = <PartPreview spec={shown} trying={trial?.label ?? null} />;
  /** Hover or focus tries a choice on in the preview; leaving puts the part back as set. */
  const tryOn = (t: Trial) => ({
    onMouseEnter: () => setTrial(t),
    onMouseLeave: () => setTrial(null),
    onFocus: () => setTrial(t),
    onBlur: () => setTrial(null),
  });

  const sections = (
    <>
      <div className="play-carts">
        <h4>{firstStep}. Pick a part</h4>
        <div className="bench-parts-gens">
          {Object.values(GENERATORS).map((x) => (
            <button key={x.id} className={gen === x.id ? 'on' : ''} onClick={() => { setTrial(null); setGen(x.id); }} data-testid={`bench-gen-${x.id}`}
              {...(gen === x.id ? {} : tryOn({ label: x.label.toLowerCase(), gen: x.id }))}>
              {thumbs.get(x.id) ? <img src={thumbs.get(x.id)} alt="" width={40} height={40} /> : <i aria-hidden="true" />}
              <b>{x.label}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="play-carts">
        <h4>{firstStep + 1}. Shape it</h4>
        {side ? null : preview}
        <div className="bench-parts-sliders">
          {g.params.map((p) => {
            const v = params[p.key] ?? p.default;
            if (p.unit === 'choice') {
              return (
                <div key={p.key} className="bench-parts-row">
                  <span>{p.label}</span>
                  <span className="bench-parts-choices">
                    {(p.choices ?? []).map((c, i) => (
                      <button key={c} className={v === p.min + i ? 'on' : ''} onClick={() => setValues((all) => ({ ...all, [gen]: { ...(all[gen] ?? {}), [p.key]: p.min + i } }))}>{c}</button>
                    ))}
                  </span>
                </div>
              );
            }
            return (
              <label key={p.key} className="bench-parts-row">
                <span>{p.label}</span>
                <output>{formatValue(p, v)}</output>
                <input type="range" min={p.min} max={p.max} step={p.step} value={v} data-testid={`bench-param-${p.key}`}
                  onChange={(e) => {
                    const n = Number(e.currentTarget.value);
                    setValues((all) => ({ ...all, [gen]: { ...(all[gen] ?? {}), [p.key]: n } }));
                  }} />
              </label>
            );
          })}
        </div>
        <div className="bench-parts-ops" role="group" aria-label="One-click shaping">
          {BENCH_OPERATORS.map((o) => {
            const on = ops.includes(o.op);
            return (
              <button key={o.op} className={on ? 'on' : ''} aria-pressed={on} data-testid={`bench-op-${o.op}`}
                {...tryOn({ label: on ? `without ${o.label.toLowerCase()}` : o.label.toLowerCase(), op: o.op })}
                onClick={() => { setTrial(null); setOps((list) => (on ? list.filter((x) => x !== o.op) : [...list, o.op])); }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="play-carts">
        <h4>{firstStep + 2}. Give it materials</h4>
        {g.slots.map((slot) => (
          <div key={slot} className="bench-parts-row">
            <span>{slot[0]!.toUpperCase() + slot.slice(1)}</span>
            <span className="bench-parts-swatches" role="radiogroup" aria-label={`${slot} material`}>
              {PART_SWATCHES.map((s) => (
                <button key={s.id} role="radio" aria-checked={slotMaterials[slot] === s.id} title={s.name} aria-label={s.name}
                  style={{ background: materialBall(s) }} data-testid={`bench-mat-${slot}-${s.id}`}
                  {...(slotMaterials[slot] === s.id ? {} : tryOn({ label: `${s.name.toLowerCase()} on the ${slot}`, slot, mat: s.id }))}
                  onClick={() => { setTrial(null); setSlots((all) => ({ ...all, [gen]: { ...slotMaterials, [slot]: s.id } })); }} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
  const footer = (
    <>
      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>Printing costs {cost.vtx} raw vertices and {cost.pxd} raw pixels, from your pack or the linked bins.
      </p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(spec)} data-testid="bench-print">{printLabel}</button>
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </>
  );
  // beside a side column (the planet's Drafting Table), the preview, the part's name, its cost and Print stay in view there
  return side ? (
    <div className="bench-parts with-side" data-testid="bench-parts">
      <aside className="bench-parts-side">{preview}{footer}{side}</aside>
      <div className="bench-parts-main">{sections}</div>
    </div>
  ) : (
    <div className="bench-parts" data-testid="bench-parts">{sections}{footer}</div>
  );
};
