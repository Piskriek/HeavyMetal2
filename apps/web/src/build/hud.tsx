import type { ReactElement } from 'react';

/** A thin cross in the middle of the screen: where the tool in your hand will act. */
export function Crosshair(props: { readonly active: boolean }): ReactElement {
  return (
    <div className={`crosshair${props.active ? ' on' : ''}`} aria-hidden="true">
      <i /><i /><i /><i />
    </div>
  );
}

/**
 * Top right: walk or studio, flat or PBR ground, over the shoulder or first person, and your avatar's mirror. Buttons, so nobody has to
 * know a key. (The hotbar itself is build/v3-hud.tsx.)
 */
export function ModeBar(props: {
  readonly mode: 'walk' | 'studio'; readonly view: 'third' | 'first'; readonly skin: 'flat' | 'pbr';
  readonly onMode: (m: 'walk' | 'studio') => void; readonly onView: (v: 'third' | 'first') => void; readonly onSkin: (s: 'flat' | 'pbr') => void;
  /** My avatar: the mirror with your goblin's looks and moves (it was the old hotbar's P tab). */
  readonly onAvatar?: () => void;
}): ReactElement {
  const seg = <T extends string>(label: string, value: T, opts: readonly [T, string, string][], on: (v: T) => void): ReactElement => (
    <div className="seg" role="group" aria-label={label}>
      {opts.map(([v, text, title]) => <button key={v} data-ui={`island.${label.toLowerCase()}.${v}`} className={value === v ? 'on' : ''} aria-pressed={value === v} title={title} onClick={() => on(v)}>{text}</button>)}
    </div>
  );
  return (
    <div className="mode-bar">
      {props.onAvatar ? <div className="seg"><button data-ui="island.avatar" title="Your goblin in the mirror: its looks and its moves" onClick={props.onAvatar}>My avatar</button></div> : null}
      {seg('Mode', props.mode, [['walk', 'Walk', 'Walk as your goblin (B switches)'], ['studio', 'Studio', 'Fly without your goblin; every setting has a window (B switches)']], props.onMode)}
      {props.mode === 'walk' ? seg('View', props.view, [['third', '3rd', 'Over the shoulder (V switches)'], ['first', '1st', 'First person (V switches)']], props.onView) : null}
      {seg('Ground', props.skin, [['flat', 'Flat', 'Plain colours, no bumps or shine'], ['pbr', 'PBR', 'Bumps, shine and height detail (normal, roughness and height maps)']], props.onSkin)}
    </div>
  );
}
