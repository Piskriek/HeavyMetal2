import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Navigator } from '@hm/uistack';

/**
 * The bar that sits at the top once you have dived in: hidden until you press Esc (or touch the top edge). It shows where you are in the
 * hierarchy Galaxy > Planet > Island > Goblin, jumps up one level (left arrow), into the selected one (right arrow), or all the way back to the galaxy.
 */
export type Level = 'galaxy' | 'planet' | 'island' | 'goblin';
const ORDER: readonly Level[] = ['galaxy', 'planet', 'island', 'goblin'];
const LABEL: Record<Level, string> = { galaxy: 'Galaxy', planet: 'My planet', island: 'My island', goblin: 'My goblin' };
const parentOf = (id: string): string | null => { const i = ORDER.indexOf(id as Level); return i > 0 ? ORDER[i - 1]! : null; };
const childrenOf = (id: string): string[] => { const i = ORDER.indexOf(id as Level); return i >= 0 && i < ORDER.length - 1 ? [ORDER[i + 1]!] : []; };

export function GalaxyBar(props: { readonly open: boolean; readonly level: Level; readonly onLevel: (l: Level) => void; readonly onBackToGalaxy: () => void }): ReactElement {
  const { open, level, onLevel, onBackToGalaxy } = props;
  const [hover, setHover] = useState(false);
  const nav = useMemo(() => new Navigator(parentOf, childrenOf, 'galaxy', level), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (nav.current() !== level) nav.zoomTo(level); }, [level, nav]);
  const crumbs = nav.breadcrumb((id) => LABEL[id as Level]);
  const shown = open || hover;
  const up = (): void => { const r = nav.zoomOut(); if (r === 'moved') onLevel(nav.current() as Level); else onBackToGalaxy(); };
  const into = (): void => { const next = childrenOf(nav.current())[0]; if (next && nav.zoomIn(next)) onLevel(next as Level); };
  return (
    <>
      <div className="galaxy-bar-edge" onPointerEnter={() => setHover(true)} aria-hidden="true" />
      <div className={`galaxy-bar${shown ? ' open' : ''}`} role="navigation" aria-label="Where you are" onPointerLeave={() => setHover(false)}>
        <button className="go" onClick={onBackToGalaxy}>Back to galaxy</button>
        <button aria-label="Up one level" title="Up one level" onClick={up}><ChevronLeft size={16} strokeWidth={1.6} /></button>
        <ol>{crumbs.map((c, i) => (
          <li key={c.id}>{i > 0 ? <span aria-hidden="true">›</span> : null}<button className={c.id === level ? 'on' : ''} onClick={() => (c.id === 'galaxy' || c.id === 'planet' ? onBackToGalaxy() : onLevel(c.id as Level))}>{c.label}</button></li>
        ))}</ol>
        <button aria-label="Into the selected" title="Into the selected" disabled={childrenOf(level).length === 0} onClick={into}><ChevronRight size={16} strokeWidth={1.6} /></button>
        <span className="hint">Esc</span>
      </div>
    </>
  );
}
