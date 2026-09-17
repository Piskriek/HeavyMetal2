import type { RacerStanding } from '../game/types';

export default function RaceStandings({ racers, ready = false }: { racers: RacerStanding[]; ready?: boolean }) {
  const player = racers.find((racer) => racer.id === 0);
  return (
    <div className="race-standings" aria-label="Live race standings">
      <span className="standings-caption">{ready ? 'THE STARTING FOUR' : 'THE PACK'}</span>
      <ol>
        {(ready ? [...racers].sort((a, b) => a.lane - b.lane) : racers).map((racer) => {
          const gap = Math.round(racer.distance - (player?.distance ?? 0));
          const detail = ready ? (racer.id ? 'CPU' : 'PLAYER') : racer.finished ? 'FINISHED' : racer.recovering ? 'RECOVERING' : !racer.id ? 'YOU' : `${gap > 0 ? '+' : ''}${gap.toLocaleString('en-US')} m`;
          return (
            <li key={racer.id} className={racer.id === 0 ? 'player-standing' : ''}>
              <span className="standing-position">{ready ? racer.lane + 1 : racer.position}</span>
              <i style={{ backgroundColor: racer.color }} />
              <strong style={{ color: racer.color }}>{racer.name}</strong>
              <span className="standing-detail">{detail}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}