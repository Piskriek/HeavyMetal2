import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Redo2, Search, Undo2 } from 'lucide-react';
import {
  V3_MODES, V3_TABS, v3Button, v3Find, v3Matches, v3Slots, v3TabIcon, v3TabName,
  type V3Button, type V3Filter, type V3Found, type V3Mode, type V3PaletteKey, type V3Slider, type V3Source, type V3SubTool, type V3Tab,
} from '@hm/buildkit';
import type { Preview } from './catalog';
import { PresetPreview } from './cards';
import { iconByName } from './icons';

/**
 * The hotbar, as the owner's spec V3 lays it out (docs/HOTBAR_V3_SPEC.md): the F1..F12 tabs with the mode's names, and under them the
 * mode's own layout. Game Mode: the tab's numbered presets, the words of the one in hand above them. Simplified Mode: the sub-tools, and
 * above them the sub-tool's presets and plain sliders. Advanced Mode: the tools, and above them the tool's options, the filters and the
 * keys. At the end: Find a tool, Undo, Redo, and Game / Simplified / Advanced. A button whose engine is not built yet carries a pip and says
 * it is coming when used. The island owns what the buttons do; this only draws them and reports picks.
 */
export interface V3OptionItem { readonly id: string; readonly name: string; readonly preview: Preview }
export interface V3Words { readonly title: string; readonly line: string; readonly left: string; readonly right: string }
export interface V3HudProps {
  readonly mode: V3Mode;
  readonly tab: number;
  readonly slot: number;
  /** Simplified: the preset of the sub-tool; Advanced: the F3 preset (-1 when the tool itself is in hand). */
  readonly preset: number;
  readonly sliders: Readonly<Record<string, number>>;
  readonly filters: Readonly<Record<string, boolean>>;
  readonly palette: Readonly<Partial<Record<string, string>>>;
  readonly options: (source: V3Source) => readonly V3OptionItem[];
  readonly words: V3Words;
  /** Whether a slider, while dragged, changes the world at once (some only take effect when let go). */
  readonly drivesLive?: (s: V3Slider) => boolean;
  readonly onTab: (tab: number) => void;
  readonly onSlot: (slot: number) => void;
  readonly onPreset: (preset: number) => void;
  /** A slider moved (`done` when let go). */
  readonly onSlider: (s: V3Slider, key: string, value: number, done: boolean) => void;
  readonly onReset: (prefix: string, sub: V3SubTool) => void;
  readonly onFilter: (key: string, on: boolean, f: V3Filter) => void;
  readonly onOption: (key: V3PaletteKey, id: string) => void;
  readonly onMode: (mode: V3Mode) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly findOpen: boolean;
  readonly onFind: (open: boolean) => void;
  readonly onFound: (f: V3Found) => void;
  /** Something that is coming was clicked (a filter, a slider). */
  readonly onComing: (what: string) => void;
  /** What the island just said (it sits on top of the column, above whatever the mode shows). */
  readonly note?: string;
  /** How full the island's budget is (build/budget.ts): shown in Simplified and Advanced, in Game Mode only when nearly full. */
  readonly budget?: { readonly share: number; readonly label: string } | null;
  /** The ground material in hand: open its look in the surface editor (Ground Material, PBR Surface Paint). */
  readonly onEditLook?: () => void;
}

const sliderKey = (t: V3Tab, sub: V3SubTool, s: V3Slider): string => `${t.key}:${sub.id}:${s.id}`;
export const sliderValue = (all: Readonly<Record<string, number>>, t: V3Tab, sub: V3SubTool, s: V3Slider): number => all[sliderKey(t, sub, s)] ?? s.value ?? 0;
const fmt = (s: V3Slider, v: number): string => {
  if (s.id === 'time') return `${String(Math.floor(v)).padStart(2, '0')}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`;
  const n = (s.step ?? 1) < 1 ? v.toFixed((s.step ?? 1) < 0.1 ? 2 : 1) : String(Math.round(v));
  return s.unit ? `${n}${s.unit === '%' || s.unit === '°' || s.unit === 'x' ? '' : ' '}${s.unit}` : n;
};

export function V3Hud(props: V3HudProps): ReactElement {
  const { mode, tab, slot, preset } = props;
  const t = V3_TABS[tab] ?? V3_TABS[0]!;
  const slots = v3Slots(t, mode);
  const held = v3Button(t, mode, slot, preset);
  return (
    <div className={`v3 v3-${mode}`} role="region" aria-label="Hotbar" data-ui="island.hotbar">
      {props.note ? <div className="island-note" role="status">{props.note}</div> : null}
      {props.findOpen ? <FindTool mode={mode} onFound={props.onFound} onClose={() => props.onFind(false)} /> : null}
      {mode === 'game' ? <GameWords t={t} held={held} words={props.words} palette={props.palette} options={props.options} onOption={props.onOption} />
        : mode === 'simplified' ? <SimplifiedPanel {...props} t={t} />
        : <AdvancedPanel {...props} t={t} held={held} />}
      <nav className="v3-tabs" role="tablist" aria-label="Tabs">
        {V3_TABS.map((x, i) => {
          const I = iconByName(v3TabIcon(x, mode));
          const name = v3TabName(x, mode);
          const keys = i >= 10 ? `${x.key} or Shift+F${i - 9}` : x.key;
          return (
            <button key={x.key} role="tab" data-ui={`island.tab.${x.key}`} aria-selected={i === tab} className={i === tab ? 'on' : ''} data-label={`${name} (${keys})`} onClick={() => props.onTab(i)}>
              <I size={15} strokeWidth={1.6} aria-hidden="true" /><span>{name}</span><kbd>{x.key}</kbd>
            </button>
          );
        })}
      </nav>
      <div className="v3-bar">
        <div className="v3-slots" role="toolbar" aria-label={`${v3TabName(t, mode)}: ${mode === 'game' ? 'presets' : mode === 'simplified' ? 'tools' : 'tools'}`}>
          {slots.map((s, i) => {
            const I = iconByName(s.icon);
            return (
              <button key={s.id} className={`v3-slot${i === slot ? ' on' : ''}${s.todo ? ' coming' : ''}`} data-ui={`island.slot.${s.id}`} aria-pressed={i === slot}
                data-label={`${s.name}${s.todo ? ' (coming)' : ''}: ${s.doc}`} onClick={() => props.onSlot(i)}>
                <b className="v3-num">{i + 1}</b>
                <I size={mode === 'advanced' ? 18 : 22} strokeWidth={1.6} aria-hidden="true" />
                <span>{s.name}</span>
                {s.todo ? <i className="v3-pip" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <div className="v3-end">
          {props.budget && (mode !== 'game' || props.budget.share >= 0.85) ? (
            <div className={`v3-budget${props.budget.share >= 0.85 ? ' full' : ''}`} data-ui="island.budget" role="meter" aria-label="Island budget" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, props.budget.share) * 100)}
              data-label={`Island budget: ${props.budget.label}. Over it, nothing more of that kind goes on.`}>
              <i style={{ width: `${Math.round(Math.min(1, props.budget.share) * 100)}%` }} />
            </div>
          ) : null}
          <button className="v3-icon" data-ui="island.find" aria-label="Find a tool" data-label="Find a tool (/)" aria-expanded={props.findOpen} onClick={() => props.onFind(!props.findOpen)}><Search size={16} strokeWidth={1.7} /></button>
          <button className="v3-icon" data-ui="island.undo" aria-label="Undo" data-label="Undo (Ctrl+Z)" onClick={props.onUndo}><Undo2 size={16} strokeWidth={1.7} /></button>
          <button className="v3-icon" data-ui="island.redo" aria-label="Redo" data-label="Redo (Ctrl+Y)" onClick={props.onRedo}><Redo2 size={16} strokeWidth={1.7} /></button>
          <div className="v3-modes" role="group" aria-label="Mode">
            {V3_MODES.map((x) => (
              <button key={x.id} data-ui={`island.mode.${x.id}`} className={x.id === mode ? 'on' : ''} aria-pressed={x.id === mode} data-label={`${x.doc} (\` switches)`} onClick={() => props.onMode(x.id)}>{x.name}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** What a mouse button does, in words. */
function Buttons(props: { readonly words: V3Words }): ReactElement {
  return <span className="v3-mouse"><i>Left</i> {props.words.left} <i>Right</i> {props.words.right}</span>;
}

/** Game Mode: the preset in hand, in big plain words; Prop Box opens its box of props above. */
function GameWords(props: { readonly t: V3Tab; readonly held: V3Button | null; readonly words: V3Words; readonly palette: V3HudProps['palette']; readonly options: V3HudProps['options']; readonly onOption: V3HudProps['onOption'] }): ReactElement {
  const o = props.held?.options;
  return (
    <>
      {o && props.held?.bind.todo !== true ? <Options label={o.label} items={props.options(o.source)} selected={props.palette[o.palette]} onPick={(id) => props.onOption(o.palette, id)} /> : null}
      <div className="v3-say" aria-live="polite">
        <b>{props.words.title}</b>
        <span>{props.words.line}</span>
        <Buttons words={props.words} />
      </div>
    </>
  );
}

function Options(props: { readonly label: string; readonly items: readonly V3OptionItem[]; readonly selected: string | undefined; readonly onPick: (id: string) => void }): ReactElement {
  return (
    <div className="v3-options" role="radiogroup" aria-label={props.label}>
      <span className="v3-label">{props.label}</span>
      <div className="v3-scroll">
        {props.items.map((it) => (
          <button key={it.id} role="radio" aria-checked={it.id === props.selected} className={it.id === props.selected ? 'on' : ''} title={it.name} onClick={() => props.onPick(it.id)}>
            <PresetPreview p={it.preview} size={20} /><span>{it.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chips(props: { readonly label: string; readonly items: readonly V3Button[]; readonly on: number; readonly onPick: (i: number) => void; readonly ui: string }): ReactElement {
  return (
    <div className="v3-chips" role="radiogroup" aria-label={props.label}>
      {props.items.map((q, i) => (
        <button key={q.id} role="radio" aria-checked={i === props.on} className={`${i === props.on ? 'on' : ''}${q.bind.todo ? ' coming' : ''}`} data-ui={`${props.ui}.${q.id}`}
          data-label={`${q.name}${q.bind.todo ? ' (coming)' : ''}${q.doc !== q.name ? `: ${q.doc}` : ''}`} onClick={() => props.onPick(i)}>
          {q.name}{q.bind.todo ? <i className="v3-pip" aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}

/** Simplified Mode: the sub-tool's presets and its plain sliders, under the tab's own name. */
function SimplifiedPanel(props: V3HudProps & { readonly t: V3Tab }): ReactElement {
  const { t } = props;
  const sub = t.simplified.subtools[props.slot] ?? t.simplified.subtools[0]!;
  const prefix = `${t.key}:${sub.id}:`;
  const changed = sub.sliders.some((s) => props.sliders[sliderKey(t, sub, s)] !== undefined);
  return (
    <section className="v3-panel" aria-label={t.simplified.title}>
      <header><b>{t.simplified.title}</b><span className="v3-sub">{sub.name}</span><Buttons words={props.words} /></header>
      <Chips label={`${sub.name} presets`} items={sub.presets} on={props.preset} onPick={props.onPreset} ui="island.preset" />
      {sub.sliders.length ? (
        <div className="v3-sliders">
          {sub.sliders.map((s) => <SliderRow key={s.id} s={s} value={sliderValue(props.sliders, t, sub, s)} live={props.drivesLive?.(s) ?? true}
            onChange={(v, done) => props.onSlider(s, sliderKey(t, sub, s), v, done)} onComing={() => props.onComing(s.name)} />)}
          {sub.id === 'ground-material' && props.onEditLook ? <button className="v3-reset" data-ui="island.surface-look" onClick={props.onEditLook}>Edit this ground's look</button> : null}
          <button className="v3-reset" disabled={!changed} onClick={() => props.onReset(prefix, sub)}>Reset</button>
        </div>
      ) : null}
    </section>
  );
}

/** One slider of Simplified Mode: a range, a toggle, a choice or a colour. One without an engine yet is shown, greyed, as coming. */
function SliderRow(props: { readonly s: V3Slider; readonly value: number; readonly live: boolean; readonly onChange: (v: number, done: boolean) => void; readonly onComing: () => void }): ReactElement {
  const { s } = props;
  const coming = !s.drives;
  const [drag, setDrag] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const v = drag ?? props.value;
  const onChange = props.onChange;
  // the browser's change event comes when the slider is let go (React's onChange is every step)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const end = (): void => { const n = Number(el.value); setDrag(null); onChange(n, true); };
    el.addEventListener('change', end);
    return () => el.removeEventListener('change', end);
  }, [onChange]);
  const title = coming ? `${s.name}: coming` : undefined;
  if (s.kind === 'toggle') {
    return (
      <button className={`v3-toggle${v ? ' on' : ''}${coming ? ' coming' : ''}`} aria-pressed={!!v} title={title} onClick={() => (coming ? props.onComing() : props.onChange(v ? 0 : 1, true))}>
        {s.name}<i aria-hidden="true">{v ? 'On' : 'Off'}</i>
      </button>
    );
  }
  if (s.kind === 'choice') {
    return (
      <span className={`v3-choice${coming ? ' coming' : ''}`} role="radiogroup" aria-label={s.name} title={title}>
        <span className="v3-label">{s.name}</span>
        {(s.choices ?? []).map((c, i) => <button key={c} role="radio" aria-checked={i === v} className={i === v ? 'on' : ''} onClick={() => (coming ? props.onComing() : props.onChange(i, true))}>{c}</button>)}
      </span>
    );
  }
  if (s.kind === 'color') {
    const hex = `#${Math.max(0, Math.min(0xffffff, Math.round(v || 0xd63e38))).toString(16).padStart(6, '0')}`;
    return (
      <label className={`v3-colour${coming ? ' coming' : ''}`} title={title}>
        <span className="v3-label">{s.name}</span>
        <input type="color" value={hex} disabled={coming} onChange={(e) => props.onChange(parseInt(e.target.value.slice(1), 16), true)} />
      </label>
    );
  }
  return (
    <label className={`v3-range${coming ? ' coming' : ''}`} title={title}>
      <span className="v3-label">{s.name}</span>
      <input ref={ref} type="range" min={s.min} max={s.max} step={s.step} value={v} disabled={coming}
        onChange={(e) => { const n = Number(e.target.value); setDrag(n); if (props.live) props.onChange(n, false); }} />
      <output>{fmt(s, v)}</output>
    </label>
  );
}

/** Advanced Mode: the tool in hand, its options, F3's presets, the filters and the keys. */
function AdvancedPanel(props: V3HudProps & { readonly t: V3Tab; readonly held: V3Button | null }): ReactElement {
  const { t, held } = props;
  const a = t.advanced;
  const o = held?.options;
  return (
    <section className="v3-panel adv" aria-label={`${a.name}: ${held?.name ?? ''}`}>
      <header><b>{held?.name ?? a.name}</b><span className="v3-sub">{held && held.doc !== held.name ? held.doc : a.name}</span><Buttons words={props.words} /></header>
      {o && held?.bind.todo !== true ? <Options label={o.label} items={props.options(o.source)} selected={props.palette[o.palette]} onPick={(id) => props.onOption(o.palette, id)} /> : null}
      {o?.source === 'paints' && props.onEditLook ? <div className="v3-sliders"><button className="v3-reset" data-ui="island.surface-look" onClick={props.onEditLook}>Edit this ground's look</button></div> : null}
      {a.presets ? <Chips label="Presets" items={a.presets} on={props.preset} onPick={(i) => props.onPreset(i === props.preset ? -1 : i)} ui="island.preset" /> : null}
      {a.filters.length ? (
        <div className="v3-filters" role="group" aria-label="Filters">
          {a.filters.map((f) => {
            const key = `${t.key}:${f.name}`, on = props.filters[key] !== false;
            return (
              <button key={f.name} className={`${on ? 'on' : ''}${f.todo ? ' coming' : ''}`} aria-pressed={on} data-label={f.todo ? `${f.name}: coming` : `${f.name}: ${on ? 'on' : 'off'}`}
                onClick={() => (f.todo ? props.onComing(f.name) : props.onFilter(key, !on, f))}>
                {f.name}{f.todo ? <i className="v3-pip" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <dl className="v3-keys" aria-label="Keys">
        {a.modifiers.map((x) => <div key={x.keys} className={x.todo ? 'coming' : ''} title={x.todo ? 'Coming' : undefined}><dt><kbd>{x.keys}</kbd></dt><dd>{x.does}</dd></div>)}
      </dl>
    </section>
  );
}

/** Find a tool (/): every button of the mode by name; arrows move, Enter takes you there, Esc closes. */
function FindTool(props: { readonly mode: V3Mode; readonly onFound: (f: V3Found) => void; readonly onClose: () => void }): ReactElement {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const all = useMemo(() => v3Find(props.mode), [props.mode]);
  const hits = useMemo(() => (q.trim() ? all.filter((x) => v3Matches(x.name, q)) : []).slice(0, 8), [all, q]);
  const go = (f: V3Found | undefined): void => { if (f) { props.onFound(f); props.onClose(); } };
  return (
    <div className="v3-find" role="dialog" aria-label="Find a tool">
      <input autoFocus value={q} placeholder="Find a tool" aria-label="Find a tool" aria-controls="v3-find-list" aria-activedescendant={hits[at] ? `v3-find-${at}` : undefined}
        onChange={(e) => { setQ(e.target.value); setAt(0); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); props.onClose(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(hits.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); go(hits[at]); }
          e.stopPropagation();
        }} />
      {q.trim() ? (
        hits.length ? (
          <ul id="v3-find-list" role="listbox" aria-label="Tools found">
            {hits.map((h, i) => (
              <li key={`${h.tab}-${h.slot}-${h.preset}-${h.name}`} id={`v3-find-${i}`} role="option" aria-selected={i === at} className={`${i === at ? 'on' : ''}${h.todo ? ' coming' : ''}`}
                onMouseEnter={() => setAt(i)} onClick={() => go(h)}>
                <b>{h.name}</b><span>{h.where}{h.todo ? ', coming' : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="v3-none">Nothing called that in {V3_MODES.find((x) => x.id === props.mode)?.name} Mode. Try a shorter word.</p>
      ) : null}
    </div>
  );
}
