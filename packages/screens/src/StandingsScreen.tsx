import type { ReactElement } from 'react';
import { GoblinFace } from './GoblinFace';
import { rootClass } from './styles';
import type { StandingRow } from './types';

/** Points first, then wins, then name: the order of the championship table. */
export function sortStandings(rows: readonly StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

export function StandingsScreen(props: { rows: readonly StandingRow[]; raceIndex: number; raceCount: number; onContinue: () => void; playerId?: string; final?: boolean; reducedMotion?: boolean }): ReactElement {
  const rows = sortStandings(props.rows);
  const lead = rows[0]?.points ?? 0;
  return (
    <div className={rootClass('dim', props.reducedMotion)} data-screen="standings" style={{ justifyContent: 'flex-start' }}>
      {props.final && rows[0] ? (
        <div className="hms-col" data-field="champion">
          <GoblinFace color={rows[0].color} accent="#ffd24a" size={84} />
          <h2 style={{ color: 'var(--a)' }}>Champion!</h2>
          <p style={{ fontWeight: 800, fontSize: 20 }}>{rows[0].name}</p>
        </div>
      ) : <h2>Standings after race {props.raceIndex + 1} of {props.raceCount}</h2>}
      <table>
        <thead><tr><th>#</th><th>Goblin</th><th style={{ textAlign: 'right' }}>Points</th><th style={{ textAlign: 'right' }}>Gap</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} data-me={r.id === props.playerId ? 'true' : undefined}>
              <td>{i + 1}</td>
              <td><span className="hms-dot" style={{ background: r.color }} />{r.name}<div className="hms-meter"><b style={{ width: `${lead > 0 ? (r.points / lead) * 100 : 0}%` }} /></div></td>
              <td style={{ textAlign: 'right' }}><b>{r.points}</b></td>
              <td style={{ textAlign: 'right', color: 'var(--d)' }}>{i === 0 ? '' : `-${lead - r.points}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="hms-btn go" data-action="continue" onClick={props.onContinue}>{props.final ? 'Finish' : 'Next race'}</button>
    </div>
  );
}
