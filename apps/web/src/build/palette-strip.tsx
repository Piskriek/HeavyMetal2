import { useRef, type ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PresetPreview } from './cards';
import type { Preview } from './catalog';

/**
 * The palette (docs/HOTBAR.md): a film strip at the top middle of the screen holding what the tool in your hand applies: the surfaces a way
 * to paint puts down, the shapes a stamp presses, the things you place. Yours first, then the community's; scroll buttons at both ends.
 * The tools stay on the hotbar; this is their material.
 */
export interface StripItem { readonly id: string; readonly name: string; readonly preview: Preview }

export function PaletteStrip(props: {
  /** What the strip holds, in a few words ("Paint with"). */
  readonly title: string;
  readonly items: readonly StripItem[];
  readonly community: readonly StripItem[];
  readonly selected: string | undefined;
  readonly onPick: (id: string) => void;
}): ReactElement {
  const reel = useRef<HTMLDivElement>(null);
  const roll = (dir: number): void => { const el = reel.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' }); };
  const frame = (it: StripItem): ReactElement => (
    <button key={it.id} className={`ps-frame${it.id === props.selected ? ' on' : ''}`} aria-pressed={it.id === props.selected} title={it.name} onClick={() => props.onPick(it.id)}>
      <PresetPreview p={it.preview} size={40} />
      <span>{it.name}</span>
    </button>
  );
  return (
    <div className="palette-strip" role="group" aria-label={props.title} data-ui="island.palette">
      <span className="ps-title">{props.title}</span>
      <button className="ps-roll" aria-label="Back along the palette" onClick={() => roll(-1)}><ChevronLeft size={16} strokeWidth={1.8} /></button>
      <div className="ps-reel" ref={reel}>
        {props.items.map(frame)}
        <span className="ps-split" aria-hidden="true">Community</span>
        {props.community.length ? props.community.map(frame) : <span className="ps-empty">Nothing shared here yet</span>}
      </div>
      <button className="ps-roll" aria-label="On along the palette" onClick={() => roll(1)}><ChevronRight size={16} strokeWidth={1.8} /></button>
    </div>
  );
}
