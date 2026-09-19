import { useEffect, useRef } from 'react';
import { ArrowRight, Home, RotateCcw, Trophy } from 'lucide-react';
import { COURSES, type RunRecord } from '../game/types';
import { CUP_NAME, CUP_POINTS, cupStandings, resultField, sessionComplete, type RaceSession } from '../game/session';
import { capsuleById, riderById } from '../game/loadouts';
import Brand from './Brand';
import OrnateCorners from './OrnateCorners';
import AnimatedMenuBackground from './ui/AnimatedMenuBackground';

interface RoundResultProps {
  result: RunRecord;
  session: RaceSession;
  onContinue: () => void;
  onMenu: () => void;
  onNewGame: () => void;
}

export default function RoundResult({ result, session, onContinue, onMenu, onNewGame }: RoundResultProps) {
  const tournament = session.setup.mode === 'tournament';
  const complete = sessionComplete(session);
  const table = cupStandings(session);
  const rows = resultField(result);
  const playerCup = table.findIndex((row) => row.id === 0) + 1;
  const won = tournament && complete ? playerCup === 1 : result.completed && result.position === 1;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { container.current?.focus({ preventScroll: true }); }, [result.id]);
  return (
    <div ref={container} tabIndex={-1} className="round-result-wrap" data-painted-backdrop="true">
      <AnimatedMenuBackground preset="vault" />
      <div className="round-result" role="region" aria-label={tournament ? 'Tournament round results' : 'Race results'}>
      <OrnateCorners /><div className="round-result-heading"><Brand variant="compact" decorative /><Trophy size={35} strokeWidth={1.3} /><span>{tournament ? `${CUP_NAME.toUpperCase()} / ${complete ? 'CUP COMPLETE' : `ROUND ${session.round + 1} OF ${session.rounds.length}`}` : session.setup.customPhysics ? 'CUSTOM PHYSICS / PRACTICE RESULTS' : 'QUICK RACE / RESULTS'}</span><h2>{won ? 'A Gloriously Bad Idea.' : complete && tournament ? 'A Cup Well Contested.' : 'Another One for the Scrapbook.'}</h2><p>{tournament && complete ? `You placed ${playerCup} of 4 with ${table.find((row) => row.id === 0)?.points ?? 0} points.` : `${result.completed ? `Finished ${result.position} of 4` : 'Did not finish'} / ${result.raceTime?.toFixed(1) ?? '0'} s / ${COURSES.find((course) => course.id === result.course)?.name}`}</p></div>
      <div className="round-results-columns">
        <section><h3><img src="/art/flag-checkered.png" alt="" className="round-result-flag-img" aria-hidden="true" />{tournament ? 'This Round' : 'The Finish Line'}</h3><table className="round-table"><thead><tr><th>Place</th><th>Racer</th><th>{tournament ? 'Points' : 'Time'}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={!row.id ? 'is-player' : ''}><td>{row.finished ? row.position : 'DNF'}</td><td><i style={{ backgroundColor: row.color }} />{row.name}{!row.id && <small>YOU</small>}</td><td>{tournament ? `+${row.finished ? CUP_POINTS[row.position - 1] ?? 0 : 0}` : row.finishTime === null ? 'DNF' : `${row.finishTime.toFixed(1)}s`}</td></tr>)}</tbody></table></section>
        {tournament ? <section><h3><Trophy size={14} />{complete ? 'Final Cup Standings' : 'Cup Standings'}</h3><table className="round-table"><thead><tr><th>Rank</th><th>Racer</th><th>Total</th></tr></thead><tbody>{table.map((row, index) => <tr key={row.id} className={!row.id ? 'is-player' : ''}><td>{index + 1}</td><td><i style={{ backgroundColor: row.color }} />{row.name}{!row.id && <small>YOU</small>}</td><td>{row.points} pts</td></tr>)}</tbody></table></section> : <section className="result-loadout"><h3>Your Bad Idea</h3><strong>{riderById(session.setup.loadout.rider).name} + {capsuleById(session.setup.loadout.capsule).name}</strong><p>{result.bumps ?? 0} rival bumps<br />{result.sheep} sheep bothered<br />{result.pickups ?? 0} airborne supplies / {result.shieldsUsed ?? 0} shield blocks<br />{result.score.toLocaleString()} chaos points</p><span>{session.setup.customPhysics ? 'Practice run. Custom physics.' : 'Fixed loadout. Shared physics. No excuses.'}</span></section>}
      </div>
      {tournament && !complete && <p className="next-round-note">Up next: <strong>{COURSES.find((course) => course.id === session.rounds[session.round + 1])?.name}</strong>. Same crew. Fresh trouble.</p>}
      <div className="round-result-actions"><button className="fantasy-link" onClick={onMenu}><Home size={15} />Main menu</button><button className="fantasy-secondary" onClick={onNewGame}>New setup</button><button className="fantasy-primary" onClick={onContinue}>{tournament && !complete ? <>Next Race <ArrowRight size={17} /></> : <>{tournament ? 'Race the Cup Again' : 'Rematch'}<RotateCcw size={16} /></>}</button></div>
      </div>
    </div>
  );
}