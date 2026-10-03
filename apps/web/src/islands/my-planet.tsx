import { useMemo, useState, type ReactElement } from 'react';
import { Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { describeIsland, type IslandMeta } from '@hm/islands';
import { TEMPLATE_SHAPES, type TemplateShape } from '../maker/scene';
import { readBundle } from './island-store';
import { IslandMap, mapOfBundle, type MapSource } from './new-island';

/**
 * My planet (owner, 2026-10-03: "from the galaxy it should be my planet, and then from the planet you see your islands with previews, and
 * then go into the island you want"): every island you have, drawn from above as it is now (an edited island shows its own ground and
 * track; an untouched one its template), the one you were last on marked. Pick one to go in. On the galaxy it is a small window beside your
 * planet; opened, it is the planet's own screen with rename, copy, delete and a new island.
 */
/** One plain line about an island: when it was last changed, and what it was made from. */
function aboutIsland(m: IslandMeta): string {
  const line = describeIsland(m, Date.now()).split(' · ').slice(1).join(', ').replace('branch of', 'made from');
  return line ? line[0]!.toUpperCase() + line.slice(1) + '.' : '';
}

function sourceOf(m: IslandMeta): MapSource {
  const saved = readBundle(m.id);
  const own = saved ? mapOfBundle(saved) : null;
  return own ?? { shape: TEMPLATE_SHAPES[m.template ?? 'blank-island'] ?? TEMPLATE_SHAPES['blank-island']! };
}

export type IslandLook = 'flat' | 'pbr';

export function PlanetWindow(props: { readonly islands: readonly IslandMeta[]; readonly activeId: string | null; readonly look: IslandLook; readonly onGo: (id: string) => void; readonly onOpen: () => void }): ReactElement {
  const shown = props.islands.slice(0, 4);
  const sources = useMemo(() => new Map(shown.map((m) => [m.id, sourceOf(m)])), [props.islands]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="planet-window" role="region" aria-label="My planet">
      <header>
        <div className="gr-preview-title"><span className="gr-preview-name">My planet</span><span className="gr-preview-doc">Your islands. Pick one to go in, or open the planet for all of them.</span></div>
      </header>
      <div className="pw-islands">
        {shown.map((m) => (
          <button key={m.id} className={m.id === props.activeId ? 'on' : ''} onClick={() => props.onGo(m.id)} title={`Go to ${m.name}`}>
            <IslandMap source={sources.get(m.id)!} size={118} look={props.look} label={`${m.name}, from above`} />
            <span>{m.name}</span>
          </button>
        ))}
      </div>
      <nav className="gr-preview-menu" aria-label="My planet">
        <button className="go" onClick={() => props.activeId && props.onGo(props.activeId)} disabled={!props.activeId}>Go to {props.islands.find((m) => m.id === props.activeId)?.name ?? 'my island'}</button>
        <button onClick={props.onOpen}>All {props.islands.length} island{props.islands.length === 1 ? '' : 's'}</button>
      </nav>
    </div>
  );
}

/** An island to try: a ready-made one or one the community shares; starred ones come first. */
export interface TryIsland { readonly id: string; readonly name: string; readonly template: string; readonly shape: TemplateShape; readonly by?: string }

export function PlanetScreen(props: {
  readonly islands: readonly IslandMeta[]; readonly activeId: string | null;
  /** The island look you last used: your islands are drawn in it. */
  readonly look: IslandLook; readonly onLook: (look: IslandLook) => void;
  readonly tries: readonly TryIsland[]; readonly favs: readonly string[]; readonly onFav: (id: string) => void; readonly onTry: (t: TryIsland) => void;
  readonly onGo: (id: string) => void; readonly onRename: (id: string, name: string) => void; readonly onDuplicate: (id: string) => void; readonly onDelete: (id: string) => void;
  readonly onNew: () => void;
}): ReactElement {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const sources = useMemo(() => new Map(props.islands.map((m) => [m.id, sourceOf(m)])), [props.islands]);
  const submit = (): void => { if (renaming) props.onRename(renaming, draft); setRenaming(null); };
  const current = props.islands.find((m) => m.id === props.activeId) ?? props.islands[0] ?? null;
  const tries = [...props.tries].sort((x, y) => Number(props.favs.includes(y.id)) - Number(props.favs.includes(x.id)));
  return (
    <div className="planet-screen">
      <section aria-label="Your islands">
        <h3>Your islands</h3>
        <div className="planet-grid">
          {props.islands.map((m) => (
            <article key={m.id} className={`planet-island${m.id === props.activeId ? ' current' : ''}`}>
              <button className="pi-map" onClick={() => props.onGo(m.id)} title={`Go to ${m.name}`}><IslandMap source={sources.get(m.id)!} size={168} look={props.look} label={`${m.name}, from above`} /></button>
              {renaming === m.id ? (
                <input autoFocus value={draft} maxLength={40} aria-label="Island name" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} onBlur={submit} />
              ) : <h4>{m.name}</h4>}
              <p>{aboutIsland(m)}</p>
              <div className="btns">
                <button className="go" onClick={() => props.onGo(m.id)}>Go in</button>
                <button title="Rename" aria-label={`Rename ${m.name}`} onClick={() => { setRenaming(m.id); setDraft(m.name); }}><Pencil size={13} strokeWidth={1.6} /></button>
                <button title="Copy" aria-label={`Copy ${m.name}`} onClick={() => props.onDuplicate(m.id)}><Copy size={13} strokeWidth={1.6} /></button>
                <button title="Delete (you can undo)" aria-label={`Delete ${m.name}`} onClick={() => props.onDelete(m.id)}><Trash2 size={13} strokeWidth={1.6} /></button>
              </div>
            </article>
          ))}
          <button className="planet-island new" onClick={props.onNew}><Plus size={22} strokeWidth={1.4} /><span>New island</span></button>
        </div>
      </section>
      {current ? (
        <section aria-label="Style">
          <h3>Style</h3>
          <p className="hint">How your islands are built to look: voxel blocks that match the avatars, or the painted ground. On the island, the Flat and PBR buttons add or take away bumps and shine in either style.</p>
          <div className="planet-looks">
            {([['flat', 'Voxel'], ['pbr', 'Painted']] as const).map(([id, name]) => (
              <button key={id} className={props.look === id ? 'on' : ''} aria-pressed={props.look === id} onClick={() => props.onLook(id)}>
                <IslandMap source={sources.get(current.id)!} size={120} look={id} label={`${current.name} in the ${name} style`} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section aria-label="Try an island">
        <h3>Try an island</h3>
        <p className="hint">Ready-made islands and the community's. Trying one gives you your own copy to walk and change; star the ones you like.</p>
        <div className="planet-tries">
          {tries.map((t) => {
            const fav = props.favs.includes(t.id);
            return (
              <article key={t.id} className={`planet-try${fav ? ' fav' : ''}`}>
                <IslandMap shape={t.shape} size={120} look={props.look} label={`${t.name}, from above`} />
                <h4>{t.name}</h4>
                <p>{t.by ? `Shared by ${t.by}` : 'Ready-made'}</p>
                <div className="btns">
                  <button className="go" onClick={() => props.onTry(t)}>Try it</button>
                  <button className={fav ? 'on' : ''} aria-pressed={fav} aria-label={fav ? `Unstar ${t.name}` : `Star ${t.name}`} title={fav ? 'Starred: it comes first' : 'Star it'} onClick={() => props.onFav(t.id)}><Star size={13} strokeWidth={1.6} /></button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
