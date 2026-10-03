import type { ReactElement, ReactNode } from 'react';
import { TABS, type TabId } from '@hm/buildkit';
import type { CatalogItem } from './catalog';
import { PresetPreview } from './cards';
import { iconByName } from './icons';

/** A thin cross in the middle of the screen: where the tool in your hand will act. */
export function Crosshair(props: { readonly active: boolean }): ReactElement {
  return (
    <div className={`crosshair${props.active ? ' on' : ''}`} aria-hidden="true">
      <i /><i /><i /><i />
    </div>
  );
}

/** The tabs: F1 to F10 (Avatar also on P). Click works when the mouse is free. */
export function TabStrip(props: { readonly tab: TabId; readonly onPick: (t: TabId) => void }): ReactElement {
  return (
    <nav className="tab-strip" role="tablist" aria-label="What you hold">
      {TABS.map((t) => {
        const I = iconByName(t.icon);
        return (
          <button key={t.id} data-ui={`island.tab.${t.id}`} role="tab" aria-selected={props.tab === t.id} className={props.tab === t.id ? 'on' : ''} data-label={`${t.label} (${t.key}${t.alt ? ` or ${t.alt.toUpperCase()}` : ''}): ${t.doc}`} onClick={() => props.onPick(t.id)}>
            <I size={15} strokeWidth={1.6} /><span>{t.label}</span><kbd>{t.key}</kbd>
          </button>
        );
      })}
    </nav>
  );
}

/** Nine slots of the open tab (keys 1 to 9, or the wheel). Each shows its preset. E opens the preset window to fill them. */
export function Hotbar(props: { readonly items: readonly (CatalogItem | null)[]; readonly selected: number; readonly onSelect: (i: number) => void; readonly onOpen: () => void; /** At the far end: Easy / Pro / Studio. */ readonly end?: ReactNode }): ReactElement {
  return (
    <div className="hotbar" role="toolbar" aria-label="Hotbar" data-ui="island.hotbar">
      {props.items.map((it, i) => (
        <button key={i} className={i === props.selected ? 'on' : ''} data-label={it ? `${it.name}: ${it.doc}` : 'Empty: press E to put a preset here'} aria-label={it ? it.name : 'Empty slot'} onClick={() => (it ? props.onSelect(i) : props.onOpen())}>
          <b>{i + 1}</b>
          {it ? <><PresetPreview p={it.preview} size={34} /><span>{it.name}</span></> : <span className="empty">+</span>}
        </button>
      ))}
      <button className="inv-btn" data-ui="island.presets" data-label="Your presets: pick what goes in these slots, change any of them (E)" aria-label="Open your presets" onClick={props.onOpen}>E</button>
      {props.end}
    </div>
  );
}

/** Words about what is in your hand: what it is, and what each mouse button does. The keys themselves live in Settings, Controls. */
export function ToolSay(props: { readonly title: string; readonly line: string; readonly left: string; readonly right: string }): ReactElement {
  return (
    <div className="tool-say" aria-live="polite">
      <b>{props.title}</b>
      <span>{props.line}</span>
      <span className="btnsay"><i>Left</i> {props.left}</span>
      <span className="btnsay"><i>Right</i> {props.right}</span>
    </div>
  );
}

/** Top right: walk or studio, flat or PBR ground, over the shoulder or first person. Buttons, so nobody has to know a key. */
export function ModeBar(props: {
  readonly mode: 'walk' | 'studio'; readonly view: 'third' | 'first'; readonly skin: 'flat' | 'pbr';
  readonly onMode: (m: 'walk' | 'studio') => void; readonly onView: (v: 'third' | 'first') => void; readonly onSkin: (s: 'flat' | 'pbr') => void;
}): ReactElement {
  const seg = <T extends string>(label: string, value: T, opts: readonly [T, string, string][], on: (v: T) => void): ReactElement => (
    <div className="seg" role="group" aria-label={label}>
      {opts.map(([v, text, title]) => <button key={v} data-ui={`island.${label.toLowerCase()}.${v}`} className={value === v ? 'on' : ''} aria-pressed={value === v} title={title} onClick={() => on(v)}>{text}</button>)}
    </div>
  );
  return (
    <div className="mode-bar">
      {seg('Mode', props.mode, [['walk', 'Walk', 'Walk as your goblin (B switches)'], ['studio', 'Studio', 'Fly without your goblin; every setting has a window (B switches)']], props.onMode)}
      {props.mode === 'walk' ? seg('View', props.view, [['third', '3rd', 'Over the shoulder (V switches)'], ['first', '1st', 'First person (V switches)']], props.onView) : null}
      {seg('Ground', props.skin, [['flat', 'Flat', 'Plain colours, no bumps or shine'], ['pbr', 'PBR', 'Bumps, shine and height detail (normal, roughness and height maps)']], props.onSkin)}
    </div>
  );
}

/** The held-Tab wheel: every preset of the open tab. The wheel moves; when the mouse is free you can also click one. Letting go of Tab keeps it. */
export function TabWheel(props: { readonly title: string; readonly items: readonly CatalogItem[]; readonly index: number; readonly clickable: boolean; readonly onPick: (i: number) => void }): ReactElement {
  return (
    <div className={`tab-palette${props.clickable ? ' clickable' : ''}`} role="listbox" aria-label={`${props.title} presets`}>
      <div className="tp-cats"><span className="on">{props.title}</span><em>{props.clickable ? 'Click one, or turn the wheel and let go of Tab.' : 'Turn the wheel, let go of Tab to keep it.'}</em></div>
      <div className="tp-grid">
        {props.items.map((it, i) => (
          <div key={it.id} role="option" aria-selected={i === props.index} className={i === props.index ? 'on' : ''} onClick={() => props.clickable && props.onPick(i)}
            ref={i === props.index ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : undefined}>
            <PresetPreview p={it.preview} size={44} />
            <span>{it.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
