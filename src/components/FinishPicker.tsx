/**
 * Picks where a race on the island ends: the full run down to the sea, or a finish line placed in
 * build mode. The island map shows every finish as a numbered marker; the list beside it names
 * them. Choosing on either one chooses on both.
 */
import { useMemo, type KeyboardEvent } from 'react';
import { Flag } from 'lucide-react';
import { courseMarks, roadPointAt, type CourseFinish } from '../game/race-marks';
import { readIslandProps, readIslandTracks, setActiveIslandTrack } from '../game/island-route/island-props-storage';
import { FINISH, START_X } from '../game/scene';
import type { RaceFinish } from '../game/session';

/** The island map image covers world x and z from −MAP_HALF to +MAP_HALF (north is −z, up). */
export const ISLAND_MAP_URL = '/art/island/island-map.jpg';
export const MAP_HALF = 48000;
export const mapPercent = (w: { x: number; z: number }) => ({
  left: `${((w.x + MAP_HALF) / (2 * MAP_HALF)) * 100}%`,
  top: `${((w.z + MAP_HALF) / (2 * MAP_HALF)) * 100}%`,
});

interface FinishPickerProps {
  /** The picked finish; null is the full run to the sea. */
  value: RaceFinish | null;
  onChange: (finish: RaceFinish | null) => void;
  /** Shows the island track picker (New Game), or not (between cup rounds: the cup's track is fixed). */
  trackPicker?: boolean;
  /** Called after the island track changed (the finishes are that track's own). */
  onTrackChange?: () => void;
  /** Show this island track's finishes instead of the active track's (the event designer's rounds). */
  trackId?: string;
}

/** A race's share of the full run, as the player reads it. */
const lengthLabel = (share: number) => share >= 0.995 ? 'Full run' : `${Math.round(share * 100)}% of the run`;

function radioKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  if (!items.length) return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : (Math.max(0, current) + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next].click(); items[next].focus();
}

export default function FinishPicker({ value, onChange, trackPicker = false, onTrackChange, trackId }: FinishPickerProps) {
  const tracks = readIslandTracks();
  const shown = trackId ?? tracks.active;
  const marks = useMemo(() => courseMarks(readIslandProps(undefined, shown), 'basalt'), [shown]);
  const seaEnd = useMemo(() => roadPointAt('basalt', FINISH), []);
  const start = marks.startWorld ?? roadPointAt('basalt', START_X);
  const options: (CourseFinish | null)[] = [...marks.finishes, null];
  const selected = (f: CourseFinish | null) => (f === null ? value === null : value !== null && Math.abs(value.x - f.x) < 1);
  const pick = (f: CourseFinish | null) => onChange(f ? { x: f.x, name: f.name } : null);

  return (
    <div className="finish-picker">
      {trackPicker && tracks.tracks.length > 1 && (
        <label className="finish-track">
          <span>Island track</span>
          <select
            value={tracks.active}
            onChange={(e) => { setActiveIslandTrack(e.target.value); onChange(null); onTrackChange?.(); }}
          >
            {tracks.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      <div className="finish-body">
        <div className="finish-map" aria-hidden="true">
          <img src={ISLAND_MAP_URL} alt="" />
          <span className="finish-marker start" style={mapPercent(start)}>S</span>
          {options.map((f, i) => (
            <button
              key={f?.id ?? 'sea'}
              tabIndex={-1}
              className={`finish-marker ${f ? '' : 'sea'} ${selected(f) ? 'selected' : ''}`}
              style={mapPercent(f ? f.world : seaEnd)}
              onClick={() => pick(f)}
            >
              {f ? i + 1 : <Flag size={11} />}
            </button>
          ))}
        </div>
        <div className="finish-list" role="radiogroup" aria-label="Choose where the race ends" onKeyDown={radioKeys}>
          {options.map((f, i) => (
            <button
              key={f?.id ?? 'sea'}
              role="radio"
              aria-checked={selected(f)}
              tabIndex={selected(f) ? 0 : -1}
              className={`finish-option ${selected(f) ? 'selected' : ''}`}
              onClick={() => pick(f)}
            >
              <span className="finish-number">{f ? i + 1 : <Flag size={12} />}</span>
              <span className="finish-text">
                <strong>{f ? f.name : 'Down to the sea'}</strong>
                <small>{f ? lengthLabel(f.share) : 'Full run, summit to the lagoon'}</small>
              </span>
            </button>
          ))}
          {!marks.finishes.length && (
            <p className="finish-empty">Place Finish Lines on the island in the 3D Map Editor (Race shelf) to race shorter runs.</p>
          )}
        </div>
      </div>
    </div>
  );
}
