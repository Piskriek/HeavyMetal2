/**
 * Quick Races → Create your own: design an event. Name it, set the field and the CPU challenge, then
 * lay out 1–8 rounds, each on one of the island's tracks (the lane layouts made in the 3D Map Editor)
 * and ending at one of that track's finish lines, or down to the sea.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2 } from 'lucide-react';
import FinishPicker from '../FinishPicker';
import { readIslandTracks } from '../../game/island-route/island-props-storage';
import { MAX_EVENT_ROUNDS, cleanName, eventSummary, newEventId, type CustomEvent, type EventRound } from '../../game/custom-events';
import { FIELD_SIZES, type FieldSize } from '../../game/contracts/config';
import { DIFFICULTIES, type Difficulty } from '../../game/session';

interface EventDesignerProps {
  initial?: CustomEvent | null;
  onSave: (event: CustomEvent) => string | null;
  onCancel: () => void;
}

export function blankEvent(now = Date.now()): CustomEvent {
  const tracks = readIslandTracks();
  const active = tracks.tracks.find((t) => t.id === tracks.active) ?? tracks.tracks[0];
  return {
    id: newEventId(now), name: 'My Island Cup', fieldSize: 4, difficulty: 'racer', createdAt: now, updatedAt: now,
    rounds: [{ trackId: active?.id ?? 'serpentine', trackName: active?.name ?? 'Serpentine Isle', finish: null }],
  };
}

export default function EventDesigner({ initial, onSave, onCancel }: EventDesignerProps) {
  const [event, setEvent] = useState<CustomEvent>(() => initial ? { ...initial, rounds: initial.rounds.map((r) => ({ ...r })) } : blankEvent());
  const [open, setOpen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tracks = readIslandTracks().tracks;
  const trackName = (id: string) => tracks.find((t) => t.id === id)?.name;

  const setRound = (i: number, change: Partial<EventRound>) =>
    setEvent((e) => ({ ...e, rounds: e.rounds.map((r, k) => (k === i ? { ...r, ...change } : r)) }));
  const move = (i: number, by: -1 | 1) => setEvent((e) => {
    const j = i + by;
    if (j < 0 || j >= e.rounds.length) return e;
    const rounds = [...e.rounds];
    [rounds[i], rounds[j]] = [rounds[j]!, rounds[i]!];
    setOpen(j);
    return { ...e, rounds };
  });
  const add = (copyOf?: number) => setEvent((e) => {
    if (e.rounds.length >= MAX_EVENT_ROUNDS) return e;
    const base = copyOf !== undefined ? e.rounds[copyOf]! : e.rounds[e.rounds.length - 1]!;
    setOpen(e.rounds.length);
    return { ...e, rounds: [...e.rounds, { ...base }] };
  });
  const remove = (i: number) => setEvent((e) => {
    if (e.rounds.length <= 1) return e;
    setOpen(Math.max(0, Math.min(open, e.rounds.length - 2)));
    return { ...e, rounds: e.rounds.filter((_, k) => k !== i) };
  });

  return (
    <div className="event-designer">
      <div className="event-designer-top">
        <label className="event-name"><span>Event name</span>
          <input value={event.name} maxLength={40} onChange={(e) => setEvent((x) => ({ ...x, name: e.target.value }))} onBlur={() => setEvent((x) => ({ ...x, name: cleanName(x.name) }))} />
        </label>
        <div className="event-choice"><span>Field</span>
          <div className="difficulty-options" role="radiogroup" aria-label="Field size">
            {FIELD_SIZES.map((n) => <button key={n} role="radio" aria-checked={event.fieldSize === n} className={event.fieldSize === n ? 'selected' : ''} onClick={() => setEvent((x) => ({ ...x, fieldSize: n as FieldSize }))}>{n}</button>)}
          </div>
        </div>
        <div className="event-choice"><span>CPU challenge</span>
          <div className="difficulty-options" role="radiogroup" aria-label="CPU challenge">
            {DIFFICULTIES.map((d) => <button key={d.id} role="radio" aria-checked={event.difficulty === d.id} className={event.difficulty === d.id ? 'selected' : ''} onClick={() => setEvent((x) => ({ ...x, difficulty: d.id as Difficulty }))}>{d.name}</button>)}
          </div>
        </div>
      </div>

      <div className="choice-heading"><span>ROUNDS · {eventSummary(event)}</span><button onClick={() => add()} disabled={event.rounds.length >= MAX_EVENT_ROUNDS}><Plus size={12} />Add round</button></div>
      <ol className="event-rounds">
        {event.rounds.map((round, i) => (
          <li key={i} className={`event-round ${open === i ? 'open' : ''}`}>
            <div className="event-round-head">
              <button className="event-round-title" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span className="event-round-no">{String(i + 1).padStart(2, '0')}</span>
                <strong>{trackName(round.trackId) ?? `${round.trackName} (missing)`}</strong>
                <small>{round.finish ? `Finish: ${round.finish.name}` : 'Down to the sea'}</small>
              </button>
              <div className="event-round-tools">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move round ${i + 1} up`}><ArrowUp size={13} /></button>
                <button onClick={() => move(i, 1)} disabled={i === event.rounds.length - 1} aria-label={`Move round ${i + 1} down`}><ArrowDown size={13} /></button>
                <button onClick={() => add(i)} disabled={event.rounds.length >= MAX_EVENT_ROUNDS} aria-label={`Copy round ${i + 1}`}><Copy size={13} /></button>
                <button onClick={() => remove(i)} disabled={event.rounds.length <= 1} aria-label={`Remove round ${i + 1}`}><Trash2 size={13} /></button>
              </div>
            </div>
            {open === i && (
              <div className="event-round-body">
                <label className="finish-track"><span>Island track</span>
                  <select value={round.trackId} onChange={(e) => setRound(i, { trackId: e.target.value, trackName: trackName(e.target.value) ?? e.target.value, finish: null })}>
                    {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    {!trackName(round.trackId) && <option value={round.trackId}>{round.trackName} (missing)</option>}
                  </select>
                </label>
                <FinishPicker value={round.finish} trackId={round.trackId} onChange={(finish) => setRound(i, { finish })} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {tracks.length <= 1 && <p className="setup-rule-note"><Plus size={15} /><span>More tracks: in the 3D Map Editor, <b>New</b> or <b>Duplicate</b> an island track and lay its lanes and finish lines. Each one shows up here.</span></p>}

      {error && <p className="bet-error" role="alert">{error}</p>}
      <div className="fantasy-dialog-actions">
        <button className="fantasy-link" onClick={onCancel}>Cancel</button>
        <span className="setup-progress-note">{event.rounds.length > 1 ? 'Points carry from round to round.' : 'One round: a Quick Race of your own.'}</span>
        <button className="fantasy-primary" onClick={() => setError(onSave({ ...event, name: cleanName(event.name) }))}><Check size={16} />Save event</button>
      </div>
    </div>
  );
}
