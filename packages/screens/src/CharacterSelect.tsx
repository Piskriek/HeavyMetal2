import type { ReactElement } from 'react';
import { GoblinFace } from './GoblinFace';
import { adjustStat, budgetLeft, statBars, tradeoffText, type StatKey } from './stats';
import { rootClass } from './styles';
import type { RacerCard } from './types';

const Bars = ({ c }: { readonly c: Pick<RacerCard, 'weight' | 'speed' | 'bounce'> }): ReactElement => (
  <div style={{ display: 'grid', gap: 3 }}>
    {statBars(c).map((b) => <div className="hms-bar" key={b.label}><span style={{ textAlign: 'left', color: 'var(--d)' }}>{b.label}</span><i><b style={{ width: `${b.fraction * 100}%` }} /></i><span>{b.value}</span></div>)}
  </div>
);

/** Pick a goblin (or build your own within the 15-point budget), then race. */
export function CharacterSelect(props: {
  racers: readonly RacerCard[]; selected: string | null; onSelect: (id: string) => void; onConfirm: () => void; onBack: () => void;
  custom?: RacerCard | null; onCustomChange?: (c: RacerCard) => void; reducedMotion?: boolean;
}): ReactElement {
  const { racers, selected, custom, onCustomChange } = props;
  const all = custom ? [...racers, custom] : racers;
  const chosen = all.find((r) => r.id === selected) ?? null;
  const left = custom ? budgetLeft(custom) : 0;
  return (
    <div className={rootClass('bg', props.reducedMotion)} data-screen="select" style={{ justifyContent: 'flex-start' }}>
      <h2>Choose your goblin</h2>
      <div className="hms-grid">
        {racers.map((r) => (
          <button key={r.id} type="button" className="hms-card" data-racer={r.id} aria-pressed={selected === r.id} onClick={() => props.onSelect(r.id)}>
            <div className="hms-row" style={{ justifyContent: 'flex-start', flexWrap: 'nowrap' }}><GoblinFace color={r.color} accent={r.accent} size={46} /><span className="hms-name">{r.name}</span></div>
            <Bars c={r} />
            <span className="hms-hint" style={{ fontSize: 12 }}>{tradeoffText(r)}</span>
          </button>
        ))}
      </div>
      {chosen ? (
        <div className="hms-panel" data-panel="detail">
          <div className="hms-row" style={{ justifyContent: 'flex-start', flexWrap: 'nowrap' }}><GoblinFace color={chosen.color} accent={chosen.accent} size={64} /><div><h3>{chosen.name}</h3><p className="hms-hint">{chosen.blurb ?? tradeoffText(chosen)}</p></div></div>
          <div style={{ marginTop: 10 }}><Bars c={chosen} /></div>
        </div>
      ) : <p className="hms-hint">Tap a goblin to see what it is good at.</p>}
      {custom && onCustomChange ? (
        <div className="hms-panel" data-panel="custom">
          <div className="hms-row" style={{ justifyContent: 'space-between' }}>
            <h3>Build your own</h3>
            <button type="button" className="hms-card" data-racer={custom.id} aria-pressed={selected === custom.id} onClick={() => props.onSelect(custom.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><GoblinFace color={custom.color} accent={custom.accent} size={34} /> Use it</button>
          </div>
          {(['weight', 'speed', 'bounce'] as StatKey[]).map((k) => (
            <div className="hms-toggle" key={k}>
              <span style={{ textTransform: 'capitalize' }}>{k}</span>
              <span className="hms-row" style={{ flexWrap: 'nowrap' }}>
                <button type="button" className="hms-btn quiet" data-stat={k} data-delta="-1" aria-label={`less ${k}`} onClick={() => onCustomChange(adjustStat(custom, k, -1))}>−</button>
                <b style={{ minWidth: 24, textAlign: 'center' }}>{custom[k]}</b>
                <button type="button" className="hms-btn quiet" data-stat={k} data-delta="1" aria-label={`more ${k}`} onClick={() => onCustomChange(adjustStat(custom, k, 1))}>+</button>
              </span>
            </div>
          ))}
          <p data-field="budget" style={{ color: left === 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 700 }}>{left} point{left === 1 ? '' : 's'} left</p>
          <div className="hms-row" style={{ justifyContent: 'flex-start' }}>
            <label className="hms-hint">Body <input type="color" value={custom.color} onChange={(e) => onCustomChange({ ...custom, color: e.target.value })} /></label>
            <label className="hms-hint">Headband <input type="color" value={custom.accent} onChange={(e) => onCustomChange({ ...custom, accent: e.target.value })} /></label>
          </div>
        </div>
      ) : null}
      <div className="hms-row">
        <button type="button" className="hms-btn quiet" data-action="back" onClick={props.onBack}>Back</button>
        <button type="button" className="hms-btn go" data-action="confirm" disabled={selected === null} aria-disabled={selected === null ? true : undefined} onClick={props.onConfirm}>Race!</button>
      </div>
    </div>
  );
}
