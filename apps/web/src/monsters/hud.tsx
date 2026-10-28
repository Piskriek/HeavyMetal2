// The monster HUD (TASK-23b-2): the player's health, a leak radar with the nearest leaks and their surge timers, the bearing a hit came
// from, and the seal bar under the crosshair. Corner panels in the game's own vocabulary (a dark glass plate with a 2 px accent
// edge). Pointer-free: nothing here covers the crosshair or a button.
import './monster-hud.css';

export interface RadarLeak {
  readonly id: number;
  /** Radians from the view: 0 is ahead, positive is to the right. */
  readonly bearing: number;
  /** Metres from the player, on the ground. */
  readonly distance: number;
  readonly state: 'dormant' | 'open' | 'warned' | 'sealed';
  /** Seconds until the next wave, when one is due (state warned). */
  readonly inSeconds: number | null;
  /** 0 to 1: how far the seal has run. */
  readonly seal: number;
  readonly dormant: boolean;
}

export interface MonsterHudProps {
  readonly hp: number;
  readonly maxHp: number;
  /** When the last hit landed (performance.now, ms); a value at or below 0 means none yet. */
  readonly hitAt: number;
  /** The last hit's bearing (radians, 0 ahead, positive to the right). */
  readonly hitBearing: number;
  /** The leaks in view (sealed ones are left out by the caller). */
  readonly radar: readonly RadarLeak[];
  /** The leak under the beam's Seal hold, and whether the player is close enough to seal it; null when none. */
  readonly seal: { readonly pct: number; readonly inReach: boolean } | null;
  /** Plan 51 wave 3: the reflex shield is up (a bridged game's threat edge raised it); hits soak most of their damage. */
  readonly shielded?: boolean;
}

/** The radar's edge, in metres: a leak beyond it sits on the rim. */
const RADAR_RANGE = 120;
/** The health bar's segments. */
const SEGMENTS = 20;
/** At or under this fraction of full health the bar turns magenta and the note appears. */
const LOW_FRACTION = 0.3;

/** A leak's blip on the radar (a 100-unit square; the centre is the player, the top is ahead). */
function blipAt(bearing: number, distance: number): { readonly x: number; readonly y: number } {
  const r = 8 + (Math.min(distance, RADAR_RANGE) / RADAR_RANGE) * 40;
  return { x: 50 + r * Math.sin(bearing), y: 50 - r * Math.cos(bearing) };
}

/** The state of a leak in the player's words. */
function stateWord(leak: RadarLeak): string {
  if (leak.state === 'warned' && leak.inSeconds !== null) return `Surge in ${Math.ceil(leak.inSeconds)} s`;
  if (leak.dormant) return 'Dormant';
  return 'Open';
}

export function MonsterHud(props: MonsterHudProps) {
  const { hp, maxHp, hitAt, hitBearing, radar, seal } = props;
  const alive = hp > 0;
  const low = alive && hp <= maxHp * LOW_FRACTION;
  const shown = Math.max(0, Math.round(hp));
  const lit = Math.ceil((Math.max(0, hp) / maxHp) * SEGMENTS);
  const nearest = [...radar].sort((a, b) => a.distance - b.distance).slice(0, 3);
  const first = nearest[0];
  const summary = first
    ? `${radar.length} leak${radar.length === 1 ? '' : 's'} in view; the nearest is ${Math.round(first.distance)} m away.`
    : 'No leaks in view.';
  const pct = seal ? Math.round(Math.max(0, Math.min(1, seal.pct)) * 100) : 0;

  return (
    <div className="mhud">
      {hitAt > 0 ? (
        // one wedge per hit: keyed by the hit's time, so each hit plays the fade again
        <div key={hitAt} className="mhud-hit" style={{ transform: `rotate(${hitBearing}rad)` }} aria-hidden="true" />
      ) : null}

      <aside className="mhud-plate mhud-radar" data-hud-zone="top-right" aria-label="Leaks">
        <svg className="mhud-scope" viewBox="0 0 100 100" role="img" aria-label={summary}>
          <circle className="ring" cx="50" cy="50" r="48" />
          <circle className="ring" cx="50" cy="50" r="24" />
          <line className="fwd" x1="50" y1="50" x2="50" y2="6" />
          {radar.map((leak) => {
            const p = blipAt(leak.bearing, leak.distance);
            const cls = leak.state === 'warned' ? 'warned' : leak.dormant ? 'dormant' : 'open';
            return (
              <g key={leak.id}>
                {leak.state === 'warned' ? <circle className="surge" cx={p.x} cy={p.y} r="4" /> : null}
                <polygon className={`blip ${cls}`} points={`${p.x},${p.y - 4} ${p.x + 4},${p.y} ${p.x},${p.y + 4} ${p.x - 4},${p.y}`} />
              </g>
            );
          })}
          <circle className="you" cx="50" cy="50" r="2.4" />
        </svg>
        <div className="mhud-leaks">
          <p className="mhud-title">Leaks</p>
          {nearest.length === 0 ? (
            <p className="mhud-none">None in reach yet.</p>
          ) : (
            <ul className="mhud-list">
              {nearest.map((leak) => (
                <li key={leak.id} className={leak.state}>
                  <b>{Math.round(leak.distance)} m</b>
                  <span>{stateWord(leak)}{leak.seal > 0 ? `, ${Math.round(leak.seal * 100)}% sealed` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className={`mhud-plate mhud-vitals${low ? ' low' : ''}${props.shielded ? ' shielded' : ''}`} data-hud-zone="bottom-right" aria-label="Health">
        <p className="mhud-title">Health</p>
        <div className="mhud-figure">
          <b>{shown}</b>
          <span>of {maxHp}</span>
        </div>
        <div className="mhud-bar" role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={shown}>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <i key={i} className={i < lit ? 'on' : ''} />
          ))}
        </div>
        {props.shielded ? <p className="mhud-shield-note">Shield up: hits do a fifth of their damage.</p> : low ? <p className="mhud-note">Low. Back off to the gate and patch up.</p> : null}
      </section>

      {seal ? (
        <div className="mhud-plate mhud-seal" data-hud-zone="centre">
          <p className="mhud-title">{seal.inReach ? `Sealing, ${pct}%` : 'Too far to seal'}</p>
          <p className="mhud-sub">{seal.inReach ? 'Keep the beam on it.' : 'Walk within 25 m of the leak.'}</p>
          <div className="mhud-seal-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
