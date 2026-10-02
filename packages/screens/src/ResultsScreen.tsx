import type { ReactElement } from 'react';
import { GoblinFace } from './GoblinFace';
import { rootClass } from './styles';
import type { ResultRow } from './types';

/** m:ss.mmm; anything that is not a sensible time shows dashes. */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--:--.---';
  const t = Math.floor(ms);
  return `${Math.floor(t / 60000)}:${String(Math.floor(t / 1000) % 60).padStart(2, '0')}.${String(t % 1000).padStart(3, '0')}`;
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st ... */
export function ordinal(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  const last = n % 10, teens = n % 100;
  return `${n}${teens >= 11 && teens <= 13 ? 'th' : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`;
}

/** The podium in display order: second, first, third (a lone winner stands alone). */
export function podiumOrder(rows: readonly ResultRow[]): ResultRow[] {
  const by = [...rows].filter((r) => !r.dnf).sort((a, b) => a.position - b.position).slice(0, 3);
  if (by.length < 2) return by;
  return by.length === 2 ? [by[1]!, by[0]!] : [by[1]!, by[0]!, by[2]!];
}

export function ResultsScreen(props: { rows: readonly ResultRow[]; onContinue: () => void; onRestart?: () => void; continueLabel?: string; title?: string; reducedMotion?: boolean }): ReactElement {
  const rows = [...props.rows].sort((a, b) => (a.dnf ? 1 : 0) - (b.dnf ? 1 : 0) || a.position - b.position);
  const podium = podiumOrder(rows);
  return (
    <div className={rootClass('dim', props.reducedMotion)} data-screen="results" style={{ justifyContent: 'flex-start' }}>
      <h2>{props.title ?? 'Race results'}</h2>
      <div className="hms-pod">
        {podium.map((r) => (
          <div key={r.id} data-podium={String(r.position)}>
            <GoblinFace color={r.color} accent="#ffd24a" size={r.position === 1 ? 60 : 46} />
            <span className="hms-name">{r.name}</span>
            <span className="hms-hint">{r.timeMs !== undefined ? formatTime(r.timeMs) : ''}</span>
            <div className="blk">{r.position}</div>
          </div>
        ))}
      </div>
      <table>
        <thead><tr><th>Pos</th><th>Goblin</th><th style={{ textAlign: 'right' }}>Time</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-me={r.isPlayer ? 'true' : undefined}>
              <td>{r.dnf ? '–' : ordinal(r.position)}</td>
              <td><span className="hms-dot" style={{ background: r.color }} />{r.name}{r.pointsGained ? <b style={{ color: 'var(--ok)', marginLeft: 8 }}>+{r.pointsGained}</b> : null}</td>
              <td style={{ textAlign: 'right' }}>{r.dnf ? 'DNF' : formatTime(r.timeMs ?? NaN)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hms-row">
        {props.onRestart ? <button type="button" className="hms-btn" data-action="restart" onClick={props.onRestart}>Race again</button> : null}
        <button type="button" className="hms-btn go" data-action="continue" onClick={props.onContinue}>{props.continueLabel ?? 'Continue'}</button>
      </div>
    </div>
  );
}
