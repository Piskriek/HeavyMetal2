import type { ReactElement, Ref } from 'react';
import { Maximize2 } from 'lucide-react';

/**
 * Goblin Racing's front: its own menu (Play, Multiplayer, Settings) over its island. On the SetMix home it is a live window beside its planet
 * (GoblinPreview); opening it lets the same window grow to fill the screen (GoblinFront). Goblin words live here, not in the harness.
 * Every line on these screens tells the player something they need: what the game is, what Play will do, who they race as.
 */
export interface GoblinStatus {
  /** One line about the game (the activity's own description). */
  readonly doc: string;
  /** Where the player stands: who they race as, or what Play will do the first time. */
  readonly you: string;
}

export function GoblinPreview(props: GoblinStatus & { readonly onOpen: () => void; readonly onPlay: () => void; readonly onMultiplayer: () => void; readonly onSettings: () => void }): ReactElement {
  return (
    <div className="gr-preview">
      <header>
        <div className="gr-preview-title"><span className="gr-preview-name">Goblin Racing</span><span className="gr-preview-doc">{props.doc}</span></div>
        <button className="gr-open" aria-label="Open Goblin Racing" title="Open Goblin Racing" onClick={props.onOpen}><Maximize2 size={16} strokeWidth={1.6} /></button>
      </header>
      {/* the island itself opens the game: a cue says so on hover */}
      <button className="gr-preview-hit" aria-label="Open Goblin Racing" onClick={props.onOpen}><span className="gr-cue"><Maximize2 size={13} strokeWidth={1.8} />Open Goblin Racing</span></button>
      <p className="gr-preview-you">{props.you}</p>
      <nav className="gr-preview-menu" aria-label="Goblin Racing menu">
        <button className="go" onClick={props.onPlay}>Play</button>
        <button onClick={props.onMultiplayer}>Multiplayer</button>
        <button onClick={props.onSettings}>Settings</button>
      </nav>
    </div>
  );
}

export function GoblinFront(props: GoblinStatus & { readonly onPlay: () => void; readonly onMultiplayer: () => void; readonly onSettings: () => void; readonly onHome: () => void }): ReactElement {
  return (
    <div className="gr-front">
      <div className="gr-scrim" aria-hidden="true" />
      <div className="gr-brand"><b>Goblin</b><b className="second">Racing</b><i>a SetMix game</i></div>
      <nav className="shell-menu" aria-label="Goblin Racing menu">
        <button className="go" onClick={props.onPlay}>Play</button>
        <button onClick={props.onMultiplayer}>Multiplayer</button>
        <button onClick={props.onSettings}>Settings</button>
        <button className="quiet" onClick={props.onHome}>Back to SetMix</button>
      </nav>
      <p className="shell-foot">{props.you}</p>
    </div>
  );
}

const HARNESS_MENU: readonly { readonly id: 'island' | 'avatars' | 'community' | 'settings'; readonly label: string; readonly says: string }[] = [
  { id: 'island', label: 'My island', says: 'Walk and build your own island.' },
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
  readonly leader: { readonly line: Ref<SVGLineElement>; readonly ring: Ref<SVGCircleElement> };
}): ReactElement {
  const act = { island: props.onMyIsland, avatars: props.onAvatars, community: props.onCommunity, settings: props.onSettings };
  return (
    <div className="sm-home">
      <svg className="sm-leader" aria-hidden="true"><circle ref={props.leader.ring} r="0" /><line ref={props.leader.line} /></svg>
      <div className="sm-brand"><b>SetMix</b><i>Harness</i></div>
      <nav className="sm-menu" aria-label="SetMix">
        {HARNESS_MENU.map((m, i) => (
          <button key={m.id} style={{ ['--i' as string]: i }} onClick={act[m.id]}><b>{m.label}</b><small>{m.says}</small></button>
        ))}
      </nav>
      <p className="sm-foot">Drag to look round the galaxy. Pick a planet to see what is played there.</p>
      <span className="sm-credits" title="In-game credits. Never real money.">{props.credits} cr</span>
    </div>
  );
}
