/**
 * Main menu → Quick Races: a Quick Race, the island Tournament, or an event of your own on the
 * Serpentine Isle lanes (Create your own, and every event you have made: My Events).
 */
import { useState } from 'react';
import { Pencil, Play, Plus, Trash2, Trophy, Wand2 } from 'lucide-react';
import EventDesigner from './EventDesigner';
import { deleteEvent, eventSummary, isTournamentEvent, listEvents, saveEvent, type CustomEvent } from '../../game/custom-events';
import CardArt from '../ui/CardArt';

interface QuickRacesPanelProps {
  onQuickRace: () => void;
  onTournament: () => void;
  onRaceEvent: (event: CustomEvent) => void;
}

export default function QuickRacesPanel({ onQuickRace, onTournament, onRaceEvent }: QuickRacesPanelProps) {
  const [events, setEvents] = useState(() => listEvents());
  const [editing, setEditing] = useState<CustomEvent | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (editing) {
    return (
      <EventDesigner
        initial={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(event) => {
          const r = saveEvent(event);
          if (!r.ok) return r.error ?? 'The event could not be saved.';
          setEvents(listEvents());
          setEditing(null);
          return null;
        }}
      />
    );
  }

  return (
    <div className="quick-races">
      <div className="mode-options quick-modes">
        <button className="mode-option" onClick={onQuickRace}>
          <div className="mode-icon"><CardArt src="/art/menus/cards/card-quick-race.png" fallback={<img src="/art/flag-checkered.png" alt="" className="mode-flag-img" aria-hidden="true" />} /></div>
          <span className="mode-kicker">ONE RACE. ALL THE CHAOS.</span><h3>Quick Race</h3>
          <p>One run down the island against the CPU. Pick the track and where it ends.</p>
          <div className="mode-facts"><span>1 round</span><span>Your finish</span></div>
        </button>
        <button className="mode-option" onClick={onTournament}>
          <div className="mode-icon"><CardArt src="/art/menus/cards/card-tournament.png" fallback={<Trophy size={47} strokeWidth={1.15} />} /></div>
          <span className="mode-kicker">CONSISTENCY. QUESTIONABLE INTENT.</span><h3>Tournament</h3>
          <p>Three rounds on the island, points carried round to round. Pick each finish as you go.</p>
          <div className="mode-facts"><span>3 rounds</span><span>One cup</span></div>
        </button>
        <button className="mode-option mode-option-create" onClick={() => setEditing('new')}>
          <div className="mode-icon"><CardArt src="/art/menus/cards/card-create-your-own.png" fallback={<Wand2 size={45} strokeWidth={1.15} />} /></div>
          <span className="mode-kicker">YOUR ISLAND. YOUR RULES.</span><h3>Create your own</h3>
          <p>Build a race or a tournament of up to eight rounds on the Serpentine Isle lanes.</p>
          <div className="mode-facts"><span>1–8 rounds</span><span>Any track, any finish</span></div>
        </button>
      </div>

      <div className="choice-heading my-events-heading"><span>MY EVENTS · {events.length}</span>{events.length > 0 && <button onClick={() => setEditing('new')}><Plus size={12} />New event</button>}</div>
      {events.length ? (
        <ul className="my-events">
          {events.map((e) => (
            <li key={e.id} className="my-event">
              <span className="my-event-icon">{isTournamentEvent(e) ? <Trophy size={18} /> : <img src="/art/flag-checkered.png" alt="" aria-hidden="true" />}</span>
              <div className="my-event-text"><strong>{e.name}</strong><small>{eventSummary(e)} · {e.rounds.map((r) => r.finish?.name ?? 'the sea').join(' → ')}</small></div>
              <div className="my-event-actions">
                {confirmDelete === e.id ? <>
                  <button className="fantasy-link" onClick={() => { deleteEvent(e.id); setEvents(listEvents()); setConfirmDelete(null); }}>Delete it</button>
                  <button className="fantasy-link" onClick={() => setConfirmDelete(null)}>Keep</button>
                </> : <>
                  <button className="fantasy-link" onClick={() => setConfirmDelete(e.id)} aria-label={`Delete ${e.name}`}><Trash2 size={14} /></button>
                  <button className="fantasy-link" onClick={() => setEditing(e)}><Pencil size={14} />Edit</button>
                  <button className="fantasy-secondary" onClick={() => onRaceEvent(e)}><Play size={14} />Race</button>
                </>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="my-events-empty">No events yet. <b>Create your own</b> to set up a race or a tournament you can come back to.</p>}
    </div>
  );
}
