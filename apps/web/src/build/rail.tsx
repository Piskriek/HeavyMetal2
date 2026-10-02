import { type ReactElement } from 'react';
import { defineSchema } from '@hm/contracts';
import { describeTool, type PaletteWheel } from '@hm/buildkit';
import { findSub, TOOLSETS, type SubTool, type ToolSet } from '@hm/toolcatalog';
import { Inspector } from '@hm/ui';
import { renderThumb } from '../avatar/thumbs';
import { MODELS } from '@hm/voxelart';
import type { VoxelModel } from '@hm/voxel';
import type { HotItem } from './hotbar';
import { iconByName } from './icons';
import { swatchOf } from './palette';
import { isWired } from './wiring';

/**
 * The studio toolbar on the island: a rail of tool sets down the left edge, a slide-out beside it with the sub-tools of the open set and the
 * settings of the one in your hand, a line of words about the tool in hand, and the held-Tab preset palette. Esc closes the slide-out first.
 */

export function ToolRail(props: { readonly openSet: string | null; readonly activeSet: string | null; readonly locked: boolean; readonly onToggle: (setId: string) => void }): ReactElement {
  return (
    <nav className={props.locked ? 'tool-rail locked' : 'tool-rail'} aria-label="Tools">
      {TOOLSETS.map((s) => {
        const Icon = iconByName(s.icon);
        return (
          <button key={s.tool} className={`${props.openSet === s.tool ? 'open ' : ''}${props.activeSet === s.tool ? 'held' : ''}`} aria-label={s.label} aria-expanded={props.openSet === s.tool}
            data-label={`${s.label} (${s.hotkey}): ${s.doc}`} onClick={() => props.onToggle(s.tool)}>
            <Icon size={18} strokeWidth={1.5} />
          </button>
        );
      })}
    </nav>
  );
}

const TOOL_SCHEMA = defineSchema({
  kind: 'tool', version: 1, label: 'Tool', doc: 'The settings of the tool in your hand.', slots: [],
  variables: [
    { key: 'size', type: 'number', label: 'Size', doc: 'How wide the brush is, in metres.', tier: 'play', default: 4, min: 0.5, max: 40, step: 0.5, hardMin: 0.1, unit: 'm' },
    { key: 'strength', type: 'number', label: 'Strength', doc: 'How much each pass changes the ground.', tier: 'play', default: 0.4, min: 0, max: 1, step: 0.01, hardMin: 0, hardMax: 4 },
  ],
} as const);

const groupsOf = (set: ToolSet): { name: string; subs: SubTool[] }[] => {
  const out: { name: string; subs: SubTool[] }[] = [];
  for (const s of set.subtools) {
    let g = out.find((x) => x.name === s.group);
    if (!g) { g = { name: s.group, subs: [] }; out.push(g); }
    g.subs.push(s);
  }
  return out;
};

export function SlideOut(props: {
  readonly setId: string; readonly held: HotItem | null;
  readonly onPick: (set: ToolSet, sub: SubTool) => void;
  readonly onTune: (key: 'size' | 'strength', value: number) => void;
  readonly onClose: () => void;
}): ReactElement | null {
  const set = TOOLSETS.find((s) => s.tool === props.setId);
  if (!set) return null;
  const held = props.held && props.held.id.startsWith(`${set.tool}.`) ? props.held : null;
  const tunable = held && held.kind !== 'pick' && held.kind !== 'delete' && held.kind !== 'place';
  return (
    <aside className="tool-slide" role="region" aria-label={`${set.label} tools`}>
      <header><h3>{set.label}</h3><button onClick={props.onClose} aria-label="Close">Close</button></header>
      <p className="hint">{set.doc}</p>
      <div className="tool-groups">
        {groupsOf(set).map((g) => (
          <section key={g.name}>
            <h4>{g.name}</h4>
            <div className="tool-subs">
              {g.subs.map((sub) => {
                const Icon = iconByName(sub.icon);
                const wired = isWired(set.tool, sub.id);
                return (
                  <button key={sub.id} className={`${held?.id === `${set.tool}.${sub.id}` ? 'on ' : ''}${wired ? '' : 'soon'}`} data-label={`${sub.name}${sub.hotkey ? ` (${sub.hotkey})` : ''}: ${sub.doc}${wired ? '' : ' Not on the island yet.'}`} onClick={() => props.onPick(set, sub)}>
                    <Icon size={16} strokeWidth={1.5} /><span>{sub.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {tunable ? (
        <div className="tool-tune">
          <Inspector schema={TOOL_SCHEMA} params={{ size: held.size, ...(held.strength !== undefined ? { strength: held.strength } : {}) }} resolved={{ size: held.size, strength: held.strength ?? 0.4 }} tier="play"
            onChange={(k, v) => { if ((k === 'size' || k === 'strength') && typeof v === 'number') props.onTune(k, v); }} />
        </div>
      ) : null}
    </aside>
  );
}

/** The words on screen about the tool in your hand. Controls themselves are in Settings. */
export function ToolSay(props: { readonly item: HotItem | null }): ReactElement | null {
  const it = props.item;
  if (!it) return null;
  const [setId, subId] = it.id.split('.');
  const set = TOOLSETS.find((s) => s.tool === setId);
  const sub = setId && subId ? findSub(setId, subId) : undefined;
  const say = describeTool({ setLabel: set?.label ?? 'Tool', subName: sub?.name ?? it.label, doc: it.doc, primary: it.left ?? 'Use it', secondary: it.right ?? 'Do the opposite', wired: subId === undefined || isWired(setId!, subId) });
  return (
    <div className="tool-say" aria-live="polite">
      <b>{say.title}</b>
      <span>{say.line}</span>
      {sub && it.label !== sub.name ? <span className="inhand"><i>In hand</i> {it.label}</span> : null}
      <span className="btnsay"><i>Left</i> {say.left}</span>
      <span className="btnsay"><i>Right</i> {say.right}</span>
    </div>
  );
}

const thumbOf = (id: string): string => {
  const m = MODELS.find((x) => x.id === id);
  return m ? renderThumb(m.build() as unknown as VoxelModel, 64, 35) : '';
};

/** Opens while Tab is held. It never takes the pointer, so the world stays live; the wheel moves, Q and E change category, letting go of Tab keeps the choice. */
export function TabPalette(props: { readonly wheel: PaletteWheel; readonly tick: number }): ReactElement | null {
  const w = props.wheel;
  if (!w.isOpen) return null;
  const cat = w.categories[w.categoryIndex];
  if (!cat) return null;
  return (
    <div className="tab-palette" role="listbox" aria-label="Presets" data-tick={props.tick}>
      <div className="tp-cats">
        {w.categories.map((c, i) => <span key={c.id} className={i === w.categoryIndex ? 'on' : ''}>{c.label}</span>)}
        <em>Q and E change group. The wheel picks. Let go of Tab to keep it.</em>
      </div>
      <div className="tp-grid">
        {cat.items.map((it, i) => (
          <div key={it.id} role="option" aria-selected={i === w.itemIndex} className={i === w.itemIndex ? 'on' : ''} ref={i === w.itemIndex ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : undefined}>
            {cat.id === 'models' ? <img alt="" width={44} height={44} src={thumbOf(it.id)} /> : <i style={{ background: swatchOf(it.id) }} />}
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
