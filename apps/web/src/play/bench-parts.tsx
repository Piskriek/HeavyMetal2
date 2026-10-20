// The preset bench's Parts page (TICKET-32; ARGO_NOTE_34 section 3): pick a Shape Press part, move its sliders, give
// each slot a material, toggle up to six one-click operators, and print it onto a blank. The printed cartridge goes in
// the beam rifle; Apply then puts the part onto whatever part it is fired at. The Studio's Parts workspace is the deep
// version of this page.
import React, { useMemo, useState } from 'react';
import type { PartSpec } from '@hm/cartlab';
import { GENERATORS, resolveParams } from '@hm/partgen';
import { BENCH_OPERATORS, PART_COSTS, partName } from './part-cartridge';
import { DEFAULT_SLOT_MATERIAL, formatValue, PART_SWATCHES, swatchName } from './part-swatches';
import './bench-parts.css';

export interface BenchPartsProps {
  /** Whether printing this part can start now, and why not (the bench, the blank, the power, the cost). */
  readonly check: (spec: PartSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: PartSpec) => void;
}

export const BenchParts: React.FC<BenchPartsProps> = ({ check, onPrint }) => {
  const [gen, setGen] = useState('bolt');
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [slots, setSlots] = useState<Record<string, Record<string, string>>>({});
  const [ops, setOps] = useState<readonly string[]>([]);

  const g = GENERATORS[gen] ?? GENERATORS.bolt!;
  const params = useMemo(() => resolveParams(g.params, values[gen] ?? {}), [g, values, gen]);
  const slotMaterials = useMemo(
    () => slots[gen] ?? Object.fromEntries(g.slots.map((s) => [s, DEFAULT_SLOT_MATERIAL[s] ?? 'paint'])),
    [slots, gen, g],
  );
  const spec: PartSpec = useMemo(() => {
    const base = { gen, params, slotMaterials, ops: ops.map((op) => ({ op, params: {} })) };
    return { ...base, name: partName(base, swatchName) };
  }, [gen, params, slotMaterials, ops]);
  const can = check(spec);
  const cost = PART_COSTS[gen] ?? { vtx: 20, pxd: 15 };

  return (
    <div className="bench-parts" data-testid="bench-parts">
      <div className="play-carts">
        <h4>2. Pick a part</h4>
        <div className="bench-parts-gens">
          {Object.values(GENERATORS).map((x) => (
            <button key={x.id} className={gen === x.id ? 'on' : ''} onClick={() => setGen(x.id)} data-testid={`bench-gen-${x.id}`}>
              <b>{x.label}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="play-carts">
        <h4>3. Shape it</h4>
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
                onClick={() => setOps((list) => (on ? list.filter((x) => x !== o.op) : [...list, o.op]))}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="play-carts">
        <h4>4. Give it materials</h4>
        {g.slots.map((slot) => (
          <div key={slot} className="bench-parts-row">
            <span>{slot[0]!.toUpperCase() + slot.slice(1)}</span>
            <span className="bench-parts-swatches" role="radiogroup" aria-label={`${slot} material`}>
              {PART_SWATCHES.map((s) => (
                <button key={s.id} role="radio" aria-checked={slotMaterials[slot] === s.id} title={s.name} aria-label={s.name}
                  style={{ background: s.color }} data-testid={`bench-mat-${slot}-${s.id}`}
                  onClick={() => setSlots((all) => ({ ...all, [gen]: { ...slotMaterials, [slot]: s.id } }))} />
              ))}
            </span>
          </div>
        ))}
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b>. Printing costs {cost.vtx} raw vertices and {cost.pxd} raw pixels, from your pack or the linked bins.
      </p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(spec)} data-testid="bench-print">Start printing</button>
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
