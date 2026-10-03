import { Fragment, type ReactElement, type Ref } from 'react';
import { Maximize2 } from 'lucide-react';

/**
 * Goblin Racing's front: its own menu (Play, Race modes, Settings) over its island. On the SetMix home it is a live window beside its planet
 * (GoblinPreview); opening it lets the same window grow to fill the screen (GoblinFront). Goblin words live here, not in the harness.
 * Every line on these screens tells the player something they need: what the game is, what Play will do, who they race as.
 */
export interface GoblinStatus {
  /** One line about the game (the activity's own description). */
  readonly doc: string;
  /** Where the player stands: who they race as, or what Play will do the first time. */
  readonly you: string;
}

/** A planet's live window on the SetMix home (Goblin Racing, or any activity): its name, what it is, where you stand, its own menu. */
export function GoblinPreview(props: GoblinStatus & {
  readonly name?: string; readonly onOpen: () => void;
  readonly actions: readonly { readonly label: string; readonly onClick: () => void; readonly go?: boolean }[];
  /** The island view behind the window has not drawn yet: a loading bar instead of an empty frame. */
  readonly loading?: boolean;
}): ReactElement {
  const name = props.name ?? 'Goblin Racing';
  return (
    <div className="gr-preview">
      <header>
        <div className="gr-preview-title"><span className="gr-preview-name">{name}</span><span className="gr-preview-doc">{props.doc}</span></div>
        <button className="gr-open" aria-label={`Open ${name}`} title={`Open ${name}`} onClick={props.onOpen}><Maximize2 size={16} strokeWidth={1.6} /></button>
      </header>
      {/* the island itself opens the game: a cue says so on hover */}
      <button className="gr-preview-hit" aria-label={`Open ${name}`} onClick={props.onOpen}><span className="gr-cue"><Maximize2 size={13} strokeWidth={1.8} />Open {name}</span></button>
      {props.loading ? <div className="gr-loading" role="status"><span>Loading the island</span><i /></div> : null}
      <p className="gr-preview-you">{props.you}</p>
      <nav className="gr-preview-menu" aria-label={`${name} menu`}>
        {props.actions.map((a) => <button key={a.label} className={a.go ? 'go' : ''} onClick={a.onClick}>{a.label}</button>)}
      </nav>
    </div>
  );
}

export function GoblinFront(props: GoblinStatus & { readonly onPlay: () => void; readonly onModes: () => void; readonly onSettings: () => void; readonly onHome: () => void }): ReactElement {
  return (
    <div className="gr-front">
      <div className="gr-scrim" aria-hidden="true" />
      <div className="gr-brand"><b>Goblin</b><b className="second">Racing</b><i>a SetMix game</i></div>
      <nav className="shell-menu" aria-label="Goblin Racing menu">
        <button className="go" onClick={props.onPlay}>Play</button>
        <button onClick={props.onModes}>Race modes</button>
        <button onClick={props.onSettings}>Settings</button>
        <button className="quiet" onClick={props.onHome}>Back to SetMix</button>
      </nav>
      <p className="shell-foot">{props.you}</p>
    </div>
  );
}

const HARNESS_MENU: readonly { readonly id: 'island' | 'avatars' | 'community' | 'settings'; readonly label: string; readonly says: string }[] = [
  { id: 'island', label: 'My planet', says: 'Your islands: pick one to go in, or make a new one.' },
  { id: 'avatars', label: 'Avatars', says: 'Who you are: goblins, humans and more.' },
  { id: 'community', label: 'Community', says: 'Presets other players share, and yours.' },
  { id: 'settings', label: 'Settings', says: 'Graphics, controls and your profile.' },
];

/**
 * The SetMix home's own chrome: the wordmark, the harness menu (your island, the community, settings) and the leader line that ties Goblin
 * Racing's window to its planet on the star chart (drawn by the shell every frame through `leader`).
 */
export function SetMixHome(props: {
  readonly onMyIsland: () => void; readonly onAvatars: () => void; readonly onCommunity: () => void; readonly onSettings: () => void; readonly credits: number;
  /** Straight into the island you were last on (or your first). */
  readonly onIslandNow: () => void;
  /** The island My island opens, and whether you have been there before (then it says you carry on where you left off). */
  readonly island: { readonly name: string; readonly visited: boolean } | null;
  readonly leader: { readonly line: Ref<SVGLineElement>; readonly ring: Ref<SVGCircleElement> };
}): ReactElement {
  const act = { island: props.onMyIsland, avatars: props.onAvatars, community: props.onCommunity, settings: props.onSettings };
  return (
    <div className="sm-home">
      <svg className="sm-leader" aria-hidden="true"><circle ref={props.leader.ring} r="0" /><line ref={props.leader.line} /></svg>
      <div className="sm-brand"><b>SetMix</b><i>Harness</i></div>
      <nav className="sm-menu" aria-label="SetMix">
        {HARNESS_MENU.map((m, i) => (
          <Fragment key={m.id}>
            <button style={{ ['--i' as string]: i }} onClick={act[m.id]}><b>{m.label}</b><small>{m.says}</small></button>
            {m.id === 'island' && props.island ? <button className="sm-sub" style={{ ['--i' as string]: i }} onClick={props.onIslandNow}>{props.island.visited ? `Carry on at ${props.island.name}` : `Go to ${props.island.name}`}</button> : null}
          </Fragment>
        ))}
      </nav>
      <p className="sm-foot">Drag to look round the galaxy. Pick a planet to see what is played there.</p>
      <span className="sm-credits" title="In-game credits. Never real money.">{props.credits} cr</span>
    </div>
  );
}
