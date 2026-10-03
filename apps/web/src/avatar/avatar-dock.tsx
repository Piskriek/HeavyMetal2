import { useEffect, useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { AVATAR_KINDS, kindOf, lookVariablesFor, looksFor, nameProblem, type AvatarKind, type AvatarLook, type LookSlot } from '@hm/avatarlook';
import { PresetPreview } from '../build/cards';
import { lookOf } from '../build/catalog';
import { MovesEditor, type EditorActions } from '../build/editors';
import { saveLook, usePlayer, wearLook } from '../build/player';
import { fx } from '../maker/feedback';
import { NewChooser, type NewWay } from '../shell/new-thing';
import { PartsPicker } from './parts-picker';

/**
 * Avatar mode (the Avatar tab, P; owner 2026-10-03, E11): the camera turns to face your avatar like a mirror, and this dock sits beside it.
 * On top, your characters: every avatar you own, whole, one click to swap, and "New avatar". Below, the avatar you are wearing, ready to
 * change: its ready-made looks, its colours, what it wears, how it moves. A new avatar is made here too, three ways (Quick setup, Setup
 * wizard, Manual), and the avatar in the world shows each choice as you make it.
 */
type Tab = 'looks' | 'colours' | 'wears' | 'moves';
const TABS: readonly { readonly id: Tab; readonly name: string }[] = [
  { id: 'looks', name: 'Looks' }, { id: 'colours', name: 'Colours' }, { id: 'wears', name: 'Wears' }, { id: 'moves', name: 'Moves' },
];
type Making = { readonly way: NewWay; readonly kind: AvatarKind; readonly draft: AvatarLook; readonly step: number } | null;
const STEPS = ['Look', 'Colours', 'Wears', 'Name'] as const;
const kindName = (k: AvatarKind): string => AVATAR_KINDS.find((x) => x.id === k)?.name ?? 'Goblin';
/** A ready-made look as the start of a new avatar of yours (not saved until you make it). */
const draftOf = (base: AvatarLook, name: string): AvatarLook => ({ ...base, id: 'draft', name });

export function AvatarDock(props: {
  readonly actions: EditorActions;
  /** Show this look on your avatar in the world (null: back to the one you wear). */
  readonly onPreview: (look: AvatarLook | null) => void;
  readonly onDone: () => void;
}): ReactElement {
  const p = usePlayer();
  const look = lookOf(p, p.lookId);
  const kind = kindOf(look);
  const [tab, setTab] = useState<Tab>('looks');
  const [making, setMaking] = useState(false);
  const change = (patch: Partial<AvatarLook>): void => { saveLook({ ...look, ...patch }); };
  return (
    <aside className="avatar-dock" aria-label="Your avatar">
      <section className="ad-crew" aria-label="Your characters">
        <h3>Your characters</h3>
        <div className="ad-row">
          {p.looks.map((l) => (
            <button key={l.id} className={l.id === p.lookId && !making ? 'on' : ''} aria-pressed={l.id === p.lookId && !making} title={`${l.name} (${kindName(kindOf(l))})`}
              onClick={() => { setMaking(false); if (l.id !== p.lookId) { wearLook(l.id); fx('select'); } }}>
              <PresetPreview p={{ kind: 'look', look: l }} size={56} />
              <span>{l.name}</span>
            </button>
          ))}
          <button className={`ad-new${making ? ' on' : ''}`} aria-pressed={making} onClick={() => setMaking(true)}>
            <Plus size={20} strokeWidth={1.4} /><span>New avatar</span>
          </button>
        </div>
      </section>

      {making ? (
        <section className="ad-body" aria-label="New avatar">
          <NewAvatar kind={kind} onPreview={props.onPreview} onCancel={() => setMaking(false)} onMade={() => { setMaking(false); setTab('looks'); }}
            onManual={(k) => { const base = looksFor(k)[0]!; saveLook({ ...base, id: 'draft', name: `New ${kindName(k).toLowerCase()}` }); setMaking(false); setTab('colours'); fx('ui-success'); }} />
        </section>
      ) : (
        <section className="ad-body" aria-label={look.name}>
          <header className="ad-self">
            <input className="ad-title" value={look.name} maxLength={20} aria-label="Name" onChange={(e) => change({ name: e.target.value })} />
            <span>{kindName(kind)}</span>
          </header>
          {nameProblem(look.name) ? <p className="hint warn" role="alert">{nameProblem(look.name)}</p> : null}
          <nav className="ad-tabs" role="tablist" aria-label="Change">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name}</button>)}
          </nav>
          {tab === 'looks' ? (
            <>
              <p className="hint">A ready-made look for {look.name}: its colours change, its name and what it wears stay.</p>
              <div className="ad-looks">
                {looksFor(kind).map((l) => (
                  <button key={l.id} className={l.skin === look.skin && l.vest === look.vest ? 'on' : ''} onClick={() => { change({ ...l, id: look.id, name: look.name, ...(look.parts ? { parts: look.parts } : {}) }); fx('select'); }}>
                    <PresetPreview p={{ kind: 'look', look: { ...l, ...(look.parts ? { parts: look.parts } : {}) } }} size={60} /><span>{l.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {tab === 'colours' ? <Colours look={look} onChange={change} /> : null}
          {tab === 'wears' ? <PartsPicker look={look} onChange={(parts) => change({ parts })} /> : null}
          {tab === 'moves' ? <MovesEditor actions={props.actions} /> : null}
          <div className="btns ad-foot">
            <button onClick={() => props.actions.share('look', look.id)}>Share…</button>
            <span className="grow" />
            <button className="go" onClick={props.onDone}>Done</button>
          </div>
        </section>
      )}
    </aside>
  );
}

/**
 * Make a new avatar three ways (B13): Quick setup (a ready-made one and a name), Setup wizard (look, colours, wears, name, one step each) or
 * Manual (the parent opens the full editor on a plain one). `onPreview` shows the avatar being made (on the island: your avatar in the world);
 * `big` adds a large picture of it here (the SetMix home has no world to show it in).
 */
export function NewAvatar(props: {
  readonly kind: AvatarKind; readonly onPreview?: (look: AvatarLook | null) => void; readonly onMade: (look: AvatarLook) => void; readonly onCancel: () => void;
  readonly onManual: (kind: AvatarKind) => void; readonly big?: boolean;
}): ReactElement {
  const [newKind, setNewKind] = useState<AvatarKind>(props.kind);
  const [making, setMaking] = useState<Making>(null);
  // the avatar being made shows as you choose; leaving or finishing puts back the one you wear
  useEffect(() => { props.onPreview?.(making ? making.draft : null); }, [making]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => props.onPreview?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = (patch: Partial<AvatarLook>): void => setMaking((m) => (m ? { ...m, draft: { ...m.draft, ...patch } } : m));
  const finish = (): void => {
    if (!making) return;
    if (nameProblem(making.draft.name)) { fx('ui-error'); return; }
    const made = saveLook({ ...making.draft, name: making.draft.name.trim() });
    wearLook(made.id); fx('ui-success');
    setMaking(null); props.onMade(made);
  };
  if (!making) {
    return (
      <>
        <h2>New avatar</h2>
        <NewChooser thing="avatar" onCancel={props.onCancel}
          onPick={(way) => { if (way === 'manual') { props.onManual(newKind); return; } const base = looksFor(newKind)[0]!; setMaking({ way, kind: newKind, draft: draftOf(base, base.name), step: 0 }); }}
          before={(
            <div className="seg ad-kinds" role="group" aria-label="Kind">
              {AVATAR_KINDS.map((k) => <button key={k.id} className={newKind === k.id ? 'on' : ''} aria-pressed={newKind === k.id} onClick={() => setNewKind(k.id)}>{k.name}</button>)}
            </div>
          )}
          says={{
            quick: `Pick a ready-made ${kindName(newKind).toLowerCase()}, give it a name, done. Change anything later.`,
            wizard: 'Four short steps: a look, its colours, what it wears, its name. Each choice shows as you make it.',
            manual: `A plain ${kindName(newKind).toLowerCase()} straight into the full editor, every colour and part.`,
          }} />
      </>
    );
  }
  return (
    <>
      <h2>{making.way === 'quick' ? 'Quick setup' : 'Setup wizard'}</h2>
      {making.way === 'wizard' ? (
        <ol className="ad-steps" aria-label="Steps">
          {STEPS.map((st, i) => <li key={st} className={i === making.step ? 'on' : i < making.step ? 'done' : ''}><button onClick={() => setMaking({ ...making, step: i })}>{i + 1}. {st}</button></li>)}
        </ol>
      ) : null}
      {props.big ? <div className="ad-big"><PresetPreview p={{ kind: 'look', look: making.draft }} size={150} /></div> : null}
      {making.way === 'quick' || making.step === 0 ? (
        <div className="ad-looks">
          {looksFor(making.kind).map((l) => (
            <button key={l.id} className={l.skin === making.draft.skin && l.vest === making.draft.vest ? 'on' : ''} onClick={() => draft({ ...l, id: 'draft', name: !making.draft.name || looksFor(making.kind).some((x) => x.name === making.draft.name) ? l.name : making.draft.name, ...(making.draft.parts ? { parts: making.draft.parts } : {}) })}>
              <PresetPreview p={{ kind: 'look', look: l }} size={60} /><span>{l.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {making.way === 'wizard' && making.step === 1 ? <Colours look={making.draft} onChange={draft} /> : null}
      {making.way === 'wizard' && making.step === 2 ? <PartsPicker look={making.draft} onChange={(parts) => draft({ parts })} /> : null}
      {making.way === 'quick' || making.step === 3 ? (
        <label className="row ad-name">Name <input value={making.draft.name} maxLength={20} onChange={(e) => draft({ name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') finish(); }} /></label>
      ) : null}
      {(making.way === 'quick' || making.step === 3) && nameProblem(making.draft.name) ? <p className="hint warn" role="alert">{nameProblem(making.draft.name)}</p> : null}
      <div className="btns">
        <button onClick={() => (making.way === 'wizard' && making.step > 0 ? setMaking({ ...making, step: making.step - 1 }) : setMaking(null))}>Back</button>
        <span className="grow" />
        {making.way === 'wizard' && making.step < STEPS.length - 1
          ? <button className="go" onClick={() => setMaking({ ...making, step: making.step + 1 })}>Next: {STEPS[making.step + 1]}</button>
          : <button className="go" onClick={finish} disabled={!!nameProblem(making.draft.name)}>Make {making.draft.name.trim() || 'it'}</button>}
      </div>
    </>
  );
}

/** Every colour of an avatar, named for its kind (a goblin's vest is a human's shirt). */
function Colours(props: { readonly look: AvatarLook; readonly onChange: (patch: Partial<AvatarLook>) => void }): ReactElement {
  return (
    <div className="ad-colours">
      {lookVariablesFor(kindOf(props.look)).map((v) => (
        <label key={v.key}><input type="color" value={props.look[v.key as LookSlot]} onChange={(e) => props.onChange({ [v.key]: e.target.value } as Partial<AvatarLook>)} /><span>{v.label}</span></label>
      ))}
    </div>
  );
}
